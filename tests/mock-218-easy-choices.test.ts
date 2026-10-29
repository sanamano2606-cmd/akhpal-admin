// MOCK 218 v2 - EASY SIZES, COLOURS AND DETAILS (Sana, 29 Oct 2026: "GO 218").
//
// The panel's copy of the easy steps' rules (src/lib/option-wizard.ts) gives
// EXACTLY the answers in the one shared list of cases the server and the
// Partners app are tested against. And the product editor really offers the
// steps, keeps an option's id when the steps keep it, and asks the server's
// own address for the ready choices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRows, readRows, QUESTION_WORDS, templateFrom, FALLBACK, draftsFromBuilt, rowsOfDrafts, choiceLines,
  kindsForReading,
} from "../src/lib/option-wizard.ts";

const CASES = JSON.parse(readFileSync("../swat-delivery-app/backend/option_wizard_cases.json", "utf8"));
const EDITOR = readFileSync("src/app/dashboard/stores/[id]/ProductEditorModal.tsx", "utf8");
const STEPS = readFileSync("src/app/dashboard/stores/[id]/parts-easy-choices.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const ROUTER = readFileSync("../swat-delivery-app/backend/routers/option_templates_api.py", "utf8");
const GALLERY = readFileSync("../swat-delivery-app/customer_app/lib/screens/product/product_detail_gallery.dart", "utf8");

for (const c of CASES.build) {
  test(`choices become rows: ${c.name}`, () => {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(buildRows(c.in))), c.out);
  });
}

for (const c of CASES.read) {
  test(`rows become choices: ${c.name}`, () => {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(readRows(c.rows, CASES.kinds))), c.out);
  });
}

test("the question words are the customer app's", () => {
  const block = /_questionWord\(String n\) => const \{([\s\S]*?)\}/.exec(GALLERY)![1];
  const words = new Set([...block.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  assert.deepStrictEqual([...words].sort(), [...QUESTION_WORDS].sort());
});

test("the server's answer is read; a broken one falls back to the everyday list", () => {
  const t = templateFrom({
    department: "Fashion", shelf: "Men's Shoes", suggested: ["colour", "shoe_size"],
    kinds: [{ key: "colour", label: "Colour", groups: [{ title: "Colours", values: ["Red", ""], dots: { Red: "#D62839" } }] },
      { nonsense: 1 }],
    details: [{ label: "Fabric", example: "Leather", important: true }, { label: "" }],
  });
  assert.equal(t.fromServer, true);
  assert.deepStrictEqual(t.kinds.map((k) => k.key), ["colour"]);
  assert.deepStrictEqual(t.kinds[0].groups[0].values, ["Red"]);
  assert.equal(t.details.length, 1);
  assert.equal(templateFrom(null), FALLBACK);
  assert.equal(templateFrom({ kinds: [] }).fromServer, false);
});

test("an option the steps keep keeps its id, its on/off and its code", () => {
  const had = [
    { id: "o1", variant_type: "Red", variant_value: "M", stock: "4", price: "", sku: "RM-1", on: false },
    { id: "o2", variant_type: "Red", variant_value: "XL", stock: "", price: "", sku: "", on: true },
  ];
  const built = buildRows({ levels: ["Colour", "Size"], first: ["Red", "Black"],
    second: { Red: ["m", "L"], Black: ["M"] }, stock: { "Red|m": 4 }, price: { "Black|M": 1300 } });
  const out = draftsFromBuilt(had, built.rows);
  assert.deepStrictEqual(out.map((d) => [d.id ?? null, d.variant_type, d.variant_value, d.on, d.sku, d.stock, d.price]), [
    ["o1", "Red", "M", false, "RM-1", "4", ""],
    [null, "Red", "L", true, "", "", ""],
    [null, "Black", "M", true, "", "", "1300"],
  ]);
  // Red XL was taken away by the steps: it is not in the list, so Save sends it in remove_ids.
  assert.ok(!out.some((d) => d.id === "o2"));
});

test("the drafts on screen open the steps on what the product has", () => {
  const drafts = [
    { variant_type: "Red", variant_value: "M", stock: "3", price: "1,200", sku: "", on: true },
    { variant_type: "Black", variant_value: "L", stock: "", price: "", sku: "", on: true },
    { variant_type: "", variant_value: "", stock: "", price: "", sku: "", on: true },
  ];
  const back = readRows(rowsOfDrafts(drafts), kindsForReading(FALLBACK));
  assert.deepStrictEqual(back.levels, ["Colour", "Size"]);
  assert.deepStrictEqual(back.second, { Red: ["M"], Black: ["L"] });
  assert.deepStrictEqual(back.price, { "Red|M": 1200 });
  assert.deepStrictEqual(choiceLines(drafts), ["Red: M", "Black: L"]);
});

test("the editor offers the easy steps over the options grid, for shops that sell goods", () => {
  assert.match(EDITOR, /import EasyChoices from "\.\/parts-easy-choices"/);
  const grid = EDITOR.indexOf('data-testid="options-section"');
  const steps = EDITOR.indexOf("<EasyChoices", grid);
  assert.ok(grid > 0 && steps > grid, "the steps sit inside the options section");
  // What decides whether anybody SEES them is the condition - shops that sell
  // goods (a restaurant keeps its own sizes and extras cards).
  assert.match(EDITOR, /\{!isRestaurant && \(\s*<EasyChoices/);
  assert.match(EDITOR, /onDone=\{\(rows, detail\) => \{\s*setVariants\(\(had\) => draftsFromBuilt\(had, rows\)\);/);
  assert.match(EDITOR, /detail && specsEditable/);
});

test("the six steps are there, one question each, with a Roman Urdu line", () => {
  assert.match(STEPS, /STEP \{step\} OF 6/);
  for (let n = 1; n <= 6; n++) assert.ok(STEPS.includes(`{step === ${n} &&`), `step ${n}`);
  for (const r of ["Kya yeh cheez mukhtalif rang", "Kya cheez badalti hai", "Har ", "Theek hai?"]) assert.ok(STEPS.includes(r), r);
  assert.match(STEPS, /Same as /);
  assert.match(STEPS, /Size first|first`/);
  // Picked is Takal yellow, never black (Sana).
  assert.match(STEPS, /bg-takal-yellow/);
  assert.doesNotMatch(STEPS, /bg-black(?!\/)|bg-takal-ink text-white/); // a dim veil behind the dialog is fine
});

test("the panel asks the server's own address for the ready choices", () => {
  assert.match(API, /\/option-templates\?/);
  assert.match(ROUTER, /@router\.get\("\/option-templates"/);
});
