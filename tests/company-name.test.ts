// ─────────────────────────────────────────────────────────────────────────────
// WHO TAKAL LEGALLY IS  (5 November 2026, Sana: "GO")
//
// Takal is the brand; TAKALAPP (SMC-Private) Limited, SECP No. 0363919, is the
// company. Apple and D&B check that the privacy policy, the terms and the
// website name the company behind the app. Two copies of the facts exist -
// this panel's src/lib/contact.ts and the website's src/lib/contact.ts - and
// this test fails the day they disagree, or the day a page stops printing them.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPANY_LEGAL_NAME,
  COMPANY_SECP_NUMBER,
  COMPANY_REGISTERED_OFFICE,
} from "../src/lib/contact.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const SHARED = code("src/app/terms/_shared.tsx");
const PRIVACY = code("src/app/privacy/page.tsx");
const LETTER = code("src/app/dashboard/settings/letterhead/page.tsx");
const SITE_CONTACT = readFileSync(
  join(process.cwd(), "..", "takal-website", "src", "lib", "contact.ts"),
  "utf-8",
);

test("the company facts are the ones on the SECP certificate", () => {
  assert.equal(COMPANY_LEGAL_NAME, "TAKALAPP (SMC-Private) Limited");
  assert.equal(COMPANY_SECP_NUMBER, "0363919");
  assert.match(COMPANY_REGISTERED_OFFICE, /^1, Sakhra Road, Matta Bazar, Matta, Swat/);
});

test("the website and the panel write the SAME company facts", () => {
  const field = (name: string) => {
    const m = SITE_CONTACT.match(new RegExp(`${name}:\\s*"([^"]+)"`));
    assert.ok(m, `the website's COMPANY has no ${name}`);
    return m![1];
  };
  assert.equal(field("legalName"), COMPANY_LEGAL_NAME);
  assert.equal(field("secpNumber"), COMPANY_SECP_NUMBER);
  assert.equal(field("registeredOffice"), COMPANY_REGISTERED_OFFICE);
});

test("all three terms name the company at the top, in English AND Urdu", () => {
  // The line sits in TermsShell, before {intro}, so every terms page has it.
  const top = SHARED.slice(SHARED.indexOf("<BothLanguagesNotice />"), SHARED.indexOf("{intro}"));
  assert.ok(top.length > 0, "the company line must come before the intro");
  assert.match(top, /Takal is run by <strong>\{COMPANY_LEGAL_NAME\}<\/strong>/);
  assert.match(top, /ur=\{[\s\S]*\{COMPANY_LEGAL_NAME\}[\s\S]*\{COMPANY_SECP_NUMBER\}[\s\S]*\{COMPANY_REGISTERED_OFFICE\}/);
});

test("the terms' Contact section names the company too, in both languages", () => {
  const contact = SHARED.slice(SHARED.indexOf('title={{ en: "Contact"'));
  const uses = contact.match(/\{COMPANY_LEGAL_NAME/g) ?? [];
  assert.ok(uses.length >= 2, "Contact must name the company in the English AND the Urdu half");
});

test("the privacy policy names the company near the top and in Contact", () => {
  const intro = PRIVACY.slice(PRIVACY.indexOf("Last updated"), PRIVACY.indexOf("<Section"));
  assert.match(intro, /is run by <strong>\{COMPANY_LEGAL_NAME\}<\/strong>/);
  assert.match(intro, /\{COMPANY_SECP_NUMBER\}/);
  const contact = PRIVACY.slice(PRIVACY.indexOf('<Section title="Contact">'));
  assert.match(contact, /\{COMPANY_LEGAL_NAME\}/);
});

// Mock 230, approved 5 November 2026 ("Approved Black").
test("every printed letter carries the company line, in black, at the foot", () => {
  const foot = LETTER.slice(LETTER.indexOf("bottom-[14mm]"));
  assert.ok(foot.length > 0, "the letter has no foot");
  const line = foot.slice(foot.indexOf("WHO SENDS THIS LETTER"));
  assert.match(line, /\{COMPANY_LEGAL_NAME\} · SECP Company No\. \{COMPANY_SECP_NUMBER\}/);
  // Black, and NOT the footer's colour setting: it is a legal fact.
  assert.match(line, /style=\{\{ color: "#000000" \}\}/);
  // Always printed - never hidden behind a Settings box being filled in.
  const before = line.slice(0, line.indexOf("{COMPANY_LEGAL_NAME} · SECP"));
  assert.doesNotMatch(before.slice(before.lastIndexOf("<div")), /\? \(|&&/);
});
