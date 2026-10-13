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

export interface CheckProduct {
  name: string;
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

export type Tab = "fix" | "options" | "all" | "already";
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
    const ps = tab === "options" ? r.products.filter((p) => (p.options || []).length > 0) : r.products;
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
 *  marks (rows, rx). The server checks every value again. */
export function partBody(products: CheckProduct[], idx: number[]): Record<string, unknown>[] {
  return idx.map((i) => {
    const { rows: _rows, rx: _rx, options, ...p } = products[i];
    void _rows; void _rx;
    const out: Record<string, unknown> = { ...p };
    if (options) out.options = options.map(({ row: _r, ...o }) => { void _r; return o; });
    return out;
  });
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
