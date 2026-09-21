// SWITCHING AN ADMIN OFF, INSTEAD OF DELETING THEM.  (Mock 100.)
//
// Sana, 20 September 2026: "Do the switch off."
//
// Until today this screen had ONE lever - Delete - and Delete cannot be undone.
// Somebody away for a month could only be left fully working, or deleted and
// rebuilt with every permission ticked again.
//
// The server could already switch an account off, and already recorded it. What
// it could not do was refuse the two cases that matter - your own account, and
// the last Main Admin - both of which DELETE has refused since the day it was
// written. Those refusals now exist on the server, and are checked in
// backend/tests/test_an_admin_can_be_switched_off_not_only_deleted.py.
//
// These checks are the screen's half: that it asks the same two questions
// BEFORE the click, and that it never quietly does the opposite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isWorking, mainAdminsStillIn, whyNotSwitchOff, canSwitchOn,
} from "../src/lib/admin-accounts.ts";

const PAGE = readFileSync(
  new URL("../src/app/dashboard/users/page.tsx", import.meta.url), "utf8");

const SANA = { id: "main-1", is_super_admin: true, is_active: true };
const SECOND_OWNER = { id: "main-2", is_super_admin: true, is_active: true };
const SHAFIQ = { id: "sub-1", is_super_admin: false, is_active: true };

// ── Reading whether somebody is working ────────────────────────────────────

test("an account with nothing saved counts as WORKING", () => {
  // Reading a missing value as "off" would have shown every admin created
  // before today as switched off, on the morning this shipped.
  assert.equal(isWorking({ id: "x" }), true);
  assert.equal(isWorking({ id: "x", is_active: true }), true);
  assert.equal(isWorking({ id: "x", is_active: false }), false);
});

// ── The two refusals ───────────────────────────────────────────────────────

test("you cannot switch off your own account", () => {
  const why = whyNotSwitchOff(SANA, "main-1", [SANA, SECOND_OWNER, SHAFIQ]);
  assert.ok(why, "the screen would have let her lock herself out");
  assert.match(why!, /your own account/);
  assert.match(why!, /locked out/);
});

test("you cannot switch off the last Main Admin who can sign in", () => {
  const why = whyNotSwitchOff(SANA, "someone-else", [SANA, SHAFIQ]);
  assert.ok(why);
  assert.match(why!, /last Main Admin/);
});

test("A MAIN ADMIN ALREADY SWITCHED OFF IS NOT COVER", () => {
  // The one a simple count gets wrong. Two Main Admins exist; one is already
  // off. Counting all of them says "there are two, go ahead" - and the result
  // is a company with nobody who can sign in.
  const alreadyOff = { ...SECOND_OWNER, is_active: false };
  assert.equal(mainAdminsStillIn([SANA, alreadyOff]), 1);
  const why = whyNotSwitchOff(SANA, "someone-else", [SANA, alreadyOff]);
  assert.ok(why, "the second-to-last Main Admin was allowed to go too");
  assert.match(why!, /last Main Admin/);
});

// ── What must still work ───────────────────────────────────────────────────

test("a sub-admin can be switched off", () => {
  assert.equal(whyNotSwitchOff(SHAFIQ, "main-1", [SANA, SHAFIQ]), null);
});

test("a SECOND Main Admin can be switched off", () => {
  // The lock is about the last one, not about Main Admins in general.
  assert.equal(
    whyNotSwitchOff(SECOND_OWNER, "main-1", [SANA, SECOND_OWNER, SHAFIQ]), null);
});

test("switching somebody back ON is never refused", () => {
  // Refusing that would be a way to lock a person out for good by accident.
  assert.equal(canSwitchOn(), true);
});

test("nobody is blocked just because the signed-in id is not known yet", () => {
  // currentAdminId is empty for a moment while the page loads. An empty id
  // matches nobody - it must not match EVERYBODY.
  assert.equal(whyNotSwitchOff(SHAFIQ, "", [SANA, SHAFIQ]), null);
});

// ── The screen itself ──────────────────────────────────────────────────────

test("the screen asks the shared rule, and keeps no copy of its own", () => {
  assert.ok(PAGE.includes("whyNotSwitchOffRule"),
    "the screen has stopped asking the shared rule");
  assert.equal(PAGE.includes("is_active !== false"), false,
    "the screen reads is_active its own way somewhere - one rule, one place");
});

test("switching off asks first; switching on does not", () => {
  // Switching somebody ON is not a question worth a window: it gives access
  // back, and the worst case is one extra click to undo.
  assert.ok(PAGE.includes("setPendingOff(u) : setWorking(u, true)"),
    "the confirm window is on the wrong one of the two");
  assert.ok(PAGE.includes("Yes, switch off"));
});

test("the confirm window says the three things that stop it looking like Delete", () => {
  assert.ok(PAGE.includes("very next click"), "it does not say WHEN it bites");
  assert.ok(PAGE.includes("Nothing is lost."), "it does not say the permissions are kept");
  assert.ok(PAGE.includes("switch them back on at any time"), "it does not say it can be undone");
  assert.ok(PAGE.includes("Audit Log"), "it does not say the change is recorded");
});

test("the Delete window now points at the gentler lever", () => {
  assert.ok(PAGE.includes("If you only want to stop them"),
    "Delete is still offered as if it were the only choice");
  // and Delete is still there - this change takes nothing away
  assert.ok(PAGE.includes("Yes, delete the account"));
});

test("the reason is shown on the row, not hidden in a tooltip only", () => {
  // A greyed-out button with no words beside it is a screen arguing with you.
  assert.ok(PAGE.includes("{why}"), "the reason is never printed on the row");
});
