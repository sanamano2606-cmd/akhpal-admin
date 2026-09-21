// ─────────────────────────────────────────────────────────────────────────────
// THE STAFF PAY SCREEN SHOWS WHAT HAS BEEN PAID, AND CAN TAKE BACK A MISTAKE.
//
// Mock 101, approved by Sana on 21 September 2026.
//
// You pay Shafiq Rs 5,000 instead of Rs 500. Until today there was no list of
// what he had been paid, and no way back from it - only editing the database
// by hand, which leaves no record of who changed it or why.
//
// TWO HALVES, AND THEY PULL OPPOSITE WAYS
//   * a cancelled row must STILL BE LISTED - hiding it hides the mistake and
//     whoever made it;
//   * and must be LEFT OUT OF EVERY TOTAL - counting it says money moved when
//     it did not.
// Most of the checks below are about keeping both true at once.
//
// The rule itself is not new. It has governed shop and rider payments since
// 19 September (money audit M3). The two staff tables were the ones left out.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** The file with its comments taken out. A guard that reads its own
 *  explanation guards nothing - CLAUDE.md section 3. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "")
     .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
     .replace(/^\s*\/\/.*$/gm, "");

const api = code(read("src/lib/api-money.ts"));
const hist = code(read("src/app/dashboard/payments/staff/parts-staff-history.tsx"));
const page = code(read("src/app/dashboard/payments/staff/page.tsx"));
const nav = read("src/lib/navigation.ts");

// ─── The panel can reach the three addresses ─────────────────────────────────

test("the panel asks for the history the server has always offered", () => {
  // The endpoint existed since the staff pay screen was built. Nothing in the
  // panel had ever called it, which is the whole reason there was no list.
  assert.ok(api.includes('`/admin/staff/history'), "the history endpoint");
  assert.ok(api.includes("async getStaffMoneyHistory("));
});

test("both kinds of staff money can be cancelled", () => {
  assert.ok(api.includes("/admin/staff/payouts/cancel/"), "a payment out");
  assert.ok(api.includes("/admin/staff/cash-handovers/cancel/"), "a cash hand-in");
});

test("the id is put in the address safely", () => {
  // An id is not always a plain uuid, and a raw one in a path is how a request
  // ends up at a different address than the one intended.
  for (const m of ["cancelStaffPayout", "cancelStaffHandover"]) {
    const i = api.indexOf(`async ${m}(`);
    assert.ok(i > 0, m);
    assert.ok(api.slice(i, i + 300).includes("encodeURIComponent"), m);
  }
});

test("a cancellation carries the one-time key, like every other money write", () => {
  // requestOnce, not request: pressing Cancel twice after an unclear failure
  // must be answered with the first answer, not treated as a second attempt.
  for (const m of ["cancelStaffPayout", "cancelStaffHandover"]) {
    const i = api.indexOf(`async ${m}(`);
    assert.ok(api.slice(i, i + 300).includes("this.requestOnce("), m);
  }
});

// ─── A cancelled row is shown, and not counted ───────────────────────────────

test("the totals skip cancelled rows, through the shared helper", () => {
  // liveTotal is the one place the whole panel does this, so this screen
  // cannot drift away from the server's own answer.
  assert.ok(hist.includes("liveTotal("), "totals must use liveTotal");
  assert.ok(!/\.reduce\(/.test(hist),
    "no hand-rolled total here - it would count cancelled rows");
});

test("a cancelled row is still drawn, struck through, with its reason", () => {
  assert.ok(hist.includes("isCancelled(r)"), "the row must know it is cancelled");
  assert.ok(hist.includes("line-through"), "shown struck through, not hidden");
  assert.ok(hist.includes("void_reason"), "the reason is the point of keeping it");
  assert.ok(hist.includes("voided_at"), "and when it was cancelled");
});

test("the list is never filtered down to live rows only", () => {
  // The one edit that would quietly undo half of this: filtering cancelled
  // rows out of the list instead of out of the totals.
  assert.ok(!/filter\([^)]*isCancelled/.test(hist),
    "cancelled rows must not be filtered out of the LIST");
});

test("a cancelled row offers no second Cancel button", () => {
  // The server refuses it with a 409 anyway. A button that always fails is a
  // button somebody presses twice and then reports as broken.
  assert.ok(hist.includes("canCancel && !off"),
    "the button must be hidden once the row is already cancelled");
});

// ─── A failed read is never read as "nothing has been paid" ──────────────────

test("a refused or failed read shows an error, not an empty history", () => {
  // On the screen where somebody decides what is still owed, "nothing has been
  // paid" and "we could not read what has been paid" must never look the same.
  assert.ok(hist.includes("readFailure(err,"), "the failure must be captured");
  assert.ok(hist.includes("<ErrorState"), "...and shown as an error");
  const i = hist.indexOf("<ErrorState");
  const j = hist.indexOf("<EmptyState");
  assert.ok(i > 0 && j > 0 && i < j,
    "the error branch must come BEFORE the empty-list branch");
  assert.ok(hist.includes("onRetry={load}"), "and offer to try again");
});

// ─── After a cancellation, both screens move ─────────────────────────────────

test("cancelling re-reads the history AND the pay run behind it", () => {
  // "Already paid" and "to pay" both move the moment a cancellation is made.
  // Re-reading only this window leaves the table underneath showing the
  // mistake as money paid until somebody presses Refresh.
  const i = hist.indexOf("onConfirm=");
  const body = hist.slice(i, i + 2000);
  assert.ok(body.includes("await load()"), "the history must be re-read");
  assert.ok(body.includes("onChanged()"), "and the pay run behind it");
  assert.ok(page.includes("onChanged={() => { load(); }}"),
    "the page must answer that by reloading");
});

test("a FAILED cancellation also re-reads the figures", () => {
  // It may well have gone through. Deciding from a stale list is the fault
  // this screen exists to prevent.
  const i = hist.indexOf("catch (err)", hist.indexOf("onConfirm="));
  assert.ok(i > 0, "the cancel must have a catch");
  assert.ok(hist.slice(i, i + 400).includes("await load().catch("),
    "a failure must still re-read the list");
});

// ─── Only the Main Admin sees the button ─────────────────────────────────────

test("the Cancel button is drawn only for the Main Admin", () => {
  assert.ok(page.includes("getMyPerms().isSuper"),
    "the Main Admin flag decides it, not the payments section");
  assert.ok(page.includes("canCancel={canCancelPayments}"));
});

test("the two addresses are Main-Admin-only in the panel's copy of the rules", () => {
  // The panel keeps a copy of the server's rule list so the sidebar can grey
  // out what an account cannot open. A copy that says something is allowed
  // when the server refuses it is a screen that looks broken.
  assert.ok(nav.includes('["/admin/staff/payouts/cancel", "__super__"]'));
  assert.ok(nav.includes('["/admin/staff/cash-handovers/cancel", "__super__"]'));
  // ORDER. The first matching prefix wins, exactly as on the server.
  assert.ok(nav.indexOf('"/admin/staff/payouts/cancel"')
            < nav.indexOf('["/admin/staff", "payments.staff"]'),
    "listed below /admin/staff these two lines would never be reached");
});

// ─── The button is on the screen, and nothing was taken away ─────────────────

test("History is offered on every staff row, terms set or not", () => {
  // Somebody with no pay terms can still have been paid - that is exactly the
  // person whose history somebody goes looking for.
  assert.equal((page.match(/onClick=\{\(\) => setHistoryFor\(r\)\}/g) || []).length, 3,
    "History belongs on both branches of the pay table and on the cash table");
});

test("Record payment, Terms and Record handover are untouched", () => {
  // The mock says so in words: nothing is taken away.
  assert.ok(page.includes("openPay(r)"));
  assert.ok(page.includes("openTerms(r)"));
  assert.ok(page.includes("openHandover(r)"));
});

test("the cancel window is the SAME one the shop and rider payments use", () => {
  // One way to cancel a payment, one set of words, one place the reason is
  // insisted on. A second copy is how the two drift apart.
  assert.ok(hist.includes("CancelPaymentDialog"));
  assert.ok(hist.includes('from "@/app/dashboard/payments/parts-cancel-dialog"'));
});
