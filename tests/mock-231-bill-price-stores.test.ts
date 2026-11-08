// ─────────────────────────────────────────────────────────────────────────────
// MOCK 231 - BILL-PRICE STORES in the panel  (Sana, 8 November 2026:
// "both ways together" / "YES" / "Approved"; "The Store Should Not See the
// markup price But Only The store own price").
//
// The rules (src/lib/bill-price.ts) are run for real; the screens are read for
// the pieces that must be there: the store's third kind with its warning, the
// order's Bill box with "Correct bill total" only for Balances, the two chips
// that match the server's queues, the row marks, and the pay run's warning
// with a second press before paying a shop whose bills are missing.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { billDiscount, billMark, billProblem, billTooHighWords, DEFAULT_LOW_PERCENT } from "../src/lib/bill-price.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a typed bill: whole rupees, at least Rs 1, never above the shop's own total", () => {
  assert.equal(billProblem("1880", 2000), null);
  assert.equal(billProblem("1,880", 2000), null);
  assert.equal(billProblem("2000", 2000), null);
  assert.equal(billProblem("2100", 2000), "The bill cannot be more than the listed total, Rs 2,000. Please check the bill.");
  assert.equal(billProblem("1880.5", 2000), "Whole rupees only - no paisa, no letters.");
  assert.equal(billProblem("0", 2000), "The bill must be at least Rs 1.");
  assert.equal(billProblem("", 2000), "Type the bill total.");
  assert.equal(billProblem("abc", 2000), "Whole rupees only - no paisa, no letters.");
});

test("the refusal is the server's own words", () => {
  const server = read("../swat-delivery-app/backend/order_bills.py");
  assert.ok(server.includes('f"The bill cannot be more than the listed total, Rs {int(listed):,}. "'));
  assert.ok(server.includes('"Please check the bill."'));
  assert.equal(billTooHighWords(12500), "The bill cannot be more than the listed total, Rs 12,500. Please check the bill.");
});

test("the discount: rupees and percent", () => {
  assert.deepEqual(billDiscount(2000, 1880), { rupees: 120, percent: 6 });
  assert.deepEqual(billDiscount(2000, 1850), { rupees: 150, percent: 7.5 });
  assert.deepEqual(billDiscount(0, 0), { rupees: 0, percent: 0 });
});

test("the row mark follows the same rule as the server's chips", () => {
  const b = (more: any) => ({ price_mode: "bill", bill_total: null, status: "ready", ...more });
  assert.equal(billMark(b({})), "missing");
  assert.equal(billMark(b({ status: "delivered" })), "missing");
  for (const st of ["pending", "accepted", "preparing", "cancelled", "rejected"]) assert.equal(billMark(b({ status: st })), null, st);
  assert.equal(billMark(b({ bill_total: 1880, bill_low: true })), "low");
  assert.equal(billMark(b({ bill_total: 1880, bill_low: false })), null);
  assert.equal(billMark({ price_mode: "standard", status: "ready" }), null);
  const desk = read("../swat-delivery-app/backend/routers/orders_desk.py");
  assert.ok(desk.includes('"&status=not.in.(pending,accepted,preparing,cancelled,rejected)"'));
});

test("the two chips have the server's keys", () => {
  const page = read("src/app/dashboard/orders/page.tsx");
  const desk = read("../swat-delivery-app/backend/routers/orders_desk.py");
  for (const k of ["bill_missing", "bill_low"]) {
    assert.ok(page.includes(`{ key: "${k}"`), k);
    assert.ok(desk.includes(`"${k}":`), k);
  }
  assert.ok(page.includes("const bm = billMark(o);"));
});

test("the store card offers bill price with the warning, sent to the server", () => {
  const card = read("src/app/dashboard/stores/[id]/parts-price-mode.tsx");
  assert.ok(card.includes('type Mode = "standard" | "fixed" | "bill";'));
  assert.ok(card.includes('option("bill", "Bill price - the shop types its bill total for every order"'));
  assert.ok(card.includes('choice === "bill" ? lowNum : undefined'));
  assert.equal(DEFAULT_LOW_PERCENT, 2);
  const api = read("src/lib/api-stores.ts");
  assert.ok(api.includes("{ mode, low_discount_percent: lowDiscountPercent }"));
  const server = read("../swat-delivery-app/backend/routers/fixed_prices.py");
  assert.ok(server.includes('pattern="^(fixed|standard|bill)$"'));
});

test("the order's Bill box: Correct only for Balances, never once paid", () => {
  const box = read("src/app/dashboard/orders/parts-order-bill.tsx");
  assert.ok(box.includes('const mayCorrect = canAccess("payments.balances");'));
  assert.ok(box.includes("mayCorrect && bill.locked === false &&"));
  assert.ok(box.includes("!reasonOk"), "a correction needs a reason");
  const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
  assert.ok(panel.includes('{o.price_mode === "bill" && ('));
  const nav = read("src/lib/navigation.ts");
  const guard = read("../swat-delivery-app/backend/app_guard.py");
  assert.ok(nav.indexOf('["/admin/orders/*/bill", "payments.balances"]') < nav.indexOf('["/admin/orders", "orders.all"]'));
  assert.ok(guard.indexOf('("/admin/orders/*/bill", "payments.balances")') < guard.indexOf('("/admin/orders", "orders.all")'));
});

test("the pay run warns and asks twice before paying a shop with bills missing", () => {
  const page = read("src/app/dashboard/payments/page.tsx");
  assert.ok(page.includes("await apiClient.getMissingBills()"));
  assert.ok(page.includes("if (payTargetBills && !billPayOk) {"));
  assert.ok(page.includes("setBillPayOk(false);"), "a new window starts unconfirmed");
  assert.ok(page.includes('partFailures.push(errorMessage(err, "which bill-price orders have no bill"))'));
  const tab = read("src/app/dashboard/payments/parts-tab-restaurants.tsx");
  assert.ok(tab.includes("data-bill-missing-tag"));
});
