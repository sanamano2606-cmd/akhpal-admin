/**
 * STORES PAGE BUGS B1-B6 (Sana 9 Nov 2026: "Go Bugs").
 * Plan: docs/Audit/STORES-SCREENS-PLAN-2026-11-09.md, part 1.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_SHOP_IDS, isDemoShop } from "../src/lib/demo-shops.ts";

const ROOT = join(import.meta.dirname, "..");
const PAGE = readFileSync(join(ROOT, "src/app/dashboard/stores/page.tsx"), "utf-8");

test("B1: every list button closes the Hidden by Takal panel, and none looks chosen while it is open", () => {
  assert.match(PAGE, /const chooseView = \(next: StoreView\) => \{\s*setView\(next\);[\s\S]{0,300}setTakalOpen\(false\);/);
  assert.match(PAGE, /const on = view === v\.key && !takalOpen;/);
});

test("B2: No picture closes the Hidden by Takal panel, so its results can be seen", () => {
  assert.match(PAGE, /data-no-picture-everywhere\s*onClick=\{\(\) => \{ setTakalOpen\(false\); setFindLimit\(40\); findProducts\("", "no_picture", 40\); \}\}/);
});

test("B3: the search row is drawn on every list, Ready to show too", () => {
  assert.match(PAGE, /\{!takalOpen && \(<div>\s*<div className="flex items-center gap-2 flex-wrap">/);
  assert.doesNotMatch(PAGE, /\{view !== "ready" && !takalOpen && \(<div>/);
});

test("B4: commission and delivery fee share one column, both still editable", () => {
  assert.match(PAGE, />Commission · Delivery fee<\/th>/);
  assert.doesNotMatch(PAGE, />Delivery fee<\/th>/);
  assert.match(PAGE, /<div data-commission>/);
  assert.match(PAGE, /<div data-fee className="mt-0\.5 text-xs">/);
  assert.match(PAGE, /onClick=\{\(\) => saveCommission\(restaurant\.id\)\}/);
  assert.match(PAGE, /onClick=\{\(\) => saveDeliveryFee\(restaurant\.id\)\}/);
});

test("B5: one answer for Open now - never Open and closed-by-hours side by side", () => {
  assert.match(PAGE, /const byHours = !!restaurant\.is_open && restaurant\.open_now === false;/);
  assert.match(PAGE, /data-open-now=\{byHours \? "by-hours" : restaurant\.is_open \? "open" : "closed"\}/);
  assert.doesNotMatch(PAGE, /<span className="ml-1\.5 whitespace-nowrap text-\[11px\] text-amber-700"/);
});

test("B6: the two demo shops - same as the backend, counted nowhere, told nothing", () => {
  const backend = readFileSync(join(ROOT, "../swat-delivery-app/backend/takal_assistant.py"), "utf-8");
  const block = backend.slice(backend.indexOf("DEMO_SHOP_IDS = frozenset({"), backend.indexOf("})", backend.indexOf("DEMO_SHOP_IDS = frozenset({")));
  const ids = [...block.matchAll(/"([0-9a-f-]{36})"/g)].map((m) => m[1]).sort();
  assert.deepEqual([...DEMO_SHOP_IDS].sort(), ids);
  assert.equal(isDemoShop("33ea73d1-d3eb-4393-90e0-be4a6d23d8dd"), true);
  assert.equal(isDemoShop("ecb4b1bf-b149-463d-9473-bf0f1ec8eec3"), false);
  assert.equal(isDemoShop(null), false);
  assert.match(PAGE, /: restaurants\.filter\(\(r\) => inView\(r, v\) && !isDemoShop\(r\.id\)\)\.length;/);
  assert.match(PAGE, /v === "attention" \? needsAttention\(r\) && !isDemoShop\(r\.id\)/);
  assert.match(PAGE, /isDemoShop\(r\.id\) \? \[\] : deriveStatus\(r\) === "approved" && liveChecks/);
  assert.match(PAGE, /data-demo-shop/);
});
