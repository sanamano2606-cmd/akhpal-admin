// STORES PAGE FIX 11 (Sana, 12 October 2026: "OK fix 11, option 1").
// A - the plainer tab names (her D4), the same words on Admin Users, the page
//     headings and the server's "no permission" messages. Words only: every
//     address and every permission key is unchanged.
// B - the store's page shows its delivery fee (read only; changed on the list,
//     her D3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAVIGATION } from "../src/lib/navigation.ts";
import { labelOf } from "../src/lib/tabs.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const SERVER = read("../swat-delivery-app/backend/core_tabs.py");

const NEW: [string, string, string, string][] = [
  // key, new name, address, page
  ["stores.all", "My new shops", "/dashboard/stores/onboarding", "src/app/dashboard/stores/onboarding/page.tsx"],
  ["stores.catalogue", "Categories", "/dashboard/stores/catalogue", "src/app/dashboard/stores/catalogue/page.tsx"],
  ["stores.inventory", "Low stock", "/dashboard/stores/inventory", "src/app/dashboard/stores/inventory/page.tsx"],
  ["stores.reliability", "Cancellations", "/dashboard/stores/reliability", "src/app/dashboard/stores/reliability/page.tsx"],
];

test("the four tabs carry the new names, at the same addresses and permissions", () => {
  const tabs = NAVIGATION.find((n) => n.label === "Stores")!.tabs!;
  for (const [key, name, href] of NEW) {
    const t = tabs.find((x) => x.href === href)!;
    assert.equal(t.label, name, href);
    assert.equal(t.section, key, href);
  }
  for (const old of ["Onboarding", "Catalogue", "Inventory", "Reliability"]) {
    assert.ok(!tabs.some((t) => t.label === old), old);
  }
});

test("Admin Users and the server use the same words", () => {
  assert.equal(labelOf("stores.catalogue"), "Stores → Categories");
  assert.equal(labelOf("stores.inventory"), "Stores → Low stock");
  assert.equal(labelOf("stores.reliability"), "Stores → Cancellations");
  assert.match(SERVER, /\("stores\.catalogue",\s+"Categories",/);
  assert.match(SERVER, /\("stores\.inventory",\s+"Low stock",/);
  assert.match(SERVER, /\("stores\.reliability", "Cancellations",/);
});

test("each page's heading matches its tab", () => {
  for (const [, name, , page] of NEW) assert.ok(read(page).includes(`>${name}</h`) || read(page).includes(`  ${name}\n`), page);
});

test("no screen still sends you to Stores → Catalogue", () => {
  assert.ok(!read("src/app/dashboard/stores/malls/[id]/parts-store-names.tsx").includes("Stores → Catalogue"));
  assert.ok(!read("src/app/dashboard/stores/parts-create-store.tsx").includes("Stores → Catalogue"));
});

test("B: the store's page shows the delivery fee, read only", () => {
  const page = read("src/app/dashboard/stores/[id]/page.tsx");
  assert.match(page, /\["Delivery fee", r\.admin_delivery_fee == null \? "Standard rule" : `Fixed · \$\{moneyExact\(r\.admin_delivery_fee\)\}`\]/);
});
