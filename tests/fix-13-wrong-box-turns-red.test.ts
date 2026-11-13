// ─────────────────────────────────────────────────────────────────────────────
// FIX 13 (All Stores audit; Sana 13 Nov 2026: "GO Fix 13")
// The product editor's mistakes were only a pop-up that fades. Now the wrong
// box (or section) turns red with the reason under it, the window scrolls to
// it, and the red goes when that box is changed.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boxError, boxValue, RED_BOX, stillWrong } from "../src/lib/box-errors.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const editor = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const saveBody = editor.slice(editor.indexOf("const save = async"), editor.indexOf("const payload: any = {"));

test("the red stays until THAT box changes", () => {
  const e = boxError("discount", "Discount: must be 0 to 90", "150");
  assert.equal(stillWrong(e, "150"), true);
  assert.equal(stillWrong(e, "15"), false);
  assert.equal(stillWrong(null, "x"), false);
  const sizes = boxError("sizes", "Every size needs a price", [{ name: "Small", price: "" }]);
  assert.equal(stillWrong(sizes, [{ name: "Small", price: "" }]), true);
  assert.equal(stillWrong(sizes, [{ name: "Small", price: "300" }]), false);
  assert.equal(boxValue(undefined), "null");
  assert.match(RED_BOX, /border-takal-red/);
});

test("no mistake on Save is only a pop-up any more", () => {
  // the one pop-up left before the payload is the category list failing to load (not a box)
  const toasts = saveBody.match(/toast\(/g) || [];
  assert.equal(toasts.length, 2, "only 'still loading' and 'category list could not be read'");
  for (const k of ["name", "price", "discount", "stock", "prep", "sizes", "extras", "options", "specs", "prices", "category", "buying"]) {
    assert.match(saveBody, new RegExp(`fail\\("${k}"`), k);
  }
});

test("name and price say which one is missing, not both", () => {
  assert.match(saveBody, /if \(!name\.trim\(\)\) \{ fail\("name", "Name is required"\); return; \}/);
  assert.match(saveBody, /fail\("price", "Price is required"\)/);
  assert.doesNotMatch(saveBody, /Name and price are required/);
});

test("every box and section can show its red and its reason", () => {
  for (const k of ["name", "price", "discount", "stock", "prep"]) {
    assert.match(editor, new RegExp(`className=\\{inputCls \\+ red\\("${k}"\\)\\} data-box="${k}"`), k);
  }
  for (const k of ["name", "price", "discount", "stock", "prep", "category", "buying", "sizes", "extras", "options", "specs", "prices"]) {
    assert.match(editor, new RegExp(`errUnder\\("${k}"\\)`), k);
  }
  for (const k of ["category", "sizes", "extras", "options", "specs"]) {
    assert.match(editor, new RegExp(`data-box="${k}"`), k);
  }
});

test("the window goes to the box and puts the cursor in it; a new product starts clean", () => {
  assert.match(editor, /el\.scrollIntoView\(\{ block: "center"/);
  assert.match(editor, /f\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(editor, /useEffect\(\(\) => \{ setBoxErr\(null\); \}, \[editId\]\);/);
  assert.match(editor, /role="alert" className="mt-1 block text-xs font-semibold text-takal-red"/);
});
