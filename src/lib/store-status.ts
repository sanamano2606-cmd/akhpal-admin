// ONE SHOP'S TRUE STATUS (Stores page fix 3, 12 Oct 2026).
//
// The same four states the Stores list shows (stores/page.tsx deriveStatus),
// and the server works out for the store page (routers/admin_stores.py
// `state.status`). The store page used to read only is_approved, so a
// suspended shop said "Approved" and a rejected one "Waiting for approval".

//
// MOCK 207 (migration 146, Sana 23 Oct 2026) adds a fifth: "hidden" - Takal
// APPROVED the shop (approved_at) but the Main Admin has not switched it on
// for customers yet (is_approved, the one flag every customer door reads).
// The same rule as backend/shop_visibility.py and the Partners app's
// lib/utils/shop_approval.dart.

export type StoreStatus = "approved" | "hidden" | "pending" | "suspended" | "rejected";

/** The server's answer when it gave one, else worked out the same way. */
export function storeStatusOf(r: any, serverSays?: string | null): StoreStatus {
  if (serverSays === "approved" || serverSays === "pending" || serverSays === "hidden"
      || serverSays === "suspended" || serverSays === "rejected") return serverSays;
  return r?.suspended_at || r?.is_suspended ? "suspended"
    : r?.is_approved ? "approved"
    : r?.rejected_at ? "rejected"
    : r?.approved_at ? "hidden"
    : "pending";
}
