/**
 * Sana, 2 October 2026 (Step 4, "Go 4.4"): the Earnings page shows what late
 * cancels cost Takal - the shop's share and the rider's trip on orders
 * cancelled after the shop took them, already taken off "Net kept".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "earnings", "page.tsx"),
  "utf8",
);

test("'What you gave back' has a late-cancels line with its count", () => {
  const block = PAGE.slice(PAGE.indexOf("What you gave back"), PAGE.indexOf(">Net kept<"));
  assert.ok(block.includes("Late cancels paid by Takal"));
  assert.ok(block.includes("money(p.late_cancels_paid ?? 0)"));
  assert.ok(block.includes("p.late_cancels ?? 0"));
});

test("the headline sentence names late cancels among what comes off", () => {
  // Money audit 13 Oct 2026: staff pay comes off too now (B25), and the
  // sentence speaks of ONE period only.
  assert.ok(PAGE.includes("promo discounts, wallet credit, late cancels and"));
  assert.ok(PAGE.includes("staff pay, <strong>{money(p.net)}</strong> is kept"));
});

test("the headline never puts the all-time figure beside the period's net", () => {
  assert.ok(!PAGE.includes("All-time <strong>{money(a.earned)}</strong> · after refunds"));
  assert.ok(PAGE.includes("<strong>{money(a.net)}</strong> kept."));
});

test("parcel staff pay is shown as a cost line (money audit B25)", () => {
  assert.ok(PAGE.includes("Staff pay (salaries &amp; bonuses)"));
  assert.ok(PAGE.includes("money(p.staff_pay ?? 0)"));
});
