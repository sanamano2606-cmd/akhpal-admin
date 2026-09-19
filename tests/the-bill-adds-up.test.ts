// ─────────────────────────────────────────────────────────────────────────────
// THE BILL MUST ADD UP — even when a discount code was used (19 Sep 2026).
//
// `orders` has NO discount column. What a promo code took off survives only as
// text inside the order's `notes` (money audit M8). So no screen could print a
// Discount line — and the customer's own order page went further and worked its
// subtotal out backwards as `total − delivery fee`, which folds the discount
// into the subtotal. On a Rs 200 promo her items read Rs 200 short, with no
// line saying why and an itemised list above that did not add up to it.
//
// Every other figure IS stored, so the discount is the only unknown in a sum
// the server itself balanced:
//
//     total = subtotal + delivery fee − discount − wallet credit
//
// These are the real figures from order 3AA2F6FC unless a case says otherwise.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderSubtotal, orderDiscount, orderCredit } from "../src/lib/order-rules.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const receipt = read("src/app/dashboard/orders/parts-customer-receipt.tsx");
const customer = read(
  "../swat-delivery-app/customer_app/lib/screens/order_tracking_details.dart",
);

/** The whole point, in one line. */
const balances = (o: any) =>
  Math.abs(
    orderSubtotal(o) + Number(o.delivery_fee) - orderDiscount(o) - orderCredit(o) -
      Number(o.total_amount),
  ) < 0.01;

// ─── 1. THE ARITHMETIC ───────────────────────────────────────────────────────

test("a plain order has no discount and still balances", () => {
  const o = { subtotal: "1194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "1344.00" };
  assert.equal(orderSubtotal(o), 1194);
  assert.equal(orderDiscount(o), 0, "There was no code. Do not invent a line.");
  assert.equal(orderCredit(o), 0);
  assert.ok(balances(o));
});

test("a Rs 200 promo shows as Rs 200, and the subtotal is NOT eaten", () => {
  const o = { subtotal: "3194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "3144.00" };
  assert.equal(orderSubtotal(o), 3194, "The items must read what the items cost.");
  assert.equal(orderDiscount(o), 200);
  assert.ok(balances(o));
});

test("wallet credit and a discount together still balance", () => {
  const o = { subtotal: "3194.00", delivery_fee: "150.00", credit_used: "100.00", total_amount: "3044.00" };
  assert.equal(orderDiscount(o), 200);
  assert.equal(orderCredit(o), 100);
  assert.ok(balances(o));
});

test("free delivery given by a code reads as a discount, not a missing fee", () => {
  // The rider is still paid; Takal absorbs it. The customer was charged the
  // fee and then had it taken off, so it belongs on the Discount line.
  const o = { subtotal: "1194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "1194.00" };
  assert.equal(orderDiscount(o), 150);
  assert.ok(balances(o));
});

test("float dust never prints as a discount", () => {
  const o = { subtotal: "0.10", delivery_fee: "0.20", credit_used: 0, total_amount: "0.30" };
  assert.equal(orderDiscount(o), 0, "Under a paisa is rounding, not a discount.");
});

test("figures that cannot be right do not become a negative discount", () => {
  // A total BIGGER than subtotal + fee means something stored is wrong.
  // Inventing "Discount − Rs 50" would only hide it.
  const o = { subtotal: "1000.00", delivery_fee: "100.00", credit_used: 0, total_amount: "1150.00" };
  assert.equal(orderDiscount(o), 0);
});

test("an order from before the subtotal column still shows something sensible", () => {
  const o = { delivery_fee: "150.00", credit_used: 0, total_amount: "1344.00" };
  assert.equal(orderSubtotal(o), 1194);
  assert.equal(orderDiscount(o), 0);
});

test("missing and broken figures are read as nothing, never as NaN", () => {
  assert.equal(orderSubtotal(null), 0);
  assert.equal(orderDiscount(null), 0);
  assert.equal(orderCredit({ credit_used: "not a number" }), 0);
  assert.equal(orderCredit({ credit_used: -50 }), 0, "Credit can never be negative.");
});

// ─── 2. THE SCREENS ──────────────────────────────────────────────────────────

test("the printed receipt has a Discount line and reads the real subtotal", () => {
  assert.ok(receipt.includes("orderSubtotal(order)"), "The receipt must read the stored subtotal.");
  assert.ok(receipt.includes("orderDiscount(order)"), "The receipt must work the discount out.");
  assert.ok(/k="Discount"/.test(receipt), "The Discount line must be printed.");
  assert.ok(
    !/const goods = Number\(order\?\.subtotal \|\| 0\)/.test(receipt),
    "The receipt should ask the shared rule, not read the column itself.",
  );
});

test("the customer's bill no longer works its own subtotal out backwards", () => {
  assert.ok(
    !/final subtotalNum\s*=\s*\(totalNum - deliveryFeeNum\)/.test(customer),
    "That line folds the discount into the subtotal. Read orders.subtotal.",
  );
  assert.ok(customer.includes("n('subtotal')"), "It must read the stored subtotal.");
  assert.ok(
    customer.includes("subtotalNum + deliveryFeeNum - creditNum - totalNum"),
    "The discount is the only unknown in the sum the server balanced.",
  );
  assert.ok(customer.includes("tr(context, 'discount')"), "A Discount line must be shown.");
  assert.ok(
    customer.includes("tr(context, 'credit_applied')"),
    "Wallet credit must be shown too, or the bill still does not add up.",
  );
});

test("the word Discount exists in both languages", () => {
  for (const f of ["strings_en.dart", "strings_ur.dart"]) {
    const src = read(`../swat-delivery-app/customer_app/lib/l10n/${f}`);
    assert.ok(
      /'discount'\s*:/.test(src),
      `${f} has no 'discount' key, so the bill would print the key name at a customer.`,
    );
  }
});

// ─── 3. THE STORED DISCOUNT (migration 082, 19 September 2026) ───────────────

test("the stored discount is believed over the sum", () => {
  // The sum below was always a stand-in for a fact. Now the order records it.
  const o = {
    subtotal: "3194.00", delivery_fee: "150.00", credit_used: 0,
    total_amount: "3144.00", discount: "200.00",
  };
  assert.equal(orderDiscount(o), 200);
});

test("an order from before that column still works it out", () => {
  const o = { subtotal: "3194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "3144.00" };
  assert.equal(orderDiscount(o), 200, "The fallback must still be there.");
});

test("a stored zero is not mistaken for a stored discount", () => {
  // Every order placed before 082 gets 0 by default. A plain order really has
  // no discount, and a pre-082 discounted order must still fall back.
  const plain = { subtotal: "1194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "1344.00", discount: 0 };
  assert.equal(orderDiscount(plain), 0);
  const old = { subtotal: "3194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "3144.00", discount: "0.00" };
  assert.equal(orderDiscount(old), 200, "0 means 'not recorded', so work it out.");
});

test("rubbish in the column does not become a discount", () => {
  for (const bad of ["", null, "not a number", -50]) {
    const o = { subtotal: "1194.00", delivery_fee: "150.00", credit_used: 0, total_amount: "1344.00", discount: bad };
    assert.equal(orderDiscount(o), 0, `discount=${String(bad)}`);
  }
});
