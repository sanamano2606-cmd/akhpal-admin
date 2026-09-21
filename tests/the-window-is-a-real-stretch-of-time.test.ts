// ─────────────────────────────────────────────────────────────────────────────
// THE MONEY SCREENS AGREE ON WHAT "THE PERIOD" MEANS.
//
// Mock 102, approved by Sana on 21 September 2026.
//
// The Balances & Payments screen carried two separate ideas of the period at
// once - a rolling day count AND an index into the pay periods - and every
// place that needed to know which was chosen had to ask both. Adding months
// would have made it three, and the third one would have been the one somebody
// forgot. They are one value now, read in one file.
//
// WHY MONTHS AT ALL (Sana: "when chose month so it must show month or a
// period"). "Last 30 days" is not September. It moves every day, so two people
// opening the same screen on different days see different money and neither is
// wrong. A month has a first day and a last day, and it is what shops are paid
// on.
//
// The dates matter more than they look. They are sent to the server, which ties
// a payment that names a window to that window ALONE. A month that starts on
// the 31st of August because the browser sits in London is a real wrong answer
// about real money.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_WINDOW_VALUE, daysParam, monthWindows, parseWindow, sameDates,
  windowLabel, type MoneyWindow,
} from "../src/lib/money-window.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PERIODS = [
  { label: "This period", from: "2026-09-15", to: "2026-09-21" },
  { label: "Last period", from: "2026-09-08", to: "2026-09-14" },
];

const dates = (w: MoneyWindow) =>
  w.kind === "dates" ? `${w.from}..${w.to}` : `days:${w.days}`;

// ─── Months are real months ──────────────────────────────────────────────────

test("this month and last month start on the 1st and end on the last day", () => {
  const [now, prev] = monthWindows(new Date("2026-09-21T09:00:00Z"));
  assert.equal(dates(now), "2026-09-01..2026-09-30");
  assert.equal(dates(prev), "2026-08-01..2026-08-31");
});

test("February is worked out, not guessed", () => {
  const [now] = monthWindows(new Date("2028-02-10T09:00:00Z"));
  assert.equal(dates(now), "2028-02-01..2028-02-29", "2028 is a leap year");
  const [notLeap] = monthWindows(new Date("2026-02-10T09:00:00Z"));
  assert.equal(dates(notLeap), "2026-02-01..2026-02-28");
});

test("last month in January is December of the year before", () => {
  const [, prev] = monthWindows(new Date("2027-01-09T09:00:00Z"));
  assert.equal(dates(prev), "2026-12-01..2026-12-31");
});

test("the month is PAKISTAN'S month, not the browser's", () => {
  // 31 August, 8pm UTC, is already 1 September in Swat. A browser anywhere in
  // the world must agree with the office about which month it is - the figures
  // it pulls are tied to these dates on the server.
  const [now] = monthWindows(new Date("2026-08-31T20:00:00Z"));
  assert.equal(dates(now), "2026-09-01..2026-09-30",
    "in Pakistan it is already September");

  // And the other way: 1 September, 2am UTC, is still 1 September in Swat
  // (PKT is ahead, never behind), so nothing swings back.
  const [stillSep] = monthWindows(new Date("2026-09-01T02:00:00Z"));
  assert.equal(dates(stillSep), "2026-09-01..2026-09-30");
});

test("the label names the month, so an old screenshot still says which", () => {
  const [now, prev] = monthWindows(new Date("2026-09-21T09:00:00Z"));
  assert.ok((now as any).label.includes("September 2026"));
  assert.ok((prev as any).label.includes("August 2026"));
});

// ─── Reading the dropdown's one value ────────────────────────────────────────

test("each shape of the value is read back correctly", () => {
  const months = monthWindows(new Date("2026-09-21T09:00:00Z"));
  assert.equal(dates(parseWindow("d:7", PERIODS, months)), "days:7");
  assert.equal(dates(parseWindow("d:all", PERIODS, months)), "days:all");
  assert.equal(dates(parseWindow("pp:1", PERIODS, months)), "2026-09-08..2026-09-14");
  assert.equal(dates(parseWindow("m:1", PERIODS, months)), "2026-08-01..2026-08-31");
});

test("nonsense falls back to the 30 days the screen always opened on", () => {
  // A screen that cannot read its own dropdown must still show real figures.
  // A blank, or a crash, on the page where somebody decides who gets paid is
  // worse than showing the window it has shown since the day it was written.
  const months = monthWindows();
  for (const bad of ["", "pp:99", "m:7", "d:0", "d:-3", "d:abc", "banana"]) {
    assert.equal(dates(parseWindow(bad, PERIODS, months)), "days:30", bad);
  }
});

test("the default value is one the parser accepts", () => {
  // Otherwise the screen silently opens on the fallback and the dropdown shows
  // nothing selected.
  assert.equal(dates(parseWindow(DEFAULT_WINDOW_VALUE, PERIODS, monthWindows())),
    "days:30");
});

test("a pay period that has not loaded yet does not become a wrong window", () => {
  // The pay periods arrive from the server a moment after the page. Until they
  // do, "pp:0" names nothing - and inventing dates for it would send the
  // server a window nobody chose.
  assert.equal(dates(parseWindow("pp:0", [], monthWindows())), "days:30");
});

// ─── What gets sent to the server ────────────────────────────────────────────

test("a dated window sends NO day count", () => {
  // Those endpoints are asked with from/to. Handing them a day count as well
  // would filter twice and quietly shrink the window.
  const months = monthWindows();
  assert.equal(daysParam(parseWindow("m:0", PERIODS, months)), undefined);
  assert.equal(daysParam(parseWindow("pp:0", PERIODS, months)), undefined);
});

test("all time sends no day count either", () => {
  assert.equal(daysParam({ kind: "days", days: "all" }), undefined);
  assert.equal(daysParam({ kind: "days", days: 7 }), 7);
});

// ─── Matching the chosen window to a week in the pay list ────────────────────

test("a chosen pay period is recognised as one of the listed weeks", () => {
  const chosen = parseWindow("pp:1", PERIODS, monthWindows());
  assert.ok(sameDates(chosen, PERIODS[1]));
  assert.ok(!sameDates(chosen, PERIODS[0]));
});

test("a month matches no pay period, which is why it is added to the list", () => {
  const chosen = parseWindow("m:0", PERIODS, monthWindows(new Date("2026-09-21T09:00:00Z")));
  assert.ok(!PERIODS.some((p) => sameDates(chosen, p)),
    "if this ever matches, the page would name the wrong week");
});

test("a rolling window matches nothing at all", () => {
  assert.ok(!sameDates({ kind: "days", days: 30 }, PERIODS[0]));
});

// ─── The words on the screen ─────────────────────────────────────────────────

test("the strip under the dropdown says something a person can read", () => {
  assert.equal(windowLabel({ kind: "days", days: "all" }), "All time");
  assert.equal(windowLabel({ kind: "days", days: 7 }), "the last 7 days");
  assert.ok(windowLabel(parseWindow("pp:1", PERIODS, monthWindows()))
    .includes("2026-09-08 to 2026-09-14"));
});

// ─── The page really uses all of this ────────────────────────────────────────

test("the payments page has no second idea of the period left in it", () => {
  // The whole point of the file. If either of these comes back, there are two
  // answers to "which period is chosen" again, and one of them will be wrong.
  const page = read("src/app/dashboard/payments/page.tsx");
  assert.ok(!page.includes("payPeriodIdx"),
    "the old pay-period index must be gone");
  assert.ok(!/const \[period, setPeriod\]/.test(page),
    "the old rolling-day state must be gone");
  assert.ok(page.includes("parseWindow(windowValue, payPeriods, months)"),
    "the page must read its window through the one helper");
});

test("the per-window figures are asked for ONLY when a window is chosen", () => {
  // On "All time" and the rolling windows nothing extra is asked, so those
  // paths behave exactly as they did before Mock 102 and cannot regress.
  const page = read("src/app/dashboard/payments/page.tsx");
  const i = page.indexOf("getStoreSettlements");
  assert.ok(i > 0, "the page must ask for the window's figures");
  const before = page.slice(Math.max(0, i - 400), i);
  assert.ok(before.includes('if (chosen.kind === "dates") {'),
    "the extra call must sit behind a check that a dated window is chosen");
});

test("a failed window read is a PART failure, never a blank page", () => {
  // The balances above are real and still usable. What is lost is the ability
  // to offer a per-week amount - and "no payouts" and "we could not read the
  // payouts" must never look the same on this screen.
  const page = read("src/app/dashboard/payments/page.tsx");
  assert.ok(page.includes("setWinFailed(true)"));
  assert.ok(page.includes('partFailures.push(errorMessage(err, "what this period owes"))'),
    "the operator must be told which figure is missing");
});

test("a payment of Rs 0 can no longer be recorded", () => {
  // The amount box can now open EMPTY, on a week with nothing to pay. Without
  // this, typing a single 0 records a payment that says nothing and has to be
  // explained later. The server accepts amount >= 0, so the box is the guard.
  // The comments are taken out first. The line that REPLACED min={0} explains
  // itself by quoting it, and a guard that reads its own explanation guards
  // nothing - CLAUDE.md section 3. This test failed on exactly that, which is
  // the reason the note is here.
  const dialog = read("src/app/dashboard/payments/parts-store-dialog.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(dialog.includes("min={1}"), "the amount must be at least Rs 1");
  assert.ok(!dialog.includes("min={0}"), "the old floor of zero must be gone");
});

test("the all-time balance is never hidden by the window", () => {
  // An old debt sitting under a quiet month must not go invisible - that is
  // how a shop stops appearing on pay runs altogether.
  const page = read("src/app/dashboard/payments/page.tsx");
  const opens = page.slice(page.indexOf("const openPay"), page.indexOf("const submitPay"));
  const mentions = (opens.match(/All-time balance/g) || []).length;
  assert.ok(mentions >= 3,
    `every dated branch must name the all-time balance - found ${mentions}`);
});
