// MOCK 232 - THE TAKAL ASSISTANT GIVES A NEW STORE ITS LOGO (Sana, 8 Nov 2026:
// "when the New Store added and get ready to view the assistant should do this
// to it too. but no need for deploy each time" - "go").
//
// The panel's half: the logo Takal drew is kept in the same place as a blurred
// picture (so "Put original back" already works), but it is SAID as what it is -
// "New logo by Takal", never "a phone number blurred". The server holds the
// rest (backend takal_logos.py, tests/test_mock_232_takal_makes_new_store_logos.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTakalLogo, TAKAL_LOGO_LINE } from "../src/lib/ready-to-show.ts";

const READY = readFileSync("src/app/dashboard/stores/parts-ready-to-show.tsx", "utf8");
const CARD = readFileSync("src/app/dashboard/stores/[id]/review/parts-checks.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");

test("a logo Takal drew is told apart from a blurred picture", () => {
  assert.equal(isTakalLogo({ found: [{ kind: "takal_logo", text: "x" }] }), true);
  assert.equal(isTakalLogo({ found: [{ kind: "phone", text: "0300" }] }), false);
  assert.equal(isTakalLogo({ found: [] }), false);
  assert.equal(isTakalLogo({ found: null }), false);
  assert.equal(isTakalLogo({}), false);
});

test("Ready to show says 'New logo by Takal - look once', apart from the blur chip", () => {
  assert.equal(TAKAL_LOGO_LINE, "New logo by Takal - look once");
  assert.match(API, /logo_by_takal\?: boolean;/);
  assert.match(READY, /\{s\.logo_by_takal && \(\s*<span data-takal-logo-chip/);
  assert.match(READY, /\{\(s\.pictures_blurred \?\? 0\) > 0 && \(\s*<span data-blurred-chip/, "the blur chip stays");
});

test("the Review card counts blurs and Takal logos apart, and Put original back stays", () => {
  assert.match(CARD, /const logos = pictures\.filter\(isTakalLogo\);/);
  assert.match(CARD, /Blurred by Takal - \{blurs\.length\}/);
  assert.match(CARD, /<b data-takal-logo-title[^>]*>🟨 New logo by Takal<\/b>/);
  assert.match(CARD, /New logo drawn by Takal · made/);
  assert.match(CARD, /"drawn by Takal"/);
  assert.match(CARD, /↺ Put original back/);
});
