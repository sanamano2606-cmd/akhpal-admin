// STORES PAGE FIX 8 (Sana, 12 October 2026: "OK fix 8"; audit O9) - one
// click no longer does a big thing without asking.
//   * Closing an open shop (from the list, or the store's Settings) asks.
//   * Marking a shop Featured asks.
//   * Turning OFF the ticked products asks.
// Opening a shop, taking Featured off and Turn ON stay one click.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const list = read("src/app/dashboard/stores/page.tsx");
const store = read("src/app/dashboard/stores/[id]/page.tsx");
const settings = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const products = read("src/app/dashboard/stores/[id]/parts-products.tsx");

test("the list: closing asks, opening does not", () => {
  assert.match(list, /onClick=\{\(\) => restaurant\.is_open \? setClosing\(restaurant\) : toggleOpen\(restaurant\)\}/);
  assert.match(list, /title=\{`Close \$\{closing\?\.name \|\| "this store"\}\?`\}/);
  assert.match(list, /if \(r\) await toggleOpen\(r\);/);
});

test("the store's Settings: closing asks, opening does not", () => {
  assert.match(settings, /onClick=\{\(\) => \(store\.is_open \? setAskClose\(true\) : flipOpen\(\)\)\}/);
  assert.match(settings, /onConfirm=\{async \(\) => \{ setAskClose\(false\); await flipOpen\(\); \}\}/);
  assert.equal((settings.match(/toggleRestaurantOpen\(/g) || []).length, 1, "one place flips it");
});

test("Featured: marking asks, taking off does not", () => {
  // MOCK 203 v2: the Featured button is inside ⋯ on the one line.
  assert.match(store, /if \(r\.is_featured\) toggleFeatured\(\); else setAskFeature\(true\);/);
  assert.match(store, /title=\{`Feature \$\{r\.name \|\| "this store"\}\?`\}/);
});

test("Products: Turn OFF asks, Turn ON does not", () => {
  // MOCK 203 v2: the bar says ON / OFF.
  assert.match(products, /label: "OFF", Icon: PowerOff, go: \(\) => setAskOff\(true\)/);
  assert.match(products, /label: "ON", Icon: Power, go: \(\) => runBulk\("on"\)/);
  assert.match(products, /onConfirm=\{async \(\) => \{ setAskOff\(false\); await runBulk\("off"\); \}\}/);
  assert.doesNotMatch(products, /go: \(\) => runBulk\("off"\)/);
});
