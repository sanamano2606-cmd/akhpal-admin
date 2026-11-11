// ─────────────────────────────────────────────────────────────────────────────
// FIX 11 (All Stores audit; Sana 11 Nov 2026: "GO Fix 11")
// Create store: a shop owner's password is 6 TO 12 characters - the server's
// rule (core_auth.py, Sana 8 Nov 2026). The form said "At least 6" and let 128
// be typed, so a long password passed here and the server refused the store.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const form = read("src/app/dashboard/stores/parts-create-store.tsx");
const server = read("../swat-delivery-app/backend/core_auth.py");

const num = (src: string, re: RegExp) => Number((src.match(re) || [])[1]);

test("the form's 6 and 12 are the server's 6 and 12", () => {
  assert.equal(num(form, /export const OWNER_PASSWORD_MIN = (\d+);/), num(server, /^VENDOR_PASSWORD_MIN_LENGTH = (\d+)$/m));
  assert.equal(num(form, /export const OWNER_PASSWORD_MAX = (\d+);/), num(server, /^VENDOR_PASSWORD_MAX_LENGTH = (\d+)$/m));
  assert.equal(num(form, /export const OWNER_PASSWORD_MAX = (\d+);/), 12);
});

function problem(pw: string): string | null {
  const start = form.indexOf("export function passwordProblem(");
  const body = form.slice(start, form.indexOf("\n}\n", start) + 2)
    .replace("export function", "function").replace(/\(pw: string\): string \| null \{/, "(pw) {");
  const settings = (form.match(/^export const OWNER_PASSWORD_(MIN|MAX) = \d+;$/gm) || [])
    .map((l) => l.replace("export const", "const")).join("\n");
  // eslint-disable-next-line no-new-func
  return (new Function(`${settings}\n${body}; return passwordProblem;`)() as (p: string) => string | null)(pw);
}

test("6 to 12 pass, 5 and 13 are refused with the same words", () => {
  assert.equal(problem("City26"), null);            // 6
  assert.equal(problem("ShopKhan1234"), null);      // 12
  assert.equal(problem("Shop5"), "Password must be 6 to 12 characters");          // 5
  assert.equal(problem("ShopKhan12345"), "Password must be 6 to 12 characters");  // 13
  assert.equal(problem(""), "Password is required");
  assert.ok(problem("12345678"), "still needs a letter");
});

test("counted like the server counts: one emoji is one character", () => {
  assert.equal(problem("Shop12345🍯🍯"), null);       // 11 characters, 13 JavaScript units
});

test("the box stops at 12 and the hint says 6 to 12", () => {
  assert.equal((form.match(/maxLength=\{OWNER_PASSWORD_MAX\}/g) || []).length, 2);
  assert.doesNotMatch(form, /maxLength=\{128\}/);
  assert.match(form, /hint=\{OWNER_PASSWORD_HINT\}/);
  assert.match(form, /OWNER_PASSWORD_HINT = `\$\{OWNER_PASSWORD_MIN\} to \$\{OWNER_PASSWORD_MAX\} characters, with a letter`/);
  assert.doesNotMatch(form, /At least 6 characters/);
});
