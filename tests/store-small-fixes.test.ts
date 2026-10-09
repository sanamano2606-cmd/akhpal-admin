// ─────────────────────────────────────────────────────────────────────────────
// MOCK 134 (approved 1 Oct 2026): the store logo is a picture with an Upload
// button (SM12), a category can be searched (SM14), every photo is shown ONCE
// and can be put in order (SM15), and every box in the product window has a
// label. The rules are RUN here; the screens are read for the approved parts.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterCategories, highlightParts, pathLabel, wordsOf } from "../src/lib/category-search.ts";
import { isPictureLink, makeCover, movePhoto } from "../src/lib/photo-order.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const EDITOR = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const SETTINGS = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const PRODUCTS = read("src/app/dashboard/stores/[id]/parts-products.tsx");
const PICKER = read("src/components/CategoryPicker.tsx");
const STORE = read("src/app/dashboard/stores/[id]/page.tsx");
const SHOP = read("src/app/shop/page.tsx");

const CATS = [
  { id: "1", label: "Cleaning › Washing powder" },
  { id: "2", label: "Cleaning › Dishwash" },
  { id: "3", label: "Personal care › Face wash" },
  { id: "4", label: "Food › Burgers" },
];

// ── SM14: finding a category ────────────────────────────────────────────────
test("every typed word must appear, in any order and any case", () => {
  assert.deepEqual(filterCategories(CATS, "wash").map((c) => c.id), ["1", "2", "3"]);
  assert.deepEqual(filterCategories(CATS, "CLEAN wash").map((c) => c.id), ["1", "2"]);
  assert.deepEqual(filterCategories(CATS, "powder washing").map((c) => c.id), ["1"]);
  assert.deepEqual(filterCategories(CATS, "zzz"), []);
});

test("nothing typed shows everything, in the shop's own order", () => {
  assert.deepEqual(filterCategories(CATS, "   "), CATS);
  assert.deepEqual(wordsOf("  Face   WASH "), ["face", "wash"]);
});

test("a category is found by its parent's name too", () => {
  assert.deepEqual(filterCategories(CATS, "food").map((c) => c.id), ["4"]);
  assert.equal(pathLabel(["Food", "", "Burgers"]), "Food › Burgers");
});

test("the typed words are marked, and touching marks join", () => {
  assert.deepEqual(highlightParts("Cleaning › Washing powder", "wash"),
    [{ text: "Cleaning › ", hit: false }, { text: "Wash", hit: true }, { text: "ing powder", hit: false }]);
  assert.deepEqual(highlightParts("Dishwash", "dish wash"), [{ text: "Dishwash", hit: true }]);
  assert.deepEqual(highlightParts("Food", ""), [{ text: "Food", hit: false }]);
});

// ── SM15: photos in order ───────────────────────────────────────────────────
test("a dragged photo lands where it was dropped; the rest keep their order", () => {
  assert.deepEqual(movePhoto(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(movePhoto(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(movePhoto(["a", "b"], 5, 0), ["a", "b"], "out of range moves nothing");
  const before = ["a", "b"]; movePhoto(before, 1, 0);
  assert.deepEqual(before, ["a", "b"], "the list on screen is never changed in place");
});

test("Make cover puts that photo first - for phones, where dragging does not work", () => {
  assert.deepEqual(makeCover(["a", "b", "c"], 2), ["c", "a", "b"]);
});

test("only a real https picture address is taken from 'paste a link'", () => {
  assert.equal(isPictureLink("https://citymall.pk/logo.png"), true);
  for (const bad of ["http://x.pk/a.png", "data:image/png;base64,AAAA", "logo.png", "", "https://", "javascript:alert(1)"]) {
    assert.equal(isPictureLink(bad), false, bad);
  }
});

test("the product window shows each photo ONCE - no box of computer text", () => {
  assert.doesNotMatch(EDITOR, /…or paste an image URL/);
  assert.doesNotMatch(EDITOR, /\+ Add photo URL/);
  assert.match(EDITOR, /setPhotos\(movePhoto\(shown, dragFrom, i\)\)/);
  assert.match(EDITOR, /onClick=\{\(\) => setPhotos\(makeCover\(shown, i\)\)\}/);
  assert.match(EDITOR, /if \(!isPictureLink\(t\)\)/);
  assert.match(EDITOR, /Array\.from\(\{ length: pending \}\)/, "one spinning square per photo on its way");
});

test("every box in the product window has a label above it", () => {
  // "Category" became "Sub-category *" on 3 Oct 2026 - a sub-category is now
  // required (Sana; see the next test).
  for (const l of ["Name", "Description", "Price (Rs)", "Discount %", "Stock", "Sub-category *"]) {
    assert.ok(EDITOR.includes(`<span className={labelCls}>${l}</span>`), l);
  }
});

test("a product cannot be saved without a sub-category (Sana, 3 Oct 2026)", () => {
  // 694 food products had none, so they never reached the Pizza / Burgers
  // lines or the shop's own buttons. Save is refused until one is chosen -
  // and refused too when the list could not be read, never saved blind.
  assert.match(EDITOR, /if \(cats\.length > 0 && !categoryId\) \{\n\s+toast\("Choose a sub-category - customers find products by it", "error"\);\n\s+return;/);
  assert.match(EDITOR, /if \(catsFailed\) \{\n\s+toast\("The category list could not be read - close and reopen this box", "error"\);\n\s+return;/);
  assert.doesNotMatch(EDITOR, /emptyLabel="No category"/, "no way to choose 'no category' any more");
});

test("the category boxes are the searchable picker, not one long list", () => {
  assert.match(EDITOR, /<CategoryPicker options=\{cats\} value=\{String\(categoryId \|\| ""\)\} onChange=\{setCategoryId\}\n\s+emptyLabel="Choose a sub-category…"/);
  assert.match(PRODUCTS, /emptyLabel="All categories"/);
  assert.match(PRODUCTS, /emptyLabel="Choose a category…" ariaLabel="Move to category"/);
  assert.doesNotMatch(PRODUCTS, /<option value="">All categories<\/option>/);
  // A failed category read is still said, never shown as an empty list.
  assert.match(EDITOR, /The category list could not be read/);
});

// ── SM12: the logo ──────────────────────────────────────────────────────────
test("the logo is a picture with an Upload button, not a text box", () => {
  assert.doesNotMatch(SETTINGS, /label: "Logo image URL"/);
  assert.match(SETTINGS, /<LogoBox store=\{store\} onLogo=\{onLogo \?\? \(\(\) => onSaved\(\)\)\} \/>/);
  assert.match(SETTINGS, /const res = await apiClient\.uploadImage\(file\);/);
  assert.match(SETTINGS, /await apiClient\.updateRestaurant\(String\(store\.id\), \{ image_url: next \}\);/);
  assert.match(SETTINGS, /title="Remove the logo\?"/, "Remove asks first");
});

test("the typed boxes' Save never sends the logo, so the two cannot undo each other", () => {
  const save = SETTINGS.split("const save = async () => {")[1].split("const field =")[0];
  assert.doesNotMatch(save, /image_url/);
});

test("a new logo shows in the header without a reload that would wipe half-typed boxes", () => {
  assert.match(STORE, /onLogo=\{\(url\) => setData\(\(d: any\) => \(d \? \{ \.\.\.d, restaurant: \{ \.\.\.d\.restaurant, image_url: url \} \} : d\)\)\}/);
  // Step 5: the store being worked on may be any store of a mall login -
  // withNewLogo puts the logo on that store wherever the window shows it.
  assert.match(SHOP, /onLogo=\{\(url\) => setMe\(\(m\) => \(m \? withNewLogo\(m, String\(shop\.id\), url\) : m\)\)\}/);
});

test("the new parts never build a colour class from a variable", () => {
  for (const [n, src] of [["picker", PICKER], ["settings", SETTINGS], ["editor", EDITOR]] as const) {
    assert.doesNotMatch(src, /\[[^\]\n]*\$\{[^\]\n]*\]/, n);
  }
});
