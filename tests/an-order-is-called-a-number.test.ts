// AN ORDER IS CALLED #10001, NOT #E407DF50.
//
// WHY THIS TEST EXISTS (20 September 2026)
//
// Until migration 090 an order was known by the first eight characters of its
// database id. A customer on a bad line has to read out eight letters AND
// digits; the office types what she said into the search box and finds
// nothing. Every order now carries a plain counting number starting at 10001.
//
// Twenty-eight places in this panel used to chop the id to eight characters,
// each with its own copy of the rule. They all call orderLabel/orderCode now,
// so this file is the one place the rule is checked - and changing how the
// number LOOKS is one edit, not twenty-eight.
//
// The fallback is the part that matters most. The panel is deployed separately
// from the server; for the minutes in between, order_no is simply not there.
// Without a fallback every row would read "#undefined".

import { test } from "node:test";
import assert from "node:assert/strict";
import { orderNo, orderCode, orderLabel } from "../src/lib/format.ts";

const NEW = { id: "e407df50-1c7a-4f2b-9a11-000000000001", order_no: 10001 };
const OLD = { id: "e407df50-1c7a-4f2b-9a11-000000000001" };

test("an order with a number is called by its number", () => {
  assert.equal(orderLabel(NEW), "#10001");
  assert.equal(orderCode(NEW), "10001");
  assert.equal(orderNo(NEW), "10001");
});

test("a server that has not been deployed yet does not print #undefined", () => {
  // The whole reason the fallback exists.
  assert.equal(orderLabel(OLD), "#e407df50");
  assert.equal(orderNo(OLD), null);
  assert.ok(!orderLabel(OLD).includes("undefined"));
  assert.ok(!orderLabel(OLD).includes("null"));
});

test("nothing at all still prints nothing at all, never a crash", () => {
  // EXACT, not "does not contain undefined". `String(undefined).slice(0, 8)`
  // is "undefine" - which passes a contains-check and still puts a word from
  // the machinery onto Sana's screen. Only an exact answer catches that.
  for (const nothing of [null, undefined, {}, ""]) {
    assert.equal(orderLabel(nothing as any), "#", `got ${orderLabel(nothing as any)}`);
  }
});

test("a row that names the order under order_id still works", () => {
  // A review and a support conversation carry `order_id`, not `id`.
  const review = { order_id: "e407df50-1c7a-4f2b-9a11-000000000001", order_no: 10007 };
  assert.equal(orderLabel(review, review.order_id), "#10007");
  const oldReview = { order_id: "e407df50-1c7a-4f2b-9a11-000000000001" };
  assert.equal(orderLabel(oldReview, oldReview.order_id), "#e407df50");
});

test("a screen holding only the id can still ask", () => {
  assert.equal(orderLabel("e407df50-1c7a-4f2b"), "#e407df50");
});

test("the number is never dressed up as something else", () => {
  // No commas, no currency, no padding. 10001 has to be searchable by typing
  // exactly what is on the screen.
  assert.equal(orderCode({ id: "x", order_no: 1000001 }), "1000001");
  assert.ok(!orderCode({ id: "x", order_no: 1000001 }).includes(","));
});

test("a number that arrives as text is still a number", () => {
  // JSON from the server can hand back a bigint as a string.
  assert.equal(orderLabel({ id: "x", order_no: "10001" }), "#10001");
});

test("an empty number is not a number", () => {
  // "" and "   " must fall back, or the screen shows a bare "#".
  assert.equal(orderLabel({ ...OLD, order_no: "" }), "#e407df50");
  assert.equal(orderLabel({ ...OLD, order_no: "   " }), "#e407df50");
});
