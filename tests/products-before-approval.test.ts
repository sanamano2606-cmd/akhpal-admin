// FIVE PRODUCTS BEFORE A SHOP IS APPROVED (Mock 165, approved by Sana 6 Oct 2026).
//
// The server decides (approve_restaurant). The Stores list must only offer the
// button the server will accept: Approve at 5 or more; under 5 a grey Approve
// with the reason for a sub-admin, and "Approve anyway" - behind a window that
// asks first - for the main admin.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approveState, MIN_PRODUCTS } from "../src/lib/approve-rule.ts";

function code(path: string): string {
  return readFileSync(path, "utf8").split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
}

test("the number is 5", () => {
  assert.equal(MIN_PRODUCTS, 5);
});

test("5 or more: the usual Approve, for anybody", () => {
  for (const main of [true, false]) {
    for (const n of [5, 6, 85]) {
      const a = approveState({ product_count: n }, main);
      assert.equal(a.button, "approve");
      assert.equal(a.enough, true);
    }
  }
});

test("under 5, a sub-admin gets a grey Approve and the reason", () => {
  const a = approveState({ product_count: 3 }, false);
  assert.equal(a.button, "none");
  assert.equal(a.why, "Needs 5 products — has 3");
  assert.equal(approveState({ product_count: 0 }, false).why, "Needs 5 products — has 0");
});

test("under 5, the main admin gets Approve anyway", () => {
  assert.equal(approveState({ product_count: 3 }, true).button, "anyway");
  assert.equal(approveState({ product_count: 0 }, true).button, "anyway");
});

test("not counted is never treated as enough", () => {
  for (const shop of [{}, { product_count: null }, { product_count: "7" }, null]) {
    const a = approveState(shop as any, false);
    assert.equal(a.count, null);
    assert.equal(a.button, "none");
    assert.equal(a.why, "Products could not be counted");
  }
});

test("the page uses the rule for Approve AND Approve after all, and asks first", () => {
  const s = code("src/app/dashboard/stores/page.tsx");
  assert.ok(s.includes("approveState(restaurant, isMain)"));
  assert.equal(s.split("approveState(restaurant, isMain)").length - 1, 3,
    "the Products column, Approve, and Approve after all");
  assert.ok(s.includes('confirmLabel="Approve anyway"'));
  assert.ok(s.includes("onConfirm={() => anyway && handleApprove(anyway.id, true)}"));
  assert.ok(s.includes("Customers will see this shop straight away"));
  assert.ok(s.includes(">Products</th>"));
});

test("only the window sends anyway=true to the server", () => {
  const api = code("src/lib/api-stores.ts");
  assert.ok(api.includes('approve${anyway ? "?anyway=true" : ""}'));
  const s = code("src/app/dashboard/stores/page.tsx");
  assert.equal(s.split("handleApprove(anyway.id, true)").length - 1, 1);
});
