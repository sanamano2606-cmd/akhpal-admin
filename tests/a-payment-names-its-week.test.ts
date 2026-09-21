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

test("the dialog asks, and the week follows the window that was chosen", () => {
  assert.ok(dialog.includes("Which week is this for?"), "The question must be asked.");

  // TURNED ROUND TWICE, AND THIS IS THE END OF IT.
  //
  // 19 Sep: the week started on the period being looked at.
  // 20 Sep (audit C4): emptied, because the amount was the ALL-TIME balance
  //        whatever the picker said, so naming a week was a lie. Khan
  //        Restaurant owed Rs 47,500 across six weeks; paying that with "Last
  //        period" showing marked ONE week paid Rs 47,500 against Rs 8,200
  //        earned, and the other five were paid again on the next run.
  // 21 Sep (Mock 102, approved): the two are made to AGREE instead. The amount
  //        now comes from the chosen window, so the week can fill itself in.
  //
  // The rule these three all serve is the same one: the amount and the week
  // must come from the same stretch of time.
  assert.ok(
    page.includes("setAmount(toPay > 0 ? String(toPay) : \"\");"),
    "The amount must be what the CHOSEN WINDOW owes, not the all-time balance.",
  );
  assert.ok(
    page.includes("setPayPeriod(toPay > 0 ? chosenOptionValue : \"\");"),
    "The week must be the window the amount was just built from - and must "
      + "stay empty when there is nothing to pay, because a payment that is "
      + "not happening names no week.",
  );
});

test("a rolling window or All time still names no week", () => {
  // There is no week to name, and the all-time balance is the right offer.
  // This is the path the screen has always had, and it must not regress.
  assert.ok(
    page.includes('if (chosen.kind !== "dates") {'),
    "The rolling windows must be handled apart from the dated ones.",
  );
});

test("a window whose figure cannot be read NEVER quietly names a week", () => {
  // THE ONE THAT MATTERS MOST IN THIS FILE.
  //
  // Falling back to the all-time amount while a week is still showing is the
  // exact fault C4 was raised for. If the per-window figure cannot be read,
  // the screen must drop the week AND say why - not silently offer 47,500
  // against a week that earned 8,200.
  const failBranch = page.slice(page.indexOf("} else if (winFailed) {"));
  assert.ok(failBranch.length > 0, "there must be a branch for a failed read");
  const upToNext = failBranch.slice(0, failBranch.indexOf("} else {"));
  assert.ok(
    upToNext.includes('setPayPeriod("")'),
    "a failed read must drop the week",
  );
  assert.ok(
    upToNext.includes("bad: true"),
    "...and must say so in red, not quietly",
  );
});

test("the week that is named is looked up in the list that can hold a month", () => {
  // A month is a perfectly good thing to pay for and it is NOT in the server's
  // pay-period list, so it is put at the front of `periodOptions`. Reading the
  // old `payPeriods` here would send the wrong dates, or none.
  assert.ok(
    page.includes("const _p = payPeriod === \"\" ? null : periodOptions[Number(payPeriod)];"),
    "submitPay must read periodOptions, not payPeriods.",
  );
});

test("months are offered, and they are real months", () => {
  assert.ok(page.includes('<optgroup label="Months">'), "the group must exist");
  assert.ok(
    page.includes("monthWindows") && page.includes("months.map"),
    "the months must come from the shared helper, not be typed out here",
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
