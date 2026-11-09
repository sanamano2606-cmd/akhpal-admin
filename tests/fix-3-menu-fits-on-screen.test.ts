// FIX 3 - A MENU ALWAYS FITS ON THE SCREEN (All Stores audit 9 Nov 2026; Sana: "GO Fix 3").
// The product ⋯ menu guessed its height (142-150 px) but is 188-260 px, so on
// the last rows "Remove product" was below the screen. Now it is measured.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeMenu } from "../src/lib/menu-place.ts";

const SRC = readFileSync(new URL("../src/app/dashboard/stores/[id]/parts-products.tsx", import.meta.url), "utf8");

test("room below: under the button", () => {
  assert.deepEqual(placeMenu(100, 120, 224, 700), { top: 126, maxHeight: null });
});

test("no room below: above the button - the case that hid Remove product", () => {
  // the old guess: 620 + 150 > 700 -> it did go up, but by 142 only; and at
  // 520 it went DOWN: 520 + 150 <= 700 while the menu ends at 526 + 224 = 750.
  const at = placeMenu(500, 520, 224, 700);
  assert.equal(at.top, 500 - 6 - 224);
  assert.ok(at.top + 224 <= 700 - 8, "the whole menu is on the screen");
});

test("room neither way: as low as it fits, inside the screen", () => {
  const at = placeMenu(150, 170, 400, 500);
  assert.equal(at.maxHeight, null);
  assert.ok(at.top >= 8 && at.top + 400 <= 500 - 8);
});

test("taller than the whole screen: scrolls inside itself", () => {
  assert.deepEqual(placeMenu(100, 120, 900, 600), { top: 8, maxHeight: 584 });
});

test("every item fits for every row of a laptop and a small screen", () => {
  for (const screen of [600, 700, 900]) {
    for (const h of [188, 224, 260]) {
      for (let y = 10; y < screen - 30; y += 7) {
        const at = placeMenu(y, y + 20, h, screen);
        const shown = at.maxHeight ?? h;
        assert.ok(at.top >= 8 && at.top + shown <= screen - 8, `screen ${screen}, menu ${h}, row ${y}`);
      }
    }
  }
});

test("the products page no longer guesses the menu's height", () => {
  assert.equal(/r\.bottom \+ 150 > window\.innerHeight/.test(SRC), false);
  assert.equal(/const tall = kind === "cover" \? 250 : 170/.test(SRC), false);
});

test("both menus are measured and moved by the rule", () => {
  assert.match(SRC, /placeMenu\(menu\.top, menu\.bottom, el\.scrollHeight, window\.innerHeight\)/);
  assert.match(SRC, /placeMenu\(picMenu\.top, picMenu\.bottom, el\.scrollHeight, window\.innerHeight\)/);
  assert.match(SRC, /ref=\{menuRef\}/);
  assert.match(SRC, /ref=\{picMenuRef\}/);
  assert.equal((SRC.match(/setMenu\(\{ p, x: Math\.max\(8, r\.right - 208\), y: r\.bottom \+ 6, top: r\.top, bottom: r\.bottom \}\)/g) || []).length, 2);
});

test("a menu scrolling inside itself does not close itself", () => {
  assert.match(SRC, /if \(menuRef\.current\?\.contains\(e\.target as Node\)\) return;\s*if \(Date\.now\(\) - opened > 400\) setMenu\(null\);/);
  assert.match(SRC, /if \(picMenuRef\.current\?\.contains\(e\.target as Node\)\) return;/);
});
