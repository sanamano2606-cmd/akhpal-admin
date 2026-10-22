// ─────────────────────────────────────────────────────────────────────────────
// FOUR NEW QUESTIONS FROM THE SERVER (money audit 21 Oct 2026), answered inside
// the screens' existing look:
//   1. Go Live / Clear test data: the server needs `confirm_orders`, the
//      number of orders the person typed - it counts again and stops if the
//      number moved (real customers may be ordering).
//   2. Switching a store to fixed-price: buying prices the VENDOR typed
//      himself are listed for the office to check (`vendor_buying_prices`).
//   3. Staff pay: a month paid MORE than it earned says so (`overpaid`); why a
//      month owes no salary (`no_salary_because`); terms that change a month
//      already paid need the Main Admin to press Save again
//      (`confirm_paid_months`).
//   4. A shop's payout account: a clerk's refusal shows the server's sentence.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AccessDeniedError } from "../src/lib/api-errors.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Go Live sends the number of orders the person typed, and waits for it", () => {
  const page = read("src/app/dashboard/go-live/page.tsx");
  assert.ok(page.includes('confirm_orders: Number((mode === "go_live" ? typedLiveOrders : typedClearOrders).trim()),'));
  assert.ok(page.includes("const armedClear = typedClear.trim() === clearPhrase && ordersTyped(typedClearOrders);"));
  assert.ok(page.includes("const armedLive = typedLive.trim() === livePhrase && ordersTyped(typedLiveOrders);"));
  const server = read("../swat-delivery-app/backend/routers/go_live.py");
  assert.ok(server.includes("confirm_orders: Optional[int]"), "the server's own field name");
});

test("the fixed-price switch lists the buying prices the vendor typed", () => {
  const card = read("src/app/dashboard/stores/[id]/parts-price-mode.tsx");
  assert.ok(card.includes("res.vendor_buying_prices_message || (res.vendor_buying_prices ?? []).length > 0"));
  assert.ok(card.includes("{r.name} - {money(r.buying_price)}"));
  const server = read("../swat-delivery-app/backend/routers/fixed_prices.py");
  assert.ok(server.includes('out["vendor_buying_prices"]') && server.includes('"vendor_buying_prices_message"'));
});

test("staff pay says overpaid, says why no salary, and asks the Main Admin about paid months", () => {
  const page = read("src/app/dashboard/payments/staff/page.tsx");
  assert.ok(page.includes("Paid {money(r.overpaid)} more than earned"));
  assert.ok(page.includes("{r.no_salary_because}"));
  assert.ok(page.includes("...(paidMonthsAsk && canCancelPayments ? { confirm_paid_months: true } : {}),"));
  assert.ok(page.includes("Array.isArray(d.paid_months)"));
  const server = read("../swat-delivery-app/backend/routers/staff_pay.py");
  for (const f of ['"overpaid"', '"no_salary_because"', "confirm_paid_months: bool", '"paid_months"']) {
    assert.ok(server.includes(f), f);
  }
});

test("a refused payout-account save shows the server's own sentence", () => {
  const said = "This shop's payout details are already saved. Only the payments office (Payments -> Balances) can change them.";
  assert.equal(new AccessDeniedError(said).message, said, "a 403 keeps the server's words");
  const card = read("src/components/PayoutDetailsCard.tsx");
  assert.ok(card.includes('toast(e?.message || "These could not be saved.", "error");'));
});
