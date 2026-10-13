/**
 * ADDING A WHOLE CATALOGUE - the screen's own rules, with no screen attached.
 * (Mock 184, approved by Sana 13 October 2026.)
 *
 *   "each product and its sizes, quantity, colours, mg, gm, etc fill auto in
 *    its related category and the options of an item auto fill in the that
 *    items options if available" - about 15,000 Health & Pharmacy items.
 *
 * WHAT IS NOT HERE: the reading of the list. Which column is which, the rows
 * of one product joined into options, the category of every product and every
 * row that needs fixing are decided by the SERVER (backend/catalogue_engine.py),
 * the same code the Partners app asks - Sana's answer c, "both together". Two
 * copies of those rules would drift, and "Will be added" would stop being a
 * promise.
 *
 * WHAT IS HERE: cutting the products into parts of about 500 rows, the
 * progress words, the four tabs of step 4 and their pages of 50, and the
 * category choices of step 3. Checked in tests/whole-catalogue-big-lists.test.ts.
 */

import { money } from "./format.ts";

export type Mode = "add" | "update";

export interface RoleChoice { key: string; label: string }

/** The roles in the order the dropdown shows them, with a heading each. */
export const ROLE_GROUPS: { title: string; keys: string[] }[] = [
  { title: "The product", keys: ["name", "category", "description", "image_url", "barcode", "prescription"] },
  { title: "Money", keys: ["price", "buying", "discount_percent"] },
  { title: "Stock", keys: ["stock"] },
  {
    title: "Option (joins rows of one product)",
    keys: ["option:Size", "option:Strength", "option:Pack", "option:Volume", "option:Weight",
      "option:Colour", "option:Flavour", "option:Scent"],
  },
  { title: "Other", keys: ["detail", "ignore"] },
];

export interface CheckOption {
  value: string; row: number; price?: number; stock?: number; sku?: string; buying_price?: number;
}

/** One money line of a product (or of one of its options) - Mock 186.
 *  Worked out by the SERVER (backend/catalogue_money.py): now -> new, what the
 *  customer pays after the discount, what Takal earns, and the loss flag. */
export interface MoneyLine {
  label: string;
  kind: "product" | "size" | "extra";
  sell_now: number | null; sell_new: number | null;
  buy_now: number | null; buy_new: number | null;
  discount_percent: number;
  pays: number | null; earns: number | null; earns_pct: number | null;
  loss: boolean; missing_buying: boolean;
  stock_now: number | null; stock_new: number | null;
  price_changed: boolean; stock_changed: boolean;
  /** A loss that needs a person's OK: added, or its price changed by this list. */
  loss_needs_ok?: boolean;
}

export interface ProductMoney {
  lines: MoneyLine[];
  loss: boolean; missing_buying: boolean; price_changed: boolean; stock_changed: boolean;
}

export interface CheckProduct {
  name: string;
  product_id?: string;
  money?: ProductMoney;
  rows: number[];
  price?: number;
  buying_price?: number;
  stock?: number;
  category_id?: string;
  description?: string;
  image_url?: string;
  discount_percent?: number;
  needs_prescription?: boolean;
  rx?: boolean;
  specs?: string;
  options_kind?: string;
  options?: CheckOption[];
}

export interface RowNote { row: number; name?: string; error: string }
export interface Listed { row: number; name: string; rows: number[] }

export interface CheckResult {
  mode: Mode;
  rows_read: number;
  rows_dropped: number;
  products: CheckProduct[];
  already: Listed[];
  not_found: Listed[];
  problems: RowNote[];
  notes: { row: number; note: string }[];
  counts: {
    products: number; with_options: number; rows_joined: number; already: number;
    not_found: number; problem_rows: number; with_stock: number; with_buying: number;
    pictures: number; prescription: number;
  };
  parts: number;
  room_today: number | null;
  daily_limit: number | null;
  fixed_price: boolean;
  mapping: string[];
  /** Mock 186. Missing from a server before it: no money lines, no loss check. */
  money?: {
    loss: number; missing_buying: number; price_changes: number; stock_only: number; same: number;
    earns_pct: number | null;
  };
  can_set_prices?: boolean;
}

export interface Leaf { id: string; name: string; path: string; needs_prescription?: boolean }
export interface Word { word: string; key: string; rows: number; suggestion: string | null; why: string }

// ── step 3: one choice per word ─────────────────────────────────────────────

/** The choices as the server suggested them (remembered, or a known word). */
export function choicesFrom(words: Word[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of words) if (w.suggestion) out[w.key] = w.suggestion;
  return out;
}

/** The words still without a sub-category, most rows first. */
export function wordsStillOpen(words: Word[], choices: Record<string, string>): Word[] {
  return words.filter((w) => !choices[w.key]);
}

/** The shelves in the dropdown, grouped by their parent ("Medicines"). */
export function leafGroups(leaves: Leaf[]): { group: string; leaves: Leaf[] }[] {
  const order: string[] = [];
  const by: Record<string, Leaf[]> = {};
  for (const lf of leaves) {
    const g = lf.path.includes(" > ") ? lf.path.split(" > ")[0] : "";
    if (!(g in by)) { by[g] = []; order.push(g); }
    by[g].push(lf);
  }
  return order.map((g) => ({ group: g, leaves: by[g] }));
}

// ── step 4: tabs, search, pages of 50 ──────────────────────────────────────

export type Tab = "fix" | "loss" | "changes" | "stock" | "options" | "all" | "already";
export const PAGE_SIZE = 50;

export interface Line {
  kind: "fix" | "product" | "already" | "not_found";
  row: number;
  name: string;
  product?: CheckProduct;
  error?: string;
}

/** What one tab lists. 15,212 rows are never drawn at once: a tab is cut
 *  into pages of 50 by pageOf(). */
export function linesFor(r: CheckResult, tab: Tab, search = ""): Line[] {
  const q = search.trim().toLowerCase();
  const hit = (name: string) => !q || name.toLowerCase().includes(q);
  let out: Line[] = [];
  if (tab === "fix") {
    out = r.problems.map((p) => ({ kind: "fix" as const, row: p.row, name: p.name || "", error: p.error }));
  } else if (tab === "already") {
    const list = r.mode === "add" ? r.already : r.not_found;
    out = list.map((a) => ({ kind: (r.mode === "add" ? "already" : "not_found") as Line["kind"],
      row: a.row, name: a.name }));
  } else {
    const pick: Record<string, (p: CheckProduct) => boolean> = {
      options: (p) => (p.options || []).length > 0,
      loss: (p) => !!p.money?.loss,
      changes: (p) => !!p.money?.price_changed,
      stock: (p) => !p.money?.price_changed && !!p.money?.stock_changed,
    };
    const ps = pick[tab] ? r.products.filter(pick[tab]) : r.products;
    out = ps.map((p) => ({ kind: "product" as const, row: p.rows[0], name: p.name, product: p }));
  }
  return out.filter((l) => hit(l.name));
}

export function pageOf<T>(list: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { items: list.slice(p * size, p * size + size), page: p, pages };
}

/** The lowest price a product sells at - "from Rs 45". */
export function fromPrice(p: CheckProduct): string {
  const prices = (p.options || []).map((o) => o.price).filter((x): x is number => typeof x === "number");
  if (prices.length) return `from ${money(Math.min(...prices))}`;
  return typeof p.price === "number" ? money(p.price) : "—";
}

/** The option kinds as the columns of a product's little table:
 *  "Strength & Pack" -> ["Strength", "Pack"], each value split the same way. */
export function optionColumns(p: CheckProduct): { heads: string[]; cells: (o: CheckOption) => string[] } {
  const heads = (p.options_kind || "Option").split(" & ");
  return {
    heads,
    cells: (o) => {
      const parts = o.value.split(" / ");
      return heads.length === parts.length ? parts : [o.value, ...Array(heads.length - 1).fill("")];
    },
  };
}

// ── step 5: parts of about 500 rows ─────────────────────────────────────────

/** Product indexes cut into parts of about `rowsPerPart` ROWS. A product's
 *  options are never split between two parts. The server cuts the same way
 *  (catalogue_engine.parts) - the count in step 4 and here agree. */
export function partsOf(products: CheckProduct[], rowsPerPart = 500): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let n = 0;
  products.forEach((p, i) => {
    const size = Math.max(1, (p.options || []).length);
    if (cur.length && n + size > rowsPerPart) { out.push(cur); cur = []; n = 0; }
    cur.push(i);
    n += size;
  });
  if (cur.length) out.push(cur);
  return out;
}

/** What one part sends: the product as checked, without the screen's own
 *  marks (rows, rx, money). The server checks every value again - and works
 *  the loss out again from the database (Mock 186). `product_id` goes along:
 *  the shop's product the check matched, checked against the name there. */
export function partBody(products: CheckProduct[], idx: number[]): Record<string, unknown>[] {
  return idx.map((i) => {
    const { rows: _rows, rx: _rx, money: _m, options, ...p } = products[i];
    void _rows; void _rx; void _m;
    const out: Record<string, unknown> = { ...p };
    if (options) out.options = options.map(({ row: _r, ...o }) => { void _r; return o; });
    return out;
  });
}

// ── Mock 186: now -> new, Takal earns, the loss check ───────────────────────

/** The products that would sell at a loss - "Leave out the 3" drops these. */
export function lossProducts(r: CheckResult): CheckProduct[] {
  return r.products.filter((p) => !!p.money?.loss);
}

/** The products to save: all of them, or all but the loss ones. */
export function productsToSave(r: CheckResult, leaveOutLosses: boolean): CheckProduct[] {
  return leaveOutLosses ? r.products.filter((p) => !p.money?.loss) : r.products;
}

/** May Save be pressed? Never with a loss nobody has looked at. */
export function saveAllowed(r: CheckResult, ticked: boolean, leftOut: boolean): boolean {
  const n = productsToSave(r, leftOut).length;
  if (n === 0) return false;
  return !(r.money?.loss && !leftOut && !ticked);
}

/** "Rs 38 → Rs 48", "Rs 45" when it does not change, "—" when unknown. */
export function nowNew(now: number | null | undefined, next: number | null | undefined,
  show: (n: number) => string = money): { was: string | null; is: string; changed: boolean } {
  const has = (x: unknown): x is number => typeof x === "number";
  if (!has(next)) return { was: null, is: has(now) ? show(now) : "—", changed: false };
  if (!has(now) || now === next) return { was: null, is: show(next), changed: false };
  return { was: show(now), is: show(next), changed: true };
}

/** What Takal earns on one, in words: "Rs 11 · 17%", "− Rs 3", "—". */
export function earnsText(l: Pick<MoneyLine, "earns" | "earns_pct">): string {
  if (typeof l.earns !== "number") return "—";
  if (l.earns < 0) return `− ${money(-l.earns)}`;
  return typeof l.earns_pct === "number" ? `${money(l.earns)} · ${l.earns_pct}%` : money(l.earns);
}

/** Why a red row is red, in one line. */
export function lossWhy(l: MoneyLine): string {
  if (!l.loss || typeof l.earns !== "number") return "";
  const each = money(-l.earns);
  return l.discount_percent > 0 && typeof l.sell_new === "number" && typeof l.buy_new === "number" && l.sell_new >= l.buy_new
    ? `the ${l.discount_percent}% discount makes it a loss: ${each} on each one`
    : `sells at a loss: ${each} on each one`;
}

/** The name of the "earns" column: Takal's in a fixed-price store, the
 *  shop's own margin over its buying price in a standard one. */
export function earnsHeading(fixed: boolean): string {
  return fixed ? "Takal earns" : "Margin";
}

/** "About 4 minutes left", from how long the parts so far took. */
export function timeLeft(msSoFar: number, partsDone: number, partsLeft: number): string {
  if (partsDone <= 0 || partsLeft <= 0) return "";
  const ms = (msSoFar / partsDone) * partsLeft;
  const min = Math.round(ms / 60000);
  if (ms < 60000) return "Less than a minute left.";
  return `About ${min} minute${min === 1 ? "" : "s"} left.`;
}

export interface SaveTotals {
  added: number; updated: number; unchanged: number; skipped: number;
  notFound: number; optionsNotFound: string[]; pictures: number; ids: string[];
}

export const NO_TOTALS: SaveTotals = {
  added: 0, updated: 0, unchanged: 0, skipped: 0, notFound: 0, optionsNotFound: [], pictures: 0, ids: [],
};

/** One part's answer added to the running totals. */
export function addPart(t: SaveTotals, out: any): SaveTotals {
  const added: { id: string }[] = Array.isArray(out?.added) ? out.added : [];
  return {
    added: t.added + added.length,
    updated: t.updated + (Array.isArray(out?.updated) ? out.updated.length : 0),
    unchanged: t.unchanged + (Number(out?.unchanged) || 0),
    skipped: t.skipped + (Array.isArray(out?.skipped) ? out.skipped.length : 0),
    notFound: t.notFound + (Array.isArray(out?.not_found) ? out.not_found.length : 0),
    optionsNotFound: [...t.optionsNotFound, ...(Array.isArray(out?.options_not_found) ? out.options_not_found : [])],
    pictures: t.pictures + (Number(out?.pictures_queued) || 0),
    ids: [...t.ids, ...added.map((a) => String(a.id))],
  };
}

/** The finished upload in plain lines, first line first. */
export function doneLines(mode: Mode, t: SaveTotals, r: CheckResult): string[] {
  const n = (x: number) => x.toLocaleString();
  const lines: string[] = [];
  if (mode === "add") {
    const opt = r.counts.with_options ? ` - ${n(r.counts.with_options)} with options` : "";
    lines.push(`${n(t.added)} product${t.added === 1 ? "" : "s"} added${opt}`);
    const already = r.counts.already + t.skipped;
    if (already) lines.push(`${n(already)} already in the shop, left as they are`);
  } else {
    lines.push(`${n(t.updated)} product${t.updated === 1 ? "" : "s"} updated`);
    if (t.unchanged) lines.push(`${n(t.unchanged)} already had these prices and stock`);
    const missing = r.counts.not_found + t.notFound;
    if (missing) lines.push(`${n(missing)} not in this shop - nothing new is added in Update`);
    if (t.optionsNotFound.length) {
      lines.push(`${n(t.optionsNotFound.length)} option${t.optionsNotFound.length === 1 ? "" : "s"} not found on the product`);
    }
  }
  if (r.counts.problem_rows) {
    lines.push(`${n(r.counts.problem_rows)} ${r.counts.problem_rows === 1 ? "row needs" : "rows need"} fixing - nothing else waits for them`);
  }
  if (r.counts.with_stock) lines.push("Stock filled on every product and option that had a quantity");
  if (r.counts.with_buying) lines.push("Buying prices filled - private, never shown to customers");
  return lines;
}

/** The blank sheet the office sends a shopkeeper. Takal's own headings, so
 *  it needs no matching when it comes back. */
export function blankSheetCsv(): string {
  return [
    "Name,Strength,Pack,Category,Buying price (TP),Selling price (MRP),Stock,Barcode,Company",
    "Panadol Tablet,500 mg,Strip of 10,Tablet,38,45,120,8964000123456,GSK",
    "Panadol Tablet,500 mg,Box of 200,Tablet,720,850,14,,GSK",
    "Chicken Karahi,Half,,Karahi,,1100,,,",
    "Chicken Karahi,Full,,Karahi,,2000,,,",
    ",,,,,,,,",
  ].join("\n");
}
