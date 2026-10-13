// STORES PAGE FIX 9 (Sana, 12 October 2026: "OK fix 9"; audit O13) - the big
// "Save changes" on Stores → Commission saves EVERYTHING you changed: the
// default rate, the markup and every shop-type row. It used to save only the
// top two boxes, so a typed "Pharmacy 5%" was lost without a word.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { changedRows, rowPercent, rowWords, sameNumber, savedWords } from "../src/lib/commission-changes.ts";

const ROOT = join(import.meta.dirname, "..");
const page = readFileSync(join(ROOT, "src/app/dashboard/stores/commission/page.tsx"), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("only the rows you changed are sent", () => {
  const saved = { pharmacy: "", grocery: "8", bakery: "12" };
  assert.deepEqual(changedRows({ pharmacy: "5", grocery: "8.0", bakery: "12" }, saved, ["pharmacy", "grocery", "bakery"]), ["pharmacy"]);
  assert.deepEqual(changedRows({ pharmacy: "", grocery: "", bakery: "12" }, saved, ["pharmacy", "grocery", "bakery"]), ["grocery"],
    "emptying a row = back to the global rate, which is a change");
  assert.deepEqual(changedRows(saved, saved, Object.keys(saved)), []);
});

test("a row means a rate, or blank for the global rate", () => {
  assert.deepEqual(rowPercent("5"), { ok: true, percent: 5 });
  assert.deepEqual(rowPercent(" "), { ok: true, percent: null });
  assert.deepEqual(rowPercent("101"), { ok: false });
  assert.deepEqual(rowPercent("-1"), { ok: false });
  assert.deepEqual(rowPercent("abc"), { ok: false });
  assert.equal(sameNumber("10", "10.0"), true);
});

test("the message says what was saved", () => {
  assert.equal(savedWords(["default rate 10%", rowWords("Pharmacy", 5), rowWords("Grocery", null)]),
    "Saved: default rate 10%, Pharmacy 5%, Grocery: global rate");
  assert.equal(savedWords([]), "Nothing was changed, so nothing was saved");
});

test("the big button saves the changed rows too, checked first", () => {
  assert.match(page, /const rows = vcError \? \[\] : changedTypes;/);
  assert.match(page, /if \(!rowPercent\(vcRates\[t\]\)\.ok\) \{[\s\S]{0,200}Nothing was saved/);
  assert.match(page, /await apiClient\.setVerticalCommission\(t, r\.percent\);/);
  assert.match(page, /toast\(`Not saved: \$\{failed\.join\("; "\)\}/);
});

test("a changed row says so, and the button says how many", () => {
  assert.match(page, /changedTypes\.includes\(v\.value\) && \(/);
  assert.match(page, /not saved yet/);
  assert.match(page, /Save changes \(\$\{changedTypes\.length\} store type/);
});

test("the old locks stay: a failed read saves nothing", () => {
  assert.match(page, /if \(settingsError\) \{/);
  assert.match(page, /disabled=\{saving \|\| loadingSettings \|\| !!settingsError\}/);
  assert.match(page, /disabled=\{vcSavingType === v\.value \|\| !!vcError\}/);
});
