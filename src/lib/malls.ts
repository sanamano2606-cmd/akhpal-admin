/**
 * MALLS IN THE PANEL - the small rules every mall screen shares.
 * (Mock 172-6, approved by Sana 8 October 2026; Step 4, 9 October 2026.)
 *
 * Sana: "if i add a Mall like this in Future, so all must be same as this
 * one." So the words and the money rules for a mall live in ONE place, and the
 * Malls list, a mall's page and Create store all say the same thing.
 *
 * The rules themselves are the SERVER's (backend/routers/malls.py): one owner,
 * one delivery speed, not in another mall, a logo, whole rupees. These helpers
 * only decide what the screen offers and how it reads.
 */
import type { Mall, MallStore, MallStoreChoice } from "./api-stores";
import { money } from "./format.ts";

/** A whole-rupee amount typed into a box: a number, null for an empty box
 *  when `emptyMeans` is null, or the words to show under the box. */
export function wholeRupees(
  typed: string,
  emptyMeans: number | null = 0,
): { value: number | null; error: string | null } {
  const t = (typed ?? "").trim().replace(/,/g, "");
  if (!t) return { value: emptyMeans, error: null };
  if (!/^\d+$/.test(t)) return { value: null, error: "Whole rupees only, e.g. 1000" };
  const n = Number(t);
  if (n > 1_000_000) return { value: null, error: "That is too large" };
  return { value: n, error: null };
}

/** "One · Rs 150 (standard fee)" - the delivery line of a mall. */
export function deliveryText(mall: Pick<Mall, "admin_delivery_fee">, standardFee: number | null): string {
  if (mall.admin_delivery_fee != null) {
    return `One · ${money(mall.admin_delivery_fee)} (the mall's own fee)`;
  }
  return standardFee != null
    ? `One · ${money(standardFee)} (standard fee)`
    : "One · the standard parcel fee";
}

/** "Rs 1,000 · whole mall", or "None" for 0. */
export function minimumText(minimum: number | null | undefined): string {
  const n = Math.round(Number(minimum) || 0);
  return n > 0 ? `${money(n)} · whole mall` : "None";
}

/** Inside its mall a store is called by its own part of the name:
 *  "Wakeel Shopping Mall - Beauty & Personal Care" -> "Beauty & Personal Care".
 *  A name that does not start with the mall's is shown whole. */
export function shortName(storeName: string, mallName: string): string {
  const n = (storeName || "").trim();
  const m = (mallName || "").trim();
  if (!m || n.length <= m.length || n.slice(0, m.length).toLowerCase() !== m.toLowerCase()) return n;
  const rest = n.slice(m.length).replace(/^\s*[-–—:·|]\s*/, "").trim();
  return rest || n;
}

/** The store's commission in words: its own rate, or its department's. */
export function rateText(store: Pick<MallStore, "commission_percent">, departmentLabel: string): string {
  return store.commission_percent != null
    ? `${store.commission_percent}% (own rate)`
    : `${departmentLabel} rate`;
}

/** Stores with no logo of their own - they show the mall's. */
export function storesWithoutLogo(stores: Pick<MallStore, "has_own_logo">[]): number {
  return stores.filter((s) => !s.has_own_logo).length;
}

/** Stores that have nothing to sell yet - hidden from customers until they do. */
export function emptyStores(stores: Pick<MallStore, "products">[]): number {
  return stores.filter((s) => !s.products).length;
}

/** What may be ticked when making a mall: only stores that can join. And the
 *  logo it would get when none is uploaded: the first ticked store's own. */
export function mallFromChoices(choices: MallStoreChoice[], ticked: string[]): {
  ok: string[];
  refused: string[];
  logoFromStore: string | null;
} {
  const byId = new Map(choices.map((c) => [c.id, c]));
  const ok: string[] = [];
  const refused: string[] = [];
  for (const id of ticked) {
    const c = byId.get(id);
    if (c && c.can_join) ok.push(id);
    else refused.push(id);
  }
  const logoFromStore = ok.map((id) => byId.get(id)?.image_url || "").find((u) => !!u) || null;
  return { ok, refused, logoFromStore };
}

/** Can "Create mall" be pressed? The words say what is missing. */
export function readyToMake(name: string, ok: string[], logo: string | null): string | null {
  if (name.trim().length < 2) return "Give the mall a name";
  if (ok.length < 1) return "Tick at least one store";
  if (!logo) return "A mall needs a logo - upload one, or tick a store that has one";
  return null;
}

/** The parcels desk: how many OTHER stores' parts travel with this one. */
export function partsTravellingWith(
  parcel: { id: string; mall_order_id?: string | null },
  all: { id: string; mall_order_id?: string | null }[],
): number {
  if (!parcel.mall_order_id) return 0;
  return all.filter((p) => p.id !== parcel.id && p.mall_order_id === parcel.mall_order_id).length;
}
