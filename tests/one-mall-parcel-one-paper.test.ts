// ─────────────────────────────────────────────────────────────────────────────
// ONE MALL PARCEL, ONE LABEL, ONE RECEIPT — money audit 21 Oct 2026, M11 /
// AREA-7-3. And the office order page's money box (AREA-7-3, AREA-7-15).
//
// The audit's own example. Wakeel Mall order #10045, ONE box:
//   Fashion  Rs 4,050 + Rs 150 delivery = Rs 4,200  (order #10045, the lead)
//   Beauty   Rs 1,800                               (order #10046)
//   The customer owes PKR 6,000 for the box.
// The desk printed two labels, "PKR 4,200" and "PKR 1,800", and two receipts
// each with one store's lines. These run the real rules (lib/mall-paper.ts)
// and then check the two screens really use them.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paperFor, labelOrderOf, onePerParcel, isPartOfGroup } from "../src/lib/mall-paper.ts";
import { orderSubtotal, orderDiscount, lineTotal } from "../src/lib/order-rules.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const fashion = {
  id: "p1", order_no: 10045, mall_order_id: "p1", restaurant_name: "Wakeel Shopping Mall — Fashion",
  subtotal: 4050, delivery_fee: 150, discount: 0, credit_used: 0, total_amount: 4200,
  payment_method: "cash", paid_online: false, customer_name: "Ayesha Khan",
  delivery_address: "House 4, Mingora", delivery_type: "standard",
};
const whole = {
  mall_order_id: "p1", kind: "mall", mall_name: "Wakeel Shopping Mall", order_no: 10045,
  store_count: 2, subtotal: 5850, delivery_fee: 150, discount: 0, credit_used: 0, total: 6000,
  stores: [
    { order_id: "p1", order_no: 10045, store_name: "Wakeel Shopping Mall — Fashion", dropped_out: false,
      items: [{ product_name: "Comfort Slippers", quantity: 1, price: 4050, variant_label: "Black / 41" }] },
    { order_id: "p2", order_no: 10046, store_name: "Wakeel Shopping Mall — Beauty", dropped_out: false,
      items: [{ product_name: "Kemei Trimmer", quantity: 1, price: 1800 }] },
  ],
};
const fashionFull = {
  order: fashion,
  items: [{ item_name: "Comfort Slippers", quantity: 1, price: 4050 }],
  mall: whole,
};

// ─── 1. THE RULES, RUN FOR REAL ──────────────────────────────────────────────

test("a mall part prints the WHOLE basket: PKR 6,000, both stores' lines, #10045", () => {
  const p = paperFor(fashionFull);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.order.total_amount, 6000, "the amount to collect is the whole box");
  assert.equal(p.order.order_no, 10045, "the lead's number - the one she was given");
  assert.equal(p.order.restaurant_name, "Wakeel Shopping Mall");
  assert.deepEqual(p.items.map((i) => i.item_name), ["Comfort Slippers", "Kemei Trimmer"]);
  // And the receipt adds up: lines = subtotal; subtotal + delivery = total.
  const lines = p.items.reduce((a, it) => a + lineTotal(it), 0);
  assert.equal(lines, orderSubtotal(p.order));
  assert.equal(orderSubtotal(p.order) + Number(p.order.delivery_fee) - orderDiscount(p.order), 6000);
  assert.equal(orderDiscount(p.order), 0, "no invented discount");
});

test("a store that dropped out is not on the paper, as it is not in the total", () => {
  const dropped = {
    ...fashionFull,
    mall: {
      ...whole, store_count: 1, subtotal: 4050, total: 4200,
      stores: [whole.stores[0], { ...whole.stores[1], dropped_out: true }],
    },
  };
  const p = paperFor(dropped);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.order.total_amount, 4200);
  assert.deepEqual(p.items.map((i) => i.item_name), ["Comfort Slippers"]);
});

test("a part whose other stores could not be read is NOT printed, and says why", () => {
  const p = paperFor({ order: fashion, items: fashionFull.items });
  assert.equal(p.ok, false, "one store's PKR 4,200 must never be printed as the parcel's amount");
  if (p.ok) return;
  assert.match(p.why, /#10045/);
  assert.match(p.why, /could not be read/);
});

test("an ordinary order prints exactly as before", () => {
  const plain = { order: { id: "o9", order_no: 10050, total_amount: 900 }, items: [{ item_name: "Tea", price: 900 }] };
  const p = paperFor(plain);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.order, plain.order);
  assert.equal(p.items, plain.items);
  assert.equal(isPartOfGroup(plain.order), false);
});

test("the label is handed no lines and no mall block (CLAUDE.md §21)", () => {
  const p = paperFor(fashionFull);
  const label = labelOrderOf(p)!;
  assert.equal(label.total_amount, 6000);
  assert.equal("items" in label, false);
  assert.equal("mall" in label, false);
  assert.ok(!JSON.stringify(label).includes("Slippers"), "no product reaches the outside of the box");
  assert.equal(labelOrderOf(paperFor({ order: fashion })), null, "nothing for an unreadable whole");
});

test("ticking both stores of one basket prints ONE paper", () => {
  const rows = [
    { id: "p1", mall_order_id: "p1" },
    { id: "p2", mall_order_id: "p1" },
    { id: "o9", mall_order_id: null },
  ];
  assert.deepEqual(onePerParcel(["p2", "p1", "o9"], rows), { ids: ["p2", "o9"], merged: 1 });
  assert.deepEqual(onePerParcel(["o9"], rows), { ids: ["o9"], merged: 0 });
});

// ─── 2. THE SCREENS REALLY USE THEM ──────────────────────────────────────────

const desk = read("src/app/dashboard/orders/parcels/page.tsx");
const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");

test("the Parcels desk prints one paper per parcel, from the whole order", () => {
  assert.ok(desk.includes("onePerParcel([...picked], parcels)"), "ticked parts are not merged");
  assert.ok(desk.includes("paperFor((await apiClient.getOrderFull(id))"), "the paper is not built from the whole");
  assert.ok(desk.includes("setReceipts(g.ready.map((p) => ({ order: p.order, items: p.items })))"));
  assert.ok(desk.includes("setLabelOrders(g.ready.map((p) => labelOrderOf(p)))"));
  assert.ok(!/setLabelOrders\(ready\)/.test(desk), "the old one-row-per-label print is back");
});

test("the order page prints the whole order and shows the whole basket's total", () => {
  assert.ok(panel.includes("const paper = data ? paperFor(data) : null;"));
  assert.ok(panel.includes("order={paper?.ok ? paper.order : o}"));
  assert.ok(panel.includes("items={paper?.ok ? paper.items : items}"));
  assert.ok(panel.includes("labelOrderOf(paper"));
  assert.ok(panel.includes("money(whole.total)"), "the money box does not show the basket total");
  assert.ok(panel.includes("not known - the other stores could not be read"),
    "a part whose whole is unknown must say so, not show its own figure as the bill");
});

test("before delivery a promo order's money box has its discount line (AREA-7-15)", () => {
  // Rs 1,000 goods, code Rs 200, delivery Rs 100: 900 + 100 + 100 used to
  // stand over "Customer pays Rs 900" with no line for the gap.
  assert.ok(panel.includes("const discountBeforeDelivery = takal?.counted ? 0 : orderDiscount(o);"));
  const box = panel.slice(panel.indexOf('<Section title="The money">'));
  assert.ok(box.indexOf("discountBeforeDelivery > 0") > 0);
  assert.ok(box.indexOf("discountBeforeDelivery > 0") < box.indexOf("Customer pays at the door"),
    "the discount must sit above what the customer pays, so the box adds up");
  assert.equal(orderDiscount({ subtotal: 1000, delivery_fee: 100, credit_used: 0, total_amount: 900 }), 200);
});

test("the desk card says the whole box's amount, or that it could not be read", () => {
  assert.ok(desk.includes("` · whole box ${rs(p.mall.total)}`"));
  assert.ok(desk.includes("p.mall_unreadable"));
});
