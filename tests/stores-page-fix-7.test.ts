// STORES PAGE FIX 7 (Sana, 12 October 2026: "OK fix 7").
//
// O5 - the panel pointed to "Stores → Pending" and "Stores → Approve shops",
//      which do not exist. Every place now says "Stores → Waiting for
//      approval", and where it can, it is a link that opens that list.
// O7 - "← All stores" on a store's page went back to Live with no search. The
//      list now keeps its list, order, search and store type in its address,
//      remembers it for the tab, and "← All stores" opens exactly that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listQuery, rememberListQuery, allStoresHref, LIST_ADDRESS_KEY } from "../src/lib/stores-list-address.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
const list = read("src/app/dashboard/stores/page.tsx");
const store = read("src/app/dashboard/stores/[id]/page.tsx");
const wizard = read("src/app/dashboard/stores/parts-create-store.tsx");
const onboarding = read("src/app/dashboard/stores/onboarding/page.tsx");
const dashboard = read("src/app/dashboard/page.tsx");

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
};

test("the list's address holds only what differs from the usual", () => {
  const d = { defaultSort: "name", sort: "name", view: "live", search: "", type: "all" };
  assert.equal(listQuery(d), "");
  assert.equal(listQuery({ ...d, view: "suspended", sort: "newest", search: " wakeel ", type: "grocery" }),
    "?status=suspended&sort=newest&q=wakeel&type=grocery");
});

test("All stores goes back to the remembered list, or to Live", () => {
  const s = memory();
  assert.equal(allStoresHref(s), "/dashboard/stores");
  rememberListQuery("?status=suspended&q=wakeel", s);
  assert.equal(s.m.get(LIST_ADDRESS_KEY), "?status=suspended&q=wakeel");
  assert.equal(allStoresHref(s), "/dashboard/stores?status=suspended&q=wakeel");
});

test("a strange remembered value is never followed", () => {
  for (const bad of ["https://evil.example/", "//evil.example", "?a=<script>", "status=pending"]) {
    const s = memory();
    s.setItem(LIST_ADDRESS_KEY, bad);
    assert.equal(allStoresHref(s), "/dashboard/stores", bad);
  }
});

test("storage switched off: no error, plain Live", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.doesNotThrow(() => rememberListQuery("?q=x", broken));
  assert.equal(allStoresHref(broken), "/dashboard/stores");
});

test("the list writes and remembers itself, and reads the store type back", () => {
  assert.match(list, /rememberListQuery\(query\)/);
  assert.match(list, /listQuery\(\{ view, sort: sortBy, defaultSort: DEFAULT_STORE_SORT, search, type: typeFilter \}\)/);
  assert.match(list, /if \(!addressRead\) return;/);
  assert.match(list, /params\.get\("type"\)/);
});

test("All stores on a store's page uses it", () => {
  assert.match(store, /router\.push\(allStoresHref\(\)\)/);
  assert.doesNotMatch(store, /router\.push\("\/dashboard\/stores"\)/);
});

test("no screen points to a place that does not exist", () => {
  for (const [name, src] of [["wizard", wizard], ["onboarding", onboarding], ["dashboard", dashboard]] as const) {
    assert.doesNotMatch(src, /Stores → Pending|Stores → Approve shops|Pending list|Pending Stores/, name);
  }
  assert.match(wizard, /window\.location\.href = "\/dashboard\/stores\?status=pending"/);
  assert.match(onboarding, /<Link href="\/dashboard\/stores\?status=pending"/);
  assert.match(dashboard, /Stores waiting for approval/);
});
