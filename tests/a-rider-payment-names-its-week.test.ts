// ─────────────────────────────────────────────────────────────────────────────
// A RIDER PAYMENT MUST SAY WHICH WEEK IT IS FOR (money audit M4).
//
// The same hole M2 closed for shops, still open for riders. The server has
// understood `period_from` / `period_to` all along: a payment that NAMES its
// period counts against that period and no other, and falls back to the day
// it was typed only when it names none.
//
// The panel never sent them. So a payment for LAST week, recorded on Monday,
// was counted against THIS week:
//   * last week went on showing the money as owing   -> you pay it again
//   * this week counted it as already paid           -> you pay too little
//
// Overpaying one week and underpaying the next, from one missing field.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** The file with its comments taken out. A guard that reads its own
 *  explanation guards nothing - CLAUDE.md section 3. */
const code = (src: string) =>
  // A BLOCK COMMENT STARTS A LINE. Anchored with ^[ \t]* and /m on purpose:
  // without it, `/*` INSIDE A STRING opens a comment that runs to the next `*/`
  // — and src/lib/navigation.ts has rules like "/admin/riders/*/cash-limits".
  // Found on 24 September 2026: a lone starred rule swallowed fifty lines of
  // SERVER_RULES, and the check for a rule below it passed on a file that no
  // longer contained it. It had looked right only because the starred lines
  // happened to come in pairs, so each one closed the one before it.
  src.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

const api = code(read("src/lib/api-money.ts"));
const money = code(read("src/domains/riders/RiderMoney.tsx"));
const settlements = read("../swat-delivery-app/backend/routers/settlements.py");

test("the rider payment call can carry the week", () => {
  assert.ok(
    api.includes("period?: { from: string; to: string }"),
    "recordRiderPayout must accept the period it is for.",
  );
  assert.ok(
    api.includes("...(period ? { period_from: period.from, period_to: period.to } : {})"),
    "...and actually send it.",
  );
});

test("the screen sends the week it is showing", () => {
  assert.ok(
    money.includes("_p ? { from: _p.from, to: _p.to } : undefined"),
    "The chosen week must reach the server.",
  );
});

test("the dialog asks, and the week follows the window that was chosen", () => {
  assert.ok(money.includes("Which week is this for?"), "The question must be asked.");

  // TURNED ROUND TWICE, AND THIS IS THE END OF IT.
  //
  // 19 Sep: the week opened on the period on screen.
  // 20 Sep (audit C4): emptied, because the amount is `outstanding` - which
  //        this screen's own table note calls an ALL-TIME balance, "a wage does
  //        not expire because the date filter moved" - so naming a week for it
  //        was a lie, and the server counts such a payment against that week
  //        ALONE, leaving the weeks before it to be paid a second time.
  // 21 Sep (Mock 102, approved, extended here at Sana's word "Rider pay screen
  //        Yes"): the two are made to AGREE. The amount now comes from the
  //        chosen window, so the week can fill itself in again.
  assert.ok(
    money.includes("setPayAmount(toPay > 0 ? String(toPay) : \"\");"),
    "The amount must be what the CHOSEN WINDOW owes, not the all-time balance.",
  );
  assert.ok(
    money.includes("setPayPeriod(toPay > 0 ? chosenOptionValue : \"\");"),
    "The week must be the window the amount was just built from - and must "
      + "stay empty when there is nothing to pay, because a payment that is "
      + "not happening names no week.",
  );
});

test("a rolling window still names no week", () => {
  // There is no week to name, and the all-time balance is the right offer.
  // This is the path the Riders section itself always uses, and it must not
  // regress - that page passes { kind: "days" } and nothing else.
  assert.ok(
    money.includes('if (period.kind !== "period") {'),
    "the rolling windows must be handled apart from the dated ones",
  );
});

test("a window whose figure cannot be read NEVER quietly names a week", () => {
  // Falling back to the all-time amount while a week is still showing is the
  // exact fault C4 was raised for.
  const i = money.indexOf("} else if (winFailed) {");
  assert.ok(i > 0, "there must be a branch for a failed read");
  const branch = money.slice(i, money.indexOf("} else {", i));
  assert.ok(branch.includes('setPayPeriod("")'), "a failed read must drop the week");
  assert.ok(branch.includes("bad: true"), "...and must say so in red, not quietly");
});

test("a failed window read does not take the whole screen down", () => {
  // The balances above are real and still usable. What is lost is only the
  // ability to offer a per-week amount.
  assert.ok(money.includes("setWinFailed(true)"));
  assert.ok(
    money.includes('problems.push(errorMessage(err, "what this period owes"))'),
    "the operator must be told which figure is missing",
  );
});

test("the week that is named is looked up in the list that can hold a month", () => {
  assert.ok(
    money.includes("const _p = payPeriod === \"\" ? null : periodOptions[Number(payPeriod)];"),
    "submitPay must read periodOptions, not payPeriods.",
  );
  assert.ok(
    money.includes("periodOptions.map("),
    "and the dropdown must draw from the same list, or the two disagree",
  );
});

test("neither a payout nor a hand-in of Rs 0 can be recorded", () => {
  // The payout box can now open EMPTY, on a week with nothing to pay, so a
  // single stray 0 would record a payout that says nothing.
  //
  // The CASH HAND-IN box had the same hole and was found while fixing that
  // one. Both are named here rather than only the payout, because "there is
  // no min=0 left in this file" is a check that stays true as the file grows.
  assert.equal((money.match(/min="1"/g) || []).length, 2,
    "both the payout and the cash hand-in must be at least Rs 1");
  assert.ok(!money.includes('min="0"'), "no floor of zero may remain");
});

test("the all-time balance is never hidden by the window", () => {
  // An old wage under a quiet month must not go invisible.
  const opens = money.slice(money.indexOf("const openPay"),
                            money.indexOf("const submitPay"));
  const mentions = (opens.match(/All-time balance/g) || []).length;
  assert.ok(mentions >= 3,
    `every dated branch must name the all-time balance - found ${mentions}`);
});

test("a payment that is not for one week is a NAMED choice, not a blank", () => {
  assert.ok(
    money.includes("Not for one week (all-time)"),
    "Forcing a week onto a payment that is not for one week would write a " +
      "period that is not true, and a wrong week is worse than none.",
  );
});

test("the office is told what the week actually does", () => {
  assert.ok(
    money.includes("counts this payment against the week"),
    "Somebody choosing a week has to know the choice moves money between " +
      "two screens.",
  );
});

test("the cash hand-in deliberately carries no week, and says why", () => {
  // The table HAS period columns. Nothing reads them for a hand-in: what a
  // rider owes is always all-time. Asking a question whose answer changes no
  // figure is friction, not safety - but the reason has to be written down,
  // or the next person "fixes" it.
  const raw = read("src/lib/api-money.ts");
  assert.ok(raw.includes("NO WEEK HERE, ON PURPOSE"));
  assert.ok(
    !code(raw).split("recordCashHandover")[1].slice(0, 300).includes("period_from"),
    "the hand-in must not start sending a week without something reading it",
  );
});

test("the server still counts a payment against the week it names", () => {
  // This is the rule the panel is feeding. If it ever changes, the fix above
  // is pointless and this test says so rather than passing quietly.
  assert.ok(
    settlements.includes("if period_from or period_to:"),
    "_payment_belongs_to_this_window must prefer the named period.",
  );
  assert.ok(
    settlements.includes("return _in_window(payment.get(\"paid_at\"), f, t)"),
    "...and fall back to the date only when no period is named.",
  );
});
