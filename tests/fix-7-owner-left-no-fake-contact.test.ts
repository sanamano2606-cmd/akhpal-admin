// FIX 7 - NO CALL, NO FAKE PHONE FOR A SHOP WHOSE OWNER LEFT
// (All Stores audit 9 Nov 2026, B2/P7; Sana: "GO Fix 7").
// A closed account's phone and e-mail are placeholders ("deleted-1a2b...",
// "deleted+...@takal.invalid"). The store page offered "📞 Call" to that and
// showed them under Profile as if real. The server says owner.closed_account
// (Fix 1, backend tests/test_fix_1_dead_shops.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("../src/app/dashboard/stores/[id]/page.tsx", import.meta.url), "utf8");

test("one flag, from the server's own answer", () => {
  assert.match(PAGE, /const ownerLeft = owner\.closed_account === true;/);
});

test("Call and WhatsApp are not offered when the owner left", () => {
  assert.match(PAGE, /\{data && !ownerLeft && \(owner\.phone \|\| r\.phone\) && \(\s*<>\s*<a href=\{`tel:/);
});

test("the ⋯ box says he left, with no phone to tap", () => {
  assert.match(PAGE, /\{data && ownerLeft && \(\s*<p data-owner-left-note/);
  assert.match(PAGE, /\{data && !ownerLeft && \(owner\.full_name \|\| owner\.phone\) && \(/);
});

test("Profile never shows the placeholders as if they were real", () => {
  assert.match(PAGE, /\["Owner", ownerLeft \? "Closed his Takal account" : owner\.full_name\]/);
  assert.match(PAGE, /\["Owner phone", ownerLeft \? "" : owner\.phone\], \["Owner email", ownerLeft \? "" : owner\.email\]/);
});

test("the name's hover text leaves the placeholder phone out", () => {
  assert.match(PAGE, /ownerLeft \? "" : owner\.phone\]\.filter\(Boolean\)\.join\(" · "\)/);
});
