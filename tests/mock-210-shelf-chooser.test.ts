// MOCK 210-1 / 210-2 - one simple shelf chooser (approved by Sana 27 Oct 2026).
// The long path must never be the first thing anybody reads again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OTHER_SHELVES, RECENT_KEY, boxWords, buildDepartments, pathParts, placeOf, rankFound, readRecent,
  rememberRecent, slugOf,
} from "../src/lib/shelf-chooser.ts";
import { filterCategories } from "../src/lib/category-search.ts";
import { shelfOptions, YOUR_SHOP } from "../src/lib/shelves.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PICKER = read("src/components/CategoryPicker.tsx");

// The same shape the server sends (GET shelf tree), cut down.
const TREE = {
  own_slugs: ["health-and-pharmacy"],
  tree: [
    { id: "h", name: "Health & Pharmacy", slug: "health-and-pharmacy", children: [
      { id: "med", name: "Medicines", children: [
        { id: "asthma", name: "Asthma & Breathing" },
        { id: "heart", name: "Heart & Blood Pressure", needs_prescription: true },
      ] },
      { id: "dev", name: "Medical Devices", children: [{ id: "bp", name: "BP Monitor" }] },
      { id: "first", name: "First Aid" },
    ] },
    { id: "b", name: "Baby, Kids & Toys", slug: "baby-kids-and-toys", children: [
      { id: "feed", name: "Baby Feeding", children: [{ id: "bottles", name: "Bottles" }] },
      { id: "clothes", name: "Baby Clothing", is_new: true },
    ] },
  ],
};
const OPTS = shelfOptions(TREE as any);

test("a path is read the new way and the old way", () => {
  assert.deepEqual(pathParts("Health & Pharmacy › Medicines › Allergy"), ["Health & Pharmacy", "Medicines", "Allergy"]);
  assert.deepEqual(pathParts("Men > T-shirts"), ["Men", "T-shirts"]);
  assert.deepEqual(pathParts("  "), []);
});

test("a department name gives the database's own slug, so its colour", () => {
  assert.equal(slugOf("Baby, Kids & Toys"), "baby-kids-and-toys");
  assert.equal(slugOf("Books, Stationery & Hobbies"), "books-stationery-and-hobbies");
  assert.equal(slugOf("Health & Pharmacy"), "health-and-pharmacy");
});

test("the flat list becomes Department -> Group -> Shelf, own department first", () => {
  const d = buildDepartments(OPTS, YOUR_SHOP);
  assert.deepEqual(d.map((x) => x.name), ["Health & Pharmacy", "Baby, Kids & Toys"]);
  assert.equal(d[0].own, true);
  assert.equal(d[1].own, false);
  assert.equal(d[0].slug, "health-and-pharmacy");
  assert.deepEqual(d[0].groups.map((g) => g.title), ["Medicines", "Medical Devices", OTHER_SHELVES]);
  assert.deepEqual(d[0].groups[0].shelves.map((s) => s.id), ["asthma", "heart"]);
  assert.deepEqual(d[0].groups[2].shelves.map((s) => s.id), ["first"], "a shelf straight under its department");
  assert.equal(d[0].count, 4);
  assert.equal(d[1].count, 2);
});

test("\"Other shelves\" always comes after the named groups", () => {
  const d = buildDepartments([
    { id: "1", label: "Grocery & Fresh › Sugar & Sweeteners" },
    { id: "2", label: "Grocery & Fresh › Laundry › Fabric Softener" },
  ]);
  assert.deepEqual(d[0].groups.map((g) => g.title), ["Laundry", OTHER_SHELVES]);
});

test("a filter list that also holds departments and groups lets them be chosen", () => {
  // The Products tab sends every node, not only shelves.
  const d = buildDepartments([
    { id: "H", label: "Health & Pharmacy" },
    { id: "M", label: "Health & Pharmacy › Medicines" },
    { id: "A", label: "Health & Pharmacy › Medicines › Allergy" },
    { id: "F", label: "Health & Pharmacy › First Aid" },
  ]);
  assert.equal(d[0].self?.id, "H");
  const med = d[0].groups.find((g) => g.name === "Medicines")!;
  assert.equal(med.self?.id, "M", "a lone group line is the group itself, not a shelf");
  assert.deepEqual(med.shelves.map((s) => s.id), ["A"]);
  assert.deepEqual(d[0].groups.find((g) => g.name === "")!.shelves.map((s) => s.id), ["F"]);
});

test("the closed box puts the SHELF first and where it sits second - never the long path first", () => {
  const asthma = OPTS.find((o) => o.id === "asthma");
  assert.deepEqual(boxWords(asthma), { main: "Asthma & Breathing", where: "Health & Pharmacy · Medicines" });
  assert.deepEqual(boxWords(OPTS.find((o) => o.id === "first")), { main: "First Aid", where: "Health & Pharmacy" });
  assert.deepEqual(boxWords({ id: "H", label: "Health & Pharmacy" }), { main: "All of Health & Pharmacy", where: "" });
  assert.deepEqual(boxWords(undefined), { main: "", where: "" });
});

test("a shelf, a group or a department name is found by typing (Sana: a good idea)", () => {
  assert.deepEqual(filterCategories(OPTS, "bottles").map((o) => o.id), ["bottles"], "a shelf");
  assert.deepEqual(filterCategories(OPTS, "medicines").map((o) => o.id), ["asthma", "heart"], "a group");
  assert.deepEqual(filterCategories(OPTS, "baby kids").map((o) => o.id).sort(), ["bottles", "clothes"], "a department");
});

test("where each line sits is read from its label", () => {
  assert.deepEqual(placeOf({ id: "x", label: "Fashion › Men › Shirts" }), { dept: "Fashion", group: "Men", shelf: "Shirts", depth: 3 });
  assert.deepEqual(placeOf({ id: "x", label: "Fashion" }), { dept: "Fashion", group: "", shelf: "", depth: 1 });
});

// ── Used lately ──────────────────────────────────────────────────────────────
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test("used lately keeps the last three, newest first, without repeats", () => {
  const s = memory();
  rememberRecent(s, "a"); rememberRecent(s, "b"); rememberRecent(s, "c"); rememberRecent(s, "a"); rememberRecent(s, "d");
  assert.deepEqual(readRecent(s), ["d", "a", "c"]);
  assert.equal(JSON.parse(s.m.get(RECENT_KEY)!).length, 3);
});

test("a broken or blocked storage only means no chips - never an error", () => {
  assert.deepEqual(readRecent(null), []);
  assert.deepEqual(readRecent({ getItem: () => "not json", setItem: () => {} }), []);
  assert.deepEqual(readRecent({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }), []);
  assert.deepEqual(rememberRecent({ getItem: () => null, setItem: () => { throw new Error("full"); } }, "x"), ["x"]);
});

// ── The screen ───────────────────────────────────────────────────────────────
test("the window walks in by Department, Group and Shelf, and has search on top", () => {
  for (const words of ["1 · DEPARTMENT", "2 · GROUP", "3 · SHELF", "Search a shelf, a group or a department",
    "TAKAL SUGGESTS", "USED LATELY", "Choose this shelf", "THIS SHOP SELLS", "ALL OTHER DEPARTMENTS", "as a new shelf"]) {
    assert.ok(PICKER.includes(words), words);
  }
  assert.match(PICKER, /buildDepartments\(opts\)/);
  assert.match(PICKER, /filterCategories\(/, "search uses the one tested matching rule");
});

test("the closed box shows boxWords - the shelf first - not the whole label", () => {
  assert.match(PICKER, /\{words\.main\}/);
  assert.match(PICKER, /\{words\.where && /);
  assert.doesNotMatch(PICKER, /value=\{open \? query : shortLabel\(chosen\)\}/, "the old one-line path box is gone");
});

test("a phone gets one step at a time; a tablet gets two columns", () => {
  assert.match(PICKER, /step === "dept" \? "flex" : "hidden"\} w-full flex-col overflow-y-auto border-r border-takal-line p-2\.5 sm:flex/);
  assert.match(PICKER, /step === "group" \? "flex sm:hidden" : "hidden"\} w-full flex-col overflow-y-auto border-r border-takal-line p-2\.5 lg:flex/);
  assert.match(PICKER, /hidden pb-1 sm:block lg:hidden/, "tablet: groups open under the department");
});

test("every screen that used the old box still uses the same one", () => {
  for (const f of ["src/app/dashboard/stores/sorting/shelf-check/page.tsx", "src/app/dashboard/stores/[id]/catalogue/parts-shelves.tsx",
    "src/app/dashboard/stores/[id]/parts-move.tsx", "src/app/dashboard/stores/[id]/parts-products.tsx",
    "src/app/dashboard/stores/[id]/ProductEditorModal.tsx"]) {
    assert.match(read(f), /<CategoryPicker /, f);
  }
  assert.match(read("src/app/dashboard/stores/[id]/parts-products.tsx"), /className="w-\[130px\] max-w-full" compact/, "the filter stays one line");
  assert.match(read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx"), /suggested=\{offer\?\.category_id \? \[String\(offer\.category_id\)\] : undefined\}/);
});

test("the window sits above the product window", () => {
  assert.match(PICKER, /fixed inset-0 z-\[60\]/);
});

test("shelves are listed A to Z, and Clear never says \"Choose…\"", () => {
  assert.match(PICKER, /\.sort\(byShelfName\)/);
  assert.match(PICKER, /localeCompare\(placeOf\(b\)\.shelf/);
  assert.match(PICKER, /value && !\/\^choose\/i\.test\(emptyLabel\)/);
});

test("typed words: the shelf's own name first, its department last", () => {
  const list = [
    { id: "toys", label: "Baby, Kids & Toys › Toys › Outdoor Toys" },
    { id: "milk", label: "Health & Pharmacy › Baby Milk & Food" },
    { id: "feed", label: "Baby, Kids & Toys › Baby Feeding › Bottles" },
    { id: "cloth", label: "Baby, Kids & Toys › Baby Clothing" },
  ];
  const found = filterCategories(list, "baby");
  assert.deepEqual(rankFound(found, ["baby"]).map((o) => o.id), ["milk", "cloth", "feed", "toys"]);
  assert.match(PICKER, /rankFound\(filterCategories\(/);
});

test("the shop's own department comes first even when it is sent later", () => {
  const d = buildDepartments([
    { id: "1", label: "Fashion › Men › Shirts" },
    { id: "2", label: "Health & Pharmacy › Medicines › Allergy", section: YOUR_SHOP },
  ], YOUR_SHOP);
  assert.deepEqual(d.map((x) => x.name), ["Health & Pharmacy", "Fashion"]);
});

test("the window is drawn on the page itself, so no other window can squeeze it", () => {
  assert.match(PICKER, /createPortal\(\s*<div className="fixed inset-0 z-\[60\]/);
  assert.match(PICKER, /document\.body,\s*\)\}/);
});

test("with nothing chosen, the window opens where Takal's suggestion sits", () => {
  assert.match(PICKER, /const here = byId\.get\(value\) \|\| byId\.get\(\(suggested \|\| \[\]\)\[0\] \|\| ""\);/);
});
