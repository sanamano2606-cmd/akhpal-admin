// ─────────────────────────────────────────────────────────────────────────────
// A PAYMENT MUST SAY WHICH WEEK IT IS FOR (money audit M2, 19 September 2026).
//
// The server has understood `period_from` / `period_to` for weeks: a payment
// that NAMES its period counts against that period and no other. The panel
// never sent them. So every payment fell back to the day it was typed, and:
//
//   * the Pay Out screen opens on LAST period, and after you paid it, it went
//     on showing the same money as still owing - so you pay it again;
//   * that same payment landed inside THIS period's "already paid", so this
//     period's "to pay" came out too small - so the shop is underpaid.
//
// Overpaying one week and underpaying the next, from one missing field.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const api = read("src/lib/api-money.ts");
const page = read("src/app/dashboard/payments/page.tsx");
const dialog = read("src/app/dashboard/payments/parts-store-dialog.tsx");
const settlements = read("../swat-delivery-app/backend/routers/settlements.py");

test("the call can carry the week", () => {
  assert.ok(api.includes("period_from?: string;"), "period_from must be in the payload");
  assert.ok(api.includes("period_to?: string;"), "period_to must be in the payload");
});

test("the page sends it when a week is chosen", () => {
  assert.ok(
    page.includes("...(_p ? { period_from: _p.from, period_to: _p.to } : {}),"),
    "The chosen week must reach the server.",
  );
});

test("the dialog asks, and starts on the week being looked at", () => {
  assert.ok(dialog.includes("Which week is this for?"), "The question must be asked.");
  assert.ok(
    page.includes('setPayPeriod(payPeriodIdx !== null ? String(payPeriodIdx) : "");'),
    "It must start on the period whose figure the person just read - not on " +
      "a blank that gets skipped.",
  );
});

test("all-time is an explicit choice, not a blank", () => {
  // Naming a week on an all-time payment would be a lie, and a WRONG period
  // is worse than none. But it has to be chosen, not fallen into.
  assert.ok(
    dialog.includes('Not for one week (all-time)'),
    "The option must be spelled out in words.",
  );
});

test("the server side of the rule is still there", () => {
  assert.ok(
    settlements.includes("return period_from == str(d_from) and period_to == str(d_to)"),
    "A payment that names a period must belong to that period only.",
  );
  assert.ok(
    settlements.includes('return _in_window(payment.get("paid_at"), f, t)'),
    "...and one with NO period must still fall back to its date, or every " +
      "payment recorded before today stops counting.",
  );
});

test("nothing else on the page lost its period", () => {
  // The rider payout call has the same hole and no screen calls it yet. If a
  // screen is ever wired to it, this test is where somebody will look.
  assert.ok(
    api.includes("async recordRiderPayout("),
    "recordRiderPayout still exists; it does not yet send a period and no " +
      "screen calls it. Wiring one up means giving it the same field.",
  );
});
