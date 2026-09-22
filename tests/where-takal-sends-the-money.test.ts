// WHERE TAKAL SENDS A VENDOR HIS MONEY.  (Mock 111, approved 22 Sep 2026.)
//
// Until this there was nowhere in Takal to put a vendor's payout details, and
// a shop could be approved and start taking orders with nobody able to say how
// it would ever be paid.
//
// THE TWO THINGS THAT MUST NOT DRIFT
//   1. NO CNIC IS ASKED FOR. Sana, in plain words: "NO CNIC".
//   2. Typing a number in and READING one back are different powers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAYOUT_METHODS, methodLabel, payoutProblem,
} from "../src/lib/payout-details.ts";
import { SERVER_RULES } from "../src/lib/navigation.ts";

const CARD = readFileSync(
  new URL("../src/components/PayoutDetailsCard.tsx", import.meta.url), "utf8");
const RULES = readFileSync(
  new URL("../src/lib/payout-details.ts", import.meta.url), "utf8");
const SERVER = readFileSync(
  new URL("../../swat-delivery-app/backend/routers/vendor_intake.py", import.meta.url),
  "utf8");

// ── 1. no CNIC ──────────────────────────────────────────────────────────────

test("no field anywhere asks for a CNIC", () => {
  // It may be MENTIONED - the screen tells the office to check the name
  // against his CNIC by eye - but never collected.
  for (const [what, src] of [["the card", CARD], ["the rules", RULES]] as const) {
    assert.ok(!/cnic\s*[:=]|name="cnic"|value={cnic}|setCnic/i.test(src),
      `${what} collects a CNIC`);
  }
});

test("the screen says WHY there is no CNIC field", () => {
  // Otherwise somebody adds one in six months thinking it was an oversight.
  // Whitespace-normalised: JSX wraps a sentence across several lines.
  const flat = CARD.replace(/\s+/g, " ");
  assert.match(flat, /does not keep the CNIC number/i);
});

// ── 2. the rules ────────────────────────────────────────────────────────────

test("a made-up method is refused", () => {
  assert.notEqual(payoutProblem("paypal", "A", "03150000000", ""), "");
  assert.notEqual(payoutProblem("", "A", "03150000000", ""), "");
});

test("the name on the account is required, and it says why", () => {
  assert.match(payoutProblem("easypaisa", "", "03150000000", ""),
    /wrong person/);
});

test("cash in person needs neither a name nor a number", () => {
  assert.equal(payoutProblem("cash", "", "", ""), "");
});

test("an Easypaisa number must look like a mobile", () => {
  assert.notEqual(payoutProblem("easypaisa", "Imran", "0315000000", ""), "");
  assert.equal(payoutProblem("easypaisa", "Imran", "03150000000", ""), "");
  assert.equal(payoutProblem("jazzcash", "Imran", "923150000000", ""), "");
  assert.notEqual(payoutProblem("easypaisa", "Imran", "hello", ""), "");
});

test("spaces and dashes in a number are fine", () => {
  assert.equal(payoutProblem("easypaisa", "Imran", "0315 000 0000", ""), "");
  assert.equal(payoutProblem("easypaisa", "Imran", "0315-000-0000", ""), "");
});

test("a bank transfer must name the bank", () => {
  assert.notEqual(payoutProblem("bank", "Imran", "1234567890", ""), "");
  assert.equal(payoutProblem("bank", "Imran", "1234567890", "HBL"), "");
});

test("a very short bank account is questioned", () => {
  assert.notEqual(payoutProblem("bank", "Imran", "12", "HBL"), "");
});

test("every method the screen offers is one the server knows", () => {
  // Written in two languages, so they are compared rather than trusted.
  const ours = PAYOUT_METHODS.map((m) => m.key).sort();
  const theirs = (SERVER.match(/PAYOUT_METHODS = \(([^)]*)\)/) || [])[1];
  assert.ok(theirs, "the server no longer lists its methods");
  for (const k of ours) {
    assert.ok(theirs!.includes(`"${k}"`), `the server does not know "${k}"`);
  }
  assert.equal(ours.length, (theirs!.match(/"/g) || []).length / 2);
});

test("the words on the screen are the words in the answer", () => {
  assert.equal(methodLabel("easypaisa"), "Easypaisa");
  assert.equal(methodLabel("bank"), "Bank transfer");
  assert.equal(methodLabel("nonsense"), "");
  for (const m of PAYOUT_METHODS) {
    assert.ok(SERVER.includes(`"${m.label}"`),
      `the server calls "${m.key}" something else`);
  }
});

// ── 3. who sees the number ──────────────────────────────────────────────────

test("reaching it needs Stores or Payments, and nothing wider", () => {
  const rule = SERVER_RULES.find(([p]) => p === "/admin/payout-details");
  assert.ok(rule, "the panel does not know what this needs");
  assert.deepEqual(rule![1], ["stores.all", "payments.balances"]);
});

test("a masked number is NEVER put back in the box", () => {
  // "0315 **** 0000" saved back would write the stars into the account and
  // make the shop unpayable - and it would look exactly like it had worked.
  assert.ok(CARD.includes("details?.can_see_full ? (details?.account_number || \"\") : \"\""),
    "the box must start empty for anybody who only sees the masked number");
});

test("somebody who cannot see the number is told to type the whole thing", () => {
  assert.match(CARD, /you are not shown the one/i);
});

test("the number is not left sitting in the page after saving", () => {
  assert.ok(CARD.includes('setNum("");'));
});

test("a refusal shows nothing, never 'no details given'", () => {
  // One is about their own access; the other is a statement about the shop.
  assert.ok(CARD.includes("setDetails(null)"));
  assert.ok(CARD.includes("if (!details) return null;"));
});

// ── 4. the checklist ────────────────────────────────────────────────────────

test("it is the seventh check, and the screen says so", () => {
  assert.match(CARD, /seventh check/i);
  assert.ok(SERVER.includes('"payout",'), "the server no longer counts it");
});

test("a shop with no payout details says it could not be paid", () => {
  assert.match(CARD, /could not be paid/i);
});
