// ─────────────────────────────────────────────────────────────────────────────
// THE SIDE MENU IS ICONS ON A SMALL LAPTOP.  (Mock 171-7, approved by Sana on
// 8 October 2026; "Do all what you suggest".)
//
// On a 1024 laptop the full menu took 256 px and a store's product list had
// to be scrolled sideways. Below 1280 px the menu now starts as icons. A phone
// still starts closed (there the menu covers the page). Once the person widens
// or narrows the menu on a computer, that choice is kept and wins.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LAYOUT = readFileSync(new URL("../src/app/dashboard/layout.tsx", import.meta.url), "utf8");
const start = LAYOUT.slice(LAYOUT.indexOf("useState(() => {"), LAYOUT.indexOf("const setSidebarOpen = "));
const setter = LAYOUT.slice(LAYOUT.indexOf("const setSidebarOpen = "), LAYOUT.indexOf("const [loading"));

test("wide from 1280 px, icons below", () => {
  assert.match(LAYOUT, /const WIDE_MENU_FROM = "\(min-width: 1280px\)";/);
  assert.match(start, /return window\.matchMedia\(WIDE_MENU_FROM\)\.matches;/);
});

test("a phone always starts closed, whatever was kept", () => {
  assert.match(LAYOUT, /const NOT_A_PHONE = "\(min-width: 768px\)";/);
  const phone = start.indexOf("if (!window.matchMedia(NOT_A_PHONE).matches) return false;");
  const kept = start.indexOf("localStorage.getItem(MENU_CHOICE_KEY)");
  assert.ok(phone > 0 && kept > phone, "the phone check comes before the kept choice");
});

test("the person's own choice is kept, and only on a computer or tablet", () => {
  assert.match(start, /if \(kept === "wide"\) return true;\s*if \(kept === "icons"\) return false;/);
  assert.match(setter, /if \(typeof window === "undefined" \|\| !window\.matchMedia\(NOT_A_PHONE\)\.matches\) return;/);
  assert.match(setter, /localStorage\.setItem\(MENU_CHOICE_KEY, open \? "wide" : "icons"\)/);
  // Storage that is blocked never breaks the menu.
  assert.equal((start.match(/try \{/g) || []).length, 1);
  assert.equal((setter.match(/try \{/g) || []).length, 1);
});
