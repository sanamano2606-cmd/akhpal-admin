// ADDING A WHOLE CATALOGUE.  (Mock 107 v2, approved by Sana 22 September 2026.)
//
// WHAT VERSION ONE GOT WRONG
//   * it took a .csv only, with OUR exact column names, from a shopkeeper who
//     sends an Excel file whose columns say "Item" and "Rate";
//   * it reported the mistakes AFTER everything had been written to the shop.
//
// Every rule below is the thing that stops one of those. The parsing is pure
// text in, text out, so it is all checkable here without a browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DETAIL, IGNORE, OUR_FIELDS,
  checkRows, guessMapping, parseCsv, parsePasted, priceOf, splitCsvLine,
  toServerCsv, whyNotImport,
} from "../src/lib/sheet-reader.ts";

// ── one line of CSV ─────────────────────────────────────────────────────────

test("a comma inside quotes does not split a product in two", () => {
  // The real case: `"Chapli Kabab, large",1600`. A plain split loses the price.
  assert.deepEqual(splitCsvLine('"Chapli Kabab, large",1600'),
    ["Chapli Kabab, large", "1600"]);
});

test("a doubled quote is one quote", () => {
  assert.deepEqual(splitCsvLine('"6"" Pizza",900'), ['6" Pizza', "900"]);
});

test("empty cells survive", () => {
  assert.deepEqual(splitCsvLine("Kabab,,20"), ["Kabab", "", "20"]);
});

// ── a whole file ────────────────────────────────────────────────────────────

test("Windows line endings do not make the price not a number", () => {
  const s = parseCsv("Item,Rate\r\nChapli Kabab,1600\r\n");
  assert.deepEqual(s.columns, ["Item", "Rate"]);
  assert.deepEqual(s.rows, [["Chapli Kabab", "1600"]]);
});

test("Excel's byte-order mark does not become part of the first heading", () => {
  // Without this, the first column is "﻿Item" and matches nothing.
  const s = parseCsv("﻿Item,Rate\nChapli Kabab,1600");
  assert.equal(s.columns[0], "Item");
});

test("the blank rows Excel leaves behind are dropped", () => {
  const s = parseCsv("Item,Rate\nA,1\n\n\nB,2\n,\n");
  assert.equal(s.rows.length, 2);
});

test("a short row is padded, not lost", () => {
  const s = parseCsv("Item,Rate,Qty\nChapli Kabab,1600");
  assert.deepEqual(s.rows[0], ["Chapli Kabab", "1600", ""]);
});

test("nothing at all does not throw", () => {
  assert.deepEqual(parseCsv("").rows, []);
  assert.deepEqual(parsePasted("").columns, []);
});

test("a paste out of Excel is split on tabs", () => {
  const s = parsePasted("Item\tRate\nChapli Kabab\t1600");
  assert.deepEqual(s.columns, ["Item", "Rate"]);
  assert.deepEqual(s.rows, [["Chapli Kabab", "1600"]]);
});

// ── guessing the columns ────────────────────────────────────────────────────

test("a real shopkeeper's headings are recognised", () => {
  const m = guessMapping(["Item", "Rate", "Qty", "Category"]);
  assert.deepEqual(m, ["name", "price", "stock", "category"]);
});

test("our own headings are recognised too", () => {
  const m = guessMapping(["name", "price", "stock"]);
  assert.deepEqual(m, ["name", "price", "stock"]);
});

test("capitals, spaces and punctuation do not matter", () => {
  assert.deepEqual(guessMapping(["  ITEM NAME ", "Unit-Price"]),
    ["name", "price"]);
});

test("a second price column does not overwrite the first", () => {
  // "Cost price" beside "Rate" is common. Whichever comes first wins, and the
  // other is kept as a detail - never silently used as THE price.
  const m = guessMapping(["Item", "Rate", "Cost Price"]);
  assert.equal(m[1], "price");
  assert.notEqual(m[2], "price");
});

test("an unknown column is KEPT as a product detail, never thrown away", () => {
  // Brand, Material and Size are the reason a customer can search.
  const m = guessMapping(["Item", "Rate", "Brand", "Material"]);
  assert.equal(m[2], DETAIL);
  assert.equal(m[3], DETAIL);
});

test("a column with no heading at all is ignored", () => {
  assert.equal(guessMapping(["Item", "   "])[1], IGNORE);
});

// ── may we import ───────────────────────────────────────────────────────────

test("a name and a price are required, and it says which is missing", () => {
  assert.match(whyNotImport([DETAIL, DETAIL]), /Name/);
  assert.match(whyNotImport(["name", DETAIL]), /Price/);
  assert.equal(whyNotImport(["name", "price"]), "");
});

// ── what will happen to each row ────────────────────────────────────────────

const SHEET = parseCsv([
  "Item,Rate",
  "Chapli Kabab,1600",
  "Chicken Karahi,1450",
  "Kabuli Pulao,900",
  "Chapli Kabab,1700",
  "Seekh Kabab,",
  "Mutton Karahi,\"2,4OO\"",
  ",500",
].join("\n"));
const MAP = ["name", "price"];

test("every row is judged BEFORE anything is saved", () => {
  const v = checkRows(SHEET, MAP, ["Kabuli Pulao"]);
  assert.equal(v.length, 7);
  assert.equal(v[0].what, "Will be added");
  assert.equal(v[2].what, "Already in this shop — skipped");
  assert.equal(v[3].what, "Twice in this file — added once");
  assert.match(v[4].what, /No price/);
  assert.match(v[5].what, /not a number/);
  assert.match(v[6].what, /No name/);
});

test("the row number is the one in HIS sheet", () => {
  // Row 1 is the heading. Telling somebody "row 3" when their screen says
  // row 4 is worse than saying nothing.
  const v = checkRows(SHEET, MAP, []);
  assert.equal(v[0].row, 2);
  assert.equal(v[6].row, 8);
});

test("an existing product is matched however it is capitalised", () => {
  const v = checkRows(SHEET, MAP, ["  chapli   kabab "]);
  assert.match(v[0].what, /Already in this shop/);
});

// ── a price a shopkeeper actually types ─────────────────────────────────────

test("prices people really write are accepted", () => {
  assert.equal(priceOf("1600"), 1600);
  assert.equal(priceOf("1,600"), 1600);
  assert.equal(priceOf("Rs 1600"), 1600);
  assert.equal(priceOf("1600.50"), 1600.5);
  assert.equal(priceOf(" 900 "), 900);
});

test("things that are not prices are refused", () => {
  assert.equal(priceOf("2,4OO"), null, "that is a letter O");
  assert.equal(priceOf(""), null);
  assert.equal(priceOf("call us"), null);
  assert.equal(priceOf("-500"), null);
});

// ── the CSV the server is given ─────────────────────────────────────────────

test("the mapping is applied, with OUR names on the columns", () => {
  const out = parseCsv(toServerCsv(SHEET, MAP));
  assert.deepEqual(out.columns, ["name", "price"]);
  assert.deepEqual(out.rows[0], ["Chapli Kabab", "1600"]);
});

test("an ignored column is left out and a detail keeps its own heading", () => {
  const s = parseCsv("Item,Rate,Brand,Old code\nEarbuds,3500,Ronin,KR-114");
  const out = parseCsv(toServerCsv(s, ["name", "price", DETAIL, IGNORE]));
  assert.deepEqual(out.columns, ["name", "price", "Brand"]);
  assert.deepEqual(out.rows[0], ["Earbuds", "3500", "Ronin"]);
});

test("a product name with a comma or a quote survives the round trip", () => {
  const s = parseCsv('Item,Rate\n"Chapli Kabab, large",1600\n"6"" Pizza",900');
  const out = parseCsv(toServerCsv(s, ["name", "price"]));
  assert.deepEqual(out.rows[0], ["Chapli Kabab, large", "1600"]);
  assert.deepEqual(out.rows[1], ['6" Pizza', "900"]);
});

test("the column names it writes are the ones the server reads", () => {
  // backend/routers/menu.py:bulk_import_menu knows exactly these words. If one
  // is renamed on either side, this fails instead of quietly dropping a column.
  const server = readFileSync(
    new URL("../../swat-delivery-app/backend/routers/menu.py", import.meta.url),
    "utf8");
  const known = server.slice(server.indexOf('known = {"name"'));
  for (const f of OUR_FIELDS) {
    assert.ok(known.includes(`"${f.key}"`),
      `the server does not know the column "${f.key}"`);
  }
});
