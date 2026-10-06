// FIVE PRODUCTS BEFORE A SHOP IS APPROVED  (Mock 165, approved by Sana 6 Oct 2026)
//
// "He must add at least 5 products then Takal will approve his store
// otherwise Takal will not." - "the main admin can still approve the store
// without products uploaded from admin panel."
//
// The server makes the decision (backend/routers/restaurants_admin.py,
// approve_restaurant). This only decides which button the Stores list shows,
// so nobody clicks a button the server will refuse.

export const MIN_PRODUCTS = 5;

export type ApproveState = {
  /** Products the shop has, or null when the server did not count them
   *  (a live shop - not counted, so the page stays fast - or a failed count). */
  count: number | null;
  enough: boolean;
  /** approve = the usual green Approve; anyway = the main admin's "Approve
   *  anyway" (asks first); none = a grey Approve with the reason under it. */
  button: "approve" | "anyway" | "none";
  why: string;
};

export function approveState(shop: { product_count?: unknown } | null | undefined,
                             isMainAdmin: boolean): ApproveState {
  const raw = shop?.product_count;
  const count = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  const enough = count !== null && count >= MIN_PRODUCTS;
  if (enough) return { count, enough, button: "approve", why: "" };
  const why = count === null
    ? "Products could not be counted"
    : `Needs ${MIN_PRODUCTS} products — has ${count}`;
  return { count, enough, button: isMainAdmin ? "anyway" : "none", why };
}
