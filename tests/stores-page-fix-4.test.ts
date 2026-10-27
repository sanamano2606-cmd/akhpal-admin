// STORES PAGE FIX 4 (Sana, 12 October 2026: "OK fix 4") - a tidier list.
//
// Shop, store type and owner sit in ONE column (they were three), a name is at
// most two lines (a 45-letter mall-store name used to wrap onto 4-6), rows are
// tighter, and the Actions column is pinned to the right edge so it is never
// scrolled off a laptop screen. Commission, delivery fee and Open stay in the
// list, editable as before (Sana's D3: sub-admins may not set them elsewhere).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const page = readFileSync(join(ROOT, "src/app/dashboard/stores/page.tsx"), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("shop, type and owner are one column", () => {
  assert.match(page, />Shop · type · owner<\/th>/);
  assert.doesNotMatch(page, />Store Type<\/th>/);
  assert.doesNotMatch(page, />Owner<\/th>/);
  // Mock 211: the Waiting list has its own six columns.
  assert.match(page, /const cols = waitingView \? 6 : slim \? 4 : 7;/);
});

// Mock 189 (Sana 14 Oct 2026, "This screen also too spreader"): ONE line now,
// so every store is one row high. The whole name is still on hover.
test("a long name is one line at most, the whole name on hover", () => {
  assert.match(page, /title=\{restaurant\.name \|\| ""\}\s*\n\s*className="line-clamp-1/);
});

test("the store type can still be changed from the list", () => {
  assert.match(page, /onClick=\{\(\) => setEditTypeId\(restaurant\.id\)\}/);
  assert.match(page, /onChange=\{\(e\) => saveVendorType\(restaurant\.id, e\.target\.value\)\}/);
});

test("the Actions column is pinned to the right edge", () => {
  assert.match(page, /<th className="sticky right-0[^"]*">Actions<\/th>/);
  assert.match(page, /<td className="sticky right-0 bg-white/);
});

test("commission, delivery fee and open stay in the list (D3)", () => {
  assert.match(page, />Commission<\/th>/);
  assert.match(page, />Delivery fee<\/th>/);
  assert.match(page, /onClick=\{\(\) => saveCommission\(restaurant\.id\)\}/);
  assert.match(page, /onClick=\{\(\) => saveDeliveryFee\(restaurant\.id\)\}/);
  // Fix 8: still in the list; closing now asks first.
  assert.match(page, /onClick=\{\(\) => restaurant\.is_open \? setClosing\(restaurant\) : toggleOpen\(restaurant\)\}/);
});

test("rows are tighter", () => {
  const table = page.slice(page.indexOf('<table className="w-full">'), page.indexOf("</table>"));
  assert.doesNotMatch(table, /px-6 py-4/);
});
