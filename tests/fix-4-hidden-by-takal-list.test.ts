// FIX 4 - THE "HIDDEN BY TAKAL" LIST (All Stores audit 9 Nov 2026; Sana: "GO Fix 4").
//   * Remove on each row - the Main Admin's, asking first, through the one
//     product delete door (an ordered product is kept for old receipts);
//   * "Open store ›" opens the store WITH the product found;
//   * "Check again" only reloaded the list - it says "Reload list" now;
//   * past 500 the list says there are more (server: test_fix_4_hidden_by_takal_list.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BOX = read("src/app/dashboard/stores/parts-takal-hidden.tsx");
const LIST = read("src/app/dashboard/stores/page.tsx");
const API = read("src/lib/api-stores.ts");
const TAB = read("src/app/dashboard/stores/[id]/parts-products.tsx");

test("Remove is on the row for the Main Admin only, and asks first", () => {
  assert.match(BOX, /\{isMain && \(\s*<button type="button" data-remove-hidden disabled=\{busy\}[\s\S]{0,120}onClick=\{\(\) => setAskRemove\(p\)\}/);
  assert.match(BOX, /open=\{!!askRemove\}[\s\S]{0,200}onConfirm=\{\(\) => askRemove && remove\(askRemove\)\}/);
  assert.match(BOX, /confirmLabel="Yes, remove it"/);
});

test("Remove goes through the one product delete door, and the row leaves the list", () => {
  assert.match(BOX, /await apiClient\.deleteProduct\(p\.id\)/);
  assert.match(BOX, /toast\(res\?\.message \|\| `\$\{p\.name\} was removed`, "success"\);\s*onShown\(p\.id\);/);
  assert.match(API, /async deleteProduct\(itemId: string\) \{\s*return this\.request\(`\/menu\/\$\{itemId\}`, \{ method: "DELETE" \}\);/);
});

test("Open store opens the product itself", () => {
  assert.match(BOX, /href=\{`\/dashboard\/stores\/\$\{p\.restaurant_id\}\?product=\$\{encodeURIComponent\(p\.id\)\}&find=\$\{encodeURIComponent\(p\.name\)\}`\}/);
  // ... and the store's Products tab reads both.
  assert.match(TAB, /const f = q0\.get\("find"\);/);
  assert.match(TAB, /const id = q0\.get\("product"\);/);
});

test("the button that only reloads says Reload list", () => {
  assert.equal(/Check again/.test(BOX), false);
  assert.match(BOX, /\{loading \? "Reloading…" : "Reload list"\}/);
});

test("past 500 the list says there are more", () => {
  assert.match(API, /products: TakalHiddenProduct\[\]; more\?: boolean \}>/);
  assert.match(LIST, /setTakalMore\(got\.more === true\);/);
  assert.match(LIST, /isMain=\{isMain\} more=\{takalMore\}/);
  assert.match(BOX, /\{!failed && more && \(\s*<p data-takal-hidden-more/);
});
