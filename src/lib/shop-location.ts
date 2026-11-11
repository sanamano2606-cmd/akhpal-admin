// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP'S PLACE IS ONE THING: A MAP PIN, WITH ITS ADDRESS.
//
// Mock 85, approved by Sana 17 September 2026:
//   "Why i need to set location and then put the address this is totally
//    confusion. There should be Address bar and pick location On Map..."
//
// The pin is what every distance, delivery fee and rider direction uses. The
// address is the words people read. They used to be two separate boxes that
// could say two different places. Now there is one "Shop location" box, and
// these are its rules - plain functions, so the tests can check them without
// a browser. The vendor app follows the same rules
// (restaurant_app/lib/widgets/shop_location_rules.dart).
// ─────────────────────────────────────────────────────────────────────────────

/** FIX 9 (All Stores audit 9 Nov 2026; Sana: "Go Fix 9"): the Google Maps
 *  link inside what was pasted, or "" when there is none. A vendor's WhatsApp
 *  location is a SHORT link (https://maps.app.goo.gl/AbC123) with no numbers
 *  in it, so the panel asks the server to open it (GET /geocode/map-link).
 *  Only Google Maps addresses count - the server checks the same again.
 *    "Shop: https://maps.app.goo.gl/AbC123 thanks" -> "https://maps.app.goo.gl/AbC123"
 *    "https://example.com/x" -> ""                                              */
export const MAP_LINK_WAIT_MS = 35000;
export const MAP_LINK_UNREAD =
  "Could not read that link - open it in Google Maps, then copy the numbers instead";

export function mapLinkIn(text: string): string {
  const m = /https:\/\/[^\s]+/i.exec(text || "");
  if (!m) return "";
  const url = m[0].replace(/[).,;'"]+$/, "");
  let u: URL;
  try { u = new URL(url); } catch { return ""; }
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return url;
  if (host === "goo.gl" && u.pathname.startsWith("/maps")) return url;
  if (/^maps\.google\.com(\.pk)?$/.test(host)) return url;
  if (/^(www\.)?google\.com(\.pk)?$/.test(host) && u.pathname.startsWith("/maps")) return url;
  return "";
}

/** A place found by the search bar (GET /geocode/search). */
export type FoundPlace = {
  name: string;
  detail: string;
  address: string;
  lat: number;
  lon: number;
};

/** The shortest search the server will look up. Anything shorter is ignored
 *  here too, so typing "gr" never sends a request. */
export const PLACE_SEARCH_MIN = 3;

/** What to search for, or null when the text is too short to bother. */
export function searchText(typed: string): string | null {
  const t = String(typed ?? "").split(/\s+/).filter(Boolean).join(" ");
  return t.length >= PLACE_SEARCH_MIN ? t.slice(0, 100) : null;
}

/** FIX 10 (All Stores audit; Sana 10 Nov 2026: "only the pins that pointed
 *  outside MINGORA and Matta should be marked - the pins can be anywhere in
 *  Pakistan"). NOTHING IS BLOCKED: a pin anywhere saves as before. A pin more
 *  than HOME_TOWN_KM from BOTH towns only gets an orange mark, so a wrong pin
 *  (two shops were pinned in Karachi) is easy to see.
 *  Matta is Matta BAZAAR (Zaman / Gulab Market), where 23 live Matta shops are
 *  pinned - not Wikipedia's point, which is 21 km away from them. Mingora is
 *  the same point the map opens on.
 *    Green Chowk, Mingora (34.7717, 72.3600)  -> no mark
 *    Gulab Market, Matta  (34.9249, 72.4144)  -> no mark
 *    Karachi              (24.86, 67.01)      -> marked                       */
export const HOME_TOWNS = [
  { name: "Mingora", lat: 34.7795, lon: 72.3607 },
  { name: "Matta", lat: 34.925, lon: 72.4144 },
] as const;
export const HOME_TOWN_KM = 10;
export const PIN_OUTSIDE_LABEL = "Outside Mingora / Matta";

/** Straight-line kilometres between two points. */
export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2
    + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** How far the pin is from the nearer town, or null when there is no pin. */
export function nearestHomeTown(lat: unknown, lon: unknown): { name: string; km: number } | null {
  if (!hasPin(lat, lon)) return null;
  const la = Number(lat), lo = Number(lon);
  let best = { name: "", km: Infinity };
  for (const t of HOME_TOWNS) {
    const km = kmBetween(la, lo, t.lat, t.lon);
    if (km < best.km) best = { name: t.name, km };
  }
  return best;
}

/** True only for a REAL pin more than HOME_TOWN_KM from both towns. No pin
 *  is not "outside" - it already has its own "No pin" mark. */
export function pinOutsideHomeTowns(lat: unknown, lon: unknown): boolean {
  const n = nearestHomeTown(lat, lon);
  return n !== null && n.km > HOME_TOWN_KM;
}

/** The hover words for the mark: "Pin is 1,214 km from Mingora - check it." */
export function pinOutsideWords(lat: unknown, lon: unknown): string {
  const n = nearestHomeTown(lat, lon);
  if (!n) return "";
  return `Pin is ${Math.round(n.km).toLocaleString("en-US")} km from ${n.name} - check it is the shop's real place. It can still be saved.`;
}

/** Is this a real pin? 0,0 and half a pin are "no pin". */
export function hasPin(lat: unknown, lon: unknown): boolean {
  if (lat === "" || lon === "" || lat == null || lon == null) return false;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

/**
 * THE PIN MOVED AND THE MAP SAYS IT IS NOW AT `found`. WHAT HAPPENS TO THE
 * ADDRESS?
 *
 *   "fill" - put `found` in the address box. Only when the box is empty, or
 *            still holds exactly what this box filled in last time (the person
 *            never changed it), so nothing a person typed is ever lost.
 *   "ask"  - the person wrote their own address. Show "Use new address /
 *            Keep mine" instead of overwriting it.
 *   "keep" - nothing to do (no answer from the map, or it already matches).
 */
export function afterPinMoved(
  typed: string,
  lastFilled: string,
  found: string,
): "fill" | "ask" | "keep" {
  const t = String(typed ?? "").trim();
  const f = String(found ?? "").trim();
  if (!f) return "keep";
  if (t === f) return "keep";
  if (!t || t === String(lastFilled ?? "").trim()) return "fill";
  return "ask";
}

/** The address as saved: trimmed, and never longer than the server allows. */
export function savedAddress(typed: string): string {
  return String(typed ?? "").trim().slice(0, 300);
}

/** Google Maps directions to the pin - exactly what the rider app opens. */
export function riderDirectionsLink(lat: unknown, lon: unknown): string {
  if (!hasPin(lat, lon)) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lon)}&travelmode=driving`;
}

/** What one save sends: the pin and its address TOGETHER, or an error. */
export function locationBody(
  lat: unknown,
  lon: unknown,
  address: string,
): { ok: true; body: { latitude: number; longitude: number; address: string } }
  | { ok: false; error: string } {
  if (!hasPin(lat, lon)) {
    return { ok: false, error: "Put the shop on the map — customers cannot see it without this" };
  }
  const a = savedAddress(address);
  if (!a) return { ok: false, error: "Shop address is required" };
  return { ok: true, body: { latitude: Number(lat), longitude: Number(lon), address: a } };
}
