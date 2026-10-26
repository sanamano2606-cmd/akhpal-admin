// STORES PAGE FIX 6 (Sana, 12 October 2026: "OK fix 6") - two bugs.
//
// A. The new owner's password (shown ONCE, on step 3 of Create store) was lost
//    by a click beside the box or by Escape. Now step 3 closes only by Done,
//    × or "Open the store page", and asks first while the password has not
//    been copied, sent or printed.
// B. In a fixed-price store the ✏️ product editor always sent the price and
//    discount, which the server refuses there - so even a new description
//    could not be saved. Now, when editing in a fixed-price store, they are
//    shown greyed out and never sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const wizard = read("src/app/dashboard/stores/parts-create-store.tsx");
const editor = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const products = read("src/app/dashboard/stores/[id]/parts-products.tsx");

test("A: Escape does nothing on step 3", () => {
  // ...and while a pharmacy licence photo is uploading (Mock 208-4).
  assert.match(wizard, /useDialogKeys\(true, close, saving \|\| uploading \|\| licUploading \|\| step === 3\)/);
});

test("A: a click beside the box closes it on step 1 only", () => {
  assert.match(wizard, /onClick=\{\(\) => \{ if \(!saving && !uploading && step === 1\) close\(\); \}\}/);
  assert.doesNotMatch(wizard, /step !== 2\) close\(\)/);
});

test("A: ×, Done and Open the store page ask first while the password is not kept", () => {
  assert.match(wizard, /if \(step === 3 && result\?\.credentials\.password && !kept\) setLeaving/);
  assert.match(wizard, /<button onClick=\{\(\) => leaveStep3\(close\)\}/);
  assert.equal((wizard.match(/onClick=\{\(\) => leaveStep3\(close\)\}>Done/g) || []).length, 2);
  assert.match(wizard, /leaveStep3\(\(\) => \{ window\.location\.href = `\/dashboard\/stores\//);
  // Only step 1's Cancel closes straight away (no password exists yet).
  assert.equal((wizard.match(/onClick=\{close\}/g) || []).length, 1);
  assert.match(wizard, /variant="secondary" size="lg" className="flex-1" onClick=\{close\}>Cancel/);
  assert.match(wizard, /title="Have you copied or printed the password\?"/);
});

test("A: Copy, WhatsApp and Print count as kept", () => {
  assert.match(wizard, /writeText\(loginText\); setKept\(true\)/);
  assert.match(wizard, /\{ setKept\(true\); window\.open\(/);
  assert.match(wizard, /\{ setKept\(true\); printLogin\(\); \}/);
});

test("B: a fixed-price store's editor never sends a price or discount when editing", () => {
  // Audit 202 (A1): a product this box has just made counts as editing too.
  assert.match(editor, /const pricesLocked = \(editing \|\| !!createdId\) && fixedPrice;/);
  assert.match(editor, /if \(pricesLocked\) \{\s*delete payload\.price;\s*delete payload\.discount_percent;/);
  assert.match(editor, /!sized && !pricesLocked && price\.trim\(\) === ""/);
  // MOCK 203 v2: they ARE typed in the window now - but sent only through the
  // one prices door (setStorePrices), never with the product's own save.
  assert.match(editor, /await apiClient\.setStorePrices\(restaurantId, changes, confirm\);/);
});

test("B: the products tab tells the editor the store is fixed-price", () => {
  assert.match(products, /fixedPrice=\{fixed\}/);
});
