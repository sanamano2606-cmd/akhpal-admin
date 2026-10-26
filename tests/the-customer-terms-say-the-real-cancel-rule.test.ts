// THE CUSTOMER TERMS SAY THE REAL CANCEL RULE.  (H12, Sana, 26 Oct 2026.)
//
// Sana's decision: "Pending cancel is free". The app lets a customer cancel
// at any stage until the order is delivered (Sana, 2 Oct 2026); a cancel
// before the shop accepts is free and does not count; after that it counts,
// and 2 in a row freeze the account until the office unblocks it.
//
// The terms page still described an old 2-minute window and said an order
// could not be cancelled once the shop had started. The server's half is
// backend/tests/test_a_pending_cancel_is_free.py.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(
  new URL("../src/app/terms/customer/page.tsx", import.meta.url), "utf8");

// Only the Cancelling section, up to the next section.
const start = PAGE.indexOf('en: "Cancelling"');
const CANCEL = PAGE.slice(start, PAGE.indexOf("<Section", start + 1));
const flat = CANCEL.replace(/\s+/g, " ");

test("the Cancelling section is there", () => {
  assert.ok(start > 0);
});

test("no old 2-minute window, no 'cannot be cancelled once the shop starts'", () => {
  assert.ok(!/2 minutes/.test(flat), "the 2-minute window is gone");
  assert.ok(!/can no longer be cancelled/.test(flat));
  assert.ok(!/2 منٹ/.test(flat));
});

test("it says: any time until delivered, free before the shop accepts", () => {
  assert.match(flat, /until it is delivered/);
  assert.match(flat, /before the shop accepts/);
  assert.match(flat, /free/);
  assert.match(flat, /does not count/);
});

test("it says: after that it counts, 2 in a row freeze until the office unblocks", () => {
  assert.match(flat, /2 counted cancellations in a row/);
  assert.match(flat, /freeze/);
  assert.match(flat, /unblock/);
  assert.match(flat, /delivered order/);
});

test("every point has its Urdu", () => {
  const en = (CANCEL.match(/\ben:/g) || []).length;
  const ur = (CANCEL.match(/\bur:/g) || []).length;
  assert.ok(en >= 4, `only ${en} English points`);
  assert.equal(en, ur);
});
