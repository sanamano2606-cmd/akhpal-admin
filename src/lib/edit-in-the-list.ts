// EDIT IN THE LIST - the rules behind typing straight into a product row.
// (Fixed-price stores plan, Step 5a. Mock 171-2, APPROVED by Sana 8 Oct 2026.)
//
// Before: only Price, Stock and On/Off could be typed in the row; a name, a
// discount, a category or one size's price needed the full product editor.
// Now every one of them is typed in the row:
//   Enter saves, Esc cancels, Tab saves and moves to the next box.
//   ▾ opens the product's sizes and extras INSIDE the list.
//
// The checks live here, in plain functions, so the screen and the tests use
// the SAME rules - and they are the server's own rules (core_models.py
// MenuItemUpdate / ProductVariantUpdate), said in words before anything is
// sent. A wrong value keeps its box open with the reason under the name; it is
// never sent to be refused.

/** The boxes of a product row, in the order Tab walks them. */
export type RowField = "name" | "price" | "discount" | "stock";
export const ROW_FIELDS: RowField[] = ["name", "price", "discount", "stock"];

/** The boxes of a size / extra row, in Tab order. */
export type OptionField = "price" | "stock";

export type Checked =
  | { ok: true; value: string | number }
  | { ok: false; reason: string };

const MAX_NAME = 150;          // MenuItemUpdate.name max_length
const MAX_PRICE = 10_000_000;  // MenuItemUpdate.price le

function wholeNumber(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

function plainNumber(raw: string): number | null {
  const t = String(raw ?? "").trim().replace(/,/g, "");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function checkName(raw: string): Checked {
  const t = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { ok: false, reason: "the name cannot be empty" };
  if (t.length > MAX_NAME) return { ok: false, reason: `the name is too long (${MAX_NAME} letters at most)` };
  return { ok: true, value: t };
}

/** The product's own price. 0 is allowed, as it always was in this list. */
export function checkPrice(raw: string): Checked {
  const n = plainNumber(raw);
  if (n === null) return { ok: false, reason: "type a price in rupees (0 or more)" };
  if (n > MAX_PRICE) return { ok: false, reason: "that price is too high" };
  return { ok: true, value: n };
}

/** An empty box means "no discount". */
export function checkDiscount(raw: string): Checked {
  const t = String(raw ?? "").trim().replace(/%$/, "").trim();
  if (t === "") return { ok: true, value: 0 };
  const n = wholeNumber(t);
  if (n === null || n > 100) return { ok: false, reason: "discount must be a whole number from 0 to 100" };
  return { ok: true, value: n };
}

export function checkStock(raw: string): Checked {
  const n = wholeNumber(raw);
  if (n === null) return { ok: false, reason: "stock must be a whole number (0 or more)" };
  return { ok: true, value: n };
}

/** One size's own price, or what one extra ADDS.
 *  A size needs more than Rs 0 (the same rule as the editor and the Partners
 *  app); an extra may be Rs 0 - a free extra. Any other choice (a colour) may
 *  be 0 or more. */
export function checkOptionPrice(raw: string, kind: "size" | "extra" | "choice"): Checked {
  const n = plainNumber(raw);
  if (n === null) {
    return { ok: false, reason: kind === "extra" ? "type what it adds in rupees (0 if it is free)" : "type a price in rupees" };
  }
  if (n > MAX_PRICE) return { ok: false, reason: "that price is too high" };
  if (kind === "size" && n <= 0) return { ok: false, reason: "a size needs a price above Rs 0" };
  return { ok: true, value: n };
}

/** The next box for Tab (or Shift+Tab). null = off the end of the row. */
export function nextField(f: RowField, back = false): RowField | null {
  const i = ROW_FIELDS.indexOf(f) + (back ? -1 : 1);
  return i >= 0 && i < ROW_FIELDS.length ? ROW_FIELDS[i] : null;
}

/** Where Tab goes from a box: the next box of this row, or the first box of
 *  the next row (the last box of the row before, going back). null = stay. */
export function tabTarget(
  ids: string[], id: string, f: RowField, back = false,
): { id: string; field: RowField } | null {
  const next = nextField(f, back);
  if (next) return { id, field: next };
  const i = ids.indexOf(id) + (back ? -1 : 1);
  if (i < 0 || i >= ids.length) return null;
  return { id: ids[i], field: back ? ROW_FIELDS[ROW_FIELDS.length - 1] : ROW_FIELDS[0] };
}

/** What the shop's price comes to after its own discount - whole rupees. */
export function afterDiscount(price: number | null | undefined, pct: number | null | undefined): number | null {
  const p = Number(price);
  const d = Number(pct) || 0;
  if (!Number.isFinite(p) || d <= 0) return null;
  return Math.round(p * (1 - Math.min(100, d) / 100));
}

/** "Pizza · 4 sizes · 3 extras" - the words under a product's name. */
export function optionWords(choices: number, extras: number, sizes: boolean): string {
  const parts: string[] = [];
  if (choices > 0) {
    const word = sizes ? "size" : "option";
    parts.push(`${choices} ${word}${choices === 1 ? "" : "s"}`);
  }
  if (extras > 0) parts.push(`${extras} extra${extras === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** What kind of option a variant row is. */
export function optionKind(v: { variant_type?: string | null }): "size" | "extra" | "choice" {
  const t = String(v?.variant_type ?? "").trim().toLowerCase();
  return t === "extra" ? "extra" : t === "size" ? "size" : "choice";
}

/** The cheapest choice (not an extra) when EVERY choice has a price of its
 *  own - the dish's "from" price. Otherwise null: a choice without a price of
 *  its own costs the product's own price. Mirrors the server's
 *  shop_products._option_summary. */
export function fromPrice(vs: { variant_type?: string | null; price_override?: number | null }[]): number | null {
  const choices = (vs || []).filter((v) => optionKind(v) !== "extra");
  if (choices.length === 0) return null;
  let low: number | null = null;
  for (const v of choices) {
    if (v.price_override === null || v.price_override === undefined) return null;
    const n = Number(v.price_override);
    if (!Number.isFinite(n)) return null;
    if (low === null || n < low) low = n;
  }
  return low;
}

/** A product of a RESTAURANT sold in sizes keeps its own price at the
 *  cheapest size - the rule of the editor and the Partners app (Mock 162). So
 *  after one size's price is typed in the list, the dish's own price is set to
 *  this, or left alone when this is null. */
export function dishPriceAfterSizeChange(
  vendorType: string,
  vs: { variant_type?: string | null; price_override?: number | null }[],
  currentPrice: number | null | undefined,
): number | null {
  if (String(vendorType || "").toLowerCase() !== "restaurant") return null;
  const choices = (vs || []).filter((v) => optionKind(v) !== "extra");
  if (choices.length === 0 || !choices.every((v) => optionKind(v) === "size")) return null;
  const low = fromPrice(vs);
  if (low === null || Number(currentPrice) === low) return null;
  return low;
}
