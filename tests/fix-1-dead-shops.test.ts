// FIX 1 - DEAD SHOPS (All Stores audit 9 Nov 2026; Sana: "Go").
// "some Stores are deleted and still shows ... why i can't delete a store".
// Server: backend tests/test_fix_1_dead_shops.py (owner_left, a rejected
// suspended shop reaches Rejected). The panel: the "Owner left" mark, and
// Reject for a Hidden or Suspended shop so it can reach "Remove for good".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = read("src/app/dashboard/stores/page.tsx");
const BAR = read("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const PAGE = read("src/app/dashboard/stores/[id]/page.tsx");

test("the list marks a shop whose owner left - on the waiting rows and on every other list", () => {
  const marks = LIST.match(/\{restaurant\.owner_left && \(\s*<span data-owner-left/g) || [];
  assert.equal(marks.length, 2, "both row kinds say Owner left");
});

test("a Hidden or Suspended shop has Reject on the list, for an approver", () => {
  assert.match(LIST, /\(deriveStatus\(restaurant\) === "hidden" \|\| deriveStatus\(restaurant\) === "suspended"\) && canAccess\("stores\.approve"\) && \(\s*<button data-reject-any\s*onClick=\{\(\) => setPending\(\{ store: restaurant, action: "reject" \}\)\}/);
});

test("Reject still asks for the reason first (the same box as a new shop)", () => {
  assert.match(LIST, /open=\{pending\?\.action === "reject"\}/);
});

test("Remove for good is still the Main Admin's, and only on a rejected shop", () => {
  assert.match(LIST, /deriveStatus\(restaurant\) === "rejected" && isMain && \(/);
  assert.match(BAR, /status === "rejected" && isMain && \(/);
});

test("the store page offers Reject for a Hidden or Suspended shop too", () => {
  assert.match(BAR, /\(status === "pending" \|\| status === "hidden" \|\| status === "suspended"\) && \(\s*<button disabled=\{busy\} onClick=\{\(\) => setAsk\("reject"\)\}/);
});

test("the store page says Owner left", () => {
  assert.match(PAGE, /owner\.closed_account === true && \(\s*<span data-owner-left/);
});
