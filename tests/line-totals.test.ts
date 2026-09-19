// ─────────────────────────────────────────────────────────────────────────────
// A LINE IS THE PRICE OF ONE TIMES HOW MANY — on every screen (19 Sep 2026).
//
// `order_items.price` is the price of ONE. Every screen printed that figure
// beside a "3 x" and then, directly underneath, a subtotal that was the sum of
// the LINES. On any order of more than one of anything the bill visibly did not
// add up: the customer's own order page, the rider's screen, the office's panel
// and the receipt printed for the parcel. Only the vendor's app had ever
// multiplied.
//
// Nothing goes red when this happens — the screen looks like a bill and is
// simply wrong — so the rule lives in ONE function and this checks both the
// arithmetic and that the screens really ask it.
//
// WHICH price is shown depends on who is reading, and that is not this file's
// business: the customer, the rider and the office read the MARKED-UP price
// (what the customer paid); the vendor's app reads the shop's own base_price
// through its own helper. The customer must never be shown the shop's price
// (Sana, 19 September 2026) — guarded in who-sees-what-was-ordered.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lineTotal, lineUnitPrice, lineQuantity } from "../src/lib/order-rules.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
const receipt = read("src/app/dashboard/orders/parts-customer-receipt.tsx");

// ─── 1. THE ARITHMETIC, FOR REAL ─────────────────────────────────────────────

test("three shirts at Rs 1,194 is Rs 3,582, not Rs 1,194", () => {
  const line = { price: "1194.00", quantity: 3 };
  assert.equal(lineUnitPrice(line), 1194);
  assert.equal(lineQuantity(line), 3);
  assert.equal(lineTotal(line), 3582);
});

test("one of something is still itself", () => {
  assert.equal(lineTotal({ price: 1194, quantity: 1 }), 1194);
  // No quantity at all means one — never zero, which would hide the line's cost.
  assert.equal(lineTotal({ price: 1194 }), 1194);
  assert.equal(lineQuantity({}), 1);
});

test("a broken quantity counts as one rather than wiping the line out", () => {
  for (const q of [null, undefined, "", "abc", 0, -4, NaN]) {
    assert.equal(lineQuantity({ price: 100, quantity: q }), 1, `quantity ${String(q)}`);
    assert.equal(lineTotal({ price: 100, quantity: q }), 100, `quantity ${String(q)}`);
  }
});

test("the server's strings are money, not text", () => {
  // PostgREST sends numeric columns as strings. "1194.00" x 3 must be 3582,
  // not "1194.001194.001194.00".
  assert.equal(lineTotal({ price: "1194.00", quantity: "3" }), 3582);
  assert.equal(lineTotal({ price: "0.50", quantity: 4 }), 2);
});

test("a line with no price is worth nothing, and says so", () => {
  assert.equal(lineTotal({ quantity: 5 }), 0);
  assert.equal(lineTotal(null), 0);
  assert.equal(lineTotal(undefined), 0);
});

test("the old `total` field is still understood", () => {
  // Some older rows carry `total` instead of `price`.
  assert.equal(lineTotal({ total: 250, quantity: 2 }), 500);
});

test("the lines add up to the order's own subtotal", () => {
  // The whole point. These are the real figures from order 3AA2F6FC with the
  // quantity raised to three.
  const items = [
    { price: "1194.00", quantity: 3 },
    { price: "250.00", quantity: 1 },
    { price: "99.50", quantity: 2 },
  ];
  const sum = items.reduce((a, it) => a + lineTotal(it), 0);
  assert.equal(sum, 3582 + 250 + 199);
});

// ─── 2. THE SCREENS REALLY ASK IT ────────────────────────────────────────────

test("the office's order page and the printed receipt both ask the one rule", () => {
  for (const [name, src] of [["the order page", panel], ["the receipt", receipt]] as const) {
    assert.ok(
      src.includes("lineTotal(it)"),
      `${name} must print lineTotal(it), not the price of one.`,
    );
    assert.ok(
      !/\{money\(it\.price \?\? it\.total \?\? 0\)\}/.test(src),
      `${name} is still printing the raw price of one as the line's amount.`,
    );
    assert.ok(
      src.includes("lineUnitPrice(it)") && src.includes("each"),
      `${name} should still show "Rs X each" under a line of more than one — ` +
        "it is the figure the customer recognises from the shop page.",
    );
  }
});

// ─── 3. THE TWO PHONE SCREENS ────────────────────────────────────────────────
//
// Read from here for the same reason the support-alerts test reads the
// backend: the four screens have to agree, and the only place that can check
// all four at once is a test that can see all four.

const customer = read(
  "../swat-delivery-app/customer_app/lib/screens/order_tracking_details.dart",
);
const rider = read(
  "../swat-delivery-app/rider_app/lib/screens/order_detail_screen_stops.dart",
);

test("the customer's order page multiplies by the quantity", () => {
  assert.ok(
    customer.includes("rs(price * qty)"),
    "The customer's own bill must show the line, not the price of one.",
  );
  assert.ok(
    customer.includes("each"),
    'The price of one should stay, quietly, as "Rs X each".',
  );
});

test("the rider's screen multiplies by the quantity", () => {
  assert.ok(
    /rsOf\(one \* \(q < 1 \? 1 : q\)\)/.test(rider),
    "The rider's lines must add up to the money he collects.",
  );
});

test("the customer's bill never shows the shop's own price", () => {
  // Sana, 19 September 2026: "the customer never sees the vendors' prices."
  for (const banned of ["base_price", "vendor_subtotal", "commission"]) {
    assert.ok(
      !customer.includes(banned),
      `The customer sees the marked-up price and nothing else. Found ${banned}.`,
    );
  }
});
