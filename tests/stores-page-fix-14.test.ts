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

// MOCK 203 v2 (approved by Sana 20 Oct 2026, after fix 14): the big
// "Products" figure and the "All" button are out of sight, so the count is on
// the Products tab again - once. The search box still carries none.
test("the product count is said once - on the Products tab; the search box carries none", () => {
  const page = read("src/app/dashboard/stores/[id]/page.tsx");
  const products = read("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.match(page, /\{t === "products" && counts\?\.all != null && \(/);
  assert.match(page, /<Stat label="Products" value=\{counts\?\.all != null/, "and in ⋯");
  assert.match(products, /placeholder="Find by name, size, code…"/);
  assert.doesNotMatch(products, /placeholder=\{`Search \$\{counts/);
});
