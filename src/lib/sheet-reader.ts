/**
 * READING A SHOPKEEPER'S PRICE LIST.  (Mock 107 v2, approved 22 Sep 2026.)
 *
 * WHAT THIS IS FOR
 * Muhammad Ilyas Khan is handed a list of products and has to get it into
 * Takal. It arrives as a .csv, as an Excel file, or pasted into a message. Its
 * columns say "Item" and "Rate", because that is what the shopkeeper calls
 * them - not "name" and "price", which is what Takal calls them.
 *
 * WHAT LIVES HERE
 *   * a CSV parser that survives the things real spreadsheets do;
 *   * the same for a paste straight out of Excel, which is tab-separated;
 *   * a first guess at which of his columns is which of ours;
 *   * turning the finished mapping back into the exact CSV the server's
 *     bulk-import already understands.
 *
 * .xlsx is NOT here. A spreadsheet is a zip of XML and cannot be read without
 * a library, and this panel deliberately carries only what it imports. The
 * server reads those, with openpyxl, at /admin/vendor-intake/read-sheet.
 *
 * NOTHING HERE TOUCHES THE DATABASE. It is all pure text in, text out, so
 * every rule below can be checked on its own - and is, in
 * tests/add-a-whole-catalogue.test.ts.
 */

export type Sheet = { columns: string[]; rows: string[][] };

/** The fields Takal understands. Anything else a sheet carries becomes a
 *  product detail, which is what the server does with an unknown column. */
export const OUR_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "price", label: "Price", required: true },
  { key: "category", label: "Category", required: false },
  { key: "description", label: "Description", required: false },
  { key: "stock", label: "Stock", required: false },
  { key: "discount_percent", label: "Discount %", required: false },
  { key: "image_url", label: "Photo address", required: false },
] as const;

export type FieldKey = (typeof OUR_FIELDS)[number]["key"];

/** What a column can be set to: one of ours, a product detail, or ignored. */
export const DETAIL = "__detail__";
export const IGNORE = "__ignore__";

/**
 * Split one line of CSV.
 *
 * Written out rather than `line.split(",")`, because a real price list says
 *     "Chapli Kabab, large",1600
 * and a plain split turns one product into two columns and loses the price.
 * Doubled quotes inside a quoted field ("") are one quote, which is how every
 * spreadsheet writes a quote.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Turn CSV text into columns and rows.
 *
 * Handles the three things that come off real machines:
 *   * Windows line endings, which would otherwise leave "\r" on the last
 *     column of every row and make "1600\r" not a number;
 *   * the byte-order mark Excel writes at the start of a UTF-8 CSV, which
 *     would otherwise make the first heading "﻿Item" and match nothing;
 *   * blank rows, which Excel leaves behind in their hundreds.
 *
 * A field containing a line break inside quotes is NOT supported, and that is
 * a deliberate limit: it is rare in a price list, and supporting it means a
 * character-by-character parser over the whole file for no real gain. Such a
 * row simply arrives split, and the person sees it in the preview.
 */
export function parseCsv(text: string): Sheet {
  const clean = (text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = splitCsvLine(lines[0]);
  while (columns.length && !columns[columns.length - 1]) columns.pop();
  const rows = lines.slice(1).map((l) => {
    const cells = splitCsvLine(l).slice(0, columns.length);
    while (cells.length < columns.length) cells.push("");
    return cells;
  }).filter((cells) => cells.some((c) => c !== ""));
  return { columns, rows };
}

/**
 * The same, for a block copied straight out of Excel.
 *
 * Excel puts a TAB between cells when you copy, not a comma, and it does not
 * quote anything. Telling somebody to save the file first is a step that loses
 * half of them, so paste is a door of its own.
 */
export function parsePasted(text: string): Sheet {
  const clean = (text || "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { columns: [], rows: [] };
  const cut = (l: string) => l.split("\t").map((c) => c.trim());
  const columns = cut(lines[0]);
  while (columns.length && !columns[columns.length - 1]) columns.pop();
  const rows = lines.slice(1).map((l) => {
    const cells = cut(l).slice(0, columns.length);
    while (cells.length < columns.length) cells.push("");
    return cells;
  }).filter((cells) => cells.some((c) => c !== ""));
  return { columns, rows };
}

/**
 * A FIRST GUESS at what each of his columns means.
 *
 * A guess, and the screen shows it as one: every line has a dropdown beside
 * it and the person can change any of them. Guessing badly costs a moment;
 * guessing nothing costs seven dropdowns on every single upload.
 *
 * The words below are what Pakistani shopkeepers' sheets actually say.
 */
const HINTS: Record<FieldKey, string[]> = {
  name: ["name", "item", "itemname", "product", "productname", "title",
         "description of item", "particulars", "goods", "article"],
  price: ["price", "rate", "amount", "cost", "mrp", "sellingprice",
          "saleprice", "unitprice", "rs", "pkr"],
  category: ["category", "type", "group", "section", "department", "kind"],
  description: ["description", "details", "detail", "note", "notes", "about"],
  stock: ["stock", "qty", "quantity", "instock", "available", "count",
          "balance", "onhand"],
  discount_percent: ["discount", "discountpercent", "off", "percentoff",
                     "disc"],
  image_url: ["image", "imageurl", "photo", "photourl", "picture", "img",
              "link"],
};

const flatten = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Guess a mapping for every column.
 *
 * Returns one entry per column: a field key, DETAIL, or IGNORE. A field is
 * never guessed twice - the FIRST column that looks like the price is the
 * price, and a second one ("old rate", "cost price") becomes a detail rather
 * than silently overwriting it.
 */
export function guessMapping(columns: string[]): string[] {
  const taken = new Set<string>();
  return columns.map((raw) => {
    const flat = flatten(raw);
    if (!flat) return IGNORE;
    for (const [field, words] of Object.entries(HINTS) as [FieldKey, string[]][]) {
      if (taken.has(field)) continue;
      // Exact first, so "price" beats "oldprice" for the `price` slot.
      if (words.includes(flat)) { taken.add(field); return field; }
    }
    for (const [field, words] of Object.entries(HINTS) as [FieldKey, string[]][]) {
      if (taken.has(field)) continue;
      if (words.some((w) => w.length >= 4 && flat.includes(w))) {
        taken.add(field);
        return field;
      }
    }
    // Anything unrecognised is KEPT as a product detail, never thrown away.
    // "Brand", "Material", "Size" are the reason customers can search.
    return DETAIL;
  });
}

/** What is stopping this mapping from being used, in words. "" when nothing is. */
export function whyNotImport(mapping: string[]): string {
  const has = (k: FieldKey) => mapping.includes(k);
  if (!has("name")) return "Say which column is the product Name.";
  if (!has("price")) return "Say which column is the Price.";
  return "";
}

/**
 * Turn the sheet plus the mapping into the exact CSV the server already
 * understands.
 *
 * Built here rather than sending the mapping to the server on purpose: the
 * writing door - /restaurants/{id}/menu/bulk-import - already refuses a name
 * the shop has and a name repeated in one file, and ONE door that writes
 * products is far easier to keep right than two.
 *
 * Every value is quoted and every quote doubled, so a product called
 * `Chapli Kabab, large` or `6" Pizza` arrives as one field.
 */
export function toServerCsv(sheet: Sheet, mapping: string[]): string {
  const cols: { index: number; head: string }[] = [];
  mapping.forEach((m, i) => {
    if (m === IGNORE) return;
    if (m === DETAIL) {
      const head = (sheet.columns[i] || "").trim();
      // A detail with no heading has no name to be shown under.
      if (head) cols.push({ index: i, head });
      return;
    }
    cols.push({ index: i, head: m });
  });
  const cell = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => cell(c.head)).join(",")];
  for (const row of sheet.rows) {
    lines.push(cols.map((c) => cell(row[c.index] ?? "")).join(","));
  }
  return lines.join("\n");
}

/**
 * What will happen to each row, BEFORE anything is saved.
 *
 * The whole point of the rewrite. Version one told somebody what had gone
 * wrong after it had already been written to their shop.
 */
export type RowVerdict = {
  row: number;            // the row number in HIS sheet, header included
  name: string;
  price: string;
  what: string;           // a sentence
  tone: "good" | "warn" | "busy";
};

/** A price the shopkeeper typed, as a number - or null if it is not one.
 *  "Rs 1,600" and "1600.00" are prices. "2,4OO" is a letter O and is not. */
export function priceOf(raw: string): number | null {
  const t = String(raw ?? "").replace(/[\s,]/g, "").replace(/^(rs|pkr)/i, "");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function checkRows(
  sheet: Sheet, mapping: string[], existingNames: string[],
): RowVerdict[] {
  const at = (k: FieldKey) => mapping.indexOf(k);
  const iName = at("name");
  const iPrice = at("price");
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const already = new Set(existingNames.map(key));
  const seen = new Set<string>();

  return sheet.rows.map((cells, i) => {
    const name = (cells[iName] ?? "").trim();
    const priceRaw = (cells[iPrice] ?? "").trim();
    const row = i + 2;                       // row 1 is the heading
    if (!name) {
      return { row, name: "", price: priceRaw,
               what: "No name — will be left out", tone: "warn" as const };
    }
    const k = key(name);
    if (seen.has(k)) {
      return { row, name, price: priceRaw,
               what: "Twice in this file — added once", tone: "busy" as const };
    }
    seen.add(k);
    if (already.has(k)) {
      return { row, name, price: priceRaw,
               what: "Already in this shop — skipped", tone: "busy" as const };
    }
    if (priceRaw === "") {
      return { row, name, price: priceRaw,
               what: "No price — will be left out", tone: "warn" as const };
    }
    if (priceOf(priceRaw) === null) {
      return { row, name, price: priceRaw,
               what: "That is not a number — check it", tone: "warn" as const };
    }
    return { row, name, price: priceRaw,
             what: "Will be added", tone: "good" as const };
  });
}
