// ─────────────────────────────────────────────────────────────────────────────
// "CREATE A STORE" — THE SAME FORM THE VENDOR APP HAS.
//
// Mock 74 (approved 15 September 2026) and Mock 75, Option A (approved
// 16 September 2026): a store made in the office asks for everything the
// vendor app's sign-up asks for, a mall is one login with one shop per kind,
// and a shop can be added to a vendor who already has a login.
//
// These checks pin the vendor app's rules as the form uses them, and read the
// form's own file so the sections cannot quietly disappear.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const form = read("src/app/dashboard/stores/parts-create-store.tsx");

// The helpers are plain functions; load them without React by cutting them out
// of the file (the page itself cannot be imported by node's test runner).
function helper<T>(name: string): T {
  const start = form.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = form.indexOf("\n}\n", start) + 2;
  const body = form.slice(start, end)
    .replace("export function", "function")
    .replace(/\): string \| null \{/, ") {")
    .replace(/\): string \{/, ") {")
    .replace(/\(([a-zA-Z]+): string\)/, "($1)");
  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return ${name};`)() as T;
}

test("the phone rule is the vendor app's rule, and the saved number has no spaces", () => {
  const problem = helper<(p: string) => string | null>("phoneProblem");
  const saved = helper<(p: string) => string>("savedPhone");
  assert.equal(problem("0300 1234567"), null);
  assert.equal(problem("(0300) 123-4567"), null);
  assert.equal(problem("+92 300 123 4567"), null);
  assert.ok(problem(""));
  assert.ok(problem("12345"));
  assert.ok(problem("0300abc4567"));
  assert.equal(saved("0300 123-4567"), "03001234567");
  assert.equal(saved("+92 300 1234567"), "+923001234567");
});

test("the password rule is the vendor app's rule", () => {
  const problem = helper<(p: string) => string | null>("passwordProblem");
  assert.equal(problem("City26"), null);
  assert.ok(problem("12345678"), "a password with no letter is refused");
  assert.ok(problem("ab1"), "a short password is refused");
});

test("a made-up password always passes that rule and has no look-alike letters", () => {
  const make = helper<() => string>("makePassword");
  const problem = helper<(p: string) => string | null>("passwordProblem");
  for (let i = 0; i < 200; i++) {
    const p = make();
    assert.equal(p.length, 10);
    assert.equal(problem(p), null);
    assert.match(p, /\d/);
    assert.doesNotMatch(p, /[01OI]/);
  }
});

test("WhatsApp gets the number in international form", () => {
  const wa = helper<(p: string) => string>("whatsappNumber");
  assert.equal(wa("03001234567"), "923001234567");
  assert.equal(wa("+923001234567"), "923001234567");
});

test("the cuisine list is the vendor app's list, value for value", () => {
  const dart = (() => {
    try {
      return readFileSync(new URL(
        "../../swat-delivery-app/restaurant_app/lib/data/cuisine_options.dart", import.meta.url), "utf8");
    } catch { return ""; }
  })();
  const inForm = [...form.matchAll(/value: "([a-z ]+)", label: "[^"]+", emoji/g)].map((m) => m[1]);
  assert.equal(inForm.length, 11);
  if (dart) {
    const inApp = [...dart.matchAll(/'value': '([a-z ]+)'/g)].map((m) => m[1]);
    assert.deepEqual(inForm, inApp, "the two cuisine lists have drifted");
  }
});

test("every section of the vendor app's sign-up is on the form", () => {
  for (const words of [
    "Owner Details", "Full Name *", "Email Address (Optional)", "Phone Number *",
    "Password *", "Confirm Password *", "Shop Logo / Picture", "Description (optional)",
    "Cuisine Type *", "Min Order (Rs)", "Opens at", "Closes at",
    "Open 24 hours",
  ]) {
    assert.ok(form.includes(words), `"${words}" is missing from the form`);
  }
  // Where the shop is: ONE box - search, pin and address (Mock 85).
  assert.equal((form.match(/<ShopLocationBox/g) || []).length, 2,
    "one Shop location box for a single shop, one for a mall");
  assert.ok(!form.includes("Full Address *"), "the separate address box is back");
  assert.ok(!form.includes("Use this map point for the address"));
});

test("a mall makes one shop per kind, and an existing vendor can be picked", () => {
  assert.match(form, /This vendor sells many kinds of things/);
  assert.match(form, /shops = picked\.map\(/);
  assert.match(form, /existing_owner_id: vendor\.id/);
  assert.match(form, /apiClient\.findVendors\(/);
});

test("open 24 hours sends the same time twice, as the vendor app does", () => {
  assert.match(form, /opening_time: open24 \? "00:00" : openTime/);
  assert.match(form, /closing_time: open24 \? "00:00" : closeTime/);
});

test("the form cannot be sent twice, and typed details are not lost by a stray click", () => {
  assert.match(form, /if \(saving\) return;/);
  assert.match(form, /step !== 2\) close\(\)/);
});

test("a shop made here waits for approval, like a shop made in the vendor app", () => {
  // Sana, 16 September 2026: "every shop go for approval first from admin if
  // made OR add by Vendor app".
  assert.ok(!form.includes("Approved at once"), "the form must not promise approval");
  assert.ok(!form.includes("created and approved"), "the done screen must not say approved");
  assert.ok(form.includes("Waits for approval"));
  assert.ok(form.includes("waiting for approval"));
  assert.ok(form.includes("Stores → Pending"), "it says where to approve it");
  assert.ok(form.includes("Open for orders once approved"));
  assert.ok(form.includes("will go live after Takal approves"), "the WhatsApp message says so too");
});

test("re-check against Mock 74/75: the details the mock shows are all there", () => {
  // One section for one shop, in the vendor app's order.
  assert.ok(form.includes('single === "restaurant" ? "Restaurant Details" : "Shop Details"'));
  assert.ok(!form.includes('"About the Shop"'), "the single shop is no longer split in two");
  // The mall rows name their commission.
  assert.ok(form.includes("Commission: {verticalLabel(v)} rate"));
  // The chosen vendor is marked.
  assert.ok(form.includes("✓ Selected"));
  // The last step of a single shop: type, hours, and the store page.
  assert.ok(form.includes(">Shop type<"));
  assert.ok(form.includes(">Hours<"));
  assert.ok(form.includes("Open the store page"));
  assert.ok(form.includes("Copy phone and password"));
  // The red marks follow the typing after the first try.
  assert.ok(form.includes("if (tried && step === 2) setErrors(check());"));
});

test("the fix-count sentence reads properly", () => {
  const start = form.indexOf("export function thingsToFix(");
  const body = form.slice(start, form.indexOf("\n}\n", start) + 2)
    .replace("export function", "function")
    .replace("(n: number): string {", "(n) {");
  // eslint-disable-next-line no-new-func
  const f = new Function(`${body}; return thingsToFix;`)() as (n: number) => string;
  assert.equal(f(1), "1 thing needs fixing");
  assert.equal(f(4), "4 things need fixing");
  assert.ok(!form.includes("thing(s)"));
});
