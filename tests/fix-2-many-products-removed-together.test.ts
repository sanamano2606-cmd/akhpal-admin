// FIX 2 - MANY PRODUCTS REMOVED TOGETHER (All Stores audit 9 Nov 2026; Sana: "go fix 2").
// The server now removes the ticked products in one go
// (backend tests/test_fix_2_many_products_removed_together.py). The panel's
// part: wait long enough for "Remove" - and ONLY for Remove.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const API = readFileSync(new URL("../src/lib/api-stores.ts", import.meta.url), "utf8");

test("Remove waits a minute, not the usual 15 seconds", () => {
  assert.match(API, /export const BULK_REMOVE_WAIT_MS = 60000;/);
  assert.match(API, /\.\.\.\(action === "remove" \? \{ timeoutMs: BULK_REMOVE_WAIT_MS \} : \{\}\)/);
});

test("the other bulk buttons keep failing fast", () => {
  const call = API.slice(API.indexOf("async bulkChangeProducts("), API.indexOf("async bulkChangeProducts(") + 900);
  assert.equal((call.match(/timeoutMs/g) || []).length, 1, "only Remove waits longer");
});
