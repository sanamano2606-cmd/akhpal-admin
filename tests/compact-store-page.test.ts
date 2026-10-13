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
  assert.match(layout, /<h1 className="text-3xl font-bold text-takal-ink">Stores<\/h1>/, "the list keeps its title");
  assert.doesNotMatch(layout, /export function/, "a Next.js layout file exports its layout only");
});

test("the store card: '‹ All stores / name', then 3 lines, small numbers - and nothing missing", () => {
  const page = code("app/dashboard/stores/[id]/page.tsx");
  assert.match(page, /<ChevronLeft className="w-4 h-4" \/> All stores[\s\S]{0,200}<b className="text-takal-ink truncate">\{r\.name \|\| "Store"\}<\/b>/);
  assert.match(page, /<h2 className="mr-1 text-xl font-extrabold/, "the name shares its line with the chips");
  assert.match(page, /\{" · "\}Owner <b className="text-takal-ink">/, "the owner is on the address line");
  for (const label of ["Products", "Buying price missing", "Sold at a loss", "Takal earns (avg)", "Outstanding", "Mark as Featured"]) {
    assert.ok(page.includes(label), label);
  }
  assert.doesNotMatch(page, /min-w-\[112px\]/, "no big boxes");
});

test("the products tab: buttons, filters, the picture count and the tips - all there, smaller", () => {
  const tab = code("app/dashboard/stores/[id]/parts-products.tsx");
  for (const words of ["Many pictures", "Prices sheet", "Whole catalogue", "Add product", "have a picture", "More tips ▾"]) {
    assert.ok(tab.includes(words), words);
  }
  assert.match(tab, /<span data-picture-progress className="ml-auto/, "the picture count sits at the end of the filter row");
  assert.doesNotMatch(tab, /products have a picture<\/span>\s*<div className="flex-1 h-2\.5/, "the big bar is gone");
  assert.match(tab, /<div data-list-tips className="text-\[12px\]/, "the help is one grey line");
  assert.match(tab, /\{tipsOpen && \(/, "the rest opens on 'More tips'");
});
