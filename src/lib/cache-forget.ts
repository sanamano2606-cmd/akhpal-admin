/**
 * WHICH SAVED COPIES A WRITE FORGETS (page reload audit, Fix D, 10 Nov 2026).
 *
 * The panel keeps a copy of each list it read for up to 60 seconds, so pages
 * open at once (api-core.ts). After a write, copies that may now be out of
 * date must be forgotten, or a page would show the figures from BEFORE the
 * button was pressed.
 *
 * Every write forgets EVERY copy - with ONE exception. The background picture
 * reader (useBackgroundPictureReader) saves what it read from product and logo
 * pictures every ~20 seconds while the panel is open. That save used to wipe
 * the copies of Orders, Payments, Customers... too, so every page opened
 * slower all day. What a picture check can change is only about SHOPS and
 * their PRODUCTS, so that one save forgets only the copies under
 * SHOP_ADDRESSES. A copy kept by mistake would show an old figure - so the
 * exception is kept this narrow on purpose.
 */

export const PICTURE_SAVE = /^\/admin\/pictures\/read(\?|$)/;

export const SHOP_ADDRESSES = [
  "/admin/stores", "/admin/restaurants", "/admin/vendor-intake",
  "/admin/pictures", "/admin/products", "/admin/shelf-check", "/admin/sorting",
  "/admin/photo-checks", "/restaurants", "/menu",
];

/** True when a write to `path` forgets every saved copy (almost every write). */
export function forgetsEverything(path: string): boolean {
  return !PICTURE_SAVE.test(path);
}

/** True when the saved copy `key` (a full address or a path) is about shops or
 *  their products - the only copies the picture reader's save forgets. */
export function isShopCopy(key: string): boolean {
  let where = key;
  try { where = new URL(key).pathname; } catch { /* already a path */ }
  return SHOP_ADDRESSES.some((p) => where === p || where.startsWith(p + "/") || where.startsWith(p + "?"));
}
