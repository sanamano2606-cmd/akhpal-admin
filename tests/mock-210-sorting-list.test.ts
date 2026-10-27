// MOCK 210-5 (approved by Sana 27 Oct 2026): Stores › Product sorting › Sorting list
// - teach Takal once, every shop follows. And Mock 210-4's "Also remember" tick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATCH_CHOICES, PHARMACIST_HEADINGS, checkCounts, cleanWord, guessSheetColumns, linesToAdd, pileNamesCsv,
  rxForLine, sheetRows, startingRx, startsWithWord, waitsForAPerson, wordProblem, wordToRemember,
  type CheckedRow,
} from "../src/lib/sorting-list.ts";
import { parseCsv } from "../src/lib/sheet-reader.ts";
import { SORTING_TABS } from "../src/lib/product-sorting.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = read("src/app/dashboard/stores/sorting/list/page.tsx");
const FIND = read("src/app/dashboard/stores/sorting/find/page.tsx");
const API = read("src/lib/api-stores.ts");

test("the Sorting list is its own tab, before Shelf check, as in the picture", () => {
  assert.deepEqual(SORTING_TABS.map((t) => t.label), ["Overview", "Find & move", "Sorting list", "Shelf check"]);
  assert.equal(SORTING_TABS[2].href, "/dashboard/stores/sorting/list");
  assert.deepEqual(MATCH_CHOICES.map((c) => c.label), ["Name starts with", "Word anywhere"]);
});

test("a word is cleaned the way the server cleans it, and refused in words", () => {
  assert.equal(cleanWord("  TRIKAT-MR "), "trikat mr");
  assert.equal(cleanWord("5% Dextrose"), "5% dextrose");
  assert.equal(wordProblem("a"), "Type at least 2 letters.");
  assert.equal(wordProblem("x".repeat(81)), "At most 80 letters.");
  assert.equal(wordProblem("D3"), "");
});

test("'starts with' is a whole word - TRIKATONE is a different medicine", () => {
  assert.ok(startsWithWord("TRIKAT MR TAB", "trikat"));
  assert.ok(startsWithWord("TRIKAT", "TRIKAT"));
  assert.ok(startsWithWord("GEBON-PLUS TAB", "gebon"));
  assert.ok(!startsWithWord("TRIKATONE TAB", "trikat"));
  assert.ok(!startsWithWord("NEW TRIKAT", "trikat"));
});

test("Find & move offers to remember only what the person just did", () => {
  assert.equal(wordToRemember("Gebon", ["GEBON TAB", "GEBON PLUS TAB"]), "gebon");
  assert.equal(wordToRemember("gebon", ["GEBON TAB", "MEGA GEBON"]), "", "one ticked name does not start with it");
  assert.equal(wordToRemember("ge", ["GEBON TAB"]), "", "too short to be a name");
  assert.equal(wordToRemember("500", ["500 MG"]), "", "a number is not a name");
  assert.equal(wordToRemember("gebon", []), "", "nothing ticked");
  assert.equal(wordToRemember("", ["GEBON"]), "");
});

test("the line's mark follows the move's choice; 'keep' takes the safe side", () => {
  assert.equal(rxForLine("yes", [false]), true);
  assert.equal(rxForLine("no", [true]), false);
  assert.equal(rxForLine("keep", [false, true]), true);
  assert.equal(rxForLine("keep", [false, false]), false);
});

test("a new line starts on Yes for a Medicines shelf, and on the shelf's own mark", () => {
  assert.equal(startingRx({ rx: false, label: "Health & Pharmacy › Medicines › Bones, Joints & Muscles" }), true);
  assert.equal(startingRx({ rx: true, label: "Health & Pharmacy › Vitamins" }), true);
  assert.equal(startingRx({ rx: false, label: "Baby, Kids & Toys › Baby Feeding › Bottles" }), false);
  assert.equal(startingRx(null), false);
});

// ── the pharmacist's sheet ──────────────────────────────────────────────────

test("our own 'not yet sorted' download reads back as it is", () => {
  const csv = pileNamesCsv([{ name: "TRIKAT MR TAB", count: 2, pile: "Over the Counter" }, { name: "=CMD()", count: 1 }]);
  assert.ok(csv.startsWith("﻿"), "Excel opens Urdu and symbols right");
  assert.ok(csv.includes("'=CMD()"), "a name is never run as a formula in Excel");
  const sheet = parseCsv(csv.replace(/^﻿/, ""));
  assert.deepEqual(sheet.columns, PHARMACIST_HEADINGS);
  const cols = guessSheetColumns(sheet.columns);
  assert.deepEqual(cols, { name: 0, what: 1, shelf: 2, rx: 3 });
});

test("the shelf is the 'shelf' column, or 'what it is' when that is empty; blank rows are dropped", () => {
  const sheet = {
    columns: ["product name", "what it is (pharmacist fills in)", "shelf (pharmacist fills in)", "needs prescription yes/no"],
    rows: [["TRIKAT MR TAB", "for joint pain", "Bones, Joints & Muscles", "yes"], ["IZATO TAB", "BP", "", "yes"], [".", "", "", ""], ["", "", "", ""]],
  };
  assert.deepEqual(sheetRows(sheet), [
    { name: "TRIKAT MR TAB", shelf: "Bones, Joints & Muscles", rx: "yes" },
    { name: "IZATO TAB", shelf: "BP", rx: "yes" },
    { name: ".", shelf: "", rx: "" },
  ]);
});

test("a pharmacist's own headings are read loosely; no headings means name, shelf, rx", () => {
  assert.deepEqual(guessSheetColumns(["Medicine", "Category", "Rx"]), { name: 0, shelf: 1, what: -1, rx: 2 });
  assert.deepEqual(guessSheetColumns(["Rx?", "Item", "Used for"]), { name: 1, shelf: -1, what: 2, rx: 0 });
  assert.deepEqual(guessSheetColumns(["A", "B", "C"]), { name: 0, shelf: 1, what: -1, rx: 2 });
  assert.deepEqual(guessSheetColumns(["A", "B"]), { name: 0, shelf: 1, what: -1, rx: -1 });
  assert.equal(guessSheetColumns(["product name", "information"]).what, -1, "'for' is a whole word, not inside 'information'");
});

const row = (r: Partial<CheckedRow>): CheckedRow => ({
  row: 1, name: "", said: "", word: "", category_id: null, shelf: null, where: "", rx: null, state: "empty", ...r,
});

test("lines: one per brand word; a chosen shelf wins; two answers wait; nothing is guessed", () => {
  const rows = [
    row({ row: 1, word: "trikat", category_id: "BONES", state: "understood", rx: true }),
    row({ row: 2, word: "trikat", category_id: "BONES", state: "understood", rx: null }),
    row({ row: 3, word: "gebon", state: "not_found", rx: false }),
    row({ row: 4, word: "cabvon", category_id: "HEART", state: "two_answers", rx: true }),
    row({ row: 5, word: "cabvon", category_id: "VIT", state: "two_answers", rx: false }),
    row({ row: 6, word: "izato", state: "empty" }),
    row({ row: 7, word: "", state: "empty" }),
  ];
  assert.deepEqual(linesToAdd(rows, {}), [{ word: "trikat", match: "starts", category_id: "BONES", rx: true }]);
  assert.deepEqual(checkCounts(rows, {}), { lines: 1, waiting: 2, empty: 2 });
  const chosen = { gebon: "VIT", cabvon: "HEART", trikat: "PAIN" };
  assert.deepEqual(linesToAdd(rows, chosen), [
    { word: "trikat", match: "starts", category_id: "PAIN", rx: true },
    { word: "gebon", match: "starts", category_id: "VIT", rx: false },
    { word: "cabvon", match: "starts", category_id: "HEART", rx: true },
  ]);
  assert.deepEqual(checkCounts(rows, chosen), { lines: 3, waiting: 0, empty: 2 });
  assert.ok(waitsForAPerson(rows[2]) && waitsForAPerson(rows[3]) && !waitsForAPerson(rows[0]) && !waitsForAPerson(rows[5]));
});

test("a name with one readable answer and one the server could not place waits - never half an answer", () => {
  const rows = [
    row({ row: 1, word: "cabvon", category_id: "HEART", state: "understood", rx: true }),
    row({ row: 2, word: "cabvon", state: "not_found", rx: true }),
  ];
  assert.deepEqual(linesToAdd(rows, {}), []);
  assert.deepEqual(checkCounts(rows, {}), { lines: 0, waiting: 1, empty: 0 });
  assert.deepEqual(linesToAdd(rows, { cabvon: "HEART" }).map((l) => l.category_id), ["HEART"]);
});

// ── the page asks the server's doors, and only those ────────────────────────

test("the page and the API use the Sorting list doors", () => {
  for (const door of ["/admin/sorting/words", "/admin/sorting/words/preview", "/admin/sorting/words/sheet/check",
    "/admin/sorting/words/sheet/apply", "/admin/sorting/pile-names", "/admin/sorting/read-sheet"]) {
    assert.ok(API.includes(door), door);
  }
  assert.ok(!/vendor-intake\/read-sheet/.test(LIST), "an Excel sheet is read behind THIS page's permission");
  assert.match(LIST, /apiClient\.applySortingSheet\(lines\)/);
  assert.match(LIST, /apiClient\.undoShelfCheck\(id\)/, "a saved line's move can be put back at once");
  assert.match(LIST, /database step 150\|not switched on/, "before step 150 the page says so and changes nothing");
});

test("Remove says plainly that moved products stay where they are", () => {
  assert.match(LIST, /Products it already moved <b>stay where they are<\/b>/);
});

test("'Also remember' saves the line WITHOUT moving anything beyond what was ticked", () => {
  assert.match(FIND, /saveSortingWord\(\{ word, match: "starts", category_id: shelf, rx: rxForLine\(mark, rxOn\), move_now: false \}\)/);
  assert.match(FIND, /useState\(true\)/, "ticked by default, as in the picture");
  assert.match(FIND, /remember && toRemember \? toRemember : ""/);
});
