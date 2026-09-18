// ─────────────────────────────────────────────────────────────────────────────
// ORDER MANAGEMENT, PHASE 1 (Sana, 17 September 2026).
//
// The office is offered "Assign a rider" only where the server will accept it,
// and giving a rider never moves the shop's step. The server holds the rule
// (core_orders.rider_assignment_patch); these checks keep the buttons in step.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canAssignRider, canChangeRider, isParcel, noCarrierText, riderWaitingForShop,
} from "../src/lib/order-rules.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const page = read("src/app/dashboard/orders/page.tsx");
const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
const api = read("src/lib/api-orders.ts");

const x = (status: string, extra: Record<string, unknown> = {}) =>
  ({ status, delivery_type: "instant", is_pickup: false, rider_id: null, ...extra });

test("a rider can be given once the shop accepts, and until the food is ready", () => {
  for (const s of ["accepted", "preparing", "ready"]) assert.equal(canAssignRider(x(s)), true, s);
  for (const s of ["pending", "on_the_way_to_restaurant", "picked_up", "on_the_way",
                   "delivered", "cancelled", "rejected", "at_hub"]) {
    assert.equal(canAssignRider(x(s)), false, s);
  }
});

test("never a parcel, never a self-pickup, never twice", () => {
  assert.equal(canAssignRider(x("ready", { delivery_type: "standard" })), false);
  assert.equal(canAssignRider(x("ready", { is_pickup: true })), false);
  assert.equal(canAssignRider(x("ready", { rider_id: "r1" })), false);
  assert.equal(isParcel(x("at_hub")), true);
});

test("a rider can be changed while he is on the job, never after", () => {
  for (const s of ["accepted", "preparing", "ready", "on_the_way_to_restaurant", "picked_up", "on_the_way"]) {
    assert.equal(canChangeRider(x(s, { rider_id: "r1" })), true, s);
  }
  for (const s of ["delivered", "cancelled", "rejected"]) {
    assert.equal(canChangeRider(x(s, { rider_id: "r1" })), false, s);
  }
  assert.equal(canChangeRider(x("picked_up")), false, "no rider to change");
  assert.equal(canChangeRider(x("on_the_way", { rider_id: "s1", delivery_type: "standard" })), false);
});

test("the empty rider place says why nobody is on it", () => {
  assert.equal(noCarrierText(x("pending")), "Waiting for the shop");
  assert.equal(noCarrierText(x("ready", { delivery_type: "standard" })), "Parcel — Takal office");
  assert.equal(noCarrierText(x("ready", { is_pickup: true })), "customer collects");
  assert.equal(noCarrierText(x("delivered")), "—");
  assert.equal(noCarrierText(x("preparing")), "Nobody yet");
});

test("a rider given an order early is shown waiting for the shop", () => {
  assert.equal(riderWaitingForShop(x("preparing", { rider_id: "r1" })), true);
  assert.equal(riderWaitingForShop(x("ready", { rider_id: "r1" })), false);
  assert.equal(riderWaitingForShop(x("preparing")), false);
});

test("the list and the order window use the rule, not their own guess", () => {
  assert.match(page, /const canTakeRider = canAssignRider\(o\) \|\| canChangeRider\(o\);/);
  assert.match(page, /\{canAssignRider\(o\) && \(/);
  assert.doesNotMatch(page, /!\["delivered", "cancelled", "rejected"\]\.includes\(o\.status\) &&\s*!o\.is_pickup/);
  assert.match(panel, /\(canAssignRider\(o\) \|\| canChangeRider\(o\)\) && \(/);
  assert.match(panel, /canAssignRider\(o\) \? \(/);
});

test("the panel never reads or shows the customer's door code", () => {
  // Sana, 17 September 2026: "The customer code must and never to be shown any where."
  for (const [name, src] of [["page", page], ["panel", panel]] as const) {
    assert.doesNotMatch(src, /\.delivery_code\b(?!_)/, `${name} reads the door code`);
  }
  // The only mention allowed is SENDING a code the office typed in, in the body.
  assert.match(api, /delivery_code: opts\.code \|\| null/);
});
