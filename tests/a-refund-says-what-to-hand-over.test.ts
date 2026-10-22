// ─────────────────────────────────────────────────────────────────────────────
// AFTER A REFUND THE OFFICE IS TOLD WHAT TO HAND OVER (decision D6, money
// audit 21 Oct 2026). A refund may give back the wallet-credit part of an
// order: the server puts it back in her Takal wallet by itself
// (`back_to_wallet`) and the rest is cash (`give_in_cash`). Example: a
// Rs 3,000 refund on an order that used Rs 500 of credit -> Rs 500 is back in
// her wallet, give Rs 2,500 in cash. Without the line the office hands over
// Rs 3,000 and she has Rs 500 extra in her wallet.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { refundHandOverWords } from "../src/lib/refund-rules.ts";
import { money } from "../src/lib/format.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the wallet part and the cash part, in words", () => {
  assert.equal(refundHandOverWords({ back_to_wallet: 500, give_in_cash: 2500 }, money),
    "Rs 500 went back to her Takal wallet by itself - give the other Rs 2,500 in cash.");
  assert.equal(refundHandOverWords({ back_to_wallet: 0, give_in_cash: 3000 }, money),
    "Give Rs 3,000 back to the customer.");
  assert.equal(refundHandOverWords({ back_to_wallet: 3000, give_in_cash: 0 }, money),
    "Rs 3,000 went back to her Takal wallet by itself - nothing to give in cash.");
});

test("an older server that does not say is not guessed at", () => {
  assert.equal(refundHandOverWords({ message: "Refund recorded" }, money), "");
  assert.equal(refundHandOverWords(null, money), "");
});

test("all three refund doors show it", () => {
  const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
  const returns = read("src/app/dashboard/orders/returns/page.tsx");
  const complaint = read("src/components/ComplaintMoneyBox.tsx");
  assert.ok(panel.includes("const reply = await apiClient.refundOrder(") && panel.includes("refundHandOverWords(reply, money)"));
  assert.ok(returns.includes("const reply = await apiClient.approveReturn(") && returns.includes("refundHandOverWords(reply, money)"));
  assert.ok(complaint.includes("const reply = await apiClient.decideComplaint(") && complaint.includes("refundHandOverWords(reply, money)"));
  // The server's own field names.
  const server = read("../swat-delivery-app/backend/routers/admin_orders.py");
  assert.ok(server.includes('"back_to_wallet"') && server.includes('"give_in_cash"'));
});
