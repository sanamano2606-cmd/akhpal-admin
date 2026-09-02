// Does money and date formatting say the truth?
//
// WHY THIS TEST EXISTS: the backend sends times with no timezone marker.
// Read plainly, those land about five hours out in Pakistan - on the audit
// log and on promo expiry dates, where being five hours out is the whole
// point of the field. And a rounded rate is not a rounded number, it is a
// wrong setting.

import { test } from "node:test";
import assert from "node:assert/strict";
import { money, moneyExact, fmtDate, fmtDateTime } from "../src/lib/format.ts";

test("money shows whole rupees with thousands separators", () => {
  assert.equal(money(12744), "Rs 12,744");
  assert.equal(money(0), "Rs 0");
  assert.equal(money(1559.4), "Rs 1,559");
});

test("money never shows NaN or undefined to an operator", () => {
  assert.equal(money(null), "Rs 0");
  assert.equal(money(undefined), "Rs 0");
  assert.equal(money("not a number"), "Rs 0");
});

test("moneyExact keeps the decimals, because a rate is not an amount", () => {
  assert.equal(moneyExact(12.5), "Rs 12.5");
  assert.equal(moneyExact(500), "Rs 500");
  assert.equal(moneyExact(12.567), "Rs 12.57");
});

test("a server time with no timezone is read as UTC, not as local time", () => {
  // 2026-07-22 12:25 UTC is 17:25 in Pakistan (UTC+5). Read plainly it would
  // wrongly show 12:25, and near midnight it would show the wrong DAY.
  const withoutMarker = fmtDateTime("2026-07-22T12:25:00");
  const withMarker = fmtDateTime("2026-07-22T12:25:00Z");
  assert.equal(withoutMarker, withMarker);
  assert.ok(withoutMarker.includes("17:25"), `expected 17:25, got ${withoutMarker}`);
});

test("the space-separated server format is handled too", () => {
  assert.equal(fmtDateTime("2026-07-22 12:25:00"), fmtDateTime("2026-07-22T12:25:00Z"));
});

test("a late-evening UTC time does not show yesterday's date", () => {
  // 2026-07-22 21:00 UTC is 02:00 on the 23rd in Pakistan.
  assert.ok(fmtDate("2026-07-22T21:00:00").includes("23"));
});

test("an empty or broken date shows a dash, never Invalid Date", () => {
  assert.equal(fmtDate(null), "—");
  assert.equal(fmtDate(""), "—");
  assert.equal(fmtDateTime(undefined), "—");
});

// ── The same rule the RELEASE checks enforce ─────────────────────────────────
//
// WHY THIS IS HERE TWICE. The backend has a release test —
// backend/tests/test_money_is_written_one_way.py — that scans this whole panel
// for an amount written by hand. It stopped a deploy on 1 September 2026
// because two buttons wrote "Rs {…}" themselves instead of calling money().
//
// That test lives in the backend and only runs at deploy time, on the release
// machine. This copy runs on `npm test`, in the panel, in a second — so the
// rule is caught while the code is being written rather than at the moment
// somebody is trying to ship.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function tsFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Code only. A note ABOUT the old way is not the old way. */
function codeLines(path: string): [number, string][] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line, i) => [i + 1, line] as [number, string])
    .filter(([, line]) => !line.trimStart().startsWith("//")
                       && !line.trimStart().startsWith("/*")
                       && !line.trimStart().startsWith("*"));
}

test("no screen writes an amount by hand — every one goes through money()", () => {
  const offenders: string[] = [];
  for (const path of tsFiles()) {
    const rel = relative("src", path).replace(/\\/g, "/");
    if (rel === "lib/format.ts") continue;          // the rule itself
    for (const [i, line] of codeLines(path)) {
      if (/=>\s*"Rs "\s*\+/.test(line) || /`Rs \$\{/.test(line)) {
        offenders.push(`${rel}:${i} writes its own money format`);
      } else if (/Rs \{/.test(line)) {
        offenders.push(`${rel}:${i} writes an amount by hand`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "Use money() from lib/format.ts, or moneyExact() for a rate:\n" + offenders.join("\n")
  );
});


// ── BOTH FIGURES, ON EVERY PAY-RUN ROW ─────────────────────────────────────
//
// Sana, 1 September 2026: "Both Period and All time. Total."
//
// These three checks read the pay-run screen's own source, because the thing
// that can go wrong is not arithmetic — it is a column quietly disappearing in
// a later edit, which no type check and no build would notice.

const PAYRUN = readFileSync("src/app/dashboard/payments/settlements/page.tsx", "utf8");

test("the pay run shows the period figure AND the all-time balance", () => {
  assert.ok(
    PAYRUN.includes("TO PAY THIS PERIOD"),
    "the period column is gone — this is the number you actually hand over",
  );
  assert.ok(
    PAYRUN.includes("OWED ALL-TIME"),
    "the all-time column is gone. Without it, a shop owed from a period you " +
      "already closed appears on no screen at all.",
  );
  assert.ok(
    PAYRUN.includes("balance_all_time"),
    "the all-time column is not reading the server's balance_all_time field",
  );
});

test("both tables on the pay run carry a TOTAL row", () => {
  const feet = PAYRUN.match(/foot=\{/g) ?? [];
  assert.equal(
    feet.length, 2,
    `found ${feet.length} TOTAL rows on the pay run; there are two tables ` +
      `(Stores and Riders) and both were asked for one.`,
  );
});

test("a balance under one rupee reads as settled, not as 'Rs 0 overpaid'", () => {
  // Earnings carry paisa, a payment is a whole-rupee handover. On the live
  // books Khan Restaurant sits on Rs 0.25 and SANA ULLAH on Rs -0.15.
  assert.ok(
    PAYRUN.includes("Math.abs(v) < 1"),
    "the rounding-dust rule is gone: a shop paid to the last rupee will now " +
      "read as 'Rs 0 overpaid' on the pay run.",
  );
});


// ── PAYING THE STAFF WHO CARRY PARCELS ─────────────────────────────────────
//
// Sana, 2 September 2026: "Monthly salary with daily limited deliveries and
// when exceed so they get some for that." · "Yes they also handover all."
//
// The screen reads its figures from the server, so there is no arithmetic here
// to check. What CAN go wrong is a column, a button or a whole table quietly
// disappearing in a later edit - which no type check and no build would notice.

const STAFFPAY = readFileSync("src/app/dashboard/payments/staff/page.tsx", "utf8");

test("the staff pay screen shows salary, bonus and what to pay", () => {
  for (const bit of ["Salary", "Bonus", "To pay this month", "Paid all-time",
                     "Over target"]) {
    assert.ok(
      STAFFPAY.includes(bit),
      `the "${bit}" column is gone from the staff pay run`,
    );
  }
});

test("cash staff are holding is a SEPARATE table, never added to their pay", () => {
  assert.ok(
    STAFFPAY.includes("Cash staff are holding"),
    "the cash table is gone. Without it the money a staff member collects " +
      "leaves every screen the moment a parcel is marked delivered.",
  );
  assert.ok(
    STAFFPAY.includes("cash_still_held") && STAFFPAY.includes("to_pay"),
    "the screen is no longer reading both accounts",
  );
  // The one mistake that must never come back: netting the two.
  assert.ok(
    !/to_pay\s*[-+]\s*.*cash_still_held|cash_still_held\s*[-+]\s*.*to_pay/.test(STAFFPAY),
    "pay and till are being combined into one number. They are two accounts — " +
      "mixing them is how four screens came to disagree about what a rider owed.",
  );
});

test("both staff tables carry a TOTAL row", () => {
  // Two `total: () => "TOTAL"` anchors, one per table.
  const anchors = STAFFPAY.match(/total:\s*\(\)\s*=>\s*"TOTAL"/g) ?? [];
  assert.equal(
    anchors.length, 2,
    `found ${anchors.length} TOTAL rows on the staff pay screen; there are two ` +
      `tables (pay and cash) and both were asked for one.`,
  );
});

test("a staff member with no pay terms is said so, not shown as Rs 0", () => {
  assert.ok(
    STAFFPAY.includes("NO PAY TERMS SET"),
    "a missing pay-terms row will now read as a salary of Rs 0 that somebody " +
      "agreed to. It is not — it means nobody has set one.",
  );
  assert.ok(STAFFPAY.includes("Set pay terms"));
});

test("the money-moving buttons go through the pay-once door", () => {
  // recordStaffPayout / recordStaffCashHandover use requestOnce in api-money;
  // this checks the SCREEN still calls those and has not grown its own POST.
  for (const fn of ["recordStaffPayout", "recordStaffCashHandover"]) {
    assert.ok(STAFFPAY.includes(`apiClient.${fn}`), `${fn} is no longer used`);
  }
  const api = readFileSync("src/lib/api-money.ts", "utf8");
  for (const fn of ["recordStaffPayout", "recordStaffCashHandover"]) {
    const body = api.slice(api.indexOf(`async ${fn}`));
    assert.ok(
      body.slice(0, 600).includes("requestOnce"),
      `${fn} sends a plain request, so a retry — a slow connection, a double ` +
        `tap — would pay the same person twice.`,
    );
  }
});

test("a staff payment is stamped with the month it covers", () => {
  assert.ok(
    STAFFPAY.includes("period_from") && STAFFPAY.includes("period_to"),
    "an unstamped payment falls back to the date it was made, so paying " +
      "August's salary in September reduces September's bill as well.",
  );
});
