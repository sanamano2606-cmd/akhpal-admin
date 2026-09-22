// EVERY ADMIN CAN CHANGE THEIR OWN PASSWORD.  (Mock 108 v2.)
//
// Sana, 22 September 2026, about the sub-admin she had created that morning:
//     "And there is no Option for him to change his Password."
//
// She was right. The SERVER has had this door since the beginning - the
// ten-character bar, the fifteen-minute lock after five wrong tries, the audit
// line on every wrong try. The PANEL never had a screen for it, so no admin has
// ever changed their own password, and every sub-admin is using one that
// somebody else typed and then had to say out loud.
//
// WHAT IS CHECKED HERE
//   * the meter tells the truth, and never refuses what the server accepts;
//   * the Save rule catches, in the browser, only the things a round trip
//     would waste time discovering;
//   * the screen exists, is reachable, and is LOCKED SHUT on a first sign-in;
//   * an absent must_change_password never traps anybody.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MIN_ADMIN_PASSWORD, STRONG_LENGTH, strengthOf, whyNotSave,
} from "../src/lib/password-strength.ts";

const MODAL = readFileSync(
  new URL("../src/components/ChangePasswordModal.tsx", import.meta.url), "utf8");
const LAYOUT = readFileSync(
  new URL("../src/app/dashboard/layout.tsx", import.meta.url), "utf8");
const API = readFileSync(
  new URL("../src/lib/api-people.ts", import.meta.url), "utf8");

// ── the meter ───────────────────────────────────────────────────────────────

test("below the server's bar is Too short", () => {
  assert.equal(strengthOf("").step, 0);
  assert.equal(strengthOf("short").step, 0);
  assert.equal(strengthOf("a".repeat(MIN_ADMIN_PASSWORD - 1)).word, "Too short");
});

test("exactly the server's bar is NOT refused", () => {
  // The whole point. A meter that says "no" to something the server says "yes"
  // to is the panel lying about the person's own account.
  const at = strengthOf("a".repeat(MIN_ADMIN_PASSWORD));
  assert.notEqual(at.step, 0);
  assert.equal(at.word, "Could be stronger");
});

test("long AND mixed is Strong", () => {
  assert.equal(strengthOf("Takal-Swat-2026!").word, "Strong");
  assert.equal(strengthOf("Kx7m-2026-Swat!!").step, 2);
});

test("long but all one kind is not Strong", () => {
  assert.equal(strengthOf("a".repeat(STRONG_LENGTH + 6)).word, "Could be stronger");
});

test("mixed but short is not Strong", () => {
  // 13 characters, every kind present. Length still decides.
  const pw = "Ab3!Ab3!Ab3!x";
  assert.equal(pw.length, STRONG_LENGTH - 1);
  assert.equal(strengthOf(pw).word, "Could be stronger");
});

test("nothing at all does not throw", () => {
  assert.equal(strengthOf(undefined as unknown as string).step, 0);
});

// ── the Save rule ───────────────────────────────────────────────────────────

const GOOD = "Takal-Swat-2026!";

test("a good change is allowed", () => {
  assert.equal(whyNotSave("old-one-here", GOOD, GOOD), "");
});

test("each thing that stops it says which thing", () => {
  assert.match(whyNotSave("", GOOD, GOOD), /current password/i);
  assert.match(whyNotSave("old-one-here", "short", "short"), /10 characters/);
  assert.match(whyNotSave("old-one-here", GOOD, ""), /again/i);
  assert.match(whyNotSave("old-one-here", GOOD, GOOD + "x"), /not the same/i);
});

test("the new password cannot be the old one", () => {
  // Otherwise "change your password" is satisfied by typing it again, and the
  // password two people know survives the very screen built to end it.
  assert.match(whyNotSave(GOOD, GOOD, GOOD), /same as the old/i);
});

test("the current password is never judged, only required", () => {
  // Five wrong tries lock the account. A browser that thought it knew whether
  // the current password was right could hand somebody a lock-out without the
  // server ever being asked.
  assert.equal(whyNotSave("x", GOOD, GOOD), "");
});

// ── the screen ──────────────────────────────────────────────────────────────

test("it is reachable from the menu, beside Logout", () => {
  assert.ok(LAYOUT.includes("ChangePasswordModal"));
  assert.ok(LAYOUT.includes("Change password"));
});

test("a first sign-in cannot be dismissed", () => {
  // lockClose is what takes away the X, Escape and the click outside.
  assert.ok(MODAL.includes("lockClose={forced}"));
  // ...and the Cancel button is not drawn at all.
  assert.ok(MODAL.includes("{!forced && ("));
});

test("an absent must_change_password never traps anybody", () => {
  // A server deployed ahead of migration 095 answers without the key at all.
  // `undefined` must read as "not forced" - never as a window with no way out.
  assert.ok(
    LAYOUT.includes("me.must_change_password === true"),
    "the check must be strictly true, not merely truthy",
  );
});

test("it stops being forced the moment it is done", () => {
  // Otherwise somebody who has just done exactly as they were asked is left
  // inside a window with no Close.
  assert.ok(LAYOUT.includes("setPwForced(false)"));
});

test("nothing typed is kept after the window closes", () => {
  assert.ok(MODAL.includes("if (!open)"));
  assert.ok(MODAL.includes('setCurrent(""); setNext(""); setAgain("");'));
});

test("the server's own sentence is shown, not a vaguer one", () => {
  // "5 attempt(s) left before a 15-minute lock" is the only warning anybody
  // gets before the account locks.
  assert.ok(MODAL.includes("e?.message ||"));
});

// ── the call ────────────────────────────────────────────────────────────────

test("it calls the server's own door and keeps the fresh token", () => {
  assert.ok(API.includes("/auth/change-password"));
  assert.ok(API.includes("current_password"));
  assert.ok(API.includes("new_password"));
  // Changing the password revokes the token this tab is holding. Without
  // storing the new one, doing the right thing throws you back to the login
  // page.
  assert.ok(API.includes('localStorage.setItem("admin_token", out.token)'));
});

test("changeMyPassword only ever changes YOUR OWN", () => {
  // The METHOD, not the first mention of the name - Mock 110 added
  // resetAdminPassword just above it, whose comment names this one, and a
  // looser search walked straight into the wrong function.
  const at = API.indexOf("async changeMyPassword(");
  assert.notEqual(at, -1, "changeMyPassword has been renamed or removed");
  const mine = API.slice(at, at + API.slice(at).indexOf("\n  }"));
  assert.ok(!/user_id|userId|\/admin\/users\//.test(mine),
    "this call must only ever change the password of whoever is signed in");
});

test("resetting somebody ELSE's password is a separate, Main-Admin-only call", () => {
  // Mock 110. Two different doors on purpose: this one needs no current
  // password, so it must never be reachable by anybody but the Main Admin.
  const at = API.indexOf("async resetAdminPassword(");
  assert.notEqual(at, -1, "there is no way to let a locked-out admin back in");
  const body = API.slice(at, at + API.slice(at).indexOf("\n  }"));
  assert.ok(body.includes("/admin/users/${userId}/reset-password"));
  assert.ok(body.includes('method: "POST"'));
  // It SENDS the password and keeps nothing. The answer is handed straight
  // back without being held in a variable or written anywhere, so the plain
  // password never reaches a cache, a log or localStorage from here.
  assert.ok(body.includes("return this.request("),
    "the answer must be returned directly");
  assert.ok(!/\bconst\b|\bawait\b/.test(body),
    "nothing may hold the answer - it is handed straight back");
  assert.ok(!body.includes("localStorage"),
    "a reset password must never be written to the browser");
});
