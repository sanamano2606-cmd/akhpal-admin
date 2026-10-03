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
  assert.ok(PAGE.includes("promo discounts, wallet credit and late cancels"));
});
