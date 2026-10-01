// ─────────────────────────────────────────────────────────────────────────────
// WHICH PHOTO BELONGS TO WHICH PRODUCT.  (Mock 132 step 4, 30 September 2026.)
//
// A Mall hands over a folder of photos named after the products:
//     coca-cola-1.5L.jpg      ->  "Coca Cola 1.5 L"
//     Surf_Excel_1kg (2).png  ->  "Surf Excel 1 kg"   (a second photo of it)
//     IMG_2231.jpg            ->  nobody knows - the person picks
//
// THE RULES, AND WHY
//   * A photo is MATCHED only when its cleaned-up name is exactly one
//     product's cleaned-up name. Anything less certain is shown to the person
//     with the closest products to choose from - a wrong picture on a product
//     is worse than no picture, because nobody goes looking for it.
//   * A product that ALREADY has a picture is SKIPPED. A product imported from
//     a spreadsheet can have its picture only in image_url, and a new photo
//     would become its cover and hide it (product_extras._sync_cover). More
//     photos for such a product are added in its own editor.
//   * Several photos of one product keep their order: the first is the cover.
//
// Pure functions only - no network, no screen - so they are tested directly
// in tests/many-pictures.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type NameEntry = { id: string; name: string; has_picture: boolean };

export type PhotoPlan =
  | { kind: "matched"; productId: string; productName: string }
  | { kind: "already"; productId: string; productName: string }
  | { kind: "pick"; candidates: NameEntry[] }
  | { kind: "not_picture" };

const PICTURE_ENDING = /\.(jpe?g|png|webp|gif)$/i;
const UNITS = "kg|g|gm|gram|grams|mg|ml|l|ltr|litre|liter|lt|pcs|pc|pack|x|cm|mm|inch|oz";

/** One way of writing a name, so "Coca-Cola 1.5 L" and "coca_cola_1.5l" agree. */
export function cleanName(text: string): string {
  let s = String(text || "").toLowerCase();
  s = s.replace(/[_\-–—]+/g, " ");
  // Keep the dot in 1.5 - it is part of the size, not punctuation.
  s = s.replace(/(\d)\.(\d)/g, "$1\u0001$2");
  // Letters (any alphabet, Urdu included), digits and spaces only.
  s = s.replace(/[^\p{L}\p{N}\u0001 ]+/gu, " ");
  s = s.replace(/\u0001/g, ".");
  // "1.5 l" and "1.5l" are the same size.
  s = s.replace(new RegExp(`(\\d)\\s+(${UNITS})(?=\\s|$)`, "g"), "$1$2");
  return s.replace(/\s+/g, " ").trim();
}

/** The name a FILE is trying to say: no ending, no "(2)", no " copy". */
export function fileKey(fileName: string): string {
  const base = String(fileName || "").split(/[\\/]/).pop() || "";
  const noEnding = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  return cleanName(noEnding.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+copy$/i, ""));
}

/** Is this file a picture the server will take? (JPG, PNG, WebP, GIF.) */
export function isPictureFile(fileName: string, type?: string): boolean {
  if (type && /^image\/(jpeg|png|webp|gif)$/.test(type)) return true;
  return PICTURE_ENDING.test(String(fileName || ""));
}

function words(s: string): Set<string> {
  return new Set(s.split(" ").filter(Boolean));
}

/** How alike two cleaned names are, 0 to 1 (shared words / all words). */
export function likeness(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  A.forEach((w) => { if (B.has(w)) both += 1; });
  return both / (A.size + B.size - both);
}

export const CLOSE_ENOUGH_TO_OFFER = 0.34;
export const CANDIDATES_SHOWN = 3;

/** Build the lookup once for a whole folder - 3,000 products, 3,000 photos. */
export function makeMatcher(products: NameEntry[]) {
  const byClean = new Map<string, NameEntry[]>();
  const cleaned = products.map((p) => ({ p, c: cleanName(p.name) }));
  for (const { p, c } of cleaned) {
    if (!c) continue;
    const list = byClean.get(c) || [];
    list.push(p);
    byClean.set(c, list);
  }

  const closest = (key: string): NameEntry[] =>
    cleaned
      .map(({ p, c }) => ({ p, s: likeness(key, c) }))
      .filter((x) => x.s >= CLOSE_ENOUGH_TO_OFFER && !x.p.has_picture)
      .sort((x, y) => y.s - x.s || x.p.name.localeCompare(y.p.name))
      .slice(0, CANDIDATES_SHOWN)
      .map((x) => x.p);

  const exact = (key: string): PhotoPlan | null => {
    const hits = byClean.get(key);
    if (!hits || hits.length === 0) return null;
    if (hits.length > 1) {
      // Two products with the same name - a person has to say which.
      return { kind: "pick", candidates: hits.filter((h) => !h.has_picture).slice(0, CANDIDATES_SHOWN) };
    }
    const p = hits[0];
    return p.has_picture
      ? { kind: "already", productId: p.id, productName: p.name }
      : { kind: "matched", productId: p.id, productName: p.name };
  };

  return (fileName: string, type?: string): PhotoPlan => {
    if (!isPictureFile(fileName, type)) return { kind: "not_picture" };
    const key = fileKey(fileName);
    const hit = exact(key);
    if (hit) return hit;
    // "coca cola 1.5l 2" - a second photo numbered at the end.
    const m = /^(.*\S) \d{1,2}$/.exec(key);
    if (m) {
      const again = exact(m[1]);
      if (again) return again;
    }
    return { kind: "pick", candidates: closest(key) };
  };
}

/** Where each photo goes in its product's list: the first is the cover (0),
 *  the next 1, 2, ... in the order the photos were chosen. */
export function positionsFor(productIds: (string | null)[]): (number | null)[] {
  const seen = new Map<string, number>();
  return productIds.map((id) => {
    if (!id) return null;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return n;
  });
}
