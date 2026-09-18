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
