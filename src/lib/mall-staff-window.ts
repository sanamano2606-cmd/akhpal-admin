/**
 * THE STAFF WINDOW OF A MALL - the small rules its screens share.
 * (Mock 172-4 and 172-5, approved by Sana 8 October 2026; Step 5, 9 Oct 2026.)
 *
 * Sana, 8 October 2026: "staff log in should have access to all stores of
 * that Mall." One login, a row of store buttons at the top, "All stores" as
 * one overview, and a mall order as ONE order even though each store packs
 * its own part.
 *
 * THESE HELPERS ARE NOT THE LOCK. The server decides what a staff login may
 * read and do (core_auth.require_shop_side, routers/orders_status.py
 * STAFF_STEPS). They only decide what the screen offers and how it reads.
 */
import type { StaffMe } from "./api-people";
import type { ShopOrder } from "./api-orders";

export type StaffShop = StaffMe["shop"];

/** Every store this login may manage, home first - or just the home store
 *  (a one-shop login, or a server from before 8 Oct 2026). */
export function staffStores(me: StaffMe | null | undefined): StaffShop[] {
  if (!me?.shop) return [];
  const list = Array.isArray(me.shops) && me.shops.length ? me.shops : [me.shop];
  const seen = new Set<string>();
  return list.filter((s) => s && !seen.has(String(s.id)) && seen.add(String(s.id)));
}

/** A whole-mall login: it gets the store buttons, "All stores" and Orders.
 *  A one-shop login keeps its window exactly as it was. */
export function isMallLogin(me: StaffMe | null | undefined): boolean {
  return !!me?.mall && staffStores(me).length > 1;
}

/** Which store the window is on: "all", or one of the login's own stores.
 *  Anything else (a store taken out of the mall since, a typed address)
 *  falls back - "all" for a mall login, the home store otherwise. */
export function pickedStore(asked: string | null | undefined, me: StaffMe | null | undefined): string {
  const stores = staffStores(me);
  if (!stores.length) return "";
  if (isMallLogin(me)) {
    if (asked && stores.some((s) => String(s.id) === asked)) return asked;
    return "all";
  }
  return String(stores[0].id);
}

/** The steps a store's order is still in the store for. After "ready" it is
 *  Takal's (the office collects it). */
export const LIVE = ["pending", "accepted", "preparing", "ready"] as const;
const rank = (s: string) => {
  const i = (LIVE as readonly string[]).indexOf(s);
  return i < 0 ? 99 : i;
};

export type WholeOrder = {
  /** The lead part's id for a mall order, the order's own id otherwise. */
  key: string;
  isMall: boolean;
  parts: ShopOrder[];
  /** The step the WHOLE order is at - its slowest part. */
  stage: "new" | "accepted" | "packing" | "ready";
  createdAt: string;
};

/** Parts of one mall basket become ONE order on the screen; every other
 *  order stands alone. Only orders still in the store; newest last within
 *  "new", and new ones first. */
export function wholeOrders(orders: ShopOrder[]): WholeOrder[] {
  const groups = new Map<string, ShopOrder[]>();
  for (const o of orders) {
    if (!(LIVE as readonly string[]).includes(String(o.status))) continue;
    const key = String(o.mall_order_id || o.id);
    const g = groups.get(key) || [];
    if (!g.some((x) => String(x.id) === String(o.id))) g.push(o);
    groups.set(key, g);
  }
  const out: WholeOrder[] = [];
  groups.forEach((parts, key) => {
    const slowest = parts.reduce((m, p) => Math.min(m, rank(String(p.status))), 99);
    const stage = (["new", "accepted", "packing", "ready"] as const)[Math.min(slowest, 3)];
    const createdAt = parts.map((p) => p.created_at).sort()[0] || "";
    // The lead part first, then the others in the order they were made.
    parts.sort((a, b) => (String(a.id) === key ? -1 : String(b.id) === key ? 1 : 0)
      || String(a.created_at).localeCompare(String(b.created_at)));
    out.push({ key, isMall: parts.some((p) => !!p.mall_order_id), parts, stage, createdAt });
  });
  const order = { new: 0, accepted: 1, packing: 2, ready: 3 };
  return out.sort((a, b) => order[a.stage] - order[b.stage] || a.createdAt.localeCompare(b.createdAt));
}

/** What one press does to each part of a whole order:
 *    accept - every NEW part is accepted
 *    ready  - every accepted or packing part is marked ready
 *    reject / cancel - the WHOLE order stops (a mall order is stopped
 *             together): a new part is "rejected", a part already taken is
 *             "cancelled". The server allows both only while it is in the store.
 *  A part already past that step is left alone, so pressing again after a
 *  half-finished try only finishes the rest. */
export type WholeAction = "accept" | "ready" | "reject" | "cancel";
export function partsFor(o: WholeOrder, action: WholeAction): { id: string; to: string }[] {
  const pick = (from: string[], to: string) =>
    o.parts.filter((p) => from.includes(String(p.status))).map((p) => ({ id: String(p.id), to }));
  switch (action) {
    case "accept": return pick(["pending"], "accepted");
    case "ready": return pick(["accepted", "preparing"], "ready");
    case "reject":
    case "cancel":
      return [...pick(["pending"], "rejected"), ...pick(["accepted", "preparing", "ready"], "cancelled")];
  }
}

/** The buttons a whole order shows at its step. */
export function actionsAt(o: WholeOrder): WholeAction[] {
  if (o.stage === "new") return ["reject", "accept"];
  if (o.stage === "accepted" || o.stage === "packing") return ["cancel", "ready"];
  return ["cancel"];
}

/** The store's own prices for the whole order (Takal's money never reaches
 *  a staff login). A part the server could not price counts as nothing. */
export function storePrices(o: WholeOrder): number {
  return o.parts.reduce((t, p) => t + (Number(p.vendor_subtotal) || 0), 0);
}

/** A store's new logo, everywhere the window shows that store - its home
 *  copy and its line in the mall's list - without reading everything again
 *  (a reload would wipe boxes half-typed in Store settings). */
export function withNewLogo(me: StaffMe, storeId: string, url: string | null): StaffMe {
  const put = (s: StaffShop) => (String(s.id) === String(storeId) ? { ...s, image_url: url } : s);
  return { ...me, shop: put(me.shop), ...(me.shops ? { shops: me.shops.map(put) } : {}) };
}

/** The address of the window: ?store= and ?tab=, so a refresh or a link
 *  opens the same store and tab. Products and the home choice stay off it. */
export function windowAddress(href: string, store: string, tab: string, home: string): string {
  const u = new URL(href);
  if (!store || store === home) u.searchParams.delete("store");
  else u.searchParams.set("store", store);
  if (tab === "products") u.searchParams.delete("tab");
  else u.searchParams.set("tab", tab);
  return u.toString();
}
