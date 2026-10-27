// MOCK 210-3 / 210-4 (approved by Sana 27 Oct 2026): Stores › Product sorting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  EMPTY_FIND, QUICK_CHIPS, RX_CHOICES, SORTING_TABS, barWidth, findQuery, movedWords, readFindAddress,
  sortNowHref, whenWords,
} from "../src/lib/product-sorting.ts";
import { NAVIGATION, SERVER_RULES, serverSectionFor } from "../src/lib/navigation.ts";
import { isOneStorePage } from "../src/lib/store-page.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const OVERVIEW = read("src/app/dashboard/stores/sorting/page.tsx");
const FIND = read("src/app/dashboard/stores/sorting/find/page.tsx");
const API = read("src/lib/api-stores.ts");

test("the question for the server leaves empty parts out and keeps the picture's order", () => {
  assert.equal(findQuery(EMPTY_FIND), "");
  assert.equal(findQuery({ ...EMPTY_FIND, q: "  montika ", quick: ["rx", "piles"] }), "q=montika&quick=piles%2Crx");
  assert.equal(findQuery({ ...EMPTY_FIND, dept: "health-and-pharmacy", shop: "s1" }, 50), "dept=health-and-pharmacy&shop=s1&offset=50");
});

test("the address is read back, and anything unknown is dropped", () => {
  assert.deepEqual(readFindAddress("?dept=health-and-pharmacy&quick=piles,everything,piles&q=gebon"),
    { q: "gebon", dept: "health-and-pharmacy", shelf: "", shop: "", quick: ["piles"] });
  assert.deepEqual(readFindAddress(""), EMPTY_FIND);
});

test("Sort now opens Find & move on that department's (or shop's) piles", () => {
  assert.equal(sortNowHref({ dept: "health-and-pharmacy" }), "/dashboard/stores/sorting/find?dept=health-and-pharmacy&quick=piles");
  assert.equal(sortNowHref({ shop: "s9" }), "/dashboard/stores/sorting/find?shop=s9&quick=piles");
});

test("the words after a move, and the bars never spill", () => {
  assert.equal(movedWords({ moved: 9, shelf: "Asthma & Breathing" }), "✓ 9 products moved to Asthma & Breathing");
  assert.equal(movedWords({ moved: 1, skipped: 2, gone: 1, shelf: "Allergy" }),
    "✓ 1 product moved to Allergy · 2 already there · 1 no longer on Takal");
  assert.deepEqual([barWidth(-3), barWidth(42), barWidth(130), barWidth(null)], [0, 42, 100, 0]);
});

test("times are Pakistan time, 'Today' only for today", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  assert.equal(whenWords("2026-10-27T11:05:00Z", now), "Today 4:05 pm");
  assert.equal(whenWords("2026-10-26T21:12:00Z", now), "Today 2:12 am", "9:12 pm UTC on the 26th is the 27th in Swat");
  assert.equal(whenWords("2026-10-25T21:12:00Z", now), "26 Oct, 2:12 am");
  assert.equal(whenWords("nonsense", now), "");
});

test("the quick buttons and the prescription choices are the picture's", () => {
  assert.deepEqual(QUICK_CHIPS.map((c) => c.label), ["In catch-all piles only", "Needs prescription", "No picture", "Moved by Takal this week"]);
  assert.deepEqual(RX_CHOICES.map((c) => c.label), ["Keep as it is", "Yes", "No"]);
  assert.deepEqual(SORTING_TABS.map((t) => t.label), ["Overview", "Find & move", "Sorting list", "Shelf check"]);
});

test("Product sorting is a Stores tab, guarded exactly like the server", () => {
  const tab = NAVIGATION.find((n) => n.label === "Stores")!.tabs!.find((t) => t.label === "Product sorting")!;
  assert.equal(tab.section, "stores.catalogue");
  assert.ok(tab.calls!.includes("/admin/sorting"));
  assert.ok(SERVER_RULES.some(([p, s]) => p === "/admin/sorting" && s === "stores.catalogue"));
  assert.equal(serverSectionFor("/admin/sorting/move", "write"), "stores.catalogue");
  assert.equal(isOneStorePage("/dashboard/stores/sorting"), false, "it keeps the Stores title and tabs");
  assert.equal(isOneStorePage("/dashboard/stores/sorting/find"), false);
});

test("Shelf check lives inside Product sorting, and its old address forwards there", () => {
  assert.ok(existsSync(new URL("../src/app/dashboard/stores/sorting/shelf-check/page.tsx", import.meta.url)));
  const old = read("src/app/dashboard/stores/shelf-check/page.tsx");
  assert.match(old, /router\.replace\(SHELF_CHECK_NOW\)/);
  assert.match(old, /SHELF_CHECK_NOW = "\/dashboard\/stores\/sorting\/shelf-check"/);
  assert.match(read("tests/routes.test.ts"), /"\/dashboard\/stores\/shelf-check",\n\];/);
});

test("the inner pages are reachable: the sorting layout draws SORTING_TABS", () => {
  const layout = read("src/app/dashboard/stores/sorting/layout.tsx");
  assert.match(layout, /\{SORTING_TABS\.map\(\(t\) =>/);
  for (const t of SORTING_TABS) assert.ok(existsSync(new URL(`../src/app${t.href}/page.tsx`, import.meta.url)), t.href);
});

test("the pages ask the three doors and undo through Shelf check's", () => {
  for (const door of ["/admin/sorting/overview", "/admin/sorting/products", "/admin/sorting/move"]) assert.ok(API.includes(door), door);
  assert.match(OVERVIEW, /apiClient\.undoShelfCheck\(id\)/);
  assert.match(FIND, /apiClient\.undoShelfCheck\(done\.batch\)/);
  assert.match(FIND, /apiClient\.moveSortingProducts\(\{ ids, to: shelf, rx: mark \}\)/);
});

test("a new search empties the ticks - a button never moves what is not on the screen", () => {
  assert.match(FIND, /setTicked\(new Set\(\)\);\n\s+load\(find, 0\);/);
  assert.match(FIND, /if \(mine !== asked\.current\) return;/, "a late answer to an old search is thrown away");
});

test("the move button waits for a shelf, and the shelf is chosen with the one chooser", () => {
  assert.match(FIND, /disabled=\{!to \|\| moving\}/);
  assert.match(FIND, /<CategoryPicker options=\{cats\} value=\{to\} onChange=\{setTo\}/);
});
