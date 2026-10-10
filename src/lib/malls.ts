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
import type { Mall, MallStore, MallStoreChoice, StoreNames } from "./api-stores";
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

// ── STORE NAMES FOLLOW THE KIND  (Mock 177, approved by Sana 9 Oct 2026) ────
//
// Sana: "the Store inside the Mall must be with the same name, The 13 main
// types stores" - "i want this setting in the admin panel so there will be no
// need of code changing." While a mall's switch is ON the DATABASE keeps every
// store of it named "<mall> — <kind>" (migration 129). These helpers only say
// on screen what that will do, before it is done.

/** The mark between the mall and the kind - the same one the database writes. */
export const NAME_DASH = " — ";

/** "Wakeel Shopping Mall — Fashion". Null when either part is missing. */
export function kindName(mallName: string, kind: string | null | undefined): string | null {
  const m = (mallName || "").trim();
  const k = (kind || "").trim();
  return m && k ? `${m}${NAME_DASH}${k}` : null;
}

/** The names that change when the switch is turned ON: every store whose name
 *  is not its kind's name yet. Example:
 *  [{ from: "City Centre — Fashion & Accessories", to: "City Centre — Fashion" }] */
export function namesToChange(card: StoreNames | undefined | null): { from: string; to: string }[] {
  if (!card) return [];
  return card.stores
    .filter((r) => r.will_be && !r.matches)
    .map((r) => ({ from: r.saved_as, to: r.will_be as string }));
}

/** Renaming the mall while the switch is ON: the store names that change with
 *  it. Nothing while it is OFF, or when the name is the same. */
export function namesForNewMallName(
  card: StoreNames | undefined | null,
  oldName: string,
  newName: string,
): { from: string; to: string }[] {
  if (!card || !card.follow) return [];
  if ((newName || "").trim() === (oldName || "").trim() || (newName || "").trim().length < 2) return [];
  const out: { from: string; to: string }[] = [];
  for (const r of card.stores) {
    const to = kindName(newName, r.kind_name);
    if (to && to !== r.saved_as) out.push({ from: r.saved_as, to });
  }
  return out;
}

/** "Add a store": the name a store will get, and - while the switch is ON -
 *  the reason it cannot go in when the mall already has a store of its kind. */
export function addPreview(
  choice: Pick<MallStoreChoice, "vendor_type" | "kind_name">,
  mall: Pick<Mall, "name" | "stores" | "store_names">,
): { willBe: string | null; takenBy: string | null } {
  if (!mall.store_names?.follow) return { willBe: null, takenBy: null };
  const kind = (choice.kind_name || "").trim();
  const taken = mall.stores.some((s) => s.vendor_type === choice.vendor_type);
  return {
    willBe: kindName(mall.name, kind),
    takenBy: !taken ? null
      : kind ? `This mall already has a ${kind} store` : "This mall already has a store of this kind",
  };
}
