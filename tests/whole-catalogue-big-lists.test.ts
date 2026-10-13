// A WHOLE CATALOGUE - big lists, every option, stock, safe prices.
// (Mock 184, approved by Sana 13 October 2026.)
//
// The reading of the list is the server's (backend/catalogue_engine.py,
// tests/test_mock_184_whole_catalogue.py). These are the screen's own rules:
// parts of about 500 rows, the four tabs and their pages of 50, the category
// choices, the progress words and the final answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NO_TOTALS, PAGE_SIZE, addPart, blankSheetCsv, choicesFrom, doneLines, fromPrice, leafGroups,
  linesFor, optionColumns, pageOf, partBody, partsOf, timeLeft, wordsStillOpen,
  type CheckProduct, type CheckResult,
} from "../src/lib/catalogue-flow.ts";

const code = (p: string) =>
  readFileSync(p, "utf8").split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");

const PANADOL: CheckProduct = {
  name: "Panadol Tablet", rows: [2, 3, 4, 5], price: 45, category_id: "otc", options_kind: "Strength & Pack",
  options: [
    { value: "500 mg / Strip of 10", row: 2, price: 45, stock: 120, buying_price: 38, sku: "896" },
    { value: "650 mg / Strip of 10", row: 4, price: 60, stock: 80, buying_price: 51 },
    { value: "650 mg / Box of 100", row: 5, price: 560, stock: 9, buying_price: 470 },
    { value: "500 mg / Box of 200", row: 3, price: 850, stock: 14, buying_price: 720 },
  ],
  specs: JSON.stringify({ Company: "GSK" }), rx: false,
};

function result(over: Partial<CheckResult> = {}): CheckResult {
  return {
    mode: "add", rows_read: 10, rows_dropped: 0,
    products: [PANADOL, { name: "Surbex-Z", rows: [6], price: 350, stock: 25, buying_price: 300 }],
    already: [{ row: 7, name: "Brufen", rows: [7] }], not_found: [],
    problems: [{ row: 8, name: "Gaviscon", error: "no selling price" }], notes: [],
    counts: { products: 2, with_options: 1, rows_joined: 4, already: 1, not_found: 0, problem_rows: 1,
      with_stock: 2, with_buying: 2, pictures: 0, prescription: 0 },
    parts: 1, room_today: null, daily_limit: null, fixed_price: false, mapping: [],
    ...over,
  };
}

test("parts are about 500 rows and never split a product's options", () => {
  const products: CheckProduct[] = [];
  for (let i = 0; i < 3000; i++) products.push({ ...PANADOL, name: `M${i}`, options: PANADOL.options!.slice(0, 3) });
  for (let i = 0; i < 6000; i++) products.push({ name: `S${i}`, rows: [i], price: 1 });
  const parts = partsOf(products);
  assert.equal(parts.length, 31, "15,000 rows: the same count the server gives (catalogue_engine.parts)");
  for (const p of parts) {
    const rows = p.reduce((n, i) => n + Math.max(1, (products[i].options || []).length), 0);
    assert.ok(rows <= 500, `a part of ${rows} rows`);
  }
  assert.deepEqual(parts.flat(), products.map((_, i) => i), "every product once, in order");
  const big = [{ ...PANADOL, options: Array.from({ length: 120 }, (_, i) => ({ value: `${i}`, row: i, price: 1 })) }];
  assert.equal(partsOf([...products.slice(0, 160), ...big]).length, 1 + 1, "a 120-option product is never cut");
});

test("a part sends the product without the screen's own marks", () => {
  const [p] = partBody([PANADOL], [0]);
  assert.equal(p.name, "Panadol Tablet");
  assert.equal("rows" in p, false);
  assert.equal("rx" in p, false);
  assert.deepEqual((p.options as any[])[0], { value: "500 mg / Strip of 10", price: 45, stock: 120, buying_price: 38, sku: "896" });
  assert.equal(PANADOL.options![0].row, 2, "the checked list itself is not changed");
});

test("the four tabs and search by name", () => {
  const r = result();
  assert.deepEqual(linesFor(r, "fix").map((l) => [l.row, l.error]), [[8, "no selling price"]]);
  assert.deepEqual(linesFor(r, "options").map((l) => l.name), ["Panadol Tablet"]);
  assert.deepEqual(linesFor(r, "all").map((l) => l.name), ["Panadol Tablet", "Surbex-Z"]);
  assert.deepEqual(linesFor(r, "already").map((l) => [l.kind, l.name]), [["already", "Brufen"]]);
  assert.deepEqual(linesFor(r, "all", "  surbex ").map((l) => l.name), ["Surbex-Z"]);
  const u = result({ mode: "update", already: [], not_found: [{ row: 9, name: "Nothing", rows: [9] }] });
  assert.deepEqual(linesFor(u, "already").map((l) => [l.kind, l.name]), [["not_found", "Nothing"]]);
});

test("15,000 rows are never drawn at once - pages of 50", () => {
  const list = Array.from({ length: 11434 }, (_, i) => i);
  assert.equal(PAGE_SIZE, 50);
  const first = pageOf(list, 0);
  assert.equal(first.items.length, 50);
  assert.equal(first.pages, 229);
  assert.deepEqual(pageOf(list, 999).items, list.slice(11400), "past the end: the last page");
  assert.equal(pageOf([], 0).pages, 1);
});

test("a product shows its options as columns and 'from' its cheapest", () => {
  const c = optionColumns(PANADOL);
  assert.deepEqual(c.heads, ["Strength", "Pack"]);
  assert.deepEqual(c.cells(PANADOL.options![2]), ["650 mg", "Box of 100"]);
  assert.equal(fromPrice(PANADOL), "from Rs 45");
  assert.equal(fromPrice({ name: "x", rows: [1], price: 350 }), "Rs 350");
});

test("step 3: suggestions filled in, open words listed, shelves grouped", () => {
  const words = [
    { word: "Tablet", key: "tablet", rows: 6210, suggestion: "otc", why: "remembered" },
    { word: "Device", key: "device", rows: 118, suggestion: null, why: "" },
  ];
  const ch = choicesFrom(words);
  assert.deepEqual(ch, { tablet: "otc" });
  assert.deepEqual(wordsStillOpen(words, ch).map((w) => w.word), ["Device"]);
  const g = leafGroups([
    { id: "rx", name: "Prescription", path: "Medicines > Prescription" },
    { id: "otc", name: "Over the Counter", path: "Medicines > Over the Counter" },
    { id: "fa", name: "First Aid", path: "First Aid" },
  ]);
  assert.deepEqual(g.map((x) => [x.group, x.leaves.length]), [["Medicines", 2], ["", 1]]);
});

test("progress words", () => {
  assert.equal(timeLeft(60000, 10, 13), "About 1 minute left.");
  assert.equal(timeLeft(10 * 60000, 10, 13), "About 13 minutes left.");
  assert.equal(timeLeft(5000, 10, 1), "Less than a minute left.");
  assert.equal(timeLeft(0, 0, 23), "");
});

test("the running totals and the one clear answer", () => {
  let t = addPart(NO_TOTALS, { added: [{ id: "a" }, { id: "b" }], skipped: ["Brufen"], pictures_queued: 2 });
  t = addPart(t, { added: [{ id: "c" }], skipped: [] });
  assert.deepEqual(t.ids, ["a", "b", "c"]);
  assert.equal(t.added, 3);
  assert.equal(t.pictures, 2);
  assert.deepEqual(doneLines("add", t, result()), [
    "3 products added - 1 with options",
    "2 already in the shop, left as they are",
    "1 row needs fixing - nothing else waits for them",
    "Stock filled on every product and option that had a quantity",
    "Buying prices filled - private, never shown to customers",
  ]);
  const u = addPart(NO_TOTALS, { updated: [{ id: "x" }], unchanged: 4, not_found: ["N"], options_not_found: ["P - 1g"] });
  const lines = doneLines("update", u, result({ mode: "update", counts: { ...result().counts, problem_rows: 0, with_stock: 0, with_buying: 0, not_found: 2 } }));
  assert.deepEqual(lines, ["1 product updated", "4 already had these prices and stock",
    "3 not in this shop - nothing new is added in Update", "1 option not found on the product"]);
});

test("the blank sheet carries the new headings", () => {
  const head = blankSheetCsv().split("\n")[0];
  assert.equal(head, "Name,Strength,Pack,Category,Buying price (TP),Selling price (MRP),Stock,Barcode,Company");
});

test("the page: five steps, two modes, the server reads the list, money stays private", () => {
  const page = code("src/app/dashboard/stores/[id]/catalogue/page.tsx");
  assert.ok(page.includes('const STEPS = ["List", "Columns", "Categories", "Check", "Save"] as const;'));
  assert.ok(page.includes("➕ Add new products") && page.includes("🔄 Update prices and stock"));
  for (const call of ["catalogueColumns(", "catalogueWords(", "catalogueCheck(", "catalogueRememberWords(",
    "catalogueFixFile("]) assert.ok(page.includes(call), call);
  assert.ok(page.includes("never shown"), "a buying-price column is marked private");
  const save = code("src/app/dashboard/stores/[id]/catalogue/parts-save.tsx");
  assert.ok(save.includes("apiClient.catalogueSavePart(shopId, r.mode, partBody(r.products, parts[i]))"));
  assert.ok(save.includes("Save again - from part {next + 1}"), "a dropped part carries on");
  assert.ok(save.includes("apiClient.catalogueUndo(shopId, totals.ids)"));
  const api = code("src/lib/api-stores.ts");
  assert.ok(api.includes('timeoutMs: 180000'), "the check of 15,000 rows may take longer than 15 s");
  assert.match(api, /catalogueSavePart[\s\S]{0,300}timeoutMs: 120000/);
});

test("the prescription switch is on Settings > General, and the office sees the photo on an order", () => {
  const card = code("src/app/dashboard/settings/parts-prescription.tsx");
  assert.ok(card.includes("apiClient.updateSettings({ prescription_photo_enabled: !on })"));
  assert.ok(card.includes("Let customers add a prescription photo"));
  assert.ok(card.includes("Not switched on yet - database step 133 has not been run."));
  assert.ok(code("src/app/dashboard/settings/page.tsx").includes("<PrescriptionSwitch />"));
  const panel = code("src/app/dashboard/orders/parts-order-panel.tsx");
  assert.ok(panel.includes("{o.prescription_path ? ("));
  const photo = code("src/app/dashboard/orders/parts-prescription.tsx");
  assert.ok(photo.includes("apiClient.getOrderPrescription(orderId)"));
  assert.ok(photo.includes("isSafeCnicLink(d.url)"), "only a link the store signed is shown");
  const api = code("src/lib/api-people.ts");
  assert.ok(api.includes("/admin/orders/${encodeURIComponent(orderId)}/prescription?t=${Date.now()}"),
    "never a cached (dead) link");
});
