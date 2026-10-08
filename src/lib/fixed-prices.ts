// FIXED-PRICE STORES - the admin panel's rules.  (Plan Steps 5b and 5c.)
//
// Sana, 8 October 2026: Option 2, Mock 171 APPROVED, "Do all what you
// suggest". In a fixed-price store Takal sets two prices for every product,
// size and extra:
//   BUYING price  - what the vendor is paid
//   SELLING price - what the customer pays (before the product's discount)
// No commission, no markup. Takal earns: what the customer pays - buying.
//
// The arithmetic is the SERVER's, copied here only so the screen can show it
// WHILE the price is being typed (routers/fixed_prices.py _item_rows,
// core_pricing.customer_price_for). The server checks every save again.
// Plan: docs/Money/PLAN-FIXED-PRICE-STORES-2026-10-08.md.

/** Two decimals, half going up - money() on the server. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
/** Whole rupees, half going up - money(x, 0) on the server. */
const whole = (n: number): number => Math.round(n + Number.EPSILON);

/** What the customer pays for one: the selling price after the product's
 *  discount, in whole rupees. customer_price_for(selling, discount, 0).
 *  Walnut Rs 690 at 10% off = Rs 621. */
export function customerPays(selling: number | null | undefined, discountPercent: number | null | undefined): number | null {
  const s = Number(selling);
  if (selling === null || selling === undefined || !Number.isFinite(s)) return null;
  const d = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  return whole(round2(s * (1 - d / 100)));
}

/** What Takal earns on one: customer pays - buying. null = no buying price. */
export function takalEarns(pays: number | null, buying: number | null | undefined): number | null {
  if (pays === null || buying === null || buying === undefined || !Number.isFinite(Number(buying))) return null;
  return whole(pays - Number(buying));
}

/** Takal's share of what the customer pays, as a whole percent. */
export function earnPercent(earns: number | null, pays: number | null): number | null {
  if (earns === null || pays === null || pays <= 0) return null;
  return Math.round((earns / pays) * 100);
}

/** The colour of "Takal earns" (Mock 171-1's legend). */
export type EarnTone = "good" | "low" | "loss" | "missing";
export function earnTone(earns: number | null, pays: number | null): EarnTone {
  if (earns === null) return "missing";
  if (earns < 0) return "loss";
  const pct = earnPercent(earns, pays);
  return pct !== null && pct >= 5 ? "good" : "low";
}

/** What a product's selling price becomes when a store with this markup is
 *  switched - the server's apply_markup: whole rupees, half going up.
 *  Walnut Rs 657 + 5% = 689.85 -> Rs 690. */
export function sellingAfterSwitch(shopPrice: number, markupPercent: number): number {
  return whole(shopPrice * (1 + markupPercent / 100));
}

/** A buying or selling price typed in the row. Whole rupees (rule R5). A
 *  product's or a size's buying price is at least Rs 1 (Step 4: a vendor total
 *  of Rs 0 would be paid from the selling price); an extra's may be Rs 0. */
export function checkFixedPrice(
  raw: string, what: "buying" | "selling", kind: "product" | "size" | "extra",
): { ok: true; value: number } | { ok: false; reason: string } {
  const t = String(raw ?? "").trim().replace(/,/g, "").replace(/^rs\.?\s*/i, "").replace(/^\+\s*/, "");
  if (!/^\d+$/.test(t)) {
    return { ok: false, reason: /^\d+\.\d+$/.test(t)
      ? `the ${what} price must be in whole rupees (for example Rs 520)`
      : `type the ${what} price in rupees` };
  }
  const n = Number(t);
  if (n > 10_000_000) return { ok: false, reason: `that ${what} price is too high` };
  if (what === "buying" && kind !== "extra" && n < 1) {
    return { ok: false, reason: "a buying price must be at least Rs 1 (only an extra may be Rs 0)" };
  }
  return { ok: true, value: n };
}

// ── Change many prices at once (Mock 171-4) ─────────────────────────────────

export type PriceTarget = "buying" | "selling" | "both";
export type PriceDirection = "up" | "down";
export type PriceHow = "pct" | "rs";

/** One price moved up or down by a percent or by rupees - whole rupees, half
 *  going up, never below 0. 1,250 up 5% = 1,312.50 -> Rs 1,313. */
export function movePrice(old: number, dir: PriceDirection, how: PriceHow, amount: number): number {
  const a = Math.max(0, Number(amount) || 0);
  const delta = how === "pct" ? (old * a) / 100 : a;
  return Math.max(0, whole(round2(dir === "up" ? old + delta : old - delta)));
}

/** The shapes the server's GET /admin/restaurants/{id}/prices sends. */
export interface PriceOption {
  id: string;
  kind: "size" | "extra";
  label: string;
  selling_price: number;
  has_own_price: boolean;
  customer_pays: number;
  buying_price: number | null;        // its OWN buying price
  uses_buying_price: number | null;   // what is really used (a size with no own price uses the product's)
  takal_earns: number | null;
  missing: boolean;
  loss: boolean;
  is_available: boolean;
}
export interface PriceItem {
  id: string;
  name: string;
  selling_price: number;
  discount_percent: number;
  customer_pays: number;
  buying_price: number | null;
  takal_earns: number | null;
  missing: boolean;
  loss: boolean;
  is_available: boolean;
  options: PriceOption[];
}
export interface StorePrices {
  restaurant_id: string;
  name: string;
  price_mode: "fixed" | "standard";
  items: PriceItem[];
  counts: { products: number; missing: number; loss: number };
}

/** One line of the "before -> after" table, and what is sent for it. */
export interface PlannedLine {
  key: string;
  product_id: string;
  variant_id: string | null;
  label: string;
  kind: "product" | "size" | "extra";
  discount: number;
  buyingBefore: number | null;
  buyingAfter: number | null;
  sellingBefore: number;
  sellingAfter: number;
  paysBefore: number | null;
  paysAfter: number | null;
  earnBefore: number | null;
  earnAfter: number | null;
  /** The product's own line of a product sold in sizes: its prices are still
   *  sent (a size with no price of its own uses them), but the table shows
   *  the sizes instead, so it is not drawn twice. */
  hidden: boolean;
}

/**
 * Every new price for the ticked products - with their sizes and extras -
 * worked out BEFORE anything is saved (Mock 171-4).
 *
 * What moves:
 *   * the product's own selling price (unless every size has its own);
 *   * each size / extra with a selling price of its own;
 *   * every buying price that is SET (one that is not set stays not set - it
 *     is still flagged "Buying price missing"; a size using the product's
 *     buying price follows the product's).
 * A free extra (Rs 0) stays free.
 */
export function planPriceChange(
  items: PriceItem[], target: PriceTarget, dir: PriceDirection, how: PriceHow, amount: number,
): PlannedLine[] {
  const moveBuying = target !== "selling";
  const moveSelling = target !== "buying";
  const out: PlannedLine[] = [];
  for (const it of items) {
    const sizes = it.options.filter((o) => o.kind === "size");
    const sizesOwnAll = sizes.length > 0 && sizes.every((o) => o.has_own_price);
    const pBuyAfter = it.buying_price === null ? null
      : moveBuying ? Math.max(1, movePrice(it.buying_price, dir, how, amount)) : it.buying_price;
    const pSellAfter = moveSelling && !sizesOwnAll ? movePrice(it.selling_price, dir, how, amount) : it.selling_price;
    if (!sizesOwnAll || it.buying_price !== null) {
      const sellAfter = pSellAfter;
      const paysB = customerPays(it.selling_price, it.discount_percent);
      const paysA = customerPays(sellAfter, it.discount_percent);
      out.push({
        key: `p:${it.id}`, product_id: it.id, variant_id: null, label: it.name, kind: "product",
        discount: it.discount_percent,
        buyingBefore: it.buying_price, buyingAfter: pBuyAfter,
        sellingBefore: it.selling_price, sellingAfter: sellAfter,
        paysBefore: paysB, paysAfter: paysA,
        earnBefore: sizes.length ? null : takalEarns(paysB, it.buying_price),
        earnAfter: sizes.length ? null : takalEarns(paysA, pBuyAfter),
        hidden: sizes.length > 0,
      });
    }
    for (const o of it.options) {
      const own = o.buying_price;
      const oBuyAfter = own === null ? null
        : moveBuying ? (o.kind === "extra" ? movePrice(own, dir, how, amount) : Math.max(1, movePrice(own, dir, how, amount)))
          : own;
      const usedBefore = o.uses_buying_price;
      const usedAfter = own !== null ? oBuyAfter : (o.kind === "size" && !o.has_own_price ? pBuyAfter : null);
      // A size with no price of its own costs the product's price, and follows it.
      const followsProduct = o.kind === "size" && !o.has_own_price;
      const sellAfter = followsProduct ? pSellAfter
        : moveSelling && !(o.kind === "extra" && o.selling_price === 0)
          ? movePrice(o.selling_price, dir, how, amount) : o.selling_price;
      const paysB = customerPays(o.selling_price, it.discount_percent);
      const paysA = customerPays(sellAfter, it.discount_percent);
      out.push({
        key: `v:${o.id}`, product_id: it.id, variant_id: o.id,
        label: `${it.name} - ${o.label}`, kind: o.kind, discount: it.discount_percent,
        buyingBefore: usedBefore, buyingAfter: usedAfter,
        sellingBefore: o.selling_price, sellingAfter: sellAfter,
        paysBefore: paysB, paysAfter: paysA,
        earnBefore: takalEarns(paysB, usedBefore), earnAfter: takalEarns(paysA, usedAfter),
        hidden: false,
      });
    }
  }
  return out;
}

/** What is sent to PUT /set-prices for a plan - only what really changes,
 *  and never a size's own buying price it did not have. */
export function changesFor(
  plan: PlannedLine[], items: PriceItem[],
): { product_id: string; variant_id?: string; buying_price?: number; selling_price?: number }[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: { product_id: string; variant_id?: string; buying_price?: number; selling_price?: number }[] = [];
  for (const l of plan) {
    const it = byId.get(l.product_id);
    const opt = l.variant_id ? it?.options.find((o) => o.id === l.variant_id) : undefined;
    const own = l.variant_id ? opt?.buying_price ?? null : it?.buying_price ?? null;
    // A size that follows the product's price is never given one of its own.
    const followsProduct = !!opt && opt.kind === "size" && !opt.has_own_price;
    const c: { product_id: string; variant_id?: string; buying_price?: number; selling_price?: number } = { product_id: l.product_id };
    if (l.variant_id) c.variant_id = l.variant_id;
    if (own !== null && l.buyingAfter !== null && l.buyingAfter !== own) c.buying_price = l.buyingAfter;
    if (l.sellingAfter !== l.sellingBefore && !followsProduct) c.selling_price = l.sellingAfter;
    if (c.buying_price !== undefined || c.selling_price !== undefined) out.push(c);
  }
  return out;
}

/** How many prices a list of changes holds - "Save 10 new prices". */
export const pricesIn = (changes: { buying_price?: number; selling_price?: number }[]): number =>
  changes.reduce((n, c) => n + (c.buying_price !== undefined ? 1 : 0) + (c.selling_price !== undefined ? 1 : 0), 0);

// ── Price history (Mock 171-5) ──────────────────────────────────────────────

export interface PriceChangeRow {
  product_id: string;
  variant_id: string | null;
  item_name: string;
  field: "buying_price" | "selling_price" | "discount_percent";
  old_value: number | null;
  new_value: number | null;
  changed_by: string;
  changed_by_name: string | null;
  changed_by_role: string | null;
  created_at: string;
}

export interface HistoryLine {
  when: string;
  who: string;
  item: string;
  buying: { old: number | null; new: number | null } | null;
  selling: { old: number | null; new: number | null } | null;
  discount: { old: number | null; new: number | null } | null;
}

/** One line per save: the changes one person made to one item in the same
 *  minute, newest first. "12 Oct, Sana: buying 600 -> 630, selling 690 -> 725". */
export function groupHistory(rows: PriceChangeRow[]): HistoryLine[] {
  const lines = new Map<string, HistoryLine>();
  const sorted = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const r of sorted) {
    const minute = String(r.created_at || "").slice(0, 16);
    const key = `${minute}|${r.changed_by}|${r.product_id}|${r.variant_id ?? ""}`;
    let l = lines.get(key);
    if (!l) {
      l = {
        when: r.created_at,
        who: r.changed_by_name || (r.changed_by_role === "admin" ? "An admin" : "Somebody"),
        item: r.item_name, buying: null, selling: null, discount: null,
      };
      lines.set(key, l);
    }
    const pair = { old: r.old_value, new: r.new_value };
    if (r.field === "buying_price") l.buying = pair;
    else if (r.field === "selling_price") l.selling = pair;
    else l.discount = pair;
  }
  return Array.from(lines.values());
}

// ── A prices sheet (5c) ─────────────────────────────────────────────────────

export interface SheetMatch {
  row: number;            // the sheet's own row number, for "row 7 was not found"
  name: string;
  item: PriceItem | null;
  option: PriceOption | null;
  buying: number | null;
  selling: number | null;
  problem: string | null;
}

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Which column is which, from the header row. Accepts the obvious words. */
export function sheetColumns(header: string[]): { name: number; size: number; buying: number; selling: number } | null {
  const h = header.map(norm);
  const find = (...words: string[]) => h.findIndex((c) => words.some((w) => c === w || c.startsWith(w)));
  const name = find("product", "name", "item");
  const size = find("size", "option", "extra");
  const buying = find("buying", "buy", "cost", "vendor");
  const selling = find("selling", "sell", "customer", "price");
  if (name < 0 || (buying < 0 && selling < 0)) return null;
  return { name, size, buying: buying === selling ? -1 : buying, selling };
}

/** Match each sheet row to a product (and size / extra) of THIS store by name,
 *  and read its two prices. Nothing unknown is ever created - a name that is
 *  not in the store is listed as not found. */
export function matchSheet(rows: string[][], items: PriceItem[]): SheetMatch[] {
  if (rows.length < 2) return [];
  const cols = sheetColumns(rows[0]);
  if (!cols) return [];
  const byName = new Map(items.map((i) => [norm(i.name), i]));
  const read = (raw: string | undefined, what: "buying" | "selling", kind: "product" | "size" | "extra") => {
    if (raw === undefined || String(raw).trim() === "") return { value: null as number | null, problem: null as string | null };
    const c = checkFixedPrice(String(raw), what, kind);
    return c.ok ? { value: c.value, problem: null } : { value: null, problem: c.reason };
  };
  const out: SheetMatch[] = [];
  rows.slice(1).forEach((r, i) => {
    const name = String(r[cols.name] ?? "").trim();
    if (!name) return;
    const item = byName.get(norm(name)) ?? null;
    const sizeName = cols.size >= 0 ? String(r[cols.size] ?? "").trim() : "";
    const option = item && sizeName ? item.options.find((o) => norm(o.label) === norm(sizeName)) ?? null : null;
    const kind = option ? option.kind : "product";
    const b = cols.buying >= 0 ? read(r[cols.buying], "buying", kind) : { value: null, problem: null };
    const s = cols.selling >= 0 ? read(r[cols.selling], "selling", kind) : { value: null, problem: null };
    let problem = b.problem || s.problem;
    if (!item) problem = "not found in this store";
    else if (sizeName && !option) problem = `"${sizeName}" is not a size or extra of ${item.name}`;
    else if (!problem && b.value === null && s.value === null) problem = "no price in this row";
    out.push({ row: i + 2, name: sizeName ? `${name} - ${sizeName}` : name, item, option,
      buying: b.value, selling: s.value, problem });
  });
  return out;
}

// ── Where the money of ONE fixed-price order goes (Mock 171-5) ──────────────

export interface OrderMoney {
  lines: { name: string; qty: number; customer: number; vendor: number; takal: number }[];
  goods: { customer: number; vendor: number; takal: number };
  promo: number;
  credit: number;
  delivery: { customer: number; rider: number; takal: number };
  total: { customer: number; vendor: number; rider: number; takal: number };
  /** customer paid = vendor + rider + Takal, to the rupee. */
  checksOut: boolean;
}

/** Each line at the prices LOCKED into the order: `price` (one, what the
 *  customer pays) and `base_price` (one, the buying price), times how many.
 *  The worked example: 1 x Almonds 1 kg + Gift box 2,570 / 2,230 / 340;
 *  2 x Walnut 1,242 / 1,200 / 42; promo -100; delivery 90 (rider 75) ->
 *  customer 3,802 = vendor 3,430 + rider 75 + Takal 297. */
export function orderMoney(order: any, items: any[]): OrderMoney {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const lines = (items || []).map((it) => {
    const qty = n(it.quantity ?? 1) || 1;
    const customer = whole(n(it.price) * qty);
    const vendor = whole(n(it.base_price) * qty);
    const name = [it.product_name || it.name || "Item", it.variant_label].filter(Boolean).join(" ");
    return { name, qty, customer, vendor, takal: customer - vendor };
  });
  const goodsCustomer = n(order?.subtotal) || lines.reduce((t, l) => t + l.customer, 0);
  const goodsVendor = order?.vendor_subtotal != null ? n(order.vendor_subtotal) : lines.reduce((t, l) => t + l.vendor, 0);
  const promo = Math.max(0, n(order?.discount));
  const credit = Math.max(0, n(order?.credit_used));
  const fee = n(order?.delivery_fee);
  const rider = n(order?.rider_earning);
  const paid = n(order?.total_amount);
  const takal = whole(goodsCustomer - goodsVendor - promo - credit + (fee - rider));
  return {
    lines,
    goods: { customer: whole(goodsCustomer), vendor: whole(goodsVendor), takal: whole(goodsCustomer - goodsVendor) },
    promo, credit,
    delivery: { customer: fee, rider, takal: whole(fee - rider) },
    total: { customer: whole(paid), vendor: whole(goodsVendor), rider: whole(rider), takal },
    checksOut: whole(goodsVendor) + whole(rider) + takal === whole(paid),
  };
}
