/**
 * Item 8 (Sana, 2 October 2026): the All Orders total leaves out cancelled
 * and rejected orders, and says how many it left out.
 *
 * Ten orders of Rs 1,000, two cancelled: the total said Rs 10,000; it is
 * Rs 8,000 of real orders.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ordersTotal } from "../src/lib/orders-total.ts";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "orders", "page.tsx"),
  "utf8",
);

test("ten orders of Rs 1,000 with two cancelled come to Rs 8,000", () => {
  const orders = Array.from({ length: 10 }, (_, i) => ({
    status: i < 2 ? "cancelled" : "delivered",
    total_amount: 1000,
  }));
  assert.deepEqual(ordersTotal(orders), { sum: 8000, skipped: 2 });
});

test("a rejected order is not counted either; every live status is", () => {
  const t = ordersTotal([
    { status: "Rejected", total_amount: 500 },
    { status: "pending", total_amount: "300.00" },
    { status: "on_the_way", total_amount: 200 },
    { status: null, total_amount: undefined },
  ]);
  assert.deepEqual(t, { sum: 500, skipped: 1 });
});

test("the page uses it, says what it left out, and keeps each row's amount", () => {
  assert.ok(PAGE.includes("ordersTotal(orders)"), "the footer still adds every order");
  assert.ok(!PAGE.includes("orders.reduce((a, o) => a + Number(o.total_amount"),
    "the old sum of every row is still there");
  assert.ok(PAGE.includes("cancelled not counted"));
  assert.ok(PAGE.includes("{money(o.total_amount)}"), "a row's own amount must stay");
});
