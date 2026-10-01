/**
 * Money fix 14 (Sana, 2 October 2026): "You owe Stores / Riders" is what you
 * OWE - an overpaid shop or rider is shown on its own line, never subtracted.
 *
 * Shop A owed Rs 5,000, Shop B overpaid Rs 2,000: the card said Rs 3,000,
 * but Rs 5,000 of cash is needed to pay Shop A.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { splitOwed } from "../src/lib/owe-split.ts";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "payments", "page.tsx"),
  "utf8",
);

test("an overpaid shop is not taken off what is owed", () => {
  assert.deepEqual(splitOwed([5000, -2000]), { owed: 5000, overpaid: 2000, overpaidCount: 1 });
});

test("nothing overpaid, nothing changes", () => {
  assert.deepEqual(splitOwed([5000, 1000, 0]), { owed: 6000, overpaid: 0, overpaidCount: 0 });
});

test("odd values count as nothing, never as money", () => {
  assert.deepEqual(splitOwed([null, undefined, "abc", "300"]), { owed: 300, overpaid: 0, overpaidCount: 0 });
});

test("both cards use the split, not a plain sum of balances", () => {
  assert.ok(PAGE.includes("splitOwed(rows.map"), "You owe Stores still nets overpaid shops");
  assert.ok(PAGE.includes("splitOwed(riderRows.map"), "You owe Riders still nets overpaid riders");
  assert.ok(!/const totalOutstanding = rows\.reduce/.test(PAGE),
    "the old plain sum of every balance is back");
});

test("the overpaid amount is shown, not hidden", () => {
  assert.ok(PAGE.includes("stores.overpaid > 0"));
  assert.ok(PAGE.includes("riders.overpaid > 0"));
});
