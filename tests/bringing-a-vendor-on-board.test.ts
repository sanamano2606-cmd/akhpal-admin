// BRINGING A VENDOR ON BOARD.  (Mock 109, approved by Sana 22 September 2026.)
//
// Sana hired Muhammad Ilyas Khan for one job, and nothing in the panel was
// built for it. These checks are the screen's half of the fix. The server's
// half - the six rules and the refusals - is checked in
// backend/tests/test_a_shop_knows_when_it_is_finished.py.
//
// The two things that MUST NOT drift:
//   * this page gives him no power he did not already have;
//   * "Send for approval" approves nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SERVER_RULES, NAVIGATION } from "../src/lib/navigation.ts";

const PAGE = readFileSync(
  new URL("../src/app/dashboard/stores/onboarding/page.tsx", import.meta.url),
  "utf8");
const API = readFileSync(
  new URL("../src/lib/api-stores.ts", import.meta.url), "utf8");
const CREATE = readFileSync(
  new URL("../src/app/dashboard/stores/parts-create-store.tsx", import.meta.url),
  "utf8");

// ── the permission ──────────────────────────────────────────────────────────

test("the page needs the SAME permission as All Stores, and no more", () => {
  const rule = SERVER_RULES.find(([p]) => p === "/admin/vendor-intake");
  assert.ok(rule, "the panel does not know what this page needs");
  assert.equal(rule![1], "stores.all");
});

test("it is on the Stores tab, behind that permission", () => {
  const stores = NAVIGATION.find((n) => n.label === "Stores");
  const tab = stores?.tabs?.find((t) => t.label === "Onboarding");
  assert.ok(tab, "there is no way to reach the page");
  assert.equal(tab!.section, "stores.all");
  assert.equal(tab!.href, "/dashboard/stores/onboarding");
});

test("approving is still a DIFFERENT permission", () => {
  // The whole safety of the arrangement. The person who signs a vendor up is
  // never the person who approves him, and never the one who prices him.
  const approve = SERVER_RULES.find(([p]) => p === "/admin/restaurants/*/approve");
  assert.equal(approve![1], "stores.approve");
  const money = SERVER_RULES.find(([p]) => p === "/admin/restaurants/*/commission");
  assert.equal(money![1], "stores.money");
});

// ── the page ────────────────────────────────────────────────────────────────

test("the Send button is off until every check is done", () => {
  assert.ok(PAGE.includes("disabled={!list.ready}"),
    "a half-made shop must not be sendable");
});

test("there is no way round the checks on this screen either", () => {
  for (const word of ["force", "sendAnyway", "skipChecks", "override"]) {
    assert.ok(!PAGE.includes(word), `the page must not offer ${word}`);
  }
});

test("the page says plainly that sending approves nothing", () => {
  assert.match(PAGE, /approves nothing/i);
  assert.match(PAGE, /Approve shops/);
});

test("all four states are drawn", () => {
  // DESIGN-SYSTEM.md section 7: loading, empty, error-with-retry, content.
  for (const part of ["LoadingState", "EmptyState", "ErrorState"]) {
    assert.ok(PAGE.includes(part), `${part} is missing`);
  }
  assert.ok(PAGE.includes("onRetry"));
});

test("a failed read never becomes 'you have not started any shops'", () => {
  // One is about the connection. The other is a statement about his work.
  const empty = PAGE.indexOf("No shops yet");
  const err = PAGE.indexOf("<ErrorState");
  assert.ok(err !== -1 && empty !== -1 && err < empty,
    "the error must be shown INSTEAD of the empty state, not beside it");
});

test("a refusal with no retry offers no Retry button", () => {
  assert.ok(PAGE.includes("error.denied ? undefined : load"),
    "trying again cannot fix a permission refusal");
});

test("the server's own refusal sentence is shown", () => {
  // It NAMES what is still missing. Replacing it with something vaguer throws
  // away the only useful part.
  assert.ok(PAGE.includes('e?.message || "Could not send it just now."'));
});

test("the progress bar is only green when everything is done", () => {
  // An almost-finished shop is not a finished shop, and a green bar says it is.
  assert.ok(PAGE.includes("done === total ? \"bg-takal-green\""));
});

// ── the calls ───────────────────────────────────────────────────────────────

test("the three calls exist and point at the right addresses", () => {
  assert.ok(API.includes("/admin/vendor-intake/my-shops"));
  assert.ok(API.includes("/admin/vendor-intake/shop/${restaurantId}"));
  assert.ok(API.includes("/admin/vendor-intake/shop/${restaurantId}/submit"));
});

test("sending is a POST, never a cached read", () => {
  const body = API.slice(API.indexOf("submitShopForApproval"));
  assert.ok(body.slice(0, 300).includes('method: "POST"'));
});

// ── what the shopkeeper is handed  (part C) ─────────────────────────────────

test("the message tells him where to GET the app", () => {
  // Without it he has a password and nowhere to type it, and his first move is
  // to ring whoever signed him up.
  assert.ok(CREATE.includes("VENDOR_APP_LINK"));
  assert.ok(CREATE.includes("Get the app:"));
});

test("the message tells him to change the password", () => {
  assert.match(CREATE, /change this password the first time/i);
});

test("the message names a person to contact", () => {
  assert.ok(CREATE.includes("helperLine"));
  assert.ok(CREATE.includes("Any problem, contact"));
});

test("a made-up placeholder phone is never sent to a vendor", () => {
  // Admin accounts made without a phone carry "admin-b21a92803528". Sending
  // that to a shopkeeper as a contact number is worse than sending nothing.
  assert.ok(CREATE.includes("/^[0-9+][0-9\\s-]{6,}$/"),
    "the helper's phone must be checked before it is sent to anybody");
});

test("it can be printed for a shopkeeper with no smartphone", () => {
  assert.ok(CREATE.includes("printLogin"));
  // NOT window.print() on this page - that prints the panel behind the box,
  // including whoever else's details are on screen.
  assert.ok(!CREATE.includes("window.print()\n"));
  assert.ok(CREATE.includes('window.open("", "_blank"'));
});

test("the printed page escapes what it prints", () => {
  assert.ok(CREATE.includes('replace(/&/g, "&amp;")'));
});

test("the panel is honest that the password cannot be read back", () => {
  assert.match(CREATE, /nobody can read it back/i);
});
