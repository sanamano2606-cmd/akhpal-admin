/**
 * A PRODUCT'S PICTURES, CHANGED STRAIGHT FROM THE PRODUCTS LIST.
 * (Mock 187, approved by Sana 13 October 2026: "i want the picture upload
 * easier as much as you can, direct from the product list.")
 *
 * One set of rules for every way a picture is added or changed in the list -
 * the square's "Change" and "+ Add", a drop of several photos, and the
 * Pictures box. Plain functions, so the rules are tested by running them
 * (tests/pictures-in-the-products-list.test.ts).
 *
 * THE TRAP THESE ARE CAREFUL ABOUT. A product imported from a spreadsheet has
 * its picture ONLY in menu_items.image_url - its photo list is empty. The
 * server's photo list REPLACES everything (PUT /menu/{id}/images) and then
 * makes the first photo the cover. So a list read as "empty" and sent back
 * with one new photo would quietly lose the imported picture. Here the
 * imported picture is read as photo 1, so it is always sent back with the
 * rest - and when the person really removes it, it is taken off properly
 * (see sendPictures).
 */

export type PictureRead = {
  /** The pictures in order - the first is the cover customers see. */
  list: string[];
  /** The picture that lives only in image_url (imported), or null. */
  imported: string | null;
};

const clean = (u: unknown) => String(u ?? "").trim();

/** What the product really has, read from the server's product. */
export function picturesOf(product: { images?: { url?: string | null }[] | null; image_url?: string | null } | null | undefined): PictureRead {
  const list = ((product?.images ?? []) as { url?: string | null }[]).map((i) => clean(i?.url)).filter(Boolean);
  const cover = clean(product?.image_url);
  if (list.length === 0 && cover) return { list: [cover], imported: cover };
  return { list: dedupe(list), imported: null };
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((u) => (u && !seen.has(u) ? (seen.add(u), true) : false));
}

/** "+ Add more": the new ones go to the end. A product with no picture: the
 *  first new one becomes the cover. */
export function withAdded(list: string[], urls: string[]): string[] {
  return dedupe([...list, ...urls.map(clean)]);
}

/** "Change": the first new picture REPLACES the cover; any others are added
 *  after the rest. Nothing else moves. */
export function withCoverChanged(list: string[], urls: string[]): string[] {
  const fresh = urls.map(clean).filter(Boolean);
  if (fresh.length === 0) return list.slice();
  return dedupe([fresh[0], ...list.slice(1), ...fresh.slice(1)]);
}

export function withRemoved(list: string[], i: number): string[] {
  return i < 0 || i >= list.length ? list.slice() : list.filter((_, j) => j !== i);
}

/** The body the server takes: position 0 is the cover. */
export const imagesBody = (list: string[]) => list.map((url, position) => ({ url, position }));

/** What the products list row shows afterwards. */
export const rowAfter = (list: string[]) => ({ image_url: list[0] ?? null, photo_count: list.length });

/** How the square's words read: "📷 3" when there is more than one. */
export const pictureCount = (photoCount: number | null | undefined, hasCover: boolean) =>
  Math.max(Number(photoCount) || 0, hasCover ? 1 : 0);

/**
 * Send the new list. The ONE door every change in the list goes through.
 *
 * An imported picture that the person removed: the server only clears a cover
 * that was IN the photo list and was taken out (product_extras._sync_cover -
 * on purpose, so the editor never wipes an imported picture by accident). So
 * it is first put into the list, then the new list is sent: the server then
 * sees it removed and clears it. Without this, the "removed" picture would
 * stay on the product for every customer.
 */
export async function sendPictures(
  api: { setProductImages: (id: string, images: { url: string; position: number }[]) => Promise<unknown> },
  productId: string,
  list: string[],
  imported: string | null,
): Promise<void> {
  if (imported && !list.includes(imported)) {
    await api.setProductImages(productId, imagesBody([imported]));
  }
  await api.setProductImages(productId, imagesBody(list));
}

/** Only pictures are taken - a PDF dropped by mistake is named, not sent. */
export function splitPictures(files: File[] | { name: string; type: string }[]) {
  const ok: any[] = [];
  const notPictures: string[] = [];
  for (const f of files as any[]) (String(f?.type || "").startsWith("image/") ? ok : notPictures).push(f);
  return { ok: ok as File[], notPictures: notPictures.map((f: any) => String(f?.name || "a file")) };
}

/** "3 pictures added", "Picture changed" - the words under the row. */
export function savedWords(how: "add" | "change", n: number): string {
  if (how === "change") return n > 1 ? `Picture changed, ${n - 1} more added` : "Picture changed";
  return n === 1 ? "Picture saved" : `${n} pictures saved`;
}
