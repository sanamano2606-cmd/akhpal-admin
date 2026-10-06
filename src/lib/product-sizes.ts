// A RESTAURANT DISH SOLD IN SIZES - the admin panel's half of Mock 162.
// (Sana, 5 October 2026: "Start the admin panel sizes improvement".)
//
// The Partners app asks a restaurant "How is it sold? One price / In sizes"
// and keeps one row per size: a name and a price. The admin panel had only the
// general options grid (Type / Value / Stock / Price) and left the dish's own
// price to be typed by hand, so a pizza could be saved at Rs 2,400 and every
// customer card would say "from Rs 2,400" for a pizza that starts at Rs 650.
//
// The rules live here, in plain functions, so the screen and the tests use
// the SAME rules - the same ones the Partners app uses:
//   * a size is an option row of type "Size" with its own price;
//   * every size needs a name and a price above 0, and two sizes may not share
//     a name;
//   * the dish's own price is its CHEAPEST size (the server charges the
//     chosen size's own price; the dish's price is only the "from" price);
//   * sizes are shown and saved cheapest first;
//   * cooked food is not counted, so a size carries no stock.

export interface SizeRow {
  name: string;
  price: string;
}

/** One tap fills the names; the shop types only the prices. */
export const QUICK_SETS: string[][] = [
  ["Small", "Medium", "Large"],
  ['7"', '11"', '13"', '16"'],
  ["Half", "Full"],
  ["500 ml", "1 L", "1.5 L"],
];

function money(s: string): number | null {
  const n = parseFloat(String(s ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The rows that say something - a name or a price. */
export function usedSizes(rows: SizeRow[]): SizeRow[] {
  return rows.filter((r) => r.name.trim() !== "" || r.price.trim() !== "");
}

/** What still stops a save, in words - or null. */
export function sizesProblem(rows: SizeRow[]): string | null {
  const used = usedSizes(rows);
  if (used.length === 0) return "Add at least one size, or choose One price";
  const seen = new Set<string>();
  for (const r of used) {
    const n = r.name.trim();
    if (!n) return "Type a name for every size";
    if (money(r.price) === null) return `Type a price for ${n}`;
    const k = n.toLowerCase();
    if (seen.has(k)) return `Two sizes are both called ${n}`;
    seen.add(k);
  }
  return null;
}

/** The cheapest size's price - the dish's own ("from") price. */
export function cheapestSize(rows: SizeRow[]): number | null {
  let low: number | null = null;
  for (const r of usedSizes(rows)) {
    const p = money(r.price);
    if (p !== null && (low === null || p < low)) low = p;
  }
  return low;
}

/** Cheapest first; two at the same price keep their order; a row without a
 *  price goes last. */
export function cheapestFirst(rows: SizeRow[]): SizeRow[] {
  return rows
    .map((r, i) => ({ r, i, p: money(r.price) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.i - b.i))
    .map((x) => x.r);
}

/** What the server's options door (PUT /menu/{id}/variants) is sent. */
export function sizesToVariants(rows: SizeRow[]) {
  return cheapestFirst(usedSizes(rows)).map((r) => ({
    variant_type: "Size",
    variant_value: r.name.trim(),
    price_override: money(r.price) as number,
  }));
}

/** A product's options are sizes when every one of them is of type "Size".
 *  Extras (Mock 166) are not counted either way - see isExtra. */
export function variantsAreSizes(vs: any[]): boolean {
  const choices = Array.isArray(vs) ? vs.filter((v) => !isExtra(v)) : [];
  return (
    choices.length > 0 &&
    choices.every((v) => String(v?.variant_type ?? "").trim().toLowerCase() === "size")
  );
}

/** The product's options as size rows, cheapest first. */
export function sizesFromVariants(vs: any[]): SizeRow[] {
  return cheapestFirst(
    (vs || []).map((v) => ({
      name: String(v?.variant_value ?? ""),
      price:
        v?.price_override != null && Number.isFinite(Number(v.price_override))
          ? String(Number(v.price_override))
          : "",
    })),
  );
}

/** Fills a quick set's names. Empty rows go; a name already there is not
 *  added twice; prices already typed stay. */
export function quickFill(rows: SizeRow[], names: string[]): SizeRow[] {
  const kept = rows.filter((r) => r.name.trim() !== "" || r.price.trim() !== "");
  const have = new Set(kept.map((r) => r.name.trim().toLowerCase()));
  return [
    ...kept,
    ...names.filter((n) => !have.has(n.toLowerCase())).map((n) => ({ name: n, price: "" })),
  ];
}

// EXTRAS - "Extra cheese + Rs 150" (Mock 166, approved by Sana 6 Oct 2026,
// choice A). The same rules as the Partners app and the server
// (backend/extras.py):
//   * an extra is an option row of type "Extra"; its price is what it ADDS,
//     whatever size is chosen - not a whole price;
//   * a customer may tick none, one or several, on top of the one size;
//   * the dish's discount comes off the whole line, extras included;
//   * every extra needs a name and an amount (0 is allowed - a free extra),
//     and two extras may not share a name; extras carry no stock.

export interface ExtraRow {
  name: string;
  adds: string;
}

/** Ideas for the first extra, one click each. */
export const QUICK_EXTRAS: ExtraRow[] = [
  { name: "Extra cheese", adds: "150" },
  { name: "Extra chicken", adds: "200" },
  { name: "Stuffed crust", adds: "250" },
  { name: "Extra sauce", adds: "50" },
];

/** Is this option row an extra (adds to the price) rather than a choice? */
export function isExtra(v: any): boolean {
  return String(v?.variant_type ?? "").trim().toLowerCase() === "extra";
}

function amount(s: string): number | null {
  const t = String(s ?? "").trim();
  if (t === "") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The extra rows that say something - a name or an amount. */
export function usedExtras(rows: ExtraRow[]): ExtraRow[] {
  return rows.filter((r) => r.name.trim() !== "" || r.adds.trim() !== "");
}

/** What still stops a save, in words - or null. No extras is fine. */
export function extrasProblem(rows: ExtraRow[]): string | null {
  const seen = new Set<string>();
  for (const r of usedExtras(rows)) {
    const n = r.name.trim();
    if (!n) return "Type a name for every extra";
    if (amount(r.adds) === null) return `Type what ${n} adds (0 if it is free)`;
    const k = n.toLowerCase();
    if (seen.has(k)) return `Two extras are both called ${n}`;
    seen.add(k);
  }
  return null;
}

/** What the server's options door is sent for the extras, in the shop's order. */
export function extrasToVariants(rows: ExtraRow[]) {
  return usedExtras(rows).map((r) => ({
    variant_type: "Extra",
    variant_value: r.name.trim(),
    price_override: amount(r.adds) as number,
  }));
}

/** A product's extras as rows, in the order they came. */
export function extrasFromVariants(vs: any[]): ExtraRow[] {
  return (vs || []).filter(isExtra).map((v) => ({
    name: String(v?.variant_value ?? ""),
    adds:
      v?.price_override != null && Number.isFinite(Number(v.price_override))
        ? String(Number(v.price_override))
        : "",
  }));
}
