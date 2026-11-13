// ─────────────────────────────────────────────────────────────────────────────
// FIX 12 (All Stores audit; Sana 12 Nov 2026: "GO Fix 12")
// The product editor says "Hidden by Takal" and why. Before, it only showed
// "Available for customers" unticked; ticking it and saving "worked" while the
// database lock (migration 152) quietly kept the product off.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  asHiddenProduct, shotWithBox, TAKAL_HIDE_SWITCH_WORDS, takalHideNext, takalHideOf, takalHideTitle,
} from "../src/lib/takal-hide-in-editor.ts";
import { editorSnapshot, hasUnsavedEdits } from "../src/lib/unsaved-edits.ts";
import { showAgainWords } from "../src/lib/takal-hidden.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const editor = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");

const NO_PIC = { takal_hidden_at: "2026-11-01T10:00:00Z", takal_hidden_reason: "is ki koi tasveer nahi hai" };
const LEGAL = { takal_hidden_at: "2026-11-01T10:00:00Z", takal_hidden_reason: "tobacco Takal par mana hai",
  takal_hidden_kind: "legal", takal_hidden_word: "naswar" };

test("a product not hidden by Takal shows nothing", () => {
  assert.equal(takalHideOf({ is_available: false }), null);
  assert.equal(takalHideOf(null), null);
  assert.equal(takalHideOf({ takal_hidden_at: null }), null);
});

test("an ordinary hide says why and that fixing it brings it back", () => {
  const h = takalHideOf(NO_PIC)!;
  assert.equal(h.locked, false);
  assert.equal(takalHideTitle(h), "🔒 Hidden by Takal - No picture");
  assert.match(takalHideNext(h), /Fix the reason and save.*within an hour/);
});

test("a legal hide says it is locked, with the word, and only Show again opens it", () => {
  const h = takalHideOf(LEGAL)!;
  assert.equal(h.locked, true);
  assert.equal(takalHideTitle(h), `⚖️ Hidden and locked by Takal's legal check - word "naswar"`);
  assert.match(takalHideNext(h), /Only the Main Admin's Show again/);
  assert.match(showAgainWords(asHiddenProduct("p1", "Naswar", h)), /because of the word "naswar"/);
  assert.equal(takalHideTitle(takalHideOf({ ...LEGAL, takal_hidden_kind: "admin" })!), "👤 Hidden and locked by an admin");
});

test("after Show again, the tick's new state is not taken for an unsaved edit", () => {
  const start = editorSnapshot({ name: "Tea", available: false });
  const moved = shotWithBox(start, "available", true);
  assert.equal(hasUnsavedEdits(moved, editorSnapshot({ name: "Tea", available: true })), false);
  assert.equal(hasUnsavedEdits(moved, editorSnapshot({ name: "Tea 2", available: true })), true);
  assert.equal(shotWithBox(null, "available", true), null);
  assert.equal(shotWithBox("not json", "available", true), "not json");
});

test("the editor shows the box, greys the tick, and says why under it", () => {
  assert.match(editor, /\{editing && takalHide && \(/);
  assert.match(editor, /data-editor-takal-hide/);
  assert.match(editor, /disabled=\{!!takalHide\} data-available-tick/);
  assert.match(editor, /data-available-locked/);
  assert.ok(TAKAL_HIDE_SWITCH_WORDS.includes("until it is shown again"));
});

test("the editor trusts the fresh read, not only the list row", () => {
  assert.match(editor, /useState<EditorTakalHide \| null>\(\(\) => takalHideOf\(product\)\)/);
  assert.match(editor, /setBase\(productBaseline\(full\)\);\n\s+setTakalHide\(takalHideOf\(full\)\);/);
});

test("Show again is the Main Admin's, asks first, and uses the list's own door", () => {
  assert.match(editor, /data-editor-show-again disabled=\{!isMain \|\| showing\}/);
  assert.match(editor, /setIsMain\(getMyPerms\(\)\.isSuper\)/);
  assert.match(editor, /open=\{askShow && !!takalHide\}/);
  assert.match(editor, /await apiClient\.showProductAgain\(editId\)/);
  assert.match(editor, /setStartShot\(\(shot\) => shotWithBox\(shot, "available", on\)\)/);
  // Esc answers the question on top, not the editor under it
  assert.match(editor, /if \(leaveAsk \|\| priceLoss \|\| addShelf !== null \|\| askShow\) return;/);
});
