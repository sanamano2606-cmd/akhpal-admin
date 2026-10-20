// STORES PAGE FIX 14 (Sana, 20 October 2026: "OK Fix 14") - two tidy-ups.
//   * "My new shops" has the same heading as every other Stores tab.
//   * A store's product count is no longer repeated on the Products tab and
//     in the search box - it stays in the "Products" figure, on the "All"
//     button and in the picture line, where each does a job.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("every Stores tab has the same heading size", () => {
  // (Categories' heading is hidden on purpose since its redesign - not checked.)
  for (const p of ["onboarding", "inventory", "commission"]) {
    const s = read(`src/app/dashboard/stores/${p}/page.tsx`);
    assert.match(s, /<h2 className="text-xl font-bold text-takal-ink[" ]/, p);
  }
  for (const p of ["onboarding", "catalogue", "inventory", "commission", "reliability"]) {
    assert.doesNotMatch(read(`src/app/dashboard/stores/${p}/page.tsx`), /<h1 className="text-2xl/, p);
  }
});

test("the Products tab and the search box carry no count; the useful ones stay", () => {
  const page = read("src/app/dashboard/stores/[id]/page.tsx");
  const products = read("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.doesNotMatch(page, /\{t === "products" && counts\?\.all != null && \(/);
  assert.match(page, /<Stat label="Products" value=\{counts\?\.all != null/);
  assert.match(products, /placeholder="Search products by name…"/);
  assert.doesNotMatch(products, /placeholder=\{`Search \$\{counts/);
  assert.match(products, /have a picture/);
});
