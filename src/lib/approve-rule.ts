// APPROVE IS ALWAYS OPEN NOW (Sana, 29 Oct 2026: "all stores those applied can
// be approved but never shows to customers until all requirements fulfilled
// except money details"). The five products and the whole checklist no longer
// stop Approve - they lock the Main Admin's "Show to customers" switch instead
// (backend show_lock.py). `button` is therefore always "approve"; `why` still
// says what is missing, so the screen can tell the person before they approve.
//
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
  void isMainAdmin;
  if (enough) return { count, enough, button: "approve", why: "" };
  const why = count === null
    ? "Products could not be counted"
    : `Needs ${MIN_PRODUCTS} products — has ${count}`;
  return { count, enough, button: "approve", why };
}

// ── THE SERVER'S WHOLE CHECKLIST (audit 202, A3, 19 Oct 2026) ──────────────
//
// The 5-product rule above is only ONE of the things the server checks before
// it approves a shop. The approve door (restaurants_admin.py) also asks the
// whole checklist (vendor_intake.py still_missing_for_approval) - details,
// address and pin, hours, logo, a photo on every product, payout details, and
// now "Owner has signed in and accepted the Terms". The panel reads that same
// list from GET /admin/vendor-intake/shop/{id} and shows it as it comes, so a
// new check on the server appears here without a panel change.

/** One check, as the server sends it. */
export type ChecklistStep = { key: string; label: string; done: boolean; note?: string };

/** A shop's checklist, as GET /admin/vendor-intake/shop/{id} (and each shop
 *  of /admin/vendor-intake/waiting) sends it. */
export type ShopChecklist = {
  ready?: boolean;
  done?: number;
  total?: number;
  what_is_left?: string[];
  steps?: ChecklistStep[];
};

/** What is still missing BESIDES products (the products rule says that in its
 *  own words). [] = nothing; null = the checklist was not read. */
export function missingForApproval(list: ShopChecklist | null | undefined): string[] | null {
  if (!list) return null;
  if (Array.isArray(list.steps) && list.steps.length > 0) {
    return list.steps.filter((s) => !s.done && s.key !== "products").map((s) => s.label);
  }
  if (Array.isArray(list.what_is_left)) {
    return list.what_is_left.filter((x) => !/products$/.test(x));
  }
  return null;
}

/** The products rule AND the checklist together - the same order the server
 *  asks them. Approve is offered as ready only when nothing is missing; the
 *  main admin keeps "Approve anyway". Not read (null): the products rule
 *  alone, and the server checks the rest when Approve is pressed. */
export function approveWithChecklist(a: ApproveState, left: string[] | null,
                                     isMainAdmin: boolean): ApproveState {
  void isMainAdmin;
  if (!left || left.length === 0) return a;
  return { ...a, why: `Still missing: ${left.join(", ")}` };
}
