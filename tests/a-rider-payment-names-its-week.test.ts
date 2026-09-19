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
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

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

test("the dialog asks, and opens on the week being looked at", () => {
  assert.ok(money.includes("Which week is this for?"), "The question must be asked.");
  assert.ok(
    money.includes("payPeriods.findIndex((p) => p.from === period.from && p.to === period.to)"),
    "It must start on the period whose figure the person just read - a blank " +
      "that must be chosen every time is a blank that gets skipped.",
  );
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
