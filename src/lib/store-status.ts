// ONE SHOP'S TRUE STATUS (Stores page fix 3, 12 Oct 2026).
//
// The same four states the Stores list shows (stores/page.tsx deriveStatus),
// and the server works out for the store page (routers/admin_stores.py
// `state.status`). The store page used to read only is_approved, so a
// suspended shop said "Approved" and a rejected one "Waiting for approval".

export type StoreStatus = "approved" | "pending" | "suspended" | "rejected";

/** The server's answer when it gave one, else worked out the same way. */
export function storeStatusOf(r: any, serverSays?: string | null): StoreStatus {
  if (serverSays === "approved" || serverSays === "pending"
      || serverSays === "suspended" || serverSays === "rejected") return serverSays;
  return r?.suspended_at ? "suspended"
    : r?.is_approved ? "approved"
    : r?.rejected_at ? "rejected"
    : "pending";
}
