// SIZES IN A SHEET (Mock 164, approved by Sana 5 October 2026).
//
// A price list with one row per size goes in as ONE product with sizes. The
// preview here must say what the server's upload will do, so it uses the SAME
// rules (swat-delivery-app/backend/size_names.py) and is checked against the
// same names as the server's tests/test_sizes_in_a_sheet.py.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkRows, guessMapping, parseCsv, splitSize, toServerCsv } from "../src/lib/sheet-reader.ts";

function code(path: string): string {
  return readFileSync(path, "utf8").split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
}

const SHEET = parseCsv([
  "Item,Size,Rate,Category",
  "Chicken Tikka Pizza,Medium,1300,Pizza",
  "Chicken Tikka Pizza,Small,650,Pizza",
  "Chicken Tikka Pizza,Large,1700,Pizza",
  "Zinger Burger,,450,Burgers",
  "Chicken Karahi,Half,1100,Karahi",
  "Chicken Karahi,Full,2000,Karahi",
  // Inches inside a CSV are written the way every spreadsheet writes a quote.
  '"Malai Boti Pizza Large 12""",,2300,Pizza',
  '"Malai Boti Pizza Small 8""",,750,Pizza',
  "Chargha Half,,900,Grill",
].join("\n"));

test("the same names as the server's rules", () => {
  assert.deepEqual(splitSize('Malai Boti Pizza Large 12"'), ["Malai Boti Pizza", 'Large 12"']);
  assert.deepEqual(splitSize("Chicken Karahi Half"), ["Chicken Karahi", "Half"]);
  assert.deepEqual(splitSize("Small Fries"), ["Fries", "Small"]);
  assert.deepEqual(splitSize('Chicken Tikka B.B.Q Pizza R 7"'), ["Chicken Tikka B.B.Q Pizza", 'Regular 7"']);
  assert.equal(splitSize("Cheese Lover Large Pizza"), null);
  assert.equal(splitSize("Zinger Burger"), null);
});

test("a Size column is matched by itself", () => {
  assert.deepEqual(guessMapping(["Item", "Size", "Rate", "Category"]), ["name", "size", "price", "category"]);
  assert.deepEqual(guessMapping(["Name", "Portion", "Price"]), ["name", "size", "price"]);
});

test("rows of one dish become one product with its sizes", () => {
  const map = guessMapping(SHEET.columns);
  const v = checkRows(SHEET, map, []);
  const heads = v.filter((x) => x.head);
  assert.deepEqual(heads.map((x) => x.name), ["Chicken Tikka Pizza", "Chicken Karahi", "Malai Boti Pizza"]);
  assert.equal(heads[0].what, "Will be added with 3 sizes");
  assert.equal(heads[0].price, "650", "the dish costs its cheapest size");
  assert.equal(heads[2].price, "750");
  // Further sizes sit under their dish, not as products of their own.
  assert.equal(v[1].what, "Size of Chicken Tikka Pizza");
  // One row alone stays as it is.
  assert.equal(v[8].name, "Chargha Half");
  assert.equal(v[8].what, "Will be added");
  // 5 products from 9 rows.
  const products = v.filter((x) => !x.size || x.head).filter((x) => x.tone === "good");
  assert.equal(products.length, 5);
});

test("a size with no price, or written twice, needs a look", () => {
  const s = parseCsv(["Name,Size,Price", "Tikka,Small,650", "Tikka,Large,", "Fries,Small,200", "Fries,small,300"].join("\n"));
  const v = checkRows(s, ["name", "size", "price"], []);
  assert.equal(v[1].tone, "warn");
  assert.match(v[1].what, /No price for Large/);
  assert.equal(v[2].tone, "warn");
  assert.match(v[2].what, /written twice/);
});

test("the size column goes to the server under the name the server reads", () => {
  const csv = toServerCsv(SHEET, guessMapping(SHEET.columns));
  assert.equal(csv.split("\n")[0], '"name","size","price","category"');
});

// Mock 184 (13 Oct 2026) replaced the page: the server reads the list now
// (catalogue_engine.py), sizes are one of eight option kinds, and step 4
// counts products and joined rows the same way.
test("the page shows the options and counts products, not rows", () => {
  const s = code("src/app/dashboard/stores/[id]/catalogue/parts-check.tsx");
  assert.ok(s.includes("with options ({c.rows_joined.toLocaleString()} rows joined)"));
  assert.ok(s.includes('{c.products.toLocaleString()} product{c.products === 1 ? "" : "s"}'));
  assert.ok(code("src/app/dashboard/stores/[id]/catalogue/page.tsx").includes("Options? Put each one on its own row."));
});

// The server adds NOTHING when one row is bad, so the preview must never say a
// bad row "will be left out" - that promises the rest still goes in.
test("a row with no name or no price says it stops the upload", () => {
  const s = parseCsv(["Name,Price", "Rice,450", ",300", "Daal,"].join("\n"));
  const v = checkRows(s, ["name", "price"], []);
  for (const r of [v[1], v[2]]) {
    assert.equal(r.tone, "warn");
    assert.match(r.what, /one bad row stops the whole upload/);
    assert.doesNotMatch(r.what, /left out/);
  }
  assert.equal(v[0].what, "Will be added");
});

// FIX 2 (Sana, 5 Oct 2026) made the Upload button grey while any row was
// orange, because the server added NOTHING when one row was bad. Mock 184
// (Sana, 13 Oct 2026, audit point 2) changed that rule on purpose: a bad row
// holds back only its own product, so Save is grey only when nothing is ready.
test("rows to fix no longer stop the others", () => {
  const s = code("src/app/dashboard/stores/[id]/catalogue/parts-check.tsx");
  // Mock 186: Save is grey when nothing is ready OR a loss nobody has
  // looked at is in the list (saveAllowed, tests/one-upload-page-does-everything).
  assert.ok(s.includes("disabled={!canSave}"));
  assert.ok(s.includes("const canSave = saveAllowed(r, ticked, leftOut);"));
  assert.ok(s.includes("Rows to fix do NOT stop the others"));
});

// A problem on a dish's SECOND size used to be skipped when counting, so the
// page said "0 need a look" and the button would have stayed yellow.
test("a missing price on a later size is counted as a problem", () => {
  const s = parseCsv(["Name,Size,Price", "Chicken Karahi,Half,1100", "Chicken Karahi,Full,"].join("\n"));
  const v = checkRows(s, ["name", "size", "price"], []);
  assert.equal(v[1].size, "Full");
  assert.equal(v[1].head, false);
  assert.equal(v[1].tone, "warn");
  // The page asks the SERVER now (Mock 184); the rule above stays in the lib.
  const page = code("src/app/dashboard/stores/[id]/catalogue/page.tsx");
  assert.ok(page.includes("apiClient.catalogueCheck(shopId"));
});

// The dish line must not say "Will be added" while one of its sizes is orange,
// and must not be counted as a second row to fix.
test("a dish waiting on a size with no price is not promised", () => {
  const s = parseCsv(["Name,Size,Price", "Chicken Karahi,Half,1100", "Chicken Karahi,Full,"].join("\n"));
  const v = checkRows(s, ["name", "size", "price"], []);
  assert.equal(v[0].head, true);
  assert.equal(v[0].waits, true);
  assert.notEqual(v[0].tone, "good");
  assert.equal(v[0].what, "Not added until Full has a price");
  // Mock 184: the server holds a product back while one of its rows needs
  // fixing ("waits for row N (the same product)") - backend test
  // test_a_bad_row_holds_back_only_its_own_product.
  const page = code("src/app/dashboard/stores/[id]/catalogue/parts-check.tsx");
  assert.ok(page.includes('tab === "fix" ? "WHAT TO FIX"'));
  // A clean dish still says it will be added.
  const ok = checkRows(parseCsv(["Name,Size,Price", "Tikka,Small,650", "Tikka,Large,1700"].join("\n")),
    ["name", "size", "price"], []);
  assert.equal(ok[0].what, "Will be added with 2 sizes");
});
