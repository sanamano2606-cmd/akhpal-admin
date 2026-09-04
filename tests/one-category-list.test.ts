// ─────────────────────────────────────────────────────────────────────────────
// ONE CATEGORY LIST — the panel half.
//
// Sana, 4 September 2026: "Why 2 types of Categories and can everywhere be the
// Same (The new One)".
//
// The Catalogue screen had a New / Old toggle. Measured on the live database
// that morning:
//
//     new list   322 categories,  322 switched on,  14 live products
//     old list   139 categories,    0 switched on,   0 live products
//
// Customers only ever see switched-on categories, so they had been seeing only
// the new list for some time. The toggle was a door onto 139 rows nothing else
// could reach — and it also chose which of two product-count columns the screen
// trusted, which is where the real fault was.
//
// These tests read the real page files, so the toggle cannot come back quietly
// and the counts cannot go back to the retired column.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync("src/app/dashboard/stores/catalogue/page.tsx", "utf8");
const api = readFileSync("src/lib/api-stores.ts", "utf8");
const types = readFileSync("src/app/dashboard/stores/catalogue/parts-types.tsx", "utf8");
const server = readFileSync(
  "../swat-delivery-app/backend/routers/categories_admin.py", "utf8");

// ── 1. The toggle is gone, and so is everything that served it ──────────────

test("the Catalogue screen no longer has a New / Old list toggle", () => {
  for (const gone of ["listVersion", "setListVersion", ">Old list<", ">New list<"]) {
    assert.ok(!page.includes(gone),
      `the retired list is still reachable from the Catalogue screen: ${gone}`);
  }
});

test("the screen no longer asks the server for a particular list", () => {
  assert.match(page, /getAdminCategories\(\)/,
    "the panel must ask for the one list, with no version");
  assert.ok(!/getAdminCategories\((["'`]|listVersion)/.test(page),
    "the panel is still asking for a specific version of the catalogue");
});

test("the server no longer offers a version to ask for", () => {
  // A parameter nobody sends is a door left open: the next person to read the
  // file would reasonably assume the old list is still reachable.
  assert.ok(!/def admin_list_categories\([^)]*version/s.test(server),
    "the server still accepts a `version` on the admin category list");
});

test("a new category is put on the one list, by the panel AND by the server", () => {
  assert.match(page, /taxonomy_version:\s*"v2"/,
    "the panel must create categories on the one list");
  assert.match(server, /data\.setdefault\("taxonomy_version",\s*"v2"\)/,
    "the SERVER must force it too — the panel is only one caller");
});

// ── 2. The counts. This is what was actually wrong ──────────────────────────

test("the server counts the column that is really used", () => {
  // Products carry `category_id` and a half-finished copy `category_id_v2`.
  // Nothing writes the copy any more: the product editor writes `category_id`,
  // and so does the customer app's browsing. The admin screen counted the copy,
  // so every product added from that point on would have shown as zero here
  // while the customer app counted it correctly.
  const body = server.split("def admin_list_categories")[1].split("\ndef ")[0];
  const afterDocstring = body.split('"""')[2] ?? body;
  assert.ok(!afterDocstring.includes("category_id_v2"),
    "the admin list is counting the retired column again");
  assert.match(afterDocstring, /_direct_product_counts\(\)/,
    "it must use the shared default, which is the column the customer app uses");
});

test("the panel adds up a branch with `total`, not `product_count`", () => {
  // On this screen `product_count` is what sits DIRECTLY in a row and `total`
  // is that plus everything below it — worked out by buildTree. Counting the
  // direct number would call "Fashion" empty while there are two shirts inside
  // it, which is the opposite of what a customer would find.
  assert.match(types, /n\.total = \(n\.product_count \|\| 0\) \+ below/);
  assert.match(page, /Number\(n\.total \|\| 0\) > 0/,
    "the empty-category warning must count the whole branch");
});

// ── 3. The number the switch cannot say by itself ───────────────────────────

test("the screen says how many empty categories customers can open", () => {
  // MEASURED ON THE LIVE SHOP, 4 September 2026: a customer opening Categories
  // saw 13 headings and 322 categories, and 301 of them had nothing in them.
  // With "Hide empty from customers" on they would have seen 3 headings and 21
  // categories, every one with something to buy.
  //
  // That is not a fault — the switch is deliberately off while the catalogue is
  // being filled in. It is a thing that must not be FORGOTTEN, and a switch
  // reading "OFF" does not say what it is costing.
  assert.match(page, /customerView/, "the count is not being worked out");
  assert.match(page, /withNothing/);
  assert.match(page, /Turn it on before you launch/,
    "the warning must say what to do about it, not only that it is true");
});

test("the warning only appears when the switch is actually off", () => {
  // A warning that shows when there is nothing to warn about is a warning
  // people learn to skip.
  assert.match(page, /hideEmpty === false && customerView\.withNothing > 0/);
});

// ── 4. Nothing points at the retired screen any more ────────────────────────

test("the old App Banner and Old list pages are gone from the panel", () => {
  assert.ok(!existsSync("src/app/dashboard/stores/catalogue/page-v1.tsx"));
  // The retired category rows are recorded where they can be checked, not
  // deleted quietly.
  assert.ok(
    existsSync("../DELETE-AFTER-TESTING/one-category-list-2026-09-04/README.md"),
    "the record of what was retired has to survive with it");
});

test("the API client takes no version either", () => {
  // An argument nobody sends is a door the next reader assumes still opens
  // something. The server does not accept it any more, so nor does this.
  const calls = api.match(/async getAdminCategories\(([^)]*)\)/g) || [];
  assert.equal(calls.length, 1, "there should be exactly one reader");
  assert.equal(calls[0], "async getAdminCategories()",
    "the reader still takes a version");
  assert.ok(!api.includes("?version="),
    "the client is still able to ask for a particular list");
});
