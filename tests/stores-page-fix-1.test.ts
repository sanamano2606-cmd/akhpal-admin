// STORES PAGE FIX 1 (Sana, 12 October 2026: "OK fix 1").
//
// docs/Audit/AUDIT-REPORT-STORES-PAGE-2026-10-12.md, S1 S4 S5 + D1, and
// Mock 182 picture 1. "Reject mean remove it from here and add a rejected
// store list separate." "The page content are too spreader."
//
//  * the shops are in FIVE lists shown as count boxes, one open at a time -
//    a rejected shop is only in Rejected;
//  * the search and the two dropdowns sit on ONE row;
//  * every shop shows how many products it has (live ones too);
//  * a rejected shop can be removed for good, by the Main Admin, after a box
//    that asks first;
//  * the Dashboard's "Stores awaiting approval" opens the Waiting list, and
//    counts only shops that are really waiting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const code = (p: string) =>
  read(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

const page = code("src/app/dashboard/stores/page.tsx");

test("the five lists are there, and Live opens first", () => {
  for (const k of ["live", "pending", "suspended", "rejected", "attention"]) {
    assert.match(page, new RegExp(`key: "${k}"`), k);
  }
  assert.match(page, /useState<StoreView>\("live"\)/);
  assert.match(page, /return \(VIEWS\.some\(\(x\) => x\.key === v\) \? v : "live"\)/,
    "a hand-typed address never breaks the page");
});

test("a rejected shop is only in the Rejected list", () => {
  assert.match(page, /v === "live" \? deriveStatus\(r\) === "approved"/);
  assert.match(page, /: deriveStatus\(r\) === v;/);
  // Browsing, a list holds only its own shops. While SEARCHING every list is
  // searched (Sana 30 Oct 2026: "The search should show all store") - each
  // row still shows its own status, so a rejected shop reads as Rejected.
  assert.match(page, /const matchesStatus = searching \|\| inView\(r, view\);/);
  assert.match(page, /const searching = !!search\.trim\(\);/);
  assert.doesNotMatch(page, /statusFilter/, "the old dropdown is gone");
});

test("Need attention = live shops with fewer than 5 products", () => {
  assert.match(page, /deriveStatus\(r\) === "approved" && typeof r\.product_count === "number"\s*\n\s*&& r\.product_count < MIN_PRODUCTS/);
});

test("the list is in the address, so the Dashboard and Back can open it", () => {
  assert.match(page, /setView\(readView\(params\.get\("status"\)\)\)/);
  assert.match(page, /url\.searchParams\.set\("status", next\)/);
  const dash = code("src/app/dashboard/page.tsx");
  assert.match(dash, /href="\/dashboard\/stores\?status=pending"/);
  assert.match(dash, /data\.waiting_restaurants/);
});

test("the search and the two dropdowns sit on one row", () => {
  const selects = page.match(/<select[\s\S]*?className="([^"]*)"/g) || [];
  const bar = selects.filter((s) => !s.includes("autoFocus"));
  assert.equal(bar.length, 2, "store type and sort");
  for (const s of bar) assert.match(s, /className="w-auto /, "a select with no width is 100% wide here");
  assert.doesNotMatch(page, /min-w-64/);
});

test("every shop shows its product count, live ones too", () => {
  assert.match(page, /if \(deriveStatus\(restaurant\) !== "pending"\) return \(/);
  assert.match(page, /\{a\.enough \? "" : "⚠ "\}\{a\.count\} product/);
});

test("remove for good: Main Admin only, rejected only, asks first", () => {
  assert.match(page, /deriveStatus\(restaurant\) === "rejected" && isMain && \(/);
  assert.match(page, /onClick=\{\(\) => setRemoving\(restaurant\)\}/);
  assert.match(page, /confirmLabel="Yes, remove for good"/);
  assert.match(page, /This cannot be undone\./);
  const api = code("src/lib/api-stores.ts");
  assert.match(api, /\/remove-for-good`, \{\s*method: "POST"/);
});

test("changing list does not reload everything from the server", () => {
  assert.match(page, /fetchRestaurants\(\);\s*\n\s*\}, \[\]\);/);
  assert.doesNotMatch(page, /filters\.status = /);
});
