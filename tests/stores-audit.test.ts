// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL AUDIT, 15 SEPTEMBER 2026 — THE STORES SECTION.
//
// Pins the panel-side fixes so they cannot quietly come undone:
//   1. A refusal from the server's form check reads as a sentence, never as
//      "[object Object]".
//   2. The store-type list offers every kind the server accepts, and a shop of
//      a kind the list does not know is never called "Food".
//   3. A failed write clears the saved reads too, so "did it go through?" is
//      answered from the server and not from a copy taken before the write.
//   4. The product editor cannot save before the product's photos and options
//      have arrived.
//   5. The shop list's fee box and the commission page read what they show.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serverDetailText } from "../src/lib/api-errors.ts";
import { VERTICALS, verticalLabel, verticalEmoji, verticalOptions } from "../src/lib/verticals.ts";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("a form refusal from the server is a sentence, not [object Object]", () => {
  const fastapi = [
    { type: "string_too_long", loc: ["body", "store_name"], msg: "String should have at most 150 characters" },
    { type: "greater_than_equal", loc: ["body", "minimum_order"], msg: "Input should be greater than or equal to 0" },
  ];
  const text = serverDetailText(fastapi);
  assert.doesNotMatch(text, /object Object/);
  assert.match(text, /store name: String should have at most 150 characters/);
  assert.match(text, /minimum order/);
  assert.equal(serverDetailText("Phone number is required"), "Phone number is required");
  assert.equal(serverDetailText({ message: "Cannot delete: 3 orders" }), "Cannot delete: 3 orders");
  assert.equal(serverDetailText(undefined), "");
  // And the one place every request goes through actually uses it.
  const core = read("lib/api-core.ts");
  assert.match(core, /new Error\(serverDetailText\(error\.detail\)/);
  assert.doesNotMatch(core, /new Error\(error\.detail \|\|/);
});

test("the panel offers the 21 kinds of shop the server accepts, and not Laundry", () => {
  const offered = new Set(VERTICALS.map((v) => v.value));
  assert.equal(offered.size, VERTICALS.length, "a kind is listed twice");
  for (const k of ["meat_chicken", "fruits_vegetables", "baby_kids", "auto_parts",
                   "furniture_decor", "cleaning_supplies", "restaurant", "grocery"]) {
    assert.ok(offered.has(k), `${k} cannot be created or filtered in the panel`);
  }
  assert.ok(!offered.has("laundry_cleaning"), "the server refuses Laundry");
  assert.equal(VERTICALS.length, 21);
});

test("a shop of an unknown kind is never labelled Food", () => {
  assert.equal(verticalLabel("meat_chicken"), "Meat & Chicken");
  assert.equal(verticalLabel("brand_new_kind"), "Brand New Kind");
  assert.notEqual(verticalEmoji("brand_new_kind"), "🍽️");
  assert.equal(verticalLabel(""), "Food");            // blank = column default
  assert.equal(verticalLabel("laundry_cleaning"), "Laundry");   // shown, not offered
  // The change-type box always contains the shop's real current kind.
  assert.equal(verticalOptions("laundry_cleaning")[0].value, "laundry_cleaning");
  assert.equal(verticalOptions("grocery"), VERTICALS);
});

test("a failed write still clears the saved reads", () => {
  const core = read("lib/api-core.ts");
  assert.match(core, /finally \{\s*if \(method !== "GET"\) APIClientCore\.clearCache\(\);/);
});

test("the product editor waits for the photos and options before it can save", () => {
  const ed = read("app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.match(ed, /const \[detailLoaded, setDetailLoaded\]/);
  assert.match(ed, /setDetailLoaded\(true\)/);
  assert.match(ed, /disabled=\{saving \|\| \(editing && !detailLoaded && !detailFailed\)\}/);
  assert.match(ed, /if \(editing && !detailLoaded && !detailFailed\)/);
});

test("the on/off switches cannot be double-flipped", () => {
  assert.match(read("app/dashboard/stores/[id]/parts-settings.tsx"), /disabled=\{toggling\}/);
  assert.match(read("app/dashboard/stores/[id]/page.tsx"), /if \(togglingItemId\) return;/);
});

test("the commission page prints the failure's words, not the failure object", () => {
  const page = read("app/dashboard/stores/commission/page.tsx");
  assert.doesNotMatch(page, /\{settingsError\} /);
  assert.match(page, /\{settingsError\.message\}/);
});

test("the create-store form asks for what the vendor app asks for", () => {
  const page = read("app/dashboard/stores/page.tsx");
  assert.match(page, /!form\.address\.trim\(\)/);
  assert.match(page, /phoneDigits\.length < 7 \|\| phoneDigits\.length > 15/);
  assert.doesNotMatch(page, /Address \(optional\)/);
});
