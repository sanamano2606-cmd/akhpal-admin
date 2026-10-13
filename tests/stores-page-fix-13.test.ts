// STORES PAGE FIX 13 (Sana, 12 October 2026: "OK fix 13") - wording.
//   * no developer words on screen ("migration 125", "asking Sana");
//   * the vendor app is called by its name, the Partners app;
//   * the "Mall staff" tab is "Staff logins" (ordinary shops have it too);
//   * "Add a whole catalogue" says which shop it is for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
// What is DRAWN: comments taken out, so a note about the old words is allowed.
const shown = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !l.trim().startsWith("//")).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n");

const PAGES = [
  "src/app/dashboard/stores/commission/page.tsx",
  "src/app/dashboard/stores/[id]/parts-settings.tsx",
  "src/app/dashboard/stores/[id]/parts-price-mode.tsx",
  "src/app/dashboard/stores/parts-create-store.tsx",
  "src/app/dashboard/stores/[id]/page.tsx",
];

test("no developer words and no 'Vendors app' on these screens", () => {
  for (const p of PAGES) {
    const s = shown(p);
    assert.doesNotMatch(s, /migration 125/, p);
    assert.doesNotMatch(s, /asking Sana/, p);
    assert.doesNotMatch(s, /Vendors app/, p);
  }
  assert.match(shown("src/app/dashboard/stores/parts-create-store.tsx"), /Takal Partners app/);
});

test("the staff tab is Staff logins, still the Main Admin's", () => {
  const s = shown("src/app/dashboard/stores/[id]/page.tsx");
  assert.match(s, /\{ id: "staff", label: "Staff logins", Icon: Users \}/);
  assert.match(s, /const tabs = TABS\.filter\(\(t\) => t\.id !== "staff" \|\| isMain\);/);
});

test("Add a whole catalogue names the shop, and lives without it", () => {
  const s = shown("src/app/dashboard/stores/[id]/catalogue/page.tsx");
  assert.match(s, /apiClient\.getShopName\(shopId\)\.then/);
  assert.match(s, /\.catch\(\(\) => \{ \}\)|\.catch\(\(\) => \{\s*\}\)/);
  assert.match(s, /Add a whole catalogue\{shopName \? /);
});
