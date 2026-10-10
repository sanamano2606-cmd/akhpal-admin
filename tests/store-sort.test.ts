// ─────────────────────────────────────────────────────────────────────────────
// STORES > ALL STORES: SORT BY  (Mock 178, approved by Sana 10 October 2026)
//
// Sana: "I want The sort by button fully functional and the default is by A-Z".
// The rules live in src/lib/store-sort.ts; the page only shows the box and
// keeps the choice in the address. Real names from the live list are used.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_STORE_SORT, readStoreSort, sortStores, STORE_SORTS, type StoreSort,
} from "../src/lib/store-sort.ts";

const STATUS = (r: any) =>
  r.is_suspended ? "suspended" : r.is_approved ? "approved" : r.rejected_at ? "rejected" : "pending";
const LABEL: Record<string, string> = {
  restaurant: "Food & Drinks", clothing_store: "Fashion", baby_kids: "Baby, Kids & Toys",
  pharmacy: "Pharmacy", grocery: "Grocery",
};
const help = { statusOf: STATUS, typeLabelOf: (r: any) => LABEL[r.vendor_type] || r.vendor_type };

const S = (id: string, name: any, more: Record<string, any> = {}): Record<string, any> =>
  ({ id, name, is_approved: true, vendor_type: "restaurant", ...more });

const LIST = [
  S("1", "Wakeel Shopping Mall — Fashion", { vendor_type: "clothing_store", owner_name: "Abdul Wakeel",
    created_at: "2026-10-01T18:08:53+00:00", open_now: true }),
  S("2", "Al Watan Baker", { owner_name: "Ahsan ullah", created_at: "2026-09-16T08:18:58+00:00" }),
  S("3", "bite Spot", { owner_name: "Aftab ahmad", created_at: "2026-09-28T15:11:41+00:00", open_now: true }),
  S("4", "Baby & Baba's Shop", { vendor_type: "baby_kids", owner_name: "Khan",
    created_at: "2026-09-09T14:18:28+00:00" }),
  S("5", "Matti Restaurant", { owner_name: "Matti Ullah", created_at: "2026-05-25T05:54:44+00:00" }),
  S("6", "Wakeel Shopping Mall — Flowers & Gifts", { vendor_type: "flowers_gifts", owner_name: "Abdul Wakeel",
    created_at: "2026-10-08T16:18:27+00:00", is_suspended: true }),
  S("7", "New Pharmacy", { vendor_type: "pharmacy", is_approved: false, owner_name: "Zia",
    created_at: "2026-10-09T10:00:00+00:00" }),
];
const names = (sort: StoreSort, list = LIST) => sortStores(list, sort, help).map((r) => r.name);

test("the page opens at Name A–Z (Sana: the default is by A-Z)", () => {
  assert.equal(DEFAULT_STORE_SORT, "name_az");
  assert.equal(STORE_SORTS[0].value, "name_az");
  assert.equal(readStoreSort(null), "name_az");
  assert.equal(readStoreSort(""), "name_az");
  assert.equal(readStoreSort("nonsense"), "name_az", "a hand-typed address never breaks the page");
  assert.equal(readStoreSort(" newest "), "newest");
});

test("the 8 choices of the mock, in its order", () => {
  assert.deepEqual(STORE_SORTS.map((s) => s.value),
    ["name_az", "name_za", "newest", "oldest", "type", "owner", "status", "open"]);
  assert.ok(!STORE_SORTS.some((s) => /product/i.test(s.label)), "no Products sort - not counted for live shops");
});

test("A–Z the human way: small and capital letters count the same", () => {
  assert.deepEqual(names("name_az"), [
    "Al Watan Baker", "Baby & Baba's Shop", "bite Spot", "Matti Restaurant", "New Pharmacy",
    "Wakeel Shopping Mall — Fashion", "Wakeel Shopping Mall — Flowers & Gifts",
  ]);
});

test("numbers in order, spaces at the start ignored, a blank name last", () => {
  const l = [S("a", "Shop 10"), S("b", "  Shop 2"), S("c", ""), S("d", "Shop 1"), S("e", null)];
  assert.deepEqual(sortStores(l, "name_az", help).map((r) => r.id), ["d", "b", "a", "c", "e"]);
  assert.deepEqual(sortStores(l, "name_za", help).map((r) => r.id), ["a", "b", "d", "c", "e"],
    "Z–A turns the names round, but a blank still goes last");
});

test("Z–A is A–Z turned round", () => {
  assert.deepEqual(names("name_za"), [...names("name_az")].reverse());
});

test("newest and oldest by the day the store was made; no date goes last both ways", () => {
  assert.deepEqual(names("newest").slice(0, 3),
    ["New Pharmacy", "Wakeel Shopping Mall — Flowers & Gifts", "Wakeel Shopping Mall — Fashion"]);
  assert.equal(names("oldest")[0], "Matti Restaurant");
  const l = [...LIST, S("x", "Aaa no date")];
  assert.equal(names("newest", l).at(-1), "Aaa no date");
  assert.equal(names("oldest", l).at(-1), "Aaa no date");
});

test("same date: the name decides, so the order never jumps about", () => {
  const t = "2026-10-08T16:18:27+00:00";
  const l = [S("1", "Zeta", { created_at: t }), S("2", "Alpha", { created_at: t }), S("3", "Mid", { created_at: t })];
  assert.deepEqual(sortStores(l, "newest", help).map((r) => r.name), ["Alpha", "Mid", "Zeta"]);
  assert.deepEqual(sortStores(l, "oldest", help).map((r) => r.name), ["Alpha", "Mid", "Zeta"]);
});

test("store type A–Z by the name the page shows, names A–Z inside each type", () => {
  assert.deepEqual(names("type"), [
    "Baby & Baba's Shop",                       // Baby, Kids & Toys
    "Wakeel Shopping Mall — Fashion",           // Fashion
    "Wakeel Shopping Mall — Flowers & Gifts",   // flowers_gifts (no label in this test)
    "Al Watan Baker", "bite Spot", "Matti Restaurant",   // Food & Drinks
    "New Pharmacy",                             // Pharmacy
  ]);
});

test("owner A–Z; a store with no owner name goes last", () => {
  const l = [...LIST, S("y", "Aaa", { owner_name: "" })];
  const got = sortStores(l, "owner", help).map((r) => r.owner_name);
  assert.deepEqual(got, ["Abdul Wakeel", "Abdul Wakeel", "Aftab ahmad", "Ahsan ullah", "Khan", "Matti Ullah", "Zia", ""]);
});

test("status: pending first, then approved, rejected, suspended last", () => {
  const l = [...LIST, S("r", "Turned Down", { is_approved: false, rejected_at: "2026-10-01" })];
  const got = sortStores(l, "status", help).map((r) => STATUS(r));
  assert.deepEqual(got, ["pending", "approved", "approved", "approved", "approved", "approved", "rejected", "suspended"]);
  // Inside one status the names are A–Z (a list of 30 approved shops must not jump about).
  const approved = [S("z", "Zanisha Food Stop"), S("a", "Al Watan Baker"), S("m", "Mr Momo's"), S("b", "Bite Squad")];
  assert.deepEqual(sortStores(approved, "status", help).map((r) => r.name),
    ["Al Watan Baker", "Bite Squad", "Mr Momo's", "Zanisha Food Stop"]);
});

test("open now first, each half A–Z", () => {
  assert.deepEqual(names("open"), [
    "bite Spot", "Wakeel Shopping Mall — Fashion",
    "Al Watan Baker", "Baby & Baba's Shop", "Matti Restaurant", "New Pharmacy",
    "Wakeel Shopping Mall — Flowers & Gifts",
  ]);
});

test("sorting never adds, drops or changes a store, and leaves the given list alone", () => {
  const before = JSON.stringify(LIST);
  for (const s of STORE_SORTS) {
    const out = sortStores(LIST, s.value, help);
    assert.equal(out.length, LIST.length, s.value);
    assert.deepEqual(new Set(out.map((r) => r.id)), new Set(LIST.map((r) => r.id)), s.value);
  }
  assert.equal(JSON.stringify(LIST), before);
  assert.deepEqual(sortStores([], "name_az", help), []);
});

// ── THE PAGE ────────────────────────────────────────────────────────────────
const PAGE = readFileSync(new URL("../src/app/dashboard/stores/page.tsx", import.meta.url), "utf8");

test("the page shows the box with every choice, bold, after the type box", () => {
  assert.match(PAGE, /aria-label="Sort by"/);
  assert.match(PAGE, /STORE_SORTS\.map/);
  assert.match(PAGE, /Sort: \{o\.label\}/);
  assert.ok(PAGE.indexOf('aria-label="Sort by"') > PAGE.indexOf("All Store Types"));
  assert.match(PAGE, /useState<StoreSort>\(DEFAULT_STORE_SORT\)/);
});

test("the page draws the SORTED list, after the filters", () => {
  assert.match(PAGE, /sortedRestaurants\.map\(\(restaurant\)/);
  assert.doesNotMatch(PAGE, /filteredRestaurants\.map\(/);
  assert.match(PAGE, /sortStores\(filteredRestaurants, sortBy/);
});

test("the choice is kept in the address without a new Back step", () => {
  assert.match(PAGE, /readStoreSort\(params\.get\("sort"\)\)/);
  assert.match(PAGE, /history\.replaceState/);
  assert.doesNotMatch(PAGE, /history\.pushState/);
  assert.doesNotMatch(PAGE, /useSearchParams\(/, "would need a Suspense boundary at build time");
});
