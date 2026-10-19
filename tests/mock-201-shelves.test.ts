// ─────────────────────────────────────────────────────────────────────────────
// MOCK 201 - EVERY PRODUCT ON ITS RIGHT SHELF, the admin panel half.
//
// Sana, 19 October 2026: "Approved. Please Build exactly the same and confirm
// once again when you done."
//
//   board 4 picture 1  Stores › Categories - the shelf manager
//   board 4 picture 2  Add a whole catalogue - "Check the shelves"
//   board 4 picture 3  Stores › Shelf check - wrong-shelf groups, with undo
//
// The examples are the mock's own: Shah Pharmacy, ariel -> Laundry Detergent,
// RIVOTRIL -> Brain, Nerves & Sleep (Rx), the audit's 909 / 88 / 307 / 8,074.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BIG_SHELF, DEPT_COLOURS, NO_COLOUR, OTHER_DEPARTMENTS, SHOW_CHIPS, YOUR_SHOP,
  bigShelves, bigShelvesLine, countLeaves, deptColour, departmentsSummary, groupsFor, hasAllDepartments,
  headline, isRx, isSure, kindLook, leafIndex, mainDepartmentOf, moveLabel, ownFirst, perProduct,
  pharmacistWords, rxConfirmText, rxDoneText, saveLabel, shelfFilter, shelfOf, shelfOptions, shelfRows,
  shelfTotals, whenLabel, withChoices,
  type ShelfCheckResult, type ShelfGroup, type ShelfNode,
} from "../src/lib/shelves.ts";
import { filterCategories } from "../src/lib/category-search.ts";
import { NAVIGATION, SERVER_RULES, serverSectionFor } from "../src/lib/navigation.ts";
import { isOneStorePage } from "../src/lib/store-page.ts";

const code = (p: string) => readFileSync(p, "utf8");

// ── A small tree, shaped like the server's ──────────────────────────────────

const leaf = (id: string, name: string, extra: Partial<ShelfNode> = {}): ShelfNode => ({ id, name, ...extra });

const HEALTH: ShelfNode = {
  id: "h", name: "Health & Pharmacy", slug: "health-and-pharmacy", own: true,
  children: [
    { id: "hm", name: "Medicines", children: [
      leaf("otc", "Over the Counter"),
      leaf("brain", "Brain, Nerves & Sleep", { needs_prescription: true }),
    ] },
    leaf("diap", "Diapers & Wipes"),
  ],
};
const GROCERY: ShelfNode = {
  id: "g", name: "Grocery & Fresh", slug: "grocery-and-fresh", own: false,
  children: [
    leaf("rice", "Rice, Flour & Pulses", { display_order: 2 }),
    leaf("pasta", "Pasta & Noodles", { is_new: true, display_order: 3 }),
    { id: "lc", name: "Laundry & Cleaning Supplies", name_ur: "دھلائی", display_order: 15, children: [
      leaf("det", "Laundry Detergent"),
      leaf("pest", "Pest Control", { is_new: true }),
    ] },
  ],
};
const NEW_TREE = { tree: [GROCERY, HEALTH], own_slugs: ["health-and-pharmacy"] };
const OLD_TREE = { tree: [HEALTH] };   // an older server: the shop's own department only

// ── The picker ──────────────────────────────────────────────────────────────

test("the shop's own department comes first, whatever order the answer was in", () => {
  assert.deepEqual(ownFirst(NEW_TREE.tree, NEW_TREE.own_slugs).map((d) => d.slug),
    ["health-and-pharmacy", "grocery-and-fresh"]);
  // Marked by the slug list alone, too.
  assert.deepEqual(ownFirst([{ ...GROCERY, own: undefined }, { ...HEALTH, own: undefined }], ["health-and-pharmacy"])
    .map((d) => d.id), ["h", "g"]);
  // Nothing own: the order is kept exactly.
  assert.deepEqual(ownFirst([GROCERY, HEALTH].map((d) => ({ ...d, own: false })), []).map((d) => d.id), ["g", "h"]);
});

test("the picker offers every shelf of every department - a pharmacy may use Laundry Detergent", () => {
  const opts = shelfOptions(NEW_TREE);
  assert.deepEqual(opts.map((o) => o.id), ["otc", "brain", "diap", "rice", "pasta", "det", "pest"]);
  assert.deepEqual([...new Set(opts.map((o) => o.section))], [YOUR_SHOP, OTHER_DEPARTMENTS]);
  const det = opts.find((o) => o.id === "det")!;
  assert.equal(det.label, "Grocery & Fresh › Laundry & Cleaning Supplies › Laundry Detergent");
  assert.equal(det.section, OTHER_DEPARTMENTS);
  assert.equal(opts.find((o) => o.id === "brain")!.rx, true, "a prescription shelf carries the Rx mark");
  assert.equal(opts.find((o) => o.id === "pest")!.isNew, true, "a new shelf carries NEW");
  // Typing the department finds its shelves.
  assert.deepEqual(filterCategories(opts, "grocery deter").map((o) => o.id), ["det"]);
});

test("an older server (own department only) gives exactly the old labels and no headings", () => {
  assert.equal(hasAllDepartments(OLD_TREE), false);
  assert.equal(hasAllDepartments(NEW_TREE), true);
  const opts = shelfOptions(OLD_TREE);
  assert.deepEqual(opts.map((o) => o.label), ["Medicines › Over the Counter", "Medicines › Brain, Nerves & Sleep", "Diapers & Wipes"]);
  assert.ok(opts.every((o) => o.section === undefined));
  assert.deepEqual(shelfOptions(null), []);
});

test("every shelf knows its department, for the colour dot and the Rx tag", () => {
  const ix = leafIndex(NEW_TREE.tree);
  assert.equal(ix.get("det")!.dept, "grocery-and-fresh");
  assert.equal(ix.get("det")!.path, "Grocery & Fresh › Laundry & Cleaning Supplies");
  assert.equal(ix.get("brain")!.rx, true);
  assert.equal(ix.has("lc"), false, "a group is not a shelf");
});

test("the department colours are the customer app's own", () => {
  assert.equal(Object.keys(DEPT_COLOURS).length, 13);
  assert.deepEqual(deptColour("grocery-and-fresh"), ["#067A25", "#A0CE3E"]);
  assert.deepEqual(deptColour("health-and-pharmacy"), ["#00707A", "#19B8C4"]);
  assert.deepEqual(deptColour("nothing-like-it"), NO_COLOUR);
  assert.deepEqual(deptColour(null), NO_COLOUR);
  // The same values as type_marks.dart in the customer app.
  const dart = code("../swat-delivery-app/customer_app/lib/theme/type_marks.dart");
  for (const hex of ["D25105", "067A25", "00707A", "C2185B", "4527A0"]) assert.ok(dart.toUpperCase().includes(hex), hex);
});

// ── Picture 1: the shelf manager ────────────────────────────────────────────

test("each department says how many shelves it has, and how many are new", () => {
  const [g] = departmentsSummary([GROCERY]);
  assert.equal(g.shelves, 4);
  assert.equal(g.newShelves, 2);
  assert.deepEqual(countLeaves(HEALTH), { shelves: 3, fresh: 0 });
  assert.equal(headline([GROCERY, HEALTH]), "2 departments · 7 shelves");
  assert.equal(headline([leaf("x", "Lonely", { children: [leaf("y", "One")] })]), "1 department · 1 shelf");
});

test("the rows: 'Shelves' first, then each group with its heading", () => {
  const rows = shelfRows(GROCERY);
  assert.deepEqual(rows.map((r) => r.kind === "section" ? `# ${r.title}` : r.node.name),
    ["# Shelves", "Rice, Flour & Pulses", "Pasta & Noodles", "# Laundry & Cleaning Supplies", "Laundry Detergent", "Pest Control"]);
  // A shelf's arrows move it among its REAL siblings - the whole level.
  const rice = rows.find((r) => r.kind === "shelf" && r.node.id === "rice")!;
  assert.equal(rice.kind === "shelf" && rice.siblings.length, 3, "the level includes the group");
  const det = rows.find((r) => r.kind === "shelf" && r.node.id === "det")!;
  assert.deepEqual(det.kind === "shelf" && det.siblings.map((s) => s.id), ["det", "pest"]);
  // A department with groups only has no "Shelves" heading.
  assert.equal(shelfRows({ id: "z", name: "Z", children: [GROCERY.children![2]] })[0].kind, "section");
});

test("the Rx switch asks first, and says how many products changed", () => {
  assert.match(rxConfirmText("Diabetes", 77, true), /Mark “Diabetes” as needing a prescription\? Its 77 products will show the Rx mark/);
  assert.match(rxConfirmText("Allergy", 1, false), /Its 1 product is checked again by the medicine rule/);
  assert.equal(rxDoneText(true, 77), "Needs a prescription now · 77 products changed");
  assert.equal(rxDoneText(false, 1), "Prescription mark taken off · 1 product changed");
  assert.equal(rxDoneText(true, undefined), "Needs a prescription now", "an older server sends no count");
  assert.equal(mainDepartmentOf(["grocery", "x"], [{ code: "grocery", name: "Grocery" }]), "Grocery · x");
  assert.equal(mainDepartmentOf([], []), "no kind of shop yet");
});

// ── Picture 2: "Check the shelves" ──────────────────────────────────────────

const LEAVES = leafIndex(NEW_TREE.tree);
const R: ShelfCheckResult = {
  products: [
    { name: "ariel", category_id: "det", shelf_sure: "sure", sheet_said: "household" },
    { name: "RIVOTRIL DROPS", category_id: "brain", shelf_sure: "sure", rx: true, sheet_said: "medicine" },
    { name: "LUX PINK", category_id: "otc", shelf_sure: "not_sure", sheet_said: "cosmetics & personal care" },
    { name: "TAVANIC", shelf_sure: "not_sure", sheet_said: "other" },
  ],
  shelf_counts: { sure: 2, not_sure: 2, rx: 1 },
};

test("a server that chooses a shelf per product is told apart from an older one", () => {
  assert.equal(perProduct(R), true);
  assert.equal(perProduct({ products: [{ name: "x", shelf_sure: "sure" }] }), true);
  assert.equal(perProduct({ products: [{ name: "x", category_id: "a" }] }), false);
  assert.equal(perProduct(null), false);
});

test("the four tiles, before and after a person's choice", () => {
  assert.deepEqual(shelfTotals(R, {}, LEAVES), { sheet: 4, sure: 2, notSure: 2, rx: 1, changed: 0 });
  // TAVANIC is put on Brain, Nerves & Sleep: sure now, and Rx with the shelf.
  const t = shelfTotals(R, { 3: "brain" }, LEAVES);
  assert.deepEqual(t, { sheet: 4, sure: 3, notSure: 1, rx: 2, changed: 1 });
  assert.equal(saveLabel(shelfTotals(R, {}, LEAVES)), "Save 2 sure · then check 2");
  assert.equal(saveLabel({ sheet: 5610, sure: 5610, notSure: 0, rx: 0, changed: 0 }), "Save all 5,610");
  assert.equal(saveLabel({ sheet: 6425, sure: 5610, notSure: 815, rx: 3920, changed: 0 }), "Save 5,610 sure · then check 815");
});

test("a person's choice wins; clearing a shelf makes it not sure", () => {
  assert.equal(shelfOf(R.products[0], 0, { 0: "pasta" }), "pasta");
  assert.equal(isSure(R.products[2], 2, {}), false);
  assert.equal(isSure(R.products[2], 2, { 2: "det" }), true);
  assert.equal(isSure(R.products[0], 0, { 0: "" }), false);
  assert.equal(isRx(R.products[1], 1, {}, LEAVES), true);
  assert.equal(isRx(R.products[0], 0, { 0: "brain" }, LEAVES), true);
});

test("the filter chips", () => {
  assert.deepEqual(shelfFilter(R, "all", {}), [0, 1, 2, 3]);
  assert.deepEqual(shelfFilter(R, "not_sure", {}), [2, 3]);
  assert.deepEqual(shelfFilter(R, "rx", {}, LEAVES), [1]);
  assert.deepEqual(shelfFilter(R, "changed", { 2: "det" }), [2]);
  assert.deepEqual(shelfFilter(R, "shelf:det", { 2: "det" }), [0, 2]);
  assert.deepEqual(shelfFilter(R, "all", {}, LEAVES, "riv"), [1], "search by name");
});

test("no shelf gets more than 100 products without being seen", () => {
  const many: ShelfCheckResult = { products: [
    ...Array.from({ length: 612 }, (_, i) => ({ name: `OTC ${i}`, category_id: "otc", shelf_sure: "sure" })),
    ...Array.from({ length: 205 }, (_, i) => ({ name: `DET ${i}`, category_id: "det", shelf_sure: "sure" })),
    ...Array.from({ length: BIG_SHELF }, (_, i) => ({ name: `R ${i}`, category_id: "rice", shelf_sure: "sure" })),
  ] };
  const big = bigShelves(many, {}, LEAVES);
  assert.deepEqual(big.map((b) => [b.shelf, b.count]), [["Over the Counter", 612], ["Laundry Detergent", 205]],
    "exactly 100 is fine; biggest first");
  assert.equal(bigShelvesLine(big), "Over the Counter 612 · Laundry Detergent 205");
  // Moving products off a shelf takes it below the line at once.
  const o: Record<number, string> = {};
  for (let i = 0; i < 106; i++) o[612 + i] = "pasta";
  assert.deepEqual(bigShelves(many, o, LEAVES).map((b) => b.shelf), ["Over the Counter", "Pasta & Noodles"]);
  // The server's own list is used when nothing is counted here.
  assert.deepEqual(bigShelves({ products: [], big_shelves: [{ category_id: "x", shelf: "Pain & Fever", count: 418 }] }, {}),
    [{ category_id: "x", shelf: "Pain & Fever", count: 418 }]);
});

test("going on puts the person's choices into the check, with the shelf's Rx mark", () => {
  const out = withChoices(R, { 2: "det", 3: "brain" }, LEAVES);
  assert.equal(out.products[2].category_id, "det");
  assert.equal(out.products[2].shelf_sure, "sure");
  assert.equal(out.products[3].category_id, "brain");
  assert.equal(out.products[3].rx, true);
  assert.equal(out.products[3].needs_prescription, true);
  assert.equal(out.products[0], R.products[0], "an untouched product is the same object");
  assert.equal(withChoices(R, {}, LEAVES), R, "nothing chosen = the answer as it came");
});

// ── Picture 3: Shelf check ──────────────────────────────────────────────────

const G: ShelfGroup[] = [
  { key: "rx-otc", kind: "rx", title: "Prescription medicines sold as “Over the Counter”", count: 909 },
  { key: "fp", kind: "household", title: "Tissue rolls and household on “Family Planning”", count: 88 },
  { key: "hair", kind: "beauty", title: "Shampoo… on “Mother & Baby Care”", count: 307 },
  { key: "unknown", kind: "medicine_unknown", title: "Medicines Takal cannot sort by name", count: 8074, action: "pharmacist" },
  { key: "wakeel", kind: "small", title: "Wakeel toys", count: 12 },
  { key: "old", kind: "food", title: "Moved last week", count: 30, done: true },
];

test("the chips: To check / Medicines / Household & food / Beauty & care / Small shops / Done", () => {
  assert.deepEqual(SHOW_CHIPS.map((c) => c[1]), ["To check", "Medicines", "Household & food", "Beauty & care", "Small shops", "Done"]);
  assert.deepEqual(groupsFor(G, "to_check").map((g) => g.key), ["rx-otc", "fp", "hair", "unknown", "wakeel"]);
  assert.deepEqual(groupsFor(G, "medicines").map((g) => g.key), ["rx-otc", "unknown"]);
  assert.deepEqual(groupsFor(G, "household").map((g) => g.key), ["fp"]);
  assert.deepEqual(groupsFor(G, "beauty").map((g) => g.key), ["hair"]);
  assert.deepEqual(groupsFor(G, "small").map((g) => g.key), ["wakeel"]);
  assert.deepEqual(groupsFor(G, "done").map((g) => g.key), ["old"]);
});

test("each kind has its own square, as on the picture", () => {
  assert.deepEqual(kindLook("rx"), { bg: "#FDECEC", fg: "#D62839", icon: "Rx" });
  assert.equal(kindLook("household").icon, "⌂");
  assert.equal(kindLook("beauty").icon, "✿");
  assert.equal(kindLook("medicine_unknown").icon, "?");
  assert.equal(kindLook("anything else").icon, "•");
});

test("Move all: normal, Moving…, ✓ N moved (board 5's states)", () => {
  assert.equal(moveLabel(G[0], { phase: "idle" }), "Move all 909");
  assert.equal(moveLabel(G[3], { phase: "idle" }), "Move all 8,074");
  assert.equal(moveLabel(G[0], { phase: "moving" }), "Moving…");
  assert.equal(moveLabel(G[1], { phase: "moved", moved: 88, batch: "b1" }), "✓ 88 moved");
});

test("the pharmacist's list is read from a paste or a file", () => {
  assert.deepEqual(pharmacistWords("Panadol\nBrufen\n\n  ORS  \npanadol"), ["Panadol", "Brufen", "ORS"]);
  assert.deepEqual(pharmacistWords("name,company\n\"Gaviscon\",Reckitt\nVitamin C, X"),
    ["company", "Gaviscon", "Reckitt", "Vitamin C", "X"]);
  assert.deepEqual(pharmacistWords("Medicine\tsafe\nCalpol"), ["Calpol"], "a heading row is dropped");
  assert.equal(pharmacistWords(Array.from({ length: 6000 }, (_, i) => `M${i}`).join("\n")).length, 5000);
  assert.deepEqual(pharmacistWords(""), []);
});

test("the undo list says when, in words", () => {
  assert.match(whenLabel("2026-10-18T21:41:00"), /^18 Oct, 9:41 pm$/);
  assert.equal(whenLabel(null), "");
  assert.equal(whenLabel("not a date"), "");
});

// ── The pages use these rules, and the tab is where Sana expects it ─────────

test("Shelf check is a Stores tab, with the black NEW tag, guarded like Categories", () => {
  const tabs = NAVIGATION.find((n) => n.label === "Stores")!.tabs!;
  assert.deepEqual(tabs.map((t) => t.label),
    ["All Stores", "Malls", "My new shops", "Categories", "Shelf check", "Low stock", "Commission", "Cancellations"]);
  const t = tabs.find((x) => x.label === "Shelf check")!;
  assert.equal(t.href, "/dashboard/stores/shelf-check");
  assert.equal(t.section, "stores.catalogue");
  assert.equal(t.tag, "NEW");
  assert.ok(SERVER_RULES.some(([p, s]) => p === "/admin/shelf-check" && s === "stores.catalogue"));
  assert.equal(serverSectionFor("/admin/shelf-check/move", "write"), "stores.catalogue");
  assert.equal(isOneStorePage("/dashboard/stores/shelf-check"), false, "it keeps the Stores title and tabs");
  assert.match(code("src/components/ui/DomainTabs.tsx"), /\{t\.tag \? \(/);
});

test("the pages are built from these rules", () => {
  const manager = code("src/app/dashboard/stores/catalogue/parts-shelves.tsx");
  for (const s of ["headline(", "shelfRows(", "departmentsSummary(", "every shop may use it", "+ Add shelf",
    "+ Add department", "Counts are before the big move. New shelves start empty and fill up when products are moved — empty shelves stay hidden from customers.",
    "Needs prescription", "Order · Rename", "Urdu name"]) assert.ok(manager.includes(s), s);
  const page = code("src/app/dashboard/stores/catalogue/page.tsx");
  assert.ok(page.includes("rxConfirmText(") && page.includes("needs_prescription: on"));
  const shelves = code("src/app/dashboard/stores/[id]/catalogue/parts-shelves.tsx");
  for (const s of ["shelfTotals(", "bigShelves(", "saveLabel(", "products in the sheet", "Sure — shelf found from the name",
    "Not sure — please choose", "medicines that need a prescription (Rx)",
    "No shelf gets more than 100 products without you seeing it.", "Check biggest",
    "Product (from the sheet)", "How sure", "Sheet said", "Changed by you"]) assert.ok(shelves.includes(s), s);
  const upload = code("src/app/dashboard/stores/[id]/catalogue/page.tsx");
  assert.ok(upload.includes("perProduct(res as ShelfCheckResult)"), "an older server keeps the word table");
  assert.ok(upload.includes("withChoices(shelfResult"), "the person's choices go into the save");
  const check = code("src/app/dashboard/stores/shelf-check/page.tsx");
  for (const s of ["Products that look like they are on the wrong shelf", "Undo history", "Look one by one",
    "Upload pharmacist list", "Safe to press.", "Runs every month.", "groupsFor(", "moveLabel(",
    "apiClient.moveShelfCheck({ group: g.key })", "apiClient.undoShelfCheck(", "apiClient.sendPharmacistList(words)"]) {
    assert.ok(check.includes(s), s);
  }
  const editor = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.ok(editor.includes("apiClient.getShelfTree(vendorType)") && editor.includes("shelfOptions(res)"));
  assert.ok(editor.includes("apiClient.suggestShelf(typed, restaurantId)") && editor.includes("✓ Use this"));
  const api = code("src/lib/api-stores.ts");
  assert.ok(api.includes('new URLSearchParams({ all_departments: "true" })'));
  assert.ok(api.includes("/shelf/suggest?"));
  // Sign-up and moving to another store still choose the shop's OWN sections.
  assert.match(code("src/app/dashboard/stores/parts-create-store.tsx"), /apiClient\.getCategoryTree\(vendorType\)/);
});

test("Shelf check: the server's card kinds land under the right chips; 'look' cards have no Move all", () => {
  const g = (key: string, kind: string, action = "move") => ({ key, kind, title: key, count: 1, action });
  const cards = [g("rx|a", "rx"), g("medicine|a", "medicine"), g("medicine_unknown|a", "medicine_unknown", "pharmacist"),
                 g("dept|a|grocery-and-fresh", "household"), g("dept|a|beauty", "beauty"), g("unsure|a", "unsure", "look"),
                 g("small|s", "small", "look")];
  assert.deepEqual(groupsFor(cards, "medicines").map((c) => c.key), ["rx|a", "medicine|a", "medicine_unknown|a"]);
  assert.deepEqual(groupsFor(cards, "household").map((c) => c.key), ["dept|a|grocery-and-fresh"]);
  assert.deepEqual(groupsFor(cards, "small").map((c) => c.key), ["small|s"]);
  assert.equal(groupsFor(cards, "to_check").length, 7);
  const page = readFileSync(new URL("../src/app/dashboard/stores/shelf-check/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const lookOnly = g\.action === "look";/);
  assert.match(page, /\{!lookOnly && <button type="button" onClick=\{onMoveAll\}/);
});
