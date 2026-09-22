// LETTING A LOCKED-OUT ADMIN BACK IN.  (Mock 110, approved 22 September 2026.)
//
// Found while building Mock 108: an admin password could only ever be set when
// the account was CREATED. No reset endpoint, no field on the PATCH model, no
// button. A forgotten password killed the account outright.
//
// This is the screen's half. The server's half - Main Admin only, never your
// own, always marked, everything signed out - is in
// backend/tests/test_a_locked_out_admin_can_be_let_back_in.py.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeAdminPassword } from "../src/lib/make-admin-password.ts";
import { MIN_ADMIN_PASSWORD, strengthOf } from "../src/lib/password-strength.ts";

const MODAL = readFileSync(
  new URL("../src/components/ResetAdminPasswordModal.tsx", import.meta.url), "utf8");
const USERS = readFileSync(
  new URL("../src/app/dashboard/users/page.tsx", import.meta.url), "utf8");

// ── the password it makes ───────────────────────────────────────────────────

test("what it makes is above the server's bar, every time", () => {
  for (let i = 0; i < 400; i++) {
    const pw = makeAdminPassword();
    assert.ok(pw.length >= MIN_ADMIN_PASSWORD, `too short: ${pw}`);
  }
});

test("what it makes is Strong, every time", () => {
  // A reset that handed out the weakest password the server accepts would be
  // the panel doing the wrong thing by default, several times a month.
  for (let i = 0; i < 400; i++) {
    assert.equal(strengthOf(makeAdminPassword()).word, "Strong");
  }
});

test("the RANDOM part never contains a character people misread", () => {
  // I/l/1 and O/0 are why somebody reads a password down a phone line three
  // times and still gets it wrong.
  //
  // Checked on the random part only, and deliberately so. A whole word is
  // readable BECAUSE it is a word - nobody hears "Olive" and wonders whether
  // that was a zero. It is the four digits and the two loose letters, which
  // are nothing but shapes, where an I or an O costs a phone call.
  for (let i = 0; i < 400; i++) {
    const parts = makeAdminPassword().split("-");
    const random = parts[2] + parts[3];
    assert.ok(!/[Il1O0]/.test(random), `hard to read: ${random}`);
  }
});

test("the words are real words, not shapes", () => {
  for (let i = 0; i < 200; i++) {
    const [a, b] = makeAdminPassword().split("-");
    for (const w of [a, b]) {
      assert.ok(w.length >= 4, `"${w}" is too short to be worth saying`);
      assert.match(w, /^[A-Z][a-z]+$/);
    }
  }
});

test("it can be read out loud", () => {
  // Two words, four digits, two letters. Not "K7MPQR39XB".
  const pw = makeAdminPassword();
  const parts = pw.split("-");
  assert.equal(parts.length, 4);
  assert.match(parts[0], /^[A-Z][a-z]+$/);
  assert.match(parts[1], /^[A-Z][a-z]+$/);
  assert.match(parts[2], /^[2-9]{4}$/);
  assert.equal(parts[3].length, 2);
});

test("the same word is never used twice in one password", () => {
  for (let i = 0; i < 400; i++) {
    const [a, b] = makeAdminPassword().split("-");
    assert.notEqual(a, b);
  }
});

test("two in a row are not the same", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(makeAdminPassword());
  assert.ok(seen.size > 190, "these are barely random");
});

// ── the screen ──────────────────────────────────────────────────────────────

test("it never offers to skip the forced change", () => {
  // A password two people know must not outlive the first sign-in.
  assert.ok(MODAL.includes("checked readOnly disabled"));
  assert.match(MODAL, /cannot be switched off/i);
});

test("it warns that everybody is signed out", () => {
  assert.match(MODAL, /signed out everywhere/i);
});

test("it is honest that the password cannot be read back", () => {
  assert.match(MODAL, /not stored anywhere/i);
  assert.match(MODAL, /reset it again/i);
});

test("the new password can be copied, sent and printed", () => {
  for (const way of ["Copy", "WhatsApp", "Print"]) {
    assert.ok(MODAL.includes(way), `no way to ${way} it`);
  }
});

test("printing opens its own window, not the panel behind it", () => {
  // window.print() here would print the sidebar and whoever else's details are
  // on screen.
  assert.ok(MODAL.includes('window.open("", "_blank"'));
  assert.ok(MODAL.includes('replace(/&/g, "&amp;")'), "the printed text is escaped");
});

test("nothing is left behind when the window shuts", () => {
  assert.ok(MODAL.includes('setPw("")'));
});

// ── the row ─────────────────────────────────────────────────────────────────

test("you cannot reset your OWN password from this screen", () => {
  // Your own is changed from the menu, where the CURRENT one is required.
  // Without that, anybody at an unlocked screen could take the account.
  const at = USERS.indexOf("Reset password");
  const around = USERS.slice(Math.max(0, at - 900), at + 200);
  assert.ok(around.includes("self ?"),
    "the button must be dead on your own row");
});

test("the button is on the Admin Users screen and opens the window", () => {
  assert.ok(USERS.includes("ResetAdminPasswordModal"));
  assert.ok(USERS.includes("setPendingReset(u)"));
});

test("the list is read again afterwards", () => {
  // The account has changed. Leaving the old rows on screen shows a state that
  // is no longer true.
  assert.ok(USERS.includes("onDone={fetchUsers}"));
});
