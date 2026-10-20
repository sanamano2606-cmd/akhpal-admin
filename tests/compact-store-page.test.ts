/**
 * MOCK 188 - A COMPACT STORE PAGE (approved by Sana 14 Oct 2026: "the Page is
 * too spreader ... How can you make it the most compacted?" -> "GO").
 *
 * Measured in a browser on the same store: the first product moved from
 * 780 px to 377 px down the page at 1536 x 864 (from none fully on screen to
 * five). Nothing was taken away - these guard that the space stays saved and
 * that every number and button is still there.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOneStorePage } from "../src/lib/store-page.ts";

const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("a store's own page has no big 'Stores' title or section tabs; every other Stores page keeps them", () => {
  assert.equal(isOneStorePage("/dashboard/stores/22222222-2222-2222-2222-222222222222"), true);
  assert.equal(isOneStorePage("/dashboard/stores/abc/catalogue"), true, "its upload page has its own back link and title");
  for (const p of ["/dashboard/stores", "/dashboard/stores/", "/dashboard/stores/malls", "/dashboard/stores/malls/m1",
    "/dashboard/stores/commission", "/dashboard/stores/inventory", "/dashboard/stores/onboarding",
    "/dashboard/stores/reliability", "/dashboard/stores/catalogue", "/dashboard/orders", null, undefined]) {
    assert.equal(isOneStorePage(p as any), false, String(p));
  }
  const layout = code("app/dashboard/stores/layout.tsx");
  assert.match(layout, /if \(isOneStorePage\(path\)\) return <div>\{children\}<\/div>;/);
  assert.match(layout, /<h1 className="pb-2 text-2xl font-bold text-takal-ink"/, "the list keeps its title (on one line with its tabs - Mock 189)");
  assert.doesNotMatch(layout, /export function/, "a Next.js layout file exports its layout only");
});

test("MOCK 203 v2: the store is ONE line - ‹, logo, name, chips, tabs, actions, ⋯ - and nothing missing", () => {
  const page = code("app/dashboard/stores/[id]/page.tsx");
  assert.match(page, /<div data-store-line className="relative flex flex-wrap items-center/);
  assert.match(page, /title="All stores" aria-label="All stores"/, "‹ goes back to All stores");
  assert.match(page, /<h2 className="text-\[15px\] font-extrabold/, "the name shares its line with the chips and tabs");
  assert.match(page, /border-l border-takal-line pl-1.5" role="tablist">/, "the tabs are on the same line");
  // The address, owner, figures and Featured are in ⋯.
  assert.match(page, /<div data-store-more /);
  assert.match(page, /Owner <b className="text-takal-ink">/, "the owner, with his phone");
  for (const label of ["Products", "Buying price missing", "Sold at a loss", "Takal earns (avg)", "Outstanding", "Mark as Featured"]) {
    assert.ok(page.includes(label), label);
  }
  assert.doesNotMatch(page, /min-w-\[112px\]/, "no big boxes");
});

test("MOCK 203 v2: the products tab is ONE tool line - and every button is still there", () => {
  const tab = code("app/dashboard/stores/[id]/parts-products.tsx");
  for (const words of ["Many pictures", "Prices sheet", "Whole catalogue", "Add product"]) {
    assert.ok(tab.includes(words), words);
  }
  assert.match(tab, /aria-label="Grid or table"/, "Grid / Table");
  assert.match(tab, /aria-haspopup="menu" aria-expanded=\{addOpen\}/, "＋ Add ▾ holds the four");
  assert.doesNotMatch(tab, /data-picture-progress/, "the picture count is the 'No picture' button");
  assert.match(tab, /<div data-list-tips className="rounded-lg/, "the tips open on the ⓘ");
  assert.match(tab, /\{tipsOpen && \(/);
});

test("MOCK 189 - the stores list: title and tabs on one line, small count buttons, one row of tools, one-line stores", () => {
  const layout = code("app/dashboard/stores/layout.tsx");
  assert.match(layout, /<div className="min-w-0 flex-1"><DomainTabs tabs=\{TABS\} bare \/><\/div>/);
  const tabs = code("components/ui/DomainTabs.tsx");
  assert.match(tabs, /className=\{bare \? "flex gap-1 overflow-x-auto" : "border-b border-takal-line flex gap-1 overflow-x-auto -mx-6 px-6"\}/,
    "every other section's tabs are drawn exactly as before");
  const list = code("app/dashboard/stores/page.tsx");
  assert.doesNotMatch(list, /<h2 className="text-xl font-bold text-takal-ink">All Stores<\/h2>/, "the tab already says it");
  assert.match(list, /<div className="flex flex-wrap items-center gap-1\.5">/, "the 5 lists are one row of buttons");
  assert.match(list, /onClick=\{\(\) => chooseView\(v\.key\)\}/, "and they still open their list");
  assert.match(list, /\+ Create store[\s\S]{0,400}Refresh/, "both buttons are kept, at the end of the search row");
  assert.match(list, /closed by hours/, "the opening-hours note stays, beside Open");
  assert.match(list, /<span className="text-takal-ink-soft whitespace-nowrap">Standard rule<\/span>/);
  assert.match(list, /className="line-clamp-1 font-semibold/, "the name on one line, the whole name on hover");
});

test("MOCK 190 - product rows half as tall: said once at the top, not on every row", () => {
  const tab = code("app/dashboard/stores/[id]/parts-products.tsx");
  assert.doesNotMatch(tab, /⛔ Customers cannot order it until/, "no third line under the name");
  assert.match(tab, /title=\{priced\?\.missing && p\.is_available\s*\? `Customers cannot order it until/, "the red row says why when pointed at");
  assert.doesNotMatch(tab, /<span className="block normal-case tracking-normal font-normal text-\[11px\]">/, "headings on one line");
  assert.match(tab, /Takal earns<span title="Takal earns = selling price after discount − buying price, per item\./, "the sum is on the ⓘ");
  assert.match(tab, /<span data-colour-key className="ml-2/, "the colour key is in the tips (MOCK 203 v2)");
  assert.doesNotMatch(tab, /a loss, or no buying price<\/span>\s*<span>Takal earns = selling price/, "not under the table any more");
  assert.match(tab, /<div className="flex flex-row gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">/,
    "Edit and ... side by side - only on the row under the mouse (MOCK 203 v2)");
  const prices = code("app/dashboard/stores/[id]/parts-products-prices.tsx");
  assert.ok(!prices.includes('"Add buying price"}'), "the 2-line box is gone");
  assert.match(prices, /aria-label="Add buying price"/, "but it still says so to a screen reader and on hover");
  const page = code("app/dashboard/stores/[id]/page.tsx");
  assert.match(page, /🔒 Fixed-price · no commission/, "one chip, not two");
});
