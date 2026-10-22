// ─────────────────────────────────────────────────────────────────────────────
// "YES, PAY MORE THAN IS OWED" MUST REACH THE SERVER IN A FORM IT READS
// (money audit AREA-4-09, fixer I, 22 Oct 2026).
//
// The panel's second press in the orange "Press again to record it anyway" box
// sends `overpay`. The server refuses a payment above what is owed (409) unless
// it reads that yes. If the two ends ever disagree on WHERE the yes goes (the
// address or the body) or what it is CALLED, every overpayment the office means
// to make is refused for ever - and the box keeps saying "press again".
//
// The panel sends it on the address (?overpay=true). The server reads it there
// AND in the body (field `overpay`), so either is enough. This test reads both
// ends and fails the moment one of them moves.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BACKEND = "../swat-delivery-app/backend/";

/** The text of one Python function (from its `def` to the next top-level line). */
function pyFunction(src: string, name: string): string {
  const start = src.indexOf(`def ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const rest = src.slice(start);
  const end = rest.slice(1).search(/\n(?:@|def |class )/);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

/** The text of one Python class body. */
function pyClass(src: string, name: string): string {
  const start = src.indexOf(`class ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const rest = src.slice(start);
  const end = rest.slice(1).search(/\n(?:@|def |class )/);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

const DOORS = [
  { path: "/admin/payouts/record", file: "routers/admin_settings.py", fn: "admin_record_payout",
    model: { file: "core_models.py", name: "PayoutRecord" } },
  { path: "/admin/riders/payouts/record", file: "routers/admin_riders.py", fn: "admin_record_rider_payout",
    model: { file: "routers/admin_shared.py", name: "RiderPayoutRecord" } },
  { path: "/admin/staff/payouts/record", file: "routers/staff_pay.py", fn: "",
    model: { file: "routers/staff_pay.py", name: "" } },
];

test("the panel sends the yes on the address, named `overpay`, for all three pay doors", () => {
  const api = read("src/lib/api-money.ts");
  for (const d of DOORS) {
    assert.ok(api.includes(`\`${d.path}\${overpay ? "?overpay=true" : ""}\``),
      `${d.path}: the panel no longer sends ?overpay=true`);
  }
});

test("each server door reads `overpay` from the address", () => {
  for (const d of DOORS.filter((x) => x.fn)) {
    const fn = pyFunction(read(BACKEND + d.file), d.fn);
    assert.match(fn, /overpay: Optional\[bool\] = Query\(/,
      `${d.fn}: the address yes is not read any more`);
    assert.match(fn, /if not wants_overpay\(payload, overpay\):/,
      `${d.fn}: the yes is read but not asked before the owed check`);
  }
  const staff = read(BACKEND + "routers/staff_pay.py");
  assert.match(staff, /overpay: Optional\[bool\] = Query\(/);
  assert.match(staff, /if not \(payload\.overpay or overpay is True\):/);
});

test("the server also takes the yes in the body, under the same name", () => {
  const settlements = read(BACKEND + "routers/settlements.py");
  assert.ok(settlements.includes('OVERPAY_FIELD = "overpay"'));
  const wants = pyFunction(settlements, "wants_overpay");
  assert.match(wants, /overpay_query is True or getattr\(payload, OVERPAY_FIELD, None\) is True/,
    "an unfilled address value must never count as yes, and the body must count");
  for (const d of DOORS.filter((x) => x.model.name)) {
    const cls = pyClass(read(BACKEND + d.model.file), d.model.name);
    assert.match(cls, /\n {4}overpay: bool = False\n/,
      `${d.model.name}: a body \`overpay\` would be silently dropped`);
  }
});
