// A PHARMACY'S LICENCE  (Mock 208-4, approved by Sana 26 October 2026)
//
// Sana: "IF ANY NEW PHARMACY CREATE THEY COULD NOT CREATE ONE WITHOUT THE
// LICENSES." The SERVER is the rule (backend/shop_licence.py): a new shop of
// type "pharmacy" needs a licence number, a valid-until date and a photo, and
// Approve stays locked until the office marks the licence OK. This file only
// holds the words and colours the panel shows, so every screen says the same.

/** The store type that needs a licence - "Health & Pharmacy". */
export const PHARMACY_TYPES = ["pharmacy"];

export const needsLicence = (vendorType?: string | null) =>
  PHARMACY_TYPES.includes(String(vendorType || "").trim().toLowerCase());

export type LicenceState = "none" | "missing" | "expired" | "waiting" | "expiring" | "ok";

export type ShopLicence = {
  needs_licence: boolean;
  state: LicenceState;
  number: string | null;
  valid_until: string | null;      // "YYYY-MM-DD"
  has_photo: boolean;
  ok_at: string | null;
  photo_link?: string | null;      // a 10-minute link; the photo itself is private
};

/** What each state is called, and its colour (Takal palette). */
export const LICENCE_STATE: Record<LicenceState, { label: string; tone: string }> = {
  none: { label: "", tone: "" },
  missing: { label: "Licence missing", tone: "bg-takal-red-soft text-takal-red" },
  expired: { label: "Licence expired", tone: "bg-takal-red-soft text-takal-red" },
  waiting: { label: "Licence not checked", tone: "bg-takal-yellow-soft text-takal-ink" },
  expiring: { label: "Licence runs out soon", tone: "bg-takal-orange-soft text-takal-orange" },
  ok: { label: "✓ valid", tone: "bg-takal-green-soft text-takal-green" },
};

/** "2027-12-31" -> "31 Dec 2027". Anything unreadable comes back as it was. */
export function licenceDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** What the Create store form must have before Next opens, for a pharmacy.
 *  The same three things the server refuses without - the form only says it
 *  sooner. Example: missingForNewPharmacy({number:"", until:"", photo:""})
 *  -> ["Licence number", "Valid until", "Licence photo"]. */
export function missingForNewPharmacy(l: { number?: string; until?: string; photo?: string }): string[] {
  const out: string[] = [];
  if (String(l.number || "").trim().length < 3) out.push("Licence number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(l.until || ""))) out.push("Valid until");
  if (!/^lic-[0-9a-f]{32}\.(jpg|png|webp)$/.test(String(l.photo || ""))) out.push("Licence photo");
  return out;
}
