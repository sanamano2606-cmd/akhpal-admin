// MOCK 217 - "HIDDEN BY TAKAL" (approved by Sana, 30 Oct 2026).
//
// The products the Takal Assistant hid (backend product_checks.py), as the
// office reads them. The reasons are the server's own Roman Urdu words, so
// the tags here are found BY those words - backend WHY_* in product_checks.py.

export interface FoundPicture {
  url: string;
  hits: { kind: string; text: string }[];
  boxes: { x0: number; y0: number; x1: number; y1: number }[];
  quality?: { width?: number; height?: number } | null;
}
export interface TakalHiddenProduct {
  id: string; restaurant_id: string; name: string; price?: number | null; image_url?: string | null;
  takal_hidden_at: string; takal_hidden_reason?: string | null; shop_name?: string;
  pictures_found?: FoundPicture[];
}

/** The server's reasons (backend product_checks.WHY_*), and the tag for each. */
export const WHY = {
  words: "naam ya tafseel mein phone number, website ya WhatsApp likha hai",
  picture: "tasveer mein phone number ya website hai",
  noPicture: "is ki koi tasveer nahi hai",
  noPrice: "is ki qeemat 0 hai",
} as const;

export function reasonTags(reason: string | null | undefined): string[] {
  const r = reason || "";
  const out: string[] = [];
  if (r.includes(WHY.picture)) out.push("Picture");
  if (r.includes(WHY.words)) out.push("Words");
  if (r.includes(WHY.noPicture)) out.push("No picture");
  if (r.includes(WHY.noPrice)) out.push("Price");
  return out.length ? out : ["Takal rule"];
}

/** What was found on the pictures, for the line beside the reason: "0328 2236600". */
export const foundText = (p: TakalHiddenProduct) =>
  [...new Set((p.pictures_found || []).flatMap((f) => f.hits.map((h) => h.text)).filter(Boolean))].join(", ");

/** A red box as percentages of the picture, so it sits right at any size.
 *  null when the picture's own size is not known (then no box is drawn -
 *  a box in the wrong place is worse than none). */
export function boxPercent(b: FoundPicture["boxes"][number], q: FoundPicture["quality"]) {
  const w = Number(q?.width) || 0, h = Number(q?.height) || 0;
  if (w <= 0 || h <= 0) return null;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return { left: clamp((b.x0 / w) * 100), top: clamp((b.y0 / h) * 100),
    width: clamp(((b.x1 - b.x0) / w) * 100), height: clamp(((b.y1 - b.y0) / h) * 100) };
}

/** The picture to show for a row: the one where something was found, else the main one. */
export const pictureOf = (p: TakalHiddenProduct) => p.pictures_found?.[0]?.url || p.image_url || "";

/** The Show again question's words. */
export function showAgainWords(p: TakalHiddenProduct): string {
  return `The Takal Assistant hid it because: ${p.takal_hidden_reason || "it broke a Takal rule"}. `
    + "It goes back to how it was before for customers now, and the Assistant will not hide it again "
    + "for the same picture and words. A new change by the vendor is checked as usual.";
}
