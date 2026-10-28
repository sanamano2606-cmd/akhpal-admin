/**
 * THE SHOP'S LOGO IN THE STORES LISTS (Sana, 28 October 2026: "i want to see
 * the vendors Logo here who has Uploaded and whose Not. The Shop logo size
 * must fit in the existing size line and when click on Logo should fully view").
 *
 * WHY THE LISTS SHOWED ONLY A TYPE SIGN. The 30 x 30 box was drawn for a
 * logo (Mock 203-1 v2), but GET /admin/restaurants did not send `image_url`,
 * so every row fell back to the type sign (a cart, a shirt) - also for the
 * waiting shops that HAD uploaded a logo.
 */

/** The small copy the server writes beside every upload (`_sm.webp`, about
 *  12 KB) - a list row never needs the full picture. Null for an address
 *  that is not one of Takal's own stored pictures. The same rule as the
 *  Partners app's `smallPictureUrl` (lib/widgets/net_img.dart). */
export function smallPictureUrl(url?: string | null): string | null {
  const u = (url || "").trim();
  if (!u.includes("/storage/v1/object/public/")) return null;
  if (u.includes("_sm.webp")) return u;
  const q = u.indexOf("?");
  const base = q === -1 ? u : u.slice(0, q);
  const dot = base.lastIndexOf(".");
  const slash = base.lastIndexOf("/");
  if (dot <= slash) return null;
  return `${base.slice(0, dot)}_sm.webp`;
}

/** The logo the row shows: the small copy first, else the picture itself.
 *  Empty when the shop has none. */
export function logoThumb(url?: string | null): string {
  const u = (url || "").trim();
  if (!u) return "";
  return smallPictureUrl(u) || u;
}

export function hasLogo(r: { image_url?: string | null } | null | undefined): boolean {
  return !!(r?.image_url || "").trim();
}
