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
