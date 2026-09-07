// THE LETTERHEAD'S COLOURS — the rules that stop a letter printing blank.
//
// Sana, 7 September 2026: "add setting(small box) for writing colour change",
// and she chose "Everything on the page". Approved as Mock 29.
//
// WHY THIS FILE EXISTS. Two separate files know what colour each part of a
// letter is: the Settings screen, which shows "using #000000" beside an empty
// box, and the letterhead itself, which paints it. If those two ever disagree,
// the screen tells Sana one thing and the printer does another — and she only
// finds out on paper. These tests read BOTH files and refuse to let them drift.
//
// They read the source rather than rendering the page, because rendering a
// Next.js client component needs a browser and this suite is plain node. The
// rules being guarded are all "these two files agree", which the text answers
// honestly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SETTINGS = readFileSync(
  "src/app/dashboard/settings/parts-business-details.tsx", "utf8");
const SHEET = readFileSync(
  "src/app/dashboard/settings/letterhead/page.tsx", "utf8");

/** Every colour the Settings screen offers, and the colour it promises. */
function offeredInks(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /key:\s*"(business_ink_[a-z0-9_]+)"[\s\S]*?fallback:\s*"(#[0-9A-Fa-f]{6})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SETTINGS)) !== null) out.set(m[1], m[2].toUpperCase());
  return out;
}

/** Every colour the printed sheet falls back to when a box is empty. */
function sheetDefaults(): Map<string, string> {
  const block = SHEET.slice(SHEET.indexOf("const INK = {"), SHEET.indexOf("} as const;"));
  const out = new Map<string, string>();
  const re = /([a-zA-Z0-9]+):\s*"(#[0-9A-Fa-f]{6})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.set(m[1], m[2].toUpperCase());
  return out;
}

/** business_ink_line1 -> line1, so the two files can be lined up. */
function shortName(field: string): string {
  return field.replace("business_ink_", "");
}

test("the Settings screen offers a colour for every part of the page", () => {
  const offered = offeredInks();
  assert.ok(offered.size > 0, "no colour boxes found - this test guards nothing");
  // Sana asked for "Everything on the page", so every part has to be here.
  for (const part of ["name", "line1", "line2", "address", "body", "footer"]) {
    assert.ok(
      offered.has(`business_ink_${part}`),
      `there is no colour box for "${part}" - Sana asked for every part of the page`
    );
  }
});

test("the colour the screen promises is the colour the sheet prints", () => {
  const offered = offeredInks();
  const printed = sheetDefaults();
  assert.ok(printed.size > 0, "the sheet has no default colours - test guards nothing");
  for (const [field, promised] of offered) {
    const key = shortName(field);
    assert.ok(printed.has(key), `the sheet has no default colour for "${key}"`);
    assert.equal(
      printed.get(key), promised,
      `Settings says "${key}" is ${promised} while the sheet prints ` +
      `${printed.get(key)} - the screen and the printer disagree`
    );
  }
});

test("every default colour can actually be read on white paper", () => {
  // Same rule the server enforces at 3.0, applied to the colours this page
  // ships with. A default nobody can read is worse than a bad choice, because
  // nobody chose it.
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255)
         + 0.7152 * channel((n >> 8) & 255)
         + 0.0722 * channel(n & 255);
  };
  for (const [key, hex] of sheetDefaults()) {
    const ratio = (1.0 + 0.05) / (luminance(hex) + 0.05);
    assert.ok(ratio >= 3.0,
      `the default colour for "${key}" (${hex}) scores ${ratio.toFixed(2)} on ` +
      `white paper - anything under 3.0 prints almost blank`);
  }
});

test("no background colour is offered anywhere", () => {
  // Paper is white. A background colour is a full page of ink on every sheet.
  for (const src of [SETTINGS, SHEET]) {
    for (const stray of ["business_bg", "business_background", "business_paper"]) {
      assert.ok(!src.includes(stray),
        `${stray} would print a full page of ink on every single sheet`);
    }
  }
});

test("an empty colour box falls back instead of going black", () => {
  // The trap this catches: writing `color: head.inkName || "#000000"` looks
  // right and quietly repaints every part of the page black the moment a box
  // is cleared - including the two parts that were never black.
  assert.ok(SHEET.includes("function ink("),
    "the fallback helper is gone - an empty box would reach the page raw");
  for (const part of ["inkName", "inkLine1", "inkLine2", "inkAddress",
                      "inkBody", "inkFooter"]) {
    assert.ok(
      SHEET.includes(`ink(head.${part},`),
      `${part} is not passed through the fallback helper, so an empty or odd ` +
      `value would be painted straight onto the letter`
    );
  }
});

test("the second slogan line is printed, and disappears when empty", () => {
  assert.ok(SHEET.includes("head.tagline2 ?"),
    "slogan line 2 is not drawn on the sheet at all");
  assert.ok(SETTINGS.includes('key: "business_tagline_2"'),
    "there is no box to type slogan line 2 into");
});

test("slogan line 1 is bigger and bolder than line 2", () => {
  // Sana's words: "First line's writing should be smaller in size and Bold
  // than the Name 'TAKAL' and bigger than second line".
  const size = (pt: string) => Number(pt);
  const name = SHEET.match(/text-\[(\d+(?:\.\d+)?)pt\] font-black/);
  const l1 = SHEET.match(/text-\[(\d+(?:\.\d+)?)pt\] font-bold uppercase tracking-\[0\.10em\]/);
  const l2 = SHEET.match(/text-\[(\d+(?:\.\d+)?)pt\] uppercase tracking-\[0\.16em\]/);
  assert.ok(name && l1 && l2, "could not find all three sizes on the sheet");
  assert.ok(size(name![1]) > size(l1![1]),
    `the name (${name![1]}pt) must be bigger than slogan line 1 (${l1![1]}pt)`);
  assert.ok(size(l1![1]) > size(l2![1]),
    `slogan line 1 (${l1![1]}pt) must be bigger than line 2 (${l2![1]}pt)`);
  assert.ok(SHEET.includes("font-bold uppercase tracking-[0.10em]"),
    "slogan line 1 is not bold");
});
