/**
 * ADMIN AUDIT - LOW ITEMS, FIRST GO (Sana, 6 October 2026: "OK").
 *
 *   item 1   Rs 0 is not a refund; a cancelled order never paid has nothing
 *            to give back - and the button is not offered for it
 *   item 2   paying more than is owed asks first; staff Rs 0 is refused too
 *   item 10  the admin email is sent without spaces, and "too many tries" is
 *            said in words
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  refundAmountProblem, alreadyRefunded, cancelledBeforePayment, mayRecordRefund,
} from "../src/lib/refund-rules.ts";
import { overOwedSentence } from "../src/lib/over-owed.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-US")}`;

// ── item 1 ──────────────────────────────────────────────────────────────────
test("Rs 0, nothing, or a negative is not a refund", () => {
  for (const n of [0, -5, NaN]) assert.match(refundAmountProblem(n, 800, rs), /Rs 0 records nothing/);
  assert.equal(refundAmountProblem(300, 800, rs), "");
  assert.match(refundAmountProblem(900, 800, rs), /came to Rs 800/);
});

test("an old Rs 0 refund that charged nobody does not count as refunded", () => {
  assert.equal(alreadyRefunded({ refunded: true, refund_amount: 0 }), false);
  assert.equal(alreadyRefunded({ refunded: true, refund_amount: "0.00" }), false);
  assert.equal(alreadyRefunded({ refunded: true, refund_amount: 200 }), true);
  assert.equal(alreadyRefunded({ refunded: true, refund_amount: null }), true);
  assert.equal(alreadyRefunded({ refunded: true, refund_amount: 0, refund_charged_to: "rider" }), true);
});

test("the Refund button is not offered on a cancelled order nobody paid for", () => {
  assert.equal(cancelledBeforePayment({ status: "cancelled", payment_status: "unpaid" }), true);
  assert.equal(mayRecordRefund({ status: "cancelled", payment_status: "unpaid" }), false);
  assert.equal(mayRecordRefund({ status: "cancelled", payment_status: "paid" }), true);
  assert.equal(mayRecordRefund({ status: "delivered", payment_status: "paid" }), true);
});

test("the order window uses the rules, not its own", () => {
  const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
  assert.match(panel, /const problem = refundAmountProblem\(amt, paid, money\);/);
  assert.match(panel, /\{mayRecordRefund\(o\) && \(/);
  assert.doesNotMatch(panel, /amt < 0\)/);
});

test("the panel and the server say the same thing about Rs 0", () => {
  const server = readFileSync(join(root, "..", "swat-delivery-app", "backend", "routers", "admin_orders.py"), "utf8");
  assert.ok(server.includes("A refund of \"\n                          \"Rs 0 records nothing.") ||
            server.includes("Rs 0 records nothing."));
});

// ── item 2 ──────────────────────────────────────────────────────────────────
test("more than is owed is named with both figures", () => {
  assert.equal(overOwedSentence(3000, 3000, rs, "Cupbar"), "");
  assert.equal(overOwedSentence(2000, 3000, rs, "Cupbar"), "");
  assert.equal(overOwedSentence(30000, 3000, rs, "Cupbar"),
    "Rs 30,000 is Rs 27,000 more than Cupbar is owed (Rs 3,000). Press again to record it anyway.");
  assert.match(overOwedSentence(500, 0, rs, "Imran"), /^Nothing is owed to Imran right now/);
  assert.match(overOwedSentence(900, 400, rs, "Imran", "held"), /more than Imran is holding \(Rs 400\)/);
  assert.equal(overOwedSentence(0, 100, rs, "x"), "", "Rs 0 is refused elsewhere, not here");
});

test("all five money windows ask first, and wait for the second press", () => {
  const files = {
    rider: read("src/domains/riders/RiderMoney.tsx"),
    shop: read("src/app/dashboard/payments/page.tsx"),
    shopDialog: read("src/app/dashboard/payments/parts-store-dialog.tsx"),
    staff: read("src/app/dashboard/payments/staff/page.tsx"),
  };
  for (const [name, src] of [["rider", files.rider], ["staff", files.staff]] as const) {
    assert.match(src, /if \(!payOver\.mayGo\(\)\) return;/, `${name} pay`);
    assert.match(src, /if \(!handOver\.mayGo\(\)\) return;/, `${name} cash in`);
    assert.match(src, /<OverOwedNote over=\{payOver\} \/>/, `${name} pay note`);
    assert.match(src, /<OverOwedNote over=\{handOver\} \/>/, `${name} cash note`);
  }
  assert.match(files.shop, /if \(!payOver\.mayGo\(\)\) return;/);
  assert.match(files.shop, /payOver=\{payOver\}/);
  assert.match(files.shopDialog, /<OverOwedNote over=\{payOver\} \/>/);
});

test("the second press is what saves: the first only shows the warning", () => {
  const hook = read("src/components/OverOwedNote.tsx");
  assert.match(hook, /if \(!sentence \|\| shown\) return true;\s*setShown\(true\);\s*return false;/);
  // a new amount asks again
  assert.match(hook, /useEffect\(\(\) => \{\s*setShown\(false\);\s*\}, \[sentence\]\);/);
});

test("staff money boxes start at Rs 1, like every other money box", () => {
  const staff = read("src/app/dashboard/payments/staff/page.tsx");
  assert.match(staff, /<input type="number" min=\{1\} step=\{1\} value=\{amount\} required/);
  // (the pay-TERMS boxes may still be 0 - a salary of 0 is a real setting)
  assert.doesNotMatch(staff, /min=\{0\} step=\{1\} value=\{amount\}/);
});

// ── item 10 ─────────────────────────────────────────────────────────────────
test("admin sign-in: spaces off, and too many tries said in words", () => {
  const login = read("src/app/auth/login/page.tsx");
  assert.match(login, /body = \{ email: email\.trim\(\), password, role: "admin" \};/);
  assert.match(login, /response\.status === 429\s*\?\s*"Too many tries\. Please wait one minute and try again\."/);
});
