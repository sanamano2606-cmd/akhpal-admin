// MOCK 225 - "+ ADD SHELF / GROUP / DEPARTMENT" INSIDE "CHOOSE A SHELF"
// (approved by Sana, 2 Nov 2026: "Approved" + "Add Group Button Too under
// Group"). The rules run for real (src/lib/shelf-add.ts); the window is
// checked for who sees the buttons and what it sends.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanName, findHome, nameProblem, nameTaken, newLabel, rxOffered, similarName, type CatNode }
  from "../src/lib/shelf-add.ts";
import { buildDepartments, placeOf } from "../src/lib/shelf-chooser.ts";
import { serverSectionFor } from "../src/lib/navigation.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PICKER = read("src/components/CategoryPicker.tsx");
const FORM = read("src/components/ShelfAddForm.tsx");

const TREE: CatNode[] = [
  { id: "d1", name: "Health & Pharmacy", slug: "health-and-pharmacy", children: [
    { id: "g1", name: "Medicines", children: [{ id: "s1", name: "Herbal & Homeopathic" }, { id: "s2", name: "Pain & Fever" }] },
    { id: "s3", name: "First Aid" }] },
  { id: "d2", name: "Grocery & Fresh", slug: "grocery-and-fresh", children: [] },
];

// ── 1. where the new row goes ──
test("the open department and group are found again by name", () => {
  assert.deepEqual(findHome(TREE, "Health & Pharmacy", "Medicines"), { deptId: "d1", groupId: "g1", deptSlug: "health-and-pharmacy" });
  assert.deepEqual(findHome(TREE, "health  &  pharmacy", ""), { deptId: "d1", groupId: null, deptSlug: "health-and-pharmacy" },
    "Other shelves = straight under the department");
  assert.equal(findHome(TREE, "Fashion", "Men"), null);
  assert.equal(findHome(TREE, "Health & Pharmacy", "Nope"), null, "never guesses another group");
});

test("the new shelf's label puts it in the right column at once", () => {
  assert.equal(newLabel("Health & Pharmacy", "Medicines", " Unani  Medicines "), "Health & Pharmacy › Medicines › Unani Medicines");
  assert.equal(newLabel("Herbal & Unani", "", "Unani Medicines"), "Herbal & Unani › Unani Medicines");
  const depts = buildDepartments([{ id: "n1", label: newLabel("Herbal & Unani", "", "Unani Medicines") }]);
  assert.equal(depts[0].name, "Herbal & Unani");
  assert.equal(depts[0].groups[0].title, "Other shelves");
  assert.equal(placeOf(depts[0].groups[0].shelves[0]).shelf, "Unani Medicines");
});

// ── 2. names ──
test("a name must be typed, short, and not already there", () => {
  assert.equal(nameProblem("  ", "shelf name"), "Type the shelf name.");
  assert.equal(nameProblem("x".repeat(61)), "At most 60 letters.");
  assert.equal(nameProblem("!!"), "A name needs letters.");
  assert.equal(nameProblem("یونانی ادویات"), "", "Urdu letters are letters");
  assert.equal(nameTaken(["Pain & Fever"], "pain  & fever"), true);
  assert.equal(cleanName("  a   b "), "a b");
});

test("a similar shelf is pointed out - only a hint", () => {
  assert.equal(similarName(["Herbal & Homeopathic", "Pain & Fever"], "Unani Medicines"), "Herbal & Homeopathic");
  assert.equal(similarName(["Kids Shoes"], "Children Shoes"), "Kids Shoes");
  assert.equal(similarName(["Pain & Fever"], "Unani Medicines"), "", "\"medicines\" alone is too common to count");
  assert.equal(similarName(["Pain & Fever"], "Pain & Fever"), "", "the same name is 'already here', not 'similar'");
});

test("the Rx tick only inside Health & Pharmacy", () => {
  assert.equal(rxOffered("health-and-pharmacy"), true);
  assert.equal(rxOffered("grocery-and-fresh"), false);
});

// ── 3. the window ──
test("only the Main Admin and Categories editors see the buttons - never in a narrow filter box", () => {
  assert.match(PICKER, /setMayAdd\(!compact && mayAccess\("stores\.catalogue", getMyPerms\(\)\)\)/);
  for (const k of ["department", "group", "shelf"]) {
    assert.match(PICKER, new RegExp(`data-add="${k}"`), k);
  }
  assert.equal(serverSectionFor("/admin/categories", "write"), "stores.catalogue", "the server asks the same");
});

test("the buttons sit at the end of their own column, in the mock's words", () => {
  const dep = PICKER.indexOf('data-add="department"'), grp = PICKER.indexOf('data-add="group"'), sh = PICKER.indexOf('data-add="shelf"');
  assert.ok(PICKER.indexOf("1 · DEPARTMENT") < dep && dep < PICKER.indexOf("2 · GROUP"));
  assert.ok(PICKER.indexOf("2 · GROUP") < grp && grp < PICKER.indexOf("3 · SHELF"));
  assert.ok(PICKER.indexOf("3 · SHELF") < sh);
  for (const w of ["＋ Add department", "＋ Add group", "＋ Add shelf"]) assert.ok(PICKER.includes(w), w);
});

test("it saves through the Categories door, in the one live list, and chooses the new shelf", () => {
  assert.match(PICKER, /apiClient\.createCategory\(\{\s*name, name_ur: nameUr \|\| null, parent_id: parent, is_active: true, display_order: 999,\s*taxonomy_version: "v2"/);
  assert.match(PICKER, /setPending\(made\.id\);/);
  assert.match(PICKER, /isNew: true/);
});

test("a group or department always comes with its first shelf; a half-save says so", () => {
  assert.match(FORM, /const needsFirst = kind !== "shelf";/);
  assert.match(PICKER, /was added, but its first shelf was not: /);
  assert.match(PICKER, /was not found in the category list\. Nothing was added\./);
});

test("nothing is saved until the yellow button", () => {
  assert.match(FORM, /disabled=\{busy \|\| !!problem\}/);
  assert.match(FORM, /data-shelf-add-go onClick=\{go\}/);
});

test("the similar-name hint looks next door first (found in the browser: it named a Grocery shelf)", () => {
  assert.match(PICKER, /return \[\.\.\.all\.filter\(\(x\) => x\.near\), \.\.\.all\.filter\(\(x\) => !x\.near\)\]/);
  assert.equal((PICKER.match(/shelfNames=\{nearFirst\}/g) || []).length, 3);
});
