/**
 * THE PANEL'S COPY OF THE COMPLAINT MONEY RULES, CHECKED AGAINST THE SERVER'S.
 * (Mock 117 FINAL and Mock 118, approved by Sana on 24 September 2026.)
 *
 * The figures are the real order 10001, read out of the live database:
 *     paid 553 - the shop's own price 350 - the customer was charged 368 -
 *     delivery 185 - commission 35 - the rider earned 143.90.
 *
 * Every number below also appears in
 * backend/tests/test_a_customer_complains_and_somebody_pays.py. If the two
 * ever drift apart, the office is shown one figure and charged another.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  halfOf, lineCustomerAmount, lineShopAmount, commissionRateOf,
  whatTakalPaidTheShop, ceilingFor, shopLoses, riderLosesForALostOrder,
  suggestedCharge, riderKeepsHisEarning, problemWithDecision, MAX_DECISION_NOTE,
} from "../src/lib/complaint-money.ts";

const ORDER = {
  total_amount: 553, vendor_subtotal: 350, delivery_fee: 185,
  commission: 35, rider_earning: 143.9,
};
const PULAO = { price: 368, base_price: 350, quantity: 1 };
const DRINK = { price: 60, base_price: 57, quantity: 1 };

const decide = (over: Record<string, unknown> = {}) =>
  problemWithDecision({
    order: ORDER, picked: [PULAO], wants: "part",
    refund: 461, charge: 315, whoPays: "shop",
    note: "Beef Pulao was raw. Kitchen's mistake.",
    ...over,
  } as Parameters<typeof problemWithDecision>[0]);

// ── half a delivery charge ─────────────────────────────────────────────────
test("half of 185 is 93, not 92 - the rounding goes the customer's way", () => {
  assert.equal(halfOf(185), 93);
});
test("half of a clean figure stays clean", () => {
  assert.equal(halfOf(200), 100);
  assert.equal(halfOf(0), 0);
});

// ── what the customer may ask for ──────────────────────────────────────────
test("WHOLE is everything he paid", () => {
  assert.equal(ceilingFor(ORDER, [], "whole"), 553);
});
test("PART is the ticked lines plus half the delivery", () => {
  assert.equal(ceilingFor(ORDER, [PULAO], "part"), 461);
});
test("a late rider with nothing ticked is half the delivery alone", () => {
  assert.equal(ceilingFor(ORDER, [], "part"), 93);
});
test("it can never come to more than he paid", () => {
  assert.equal(ceilingFor({ ...ORDER, total_amount: 300 }, [PULAO], "part"), 300);
});
test("a line is its price times how many", () => {
  assert.equal(lineCustomerAmount({ price: 60, quantity: 3 }), 180);
  assert.equal(lineShopAmount({ base_price: 57, quantity: 3 }), 171);
});

// ── what the shop loses ────────────────────────────────────────────────────
test("the rate comes from the ORDER, not from settings today", () => {
  // 35 on 350 is ten per cent - the rate on 19 September. The global rate is
  // five per cent now, and this order must not be re-priced by it.
  assert.ok(Math.abs(commissionRateOf(ORDER) - 0.10) < 1e-9);
});
test("what Takal paid the shop", () => {
  assert.equal(whatTakalPaidTheShop(ORDER), 315);
});
test("a whole-order refund costs the shop everything it would have been paid", () => {
  assert.equal(shopLoses(ORDER, [], "whole"), 315);
});
test("part of an order costs it only the ticked line, at ITS price", () => {
  // 57 less ten per cent = 51.30. NOT the Rs 60 the customer paid: the
  // kitchen never saw the markup.
  assert.equal(shopLoses(ORDER, [DRINK], "part"), 51.3);
});
test("the shop is never charged the customer's price", () => {
  assert.ok(shopLoses(ORDER, [PULAO], "part") < 368);
  assert.equal(shopLoses(ORDER, [PULAO], "part"), 315);
});

// ── what the rider loses ───────────────────────────────────────────────────
test("a lost order costs him what Takal paid the shop - Sana's Option A", () => {
  assert.equal(riderLosesForALostOrder(ORDER), 315);
});
test("a late delivery costs him only the refund", () => {
  assert.equal(suggestedCharge(ORDER, [], "part", "rider", 93), 93);
});
test("he stops being paid only when the order never arrived", () => {
  assert.equal(riderKeepsHisEarning("rider", "whole"), false);
  assert.equal(riderKeepsHisEarning("rider", "part"), true);
});
test("the shop's mistake never costs the rider a rupee", () => {
  assert.equal(riderKeepsHisEarning("shop", "whole"), true);
  assert.equal(riderKeepsHisEarning("shop", "part"), true);
  assert.equal(suggestedCharge(ORDER, [PULAO], "whole", "shop", 553), 315);
});
test("Takal at fault takes money off nobody", () => {
  assert.equal(suggestedCharge(ORDER, [PULAO], "whole", "takal", 553), 0);
});
test("what comes off him is never more than the refund", () => {
  assert.equal(suggestedCharge(ORDER, [], "part", "rider", 40), 40);
});

// ── what the office may not approve ────────────────────────────────────────
test("a finished decision is accepted", () => {
  assert.equal(decide(), "");
});
test("nobody named is refused", () => {
  assert.match(decide({ whoPays: null }), /who was responsible/i);
});
test("no amount is refused", () => {
  assert.match(decide({ refund: null }), /what the customer gets back/i);
  assert.match(decide({ charge: null }), /comes off the one at fault/i);
});
test("no reason written is refused - the shop and the rider are SHOWN it", () => {
  assert.match(decide({ note: "" }), /short reason/i);
  assert.match(decide({ note: "   " }), /short reason/i);
});
test("a very long reason is refused", () => {
  assert.match(decide({ note: "x".repeat(MAX_DECISION_NOTE + 1) }), /shorter|under/i);
});
test("paying above the ceiling is refused, lowering it is always allowed", () => {
  assert.equal(ceilingFor(ORDER, [PULAO], "part"), 461);
  assert.match(decide({ refund: 462 }), /at most/i);
  assert.equal(decide({ refund: 461 }), "");
  assert.equal(decide({ refund: 100, charge: 100 }), "");
});
test("charging more than the refund is refused", () => {
  assert.match(decide({ refund: 100, charge: 101 }), /more than the customer/i);
});
test("a negative amount is refused", () => {
  assert.match(decide({ refund: -1 }), /less than nothing/i);
  assert.match(decide({ charge: -1 }), /less than nothing/i);
});
test("an old order with no shop price cannot charge the shop", () => {
  const noBase = { price: 368, quantity: 1 };
  assert.match(
    problemWithDecision({
      order: ORDER, picked: [noBase], wants: "part", refund: 461,
      charge: 315, whoPays: "shop", note: "raw",
    }),
    /shop's own price/i);
});
test("docking a rider past his earning needs the Main Admin", () => {
  const refused = problemWithDecision({
    order: ORDER, picked: [], wants: "whole", refund: 553, charge: 315,
    whoPays: "rider", note: "never arrived", riderEarning: 143.9,
  });
  assert.match(refused, /144/);
  assert.match(refused, /Main Admin/i);
  assert.equal(problemWithDecision({
    order: ORDER, picked: [], wants: "whole", refund: 553, charge: 315,
    whoPays: "rider", note: "never arrived", riderEarning: 143.9,
    overEarningAllowed: true,
  }), "");
});
test("inside his earning needs no tick", () => {
  assert.equal(problemWithDecision({
    order: ORDER, picked: [], wants: "part", refund: 93, charge: 93,
    whoPays: "rider", note: "late", riderEarning: 143.9,
  }), "");
});

// ── MOCK 118, re-done in arithmetic ────────────────────────────────────────
function theDayEnds(
  order: typeof ORDER, picked: typeof PULAO[], wants: string,
  whoPays: string, refund: number,
) {
  const charge = suggestedCharge(order, picked, wants, whoPays, refund);
  const shop = whatTakalPaidTheShop(order)
    - (whoPays === "shop" ? shopLoses(order, picked, wants) : 0);
  const earned = riderKeepsHisEarning(whoPays, wants) ? Number(order.rider_earning) : 0;
  const rider = earned - (whoPays === "rider" ? charge : 0);
  const customerOut = Number(order.total_amount) - refund;
  return { shop, rider, takal: customerOut - shop - rider, customerOut };
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.011;

test("Mock 118: an ordinary order with no complaint", () => {
  const d = theDayEnds(ORDER, [], "part", "takal", 0);
  assert.ok(near(d.shop, 315) && near(d.rider, 143.9) && near(d.takal, 94.1));
});
test("Mock 118: restaurant at fault, whole order - THE RIDER IS STILL PAID", () => {
  const d = theDayEnds(ORDER, [PULAO], "whole", "shop", 553);
  assert.ok(near(d.shop, 0), "the shop gets nothing");
  assert.ok(near(d.rider, 143.9), "the rider is paid in full");
  assert.ok(near(d.takal, -143.9), "Takal carries his fee");
});
test("Mock 118: restaurant at fault, part of the order", () => {
  const d = theDayEnds(ORDER, [PULAO], "part", "shop", 461);
  assert.ok(near(d.shop, 0) && near(d.rider, 143.9) && near(d.takal, 553 - 461 - 143.9));
});
test("Mock 118: rider at fault and late", () => {
  const d = theDayEnds(ORDER, [], "part", "rider", 93);
  assert.ok(near(d.shop, 315) && near(d.rider, 143.9 - 93) && near(d.takal, 94.1));
});
test("Mock 118: rider at fault, never arrived - Takal ends at ZERO", () => {
  const d = theDayEnds(ORDER, [], "whole", "rider", 553);
  assert.ok(near(d.shop, 315), "the shop is untouched");
  assert.ok(near(d.rider, -315), "he repays what Takal paid the shop");
  assert.ok(near(d.takal, 0), "not a rupee lost, not a rupee gained");
});
test("nothing ever goes missing, whatever the case", () => {
  const cases: [string, string, number][] = [
    ["whole", "shop", 553], ["part", "shop", 461],
    ["part", "rider", 93], ["whole", "rider", 553],
    ["whole", "takal", 553], ["part", "takal", 93],
  ];
  for (const [wants, who, refund] of cases) {
    const picked = wants === "part" && who === "shop" ? [PULAO] : [];
    const d = theDayEnds(ORDER, picked, wants, who, refund);
    assert.ok(near(d.shop + d.rider + d.takal, d.customerOut),
      `${who}/${wants} does not add up`);
  }
});
