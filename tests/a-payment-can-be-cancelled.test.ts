// ─────────────────────────────────────────────────────────────────────────────
// A WRONG PAYMENT CAN BE PUT RIGHT (money audit M3, 19 September 2026).
//
// You mean Rs 20,000. Your finger slips: Rs 200,000. There was no way back.
// No Edit button, no Delete button, and a minus correction refused twice over
// - by the server's own model and by the database. The books said Rs 200,000
// for ever, unless somebody opened Supabase by hand, which leaves no record of
// who changed it or why.
//
// THE RULE THESE TESTS HOLD IN PLACE, on the screen as well as on the server:
//   * money is ADDED UP  -> cancelled rows are SKIPPED
//   * history is LISTED  -> cancelled rows are SHOWN, crossed out, with a reason
//   * cancelling         -> Main Admin only, and the reason is not optional
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isCancelled, cancelReason, liveRows, liveTotal } from "../src/lib/money-void.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** The file with its comments taken out.
 *
 * CLAUDE.md section 3's trap, and it caught this very test file: the check
 * below looked for "}/cancel" and found it in a COMMENT two lines above the
 * code, explaining why that shape must never be used. A guard that reads its
 * own explanation guards nothing. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const api = read("src/lib/api-money.ts");
const page = read("src/app/dashboard/payments/page.tsx");
const history = read("src/app/dashboard/payments/parts-tab-history.tsx");
const dialog = read("src/app/dashboard/payments/parts-cancel-dialog.tsx");
const riderMoney = read("src/domains/riders/RiderMoney.tsx");

// ── what "cancelled" means, run for real ────────────────────────────────────

test("a row with no voided_at is real money", () => {
  // The column may not exist yet (migration 085 is run by hand), or a reply
  // may simply not carry it. Both must mean "this counts" - guessing the other
  // way would make real payments vanish off the screen.
  assert.equal(isCancelled({ amount: 500 }), false);
  assert.equal(isCancelled({ amount: 500, voided_at: null }), false);
  assert.equal(isCancelled(undefined), false);
});

test("a row with a voided_at is not money", () => {
  assert.equal(isCancelled({ amount: 500, voided_at: "2026-09-19T10:00:00Z" }), true);
});

test("the two hundred thousand rupee slip", () => {
  const rows = [
    { amount: 200000, voided_at: "2026-09-19T10:02:00Z", void_reason: "typing mistake, extra zero" },
    { amount: 20000 },
  ];
  assert.equal(liveTotal(rows), 20000, "the books must say 20,000");
  assert.equal(rows.length, 2, "and the wrong row must still be there to look at");
  assert.equal(liveRows(rows).length, 1);
  assert.equal(cancelReason(rows[0]), "typing mistake, extra zero");
});

test("a reason is only shown for a row that was actually cancelled", () => {
  assert.equal(cancelReason({ amount: 5, void_reason: "left over" }), "");
});

test("a total of nothing is nothing, not a crash", () => {
  assert.equal(liveTotal([]), 0);
  assert.equal(liveRows([]).length, 0);
});

// ── the screen ──────────────────────────────────────────────────────────────

test("the panel can ask the server to cancel all three kinds of record", () => {
  assert.ok(api.includes("/admin/payouts/cancel/"), "shop payment");
  assert.ok(api.includes("/admin/riders/payouts/cancel/"), "rider payment");
  assert.ok(api.includes("/admin/riders/cash-handovers/cancel/"), "cash hand-in");
});

test("the id sits after the word cancel, never before it", () => {
  // The server's permission list matches on the START of a path, so an address
  // shaped ".../{id}/cancel" could not be given a Main-Admin-only line at all.
  assert.ok(!code(api).includes("}/cancel"), "an id in the middle cannot be guarded");
});

test("the window will not send a cancellation with no reason", () => {
  assert.ok(dialog.includes("reason.trim().length < 3"), "a blank reason must be refused");
  assert.ok(dialog.includes("disabled={tooShort}"), "and the button must be off until there is one");
});

test("the window says plainly that nothing is deleted", () => {
  assert.ok(
    dialog.includes("stays on the list, marked cancelled. Nothing is deleted."),
    "Somebody pressing Cancel must know the payment is not being erased.",
  );
});

test("a cancelled payment is still shown, crossed out, with its reason", () => {
  assert.ok(history.includes("line-through"), "the amount must be struck through");
  assert.ok(history.includes("Cancelled"), "it must be labelled");
  assert.ok(history.includes("cancelReason(h)"), "and it must say why");
});

test("the Cancel button is only drawn for the Main Admin", () => {
  assert.ok(history.includes("canCancel && ("), "the column is behind the check");
  assert.ok(
    page.includes("setCanCancelPayments(getMyPerms().isSuper)"),
    "and the check is the Main Admin flag, not the payments section",
  );
});

test("the totals above the history skip cancelled payments", () => {
  assert.ok(
    page.includes("liveTotal(forThisMethod)"),
    "Adding a cancelled payment into 'paid by cash' is the same wrong number " +
      "the whole fix exists to stop.",
  );
});

test("the downloaded spreadsheet says a payment was cancelled", () => {
  // A CSV that does not say so adds it up as real money the moment somebody
  // drags the Amount column.
  assert.ok(page.includes('label: "Cancelled On"'));
  assert.ok(page.includes('label: "Cancelled Because"'));
});

test("after cancelling, every figure on the page is read again", () => {
  assert.ok(
    page.includes("await apiClient.cancelRestaurantPayout(String(cancelTarget.id), reason);"),
    "the cancel must actually be sent",
  );
  assert.ok(
    /cancelRestaurantPayout[\s\S]{0,600}await fetchData\(\)/.test(page),
    "Every balance on the page was built on that payment, so they must all " +
      "be re-read rather than patched up on screen.",
  );
});

// ── riders ──────────────────────────────────────────────────────────────────

test("the office can finally SEE what riders have been paid", () => {
  // Until this there was no list of rider payments in the panel at all, so a
  // payment typed wrong could not even be found, let alone corrected.
  assert.ok(riderMoney.includes("Money already recorded"));
  assert.ok(riderMoney.includes("getRiderPayoutHistory"));
  assert.ok(riderMoney.includes("getRiderHandoverHistory"));
});

test("a rider row is cancelled by the right call for its kind", () => {
  assert.ok(
    /kind === "payout"[\s\S]{0,200}cancelRiderPayout[\s\S]{0,200}cancelRiderHandover/.test(riderMoney),
    "A cash hand-in cancelled as if it were a payment would move the wrong money.",
  );
});

test("cancelling a rider row re-reads his cash, because it can suspend him", () => {
  // A hand-in reduces the cash he is holding, and too much cash in hand stops
  // him working. Cancelling one puts that cash back in his hands.
  assert.ok(/cancelRiderHandover[\s\S]{0,700}await load\(\)/.test(riderMoney));
});
