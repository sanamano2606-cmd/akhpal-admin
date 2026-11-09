// FIX 8 - THE PRODUCT WINDOW ASKS BEFORE IT THROWS WORK AWAY
// (All Stores audit 9 Nov 2026, P1. Sana: "GO Fix 8".)
// Report: docs/Audit/AUDIT-REPORT-ALL-STORES-2026-11-09.md
//
// A click outside, the X, Cancel, Esc and "‹ prev / next ›" closed the
// product window at once and everything typed was lost. Now every one of them
// asks "Leave without saving?" when something changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { closesFromBackdrop, editorSnapshot, hasUnsavedEdits } from "../src/lib/unsaved-edits.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const EDITOR = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");

// ── the rule itself, run for real ──
test("nothing changed = nothing unsaved; a changed price = unsaved", () => {
  const start = editorSnapshot({ name: "Pepsi 1.5L", price: "180", photos: ["a.jpg"] });
  assert.equal(hasUnsavedEdits(start, editorSnapshot({ name: "Pepsi 1.5L", price: "180", photos: ["a.jpg"] })), false);
  assert.equal(hasUnsavedEdits(start, editorSnapshot({ name: "Pepsi 1.5L", price: "190", photos: ["a.jpg"] })), true);
  assert.equal(hasUnsavedEdits(start, editorSnapshot({ name: "Pepsi 1.5L", price: "180", photos: ["a.jpg", "b.jpg"] })), true);
});

test("the same boxes in another order are the same picture; undefined = empty", () => {
  assert.equal(editorSnapshot({ a: 1, b: "x" }), editorSnapshot({ b: "x", a: 1 }));
  assert.equal(editorSnapshot({ a: undefined }), editorSnapshot({ a: null }));
});

test("before the window is ready nothing is unsaved", () => {
  assert.equal(hasUnsavedEdits(null, editorSnapshot({ name: "x" })), false);
});

test("a photo or video still uploading counts as unsaved, even with every box the same", () => {
  const s = editorSnapshot({ name: "x" });
  assert.equal(hasUnsavedEdits(s, s, { uploading: true }), true);
  assert.equal(hasUnsavedEdits(s, s, { videoBusy: true }), true);
  assert.equal(hasUnsavedEdits(s, s, { pending: 2 }), true);
  assert.equal(hasUnsavedEdits(s, s, { uploading: false, videoBusy: false, pending: 0 }), false);
  assert.equal(hasUnsavedEdits(null, s, { uploading: true }), true);
});

test("the dark area closes only when the press began AND ended on it", () => {
  assert.equal(closesFromBackdrop(true, true), true);
  assert.equal(closesFromBackdrop(false, true), false);   // selecting words, let go outside
  assert.equal(closesFromBackdrop(true, false), false);
  assert.equal(closesFromBackdrop(false, false), false);
});

// ── every way of closing goes through the question ──
test("no button or area of the window closes it straight away any more", () => {
  assert.equal(/onClick=\{onClose\}/.test(EDITOR), false, "onClick={onClose} is back");
  assert.equal(/onClick=\{nav\.(prev|next)\}/.test(EDITOR), false, "prev / next jump without asking");
  assert.match(EDITOR, /onClick=\{\(\) => askClose\(nav\.prev\)\}/);
  assert.match(EDITOR, /onClick=\{\(\) => askClose\(nav\.next\)\}/);
  assert.match(EDITOR, /onClick=\{\(\) => askClose\(onClose\)\} aria-label="Close"/);
  assert.match(EDITOR, /onClick=\{\(\) => askClose\(onClose\)\} className="ml-auto px-4 py-2/);
});

test("the dark area uses the press-and-release rule, then asks", () => {
  assert.match(EDITOR, /onMouseDown=\{\(e\) => \{ pressedOnBackdrop\.current = e\.target === e\.currentTarget; \}\}/);
  assert.match(EDITOR, /closesFromBackdrop\(pressedOnBackdrop\.current, e\.target === e\.currentTarget\)[\s\S]{0,120}if \(close\) askClose\(onClose\)/);
});

test("Esc asks too - and leaves the editor alone while another question is open", () => {
  assert.match(EDITOR, /useDialogKeys\(true, escClose,/);
  assert.match(EDITOR, /closeAsked\.current = \(\) => \{\s*if \(leaveAsk \|\| priceLoss \|\| addShelf !== null\) return;\s*askClose\(onClose\);/);
});

test("askClose asks only when something is unsaved, and never while saving", () => {
  assert.match(EDITOR, /const askClose = \(then\?: \(\) => void\) => \{\s*if \(!then \|\| saving\) return;\s*if \(unsaved\) setLeaveAsk\(\(\) => then\);\s*else then\(\);/);
  assert.match(EDITOR, /hasUnsavedEdits\(startShot, snapshotNow, \{ uploading, videoBusy, pending \}\)/);
});

test("the picture covers every box a person can change", () => {
  const shot = EDITOR.match(/editorSnapshot\(\{([\s\S]*?)\}\);/);
  assert.ok(shot, "editorSnapshot call not found");
  for (const box of ["name", "description", "price", "discount", "stock", "available", "featured", "categoryId",
    "photos", "prep", "specs", "video", "variants", "choicePhotos", "sizes", "extras", "buyBox", "fixSell",
    "fixDisc", "optPrices", "buying"]) {
    assert.match(shot![1], new RegExp(`\\b${box}\\b`), `${box} is not watched`);
  }
});

test("the question says Leave / Stay in plain words, and Stay keeps everything", () => {
  assert.match(EDITOR, /title="Leave without saving\?"/);
  assert.match(EDITOR, /confirmLabel="Leave"/);
  assert.match(EDITOR, /cancelLabel="Stay"/);
  assert.match(EDITOR, /onCancel=\{\(\) => setLeaveAsk\(null\)\}/);
  assert.match(EDITOR, /data-leave-uploading/);
  assert.match(EDITOR, /data-leave-unsaved/);
});
