// Does the spreadsheet export stay safe?
//
// WHY THIS TEST EXISTS: every export in this panel carries text that people
// typed - customer names, addresses, audit-log actions. A cell that starts
// with "=" is run as a formula the moment somebody opens the file in Excel.
// The Reports page once had its own copy of this writer with the guard left
// out. A test is how that stops being possible to reintroduce quietly.

import { test } from "node:test";
import assert from "node:assert/strict";
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
