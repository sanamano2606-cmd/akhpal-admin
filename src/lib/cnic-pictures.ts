/**
 * A RIDER'S CNIC PICTURES - the rules, kept in a .ts file so plain Node can
 * test them (Mock 163, approved by Sana on 5 October 2026).
 *
 * The rider app now asks for a photo of BOTH sides of the CNIC when a rider
 * signs up. The pictures are kept in a PRIVATE store: the panel never gets an
 * address that lasts. It asks the server for links that work for 10 minutes
 * (GET /admin/riders/{id}/cnic-pictures), and the server writes every such
 * look in the Audit Log.
 *
 * Riders who signed up before this have none. They are NOT blocked (Sana:
 * "what ever your recommendation") - the panel warns before approving one,
 * and the rider app asks him for them on his Profile page.
 */

/** How long a link lasts, in seconds - the same 600 as the server's
 *  SIGNED_LINK_SECONDS in backend/rider_documents.py. */
export const CNIC_LINK_SECONDS = 600;

/** A link is re-asked for a minute before it would run out, so "Open full
 *  size" never opens a dead one. */
export const CNIC_LINK_REFRESH_AFTER_MS = (CNIC_LINK_SECONDS - 60) * 1000;

export type CnicPictures = {
  cnic?: string | null;
  front?: string | null;
  back?: string | null;
  has_front?: boolean;
  has_back?: boolean;
  sent_at?: string | null;
  expires_in?: number | null;
};

const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Does this rider row say anything about CNIC pictures at all? A server from
 *  before migration 122 has no such columns - then nothing is warned about. */
export function cnicPicturesKnown(rider: any): boolean {
  return !!rider && ("cnic_front_path" in rider || "cnic_back_path" in rider);
}

/** Has this rider sent BOTH sides? */
export function hasBothCnicPictures(rider: any): boolean {
  return !!rider && filled(rider.cnic_front_path) && filled(rider.cnic_back_path);
}

/** Should Approve ask first? Only when the row says the pictures are missing. */
export function approveNeedsCnicWarning(rider: any): boolean {
  return cnicPicturesKnown(rider) && !hasBothCnicPictures(rider);
}

/** Which sides are missing, in words: "both sides", "the back", "the front". */
export function missingCnicSides(rider: any): string {
  const front = filled(rider?.cnic_front_path);
  const back = filled(rider?.cnic_back_path);
  if (!front && !back) return "both sides";
  if (!front) return "the front";
  if (!back) return "the back";
  return "";
}

/** Is a link fetched at `fetchedAt` (ms) still safe to open at `now` (ms)? */
export function cnicLinkStillGood(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < CNIC_LINK_REFRESH_AFTER_MS;
}

/** Only a link to Takal's own picture store is ever shown or opened. */
export function isSafeCnicLink(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.pathname.includes("/storage/v1/object/sign/rider-documents/");
  } catch {
    return false;
  }
}
