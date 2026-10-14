/**
 * MOCK 192 - COMPACT ORDERS, the All Orders screen (Sana 14 Oct 2026: "GO for
 * the ALL order screen").
 *
 * Measured in a browser on the same 13 orders: the first order moved from
 * 504 px to 210 px down the page at 1536 x 864, and a row from about 86-105 px
 * to 50 px (3 -> 13 orders on screen), with nothing wider than before. These
 * guard that, and that nothing on the screen was lost.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const PAGE = read("app/dashboard/orders/page.tsx");
const LAYOUT = read("app/dashboard/orders/layout.tsx");

test("'Orders' and its tabs on one line - the sentence on hover", () => {
  assert.match(LAYOUT, /<div className="min-w-0 flex-1"><DomainTabs tabs=\{TABS\} bare \/><\/div>/);
  assert.match(LAYOUT, /title="Every order from the moment it is placed to the moment it is delivered, returned or refunded\."/);
});

test("nothing removed: the count, Live, both buttons, every chip, filter and column", () => {
  for (const w of ["orders", "Live", "Export this page", "Refresh", "Filters", "Newest first", "Clear all",
    "Nobody yet", "Takal office", "rider ", "waiting for the shop", "in this step", "too long altogether",
    "\"TAKAL KEEPS\"", "cancelled not counted", "Assign"]) {
    assert.ok(PAGE.includes(w) || PAGE.includes(w.replace(/"/g, "")), w);
  }
  for (const h of ["ORDER", "TYPE", "CUSTOMER", "SHOP", "CARRIED BY", "AMOUNT", "PAY", "STATUS", "WAITING", "FLAGS"]) {
    assert.ok(PAGE.includes(`"${h}"`) || PAGE.includes(`>${h}<`), h);
  }
});

test("compact: no 'All Orders' heading, the count at the end of the chips, buttons in the search row, short rows", () => {
  assert.doesNotMatch(PAGE, /<h2 className="text-xl font-bold text-takal-ink">All Orders<\/h2>/);
  assert.match(PAGE, /<span className="ml-auto inline-flex items-center gap-2 text-\[13px\] text-takal-ink-soft whitespace-nowrap">/);
  assert.match(PAGE, /<option value="smallest">Smallest first<\/option>\s*<\/select>\s*<Button\s+variant="secondary"/);
  assert.match(PAGE, /rounded-full border-\[1\.5px\] px-2\.5 py-0\.5 text-\[12\.5px\]/, "smaller chips");
  assert.doesNotMatch(PAGE, /px-4 py-3/, "cells half as roomy");
  assert.match(PAGE, /title=\{o\.restaurant_name \|\| ""\}/, "a long shop name is whole on hover");
});
