// ─────────────────────────────────────────────────────────────────────────────
// EDIT IN THE LIST - every store.  (Fixed-price stores plan, Step 5a.)
//
// Sana, 8 October 2026: "Make all the Stores products easily editable within
// the list, so every time no need to open edit products page." Mock 171-2
// APPROVED; "go" for Step 5a.
//
// Before: only Price, Stock and On/Off could be typed in a product row. Now
// name, price, discount, stock and category are typed in the row; Enter saves,
// Esc cancels, Tab saves and moves on; ▾ opens the sizes and extras INSIDE the
// list, each with its own price, stock and on/off.
//
// These checks hold the RULES (the arithmetic is run for real) and that the
// screen really uses them: a wrong value is never sent, a change touches only
// its own row, and one size is changed through its own door - never by
// rewriting all the product's options.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  afterDiscount, checkDiscount, checkName, checkOptionPrice, checkPrice, checkStock,
  dishPriceAfterSizeChange, fromPrice, nextField, optionKind, optionWords, tabTarget,
} from "../src/lib/edit-in-the-list.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const TAB = read("src/app/dashboard/stores/[id]/parts-products.tsx");
const EDIT = read("src/app/dashboard/stores/[id]/parts-products-edit.tsx");
const API = read("src/lib/api-stores.ts");
const SERVER = read("../swat-delivery-app/backend/routers/shop_products.py");

function fn(src: string, name: string): string {
  const start = src.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `${name} is missing`);
  const next = src.indexOf("\n  const ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

// ── 1. WHAT MAY BE TYPED - the server's own rules, said first ───────────────

test("a name is tidied, and an empty or too-long one is refused in words", () => {
  assert.deepEqual(checkName("  Zinger   Burger with Fries "), { ok: true, value: "Zinger Burger with Fries" });
  assert.equal(checkName("   ").ok, false);
  assert.equal(checkName("x".repeat(151)).ok, false, "MenuItemUpdate.name is 150 at most");
  assert.equal(checkName("x".repeat(150)).ok, true);
});

test("a price is rupees, 0 or more", () => {
  assert.deepEqual(checkPrice("450"), { ok: true, value: 450 });
  assert.deepEqual(checkPrice("1,350"), { ok: true, value: 1350 }, "a comma as typed in Pakistan");
  assert.deepEqual(checkPrice("0"), { ok: true, value: 0 }, "0 was allowed in this list before - unchanged");
  for (const bad of ["", "-5", "abc", "12a", "10000001"]) assert.equal(checkPrice(bad).ok, false, bad);
});

test("a discount is a whole number from 0 to 100, and an empty box means none", () => {
  assert.deepEqual(checkDiscount("10"), { ok: true, value: 10 });
  assert.deepEqual(checkDiscount("10 %"), { ok: true, value: 10 });
  assert.deepEqual(checkDiscount(""), { ok: true, value: 0 }, "an emptied box takes the discount off");
  for (const bad of ["101", "4.5", "-1", "ten"]) assert.equal(checkDiscount(bad).ok, false, bad);
});

test("stock 4.5 is refused with the words Mock 171-2 shows", () => {
  const c = checkStock("4.5");
  assert.equal(c.ok, false);
  assert.equal((c as any).reason, "stock must be a whole number (0 or more)");
  assert.deepEqual(checkStock("4"), { ok: true, value: 4 });
  assert.deepEqual(checkStock("0"), { ok: true, value: 0 });
});

test("a size needs more than Rs 0; an extra may be free", () => {
  assert.equal(checkOptionPrice("0", "size").ok, false);
  assert.deepEqual(checkOptionPrice("1350", "size"), { ok: true, value: 1350 });
  assert.deepEqual(checkOptionPrice("0", "extra"), { ok: true, value: 0 });
  assert.equal(checkOptionPrice("", "extra").ok, false);
  assert.deepEqual(checkOptionPrice("0", "choice"), { ok: true, value: 0 });
});

// ── 2. TAB WALKS THE ROW, THEN THE NEXT ROW ─────────────────────────────────

test("Tab goes name → price → discount → stock, then the next product's name", () => {
  assert.equal(nextField("name"), "price");
  assert.equal(nextField("stock"), null);
  assert.equal(nextField("name", true), null);
  const ids = ["a", "b"];
  assert.deepEqual(tabTarget(ids, "a", "discount"), { id: "a", field: "stock" });
  assert.deepEqual(tabTarget(ids, "a", "stock"), { id: "b", field: "name" });
  assert.deepEqual(tabTarget(ids, "b", "name", true), { id: "a", field: "stock" });
  assert.equal(tabTarget(ids, "b", "stock"), null, "off the end of the page: the box just closes");
});

// ── 3. THE WORDS AND NUMBERS ON THE ROW ─────────────────────────────────────

test("Rs 280 with 10% off is Rs 252 - whole rupees", () => {
  assert.equal(afterDiscount(280, 10), 252);
  assert.equal(afterDiscount(105, 7), 98, "97.65 -> 98");
  assert.equal(afterDiscount(280, 0), null, "no discount, no line");
});

test("'4 sizes · 3 extras' under the name", () => {
  assert.equal(optionWords(4, 3, true), "4 sizes · 3 extras");
  assert.equal(optionWords(1, 0, true), "1 size");
  assert.equal(optionWords(2, 0, false), "2 options", "colours are options, not sizes");
  assert.equal(optionWords(0, 1, false), "1 extra");
});

test("'from Rs 650' only when every size has its own price", () => {
  const pizza = [
    { variant_type: "Size", price_override: 1300 },
    { variant_type: "Size", price_override: 650 },
    { variant_type: "Extra", price_override: 100 },
  ];
  assert.equal(fromPrice(pizza), 650, "the extra is not a size");
  assert.equal(fromPrice([{ variant_type: "Size", price_override: null }, { variant_type: "Size", price_override: 900 }]), null,
    "a size without a price of its own costs the product's price");
  assert.equal(optionKind({ variant_type: " extra " }), "extra");
  assert.equal(optionKind({ variant_type: "Colour" }), "choice");
});

test("a restaurant's dish keeps its own price at the cheapest size (Mock 162)", () => {
  const sizes = [{ variant_type: "Size", price_override: 700 }, { variant_type: "Size", price_override: 1300 }];
  assert.equal(dishPriceAfterSizeChange("restaurant", sizes, 650), 700, "Regular went 650 -> 700");
  assert.equal(dishPriceAfterSizeChange("restaurant", sizes, 700), null, "already right: nothing sent");
  assert.equal(dishPriceAfterSizeChange("grocery", sizes, 650), null, "a grocery's own price is the shop's choice");
  assert.equal(dishPriceAfterSizeChange("restaurant",
    [{ variant_type: "Size", price_override: 700 }, { variant_type: "Colour", price_override: 9 }], 650), null,
    "not sold in sizes alone");
});

// ── 4. THE SCREEN REALLY USES THEM ──────────────────────────────────────────

test("one save for name, price, discount and stock - and a wrong value is never sent", () => {
  const body = fn(TAB, "saveField");
  for (const check of ["checkName", "checkPrice", "checkDiscount", "checkStock"]) {
    assert.ok(body.includes(check), `saveField must use ${check}`);
  }
  const refused = body.indexOf("if (!c.ok)");
  const sent = body.indexOf("apiClient.updateMenuItem");
  assert.ok(refused > 0 && sent > refused, "the check comes before anything is sent");
  assert.match(body.slice(refused, sent),
    /^if \(!c\.ok\) \{\s*(\/\/[^\n]*\s*)*setEdit\(\{ \.\.\.edit, bad: true \}\);\s*note\([^\n]*\);\s*return;\s*\}/,
    "a refused value keeps its box open, red, and STOPS - nothing after it runs");
  assert.match(body, /patchRow\(p\.id,/, "only its own row changes");
  assert.doesNotMatch(body, /setReloadKey|load\(\)/, "nothing reloads the whole store");
});

test("an unchanged box sends nothing", () => {
  assert.match(fn(TAB, "saveField"), /if \(edit\.val\.trim\(\) === valueOf\(p, field\)\.trim\(\)\) \{ moveOn\(\); return; \}/);
});

test("Enter saves, Esc cancels, Tab saves and moves on - in every box", () => {
  assert.match(EDIT, /e\.key === "Enter"\) \{ e\.preventDefault\(\); onSave\(\); \}/);
  assert.match(EDIT, /e\.key === "Escape"\) \{ e\.preventDefault\(\); onCancel\(\); \}/);
  assert.match(EDIT, /e\.key === "Tab" && onTab\) \{ e\.preventDefault\(\); onTab\(e\.shiftKey\); \}/);
  for (const f of ["name", "price", "discount", "stock"]) {
    assert.match(TAB, new RegExp(`typing\\?\\.field === "${f}" \\? \\(\\s*<EditBox`), `the ${f} box`);
  }
});

test("the category of one product is chosen from the category list and saved alone", () => {
  const body = fn(TAB, "saveCategory");
  assert.match(body, /if \(!value\) \{ toast\("Choose a category", "error"\); return; \}/, "never an empty category");
  assert.match(body, /apiClient\.updateMenuItem\(p\.id, \{ category_id: value \}\)/);
  assert.match(body, /patchRow\(p\.id,/);
});

test("a price set size by size is shown as 'from Rs …' and opens the sizes, not a box", () => {
  assert.match(fn(TAB, "openBox"), /if \(field === "price" && priceIsFromSizes\(p\)\) \{[\s\S]*setOpened/);
  assert.match(TAB, /from \{money\(p\.from_price\)\}/);
});

test("one size is changed through ITS OWN door - the others are never rewritten", () => {
  assert.match(API, /async updateVariant\([\s\S]*?\/variants\/\$\{encodeURIComponent\(variantId\)\}`, \{\s*method: "PATCH"/);
  assert.match(API, /\/menu\/\$\{encodeURIComponent\(itemId\)\}\/variants\?include_unavailable=true/,
    "switched-off sizes are listed too, or they could never be switched back on");
  assert.doesNotMatch(EDIT, /setProductVariants/, "the replace-them-all door must not be used here");
  assert.match(EDIT, /apiClient\.updateVariant\(v\.id, payload\)/);
  assert.match(EDIT, /apiClient\.updateVariant\(v\.id, \{ is_available: on \}\)/);
});

test("a size's price is checked before it is sent, and a dish's 'from' price follows", () => {
  const save = EDIT.slice(EDIT.indexOf("const save = async"), EDIT.indexOf("const flip = async"));
  const refused = save.indexOf("if (!c.ok)");
  const sent = save.indexOf("apiClient.updateVariant");
  assert.ok(refused > 0 && sent > refused);
  assert.match(save, /dishPriceAfterSizeChange\(vendorType, next, product\.price\)/);
  assert.match(save, /apiClient\.updateMenuItem\(product\.id, \{ price: dish \}\)/);
});

test("two quick clicks on a size's switch are one change", () => {
  assert.match(EDIT, /if \(flipping\.current\.has\(v\.id\)\) return;/);
});

test("the list fits a smaller screen: no picture and no category column below 1280 px", () => {
  assert.match(TAB, /const SHOW_PICTURE = "hidden xl:table-cell";/);
  assert.match(TAB, /const SHOW_CATEGORY = "hidden xl:table-cell";/);
  // ...and the category stays clickable, under the name.
  assert.match(TAB, /onClick=\{\(\) => setCatFor\(\{ p, value: p\.category_id \|\| "" \}\)\}[\s\S]*xl:pointer-events-none/);
});

test("the server sends the sizes and extras summary the row draws", () => {
  assert.match(SERVER, /"&select=product_id,variant_type,price_override"/);
  assert.match(SERVER, /\*\*_option_summary\(options_of\.get\(pid, \[\]\)\)/);
  for (const k of ["choice_count", "extra_count", "sizes", "from_price"]) {
    assert.ok(SERVER.includes(`"${k}"`), k);
    assert.ok(API.includes(`${k}?:`), `the panel's type knows ${k}`);
  }
});
