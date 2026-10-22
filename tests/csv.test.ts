// Does the spreadsheet export stay safe?
//
// WHY THIS TEST EXISTS: every export in this panel carries text that people
// typed - customer names, addresses, audit-log actions. A cell that starts
// with "=" is run as a formula the moment somebody opens the file in Excel.
// The Reports page once had its own copy of this writer with the guard left
// out. A test is how that stops being possible to reintroduce quietly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { csvCell, buildCsv } from "../src/lib/csv.ts";

test("a formula is defused, not executed", () => {
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("@SUM(A1:A9)"), `"'@SUM(A1:A9)"`);
  assert.equal(csvCell("+44 300 123"), `"'+44 300 123"`);
});

test("a real negative number is left alone so the sheet still adds up", () => {
  assert.equal(csvCell("-50"), `"-50"`);
  assert.equal(csvCell(-50), `"-50"`);
  assert.equal(csvCell("-12.75"), `"-12.75"`);
});

test("ordinary text passes through, quotes are doubled", () => {
  assert.equal(csvCell("Matti Restaurant"), `"Matti Restaurant"`);
  assert.equal(csvCell('He said "hello"'), `"He said ""hello"""`);
});

test("empty and missing values become an empty cell, never the word undefined", () => {
  assert.equal(csvCell(null), `""`);
  assert.equal(csvCell(undefined), `""`);
  assert.equal(csvCell(""), `""`);
});

test("buildCsv writes a header row and one row per record", () => {
  const csv = buildCsv(
    [
      { name: "PK store", owed: 2999 },
      { name: "Matti Restaurant", owed: 1559 },
    ],
    [
      { key: "name", label: "Store" },
      { key: "owed", label: "Owed" },
    ]
  );
  assert.equal(csv, '"Store","Owed"\n"PK store","2999"\n"Matti Restaurant","1559"');
});

test("buildCsv returns nothing for no rows, so the caller can say so", () => {
  assert.equal(buildCsv([]), "");
  assert.equal(buildCsv(null as any), "");
});

test("a dangerous value inside real data is still defused", () => {
  const csv = buildCsv([{ action: '=HYPERLINK("http://bad","click")' }]);
  assert.ok(csv.includes(`"'=HYPERLINK`), "formula must be prefixed with a quote");
});

// ─── WHOLE RUPEES IN EVERY DOWNLOAD (money audit AREA-6-9, 21 Oct 2026) ─────
//
// The screens print whole rupees; the exports wrote the server's two decimals
// as they came - a rider wage of Rs 143.90 went into the sheet as 143.9 while
// the screen beside it said Rs 144.

import { csvRupees } from "../src/lib/csv.ts";
import { roundRupees } from "../src/lib/format.ts";

test("a money column is written in whole rupees", () => {
  const csv = buildCsv(
    [{ name: "SANA ULLAH", wage: 143.9, chart: "12190.8" }],
    [
      { key: "name", label: "Rider" },
      { key: "wage", label: "Owed", money: true },
      { key: "chart", label: "Total", money: true },
    ],
  );
  assert.equal(csv, '"Rider","Owed","Total"\n"SANA ULLAH","144","12191"');
});

test("the download rounds exactly as the screen does (half away from zero)", () => {
  for (const v of [143.9, 143.5, 143.49, -0.5, -12.5, 0.4, 2.675, "553.40", 0]) {
    assert.equal(csvRupees(v), roundRupees(v), `value ${v}`);
  }
});

test("a blank money cell stays blank - it is not Rs 0", () => {
  const csv = buildCsv([{ a: null }, { a: "" }, { a: "n/a" }], [{ key: "a", label: "A", money: true }]);
  assert.equal(csv, '"A"\n""\n""\n"n/a"');
});

test("the money pages mark their amounts as money", () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const earnings = src("src/app/dashboard/earnings/page.tsx");
  for (const k of ["customers_paid", "commission", "markup", "price_difference", "earned"]) {
    assert.ok(new RegExp(`key: "${k}", label: "[^"]*", money: true`).test(earnings), `earnings ${k}`);
  }
  const payments = src("src/app/dashboard/payments/page.tsx");
  for (const k of ["owed", "outstanding", "cash_collected", "handed_over", "cash_outstanding",
                   "amount", "food_sales", "payout_due"]) {
    assert.ok(new RegExp(`key: "${k}", label: "[^"]*", money: true`).test(payments), `payments ${k}`);
  }
});
