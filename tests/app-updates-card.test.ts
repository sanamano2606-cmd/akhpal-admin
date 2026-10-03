// MOCK 140 (2 October 2026): Settings -> App updates, the card that drives the
// update pop-up in the three phone apps. These read the panel AND the server
// as text, so the two halves cannot drift apart without a test saying so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const card = read("src/app/dashboard/settings/parts-app-updates.tsx");
const page = read("src/app/dashboard/settings/page.tsx");
const client = read("src/lib/api-client.ts");
const nav = read("src/lib/navigation.ts");
const server = read("../swat-delivery-app/backend/routers/app_versions.py");
const rules = read("../swat-delivery-app/backend/core_app_versions.py");
const guard = read("../swat-delivery-app/backend/app_guard.py");

test("the card is on the Settings page", () => {
  assert.match(page, /import \{ AppUpdates \} from "\.\/parts-app-updates"/);
  assert.match(page, /<AppUpdates \/>/);
});

test("a sub-admin never sees it - it returns nothing unless Main Admin", () => {
  assert.match(card, /if \(!isSuper\) return null;/);
  assert.match(card, /getMyPerms\(\)/);
});

test("the panel calls exactly the addresses the server answers", () => {
  assert.match(client, /"\/admin\/app-versions", \{ method: "GET" \}/);
  assert.match(client, /`\/admin\/app-versions\/\$\{app\}`/);
  assert.match(server, /@router\.get\("\/admin\/app-versions"/);
  assert.match(server, /@router\.put\("\/admin\/app-versions\/\{app\}"/);
});

test("the server checks Main Admin itself, inside both doors", () => {
  assert.equal((server.match(/_require_main_admin\(user\)/g) || []).length, 2);
});

test("App updates is Main Admin only, on both sides", () => {
  assert.match(nav, /\["\/admin\/app-versions", "__super__"\]/);
  assert.match(guard, /\("\/admin\/app-versions", "__super__"\)/);
});

test("the panel and the server read a version the same way", () => {
  assert.match(card, /\/\^\[0-9\]\+\(\\\.\[0-9\]\+\)\{0,3\}\$\//);
  assert.match(rules, /\^\[0-9\]\+\(\\\.\[0-9\]\+\)\{0,3\}\$/);
});

test("the three apps are named the same on both sides", () => {
  assert.match(client, /"customer" \| "rider" \| "vendor"/);
  assert.match(rules, /APPS = \("customer", "rider", "vendor"\)/);
});

test("versions are compared as numbers in the panel", async () => {
  // The same arithmetic, run for real: as text 2.4.10 would be older than 2.4.9.
  const src = card.slice(card.indexOf("export function olderThan"));
  const body = src.slice(src.indexOf("{") + 1, src.indexOf("\n}\n"));
  const olderThan = new Function("a", "b", body) as (a: string, b: string) => boolean;
  assert.equal(olderThan("2.4.9", "2.4.10"), true);
  assert.equal(olderThan("2.4.10", "2.4.9"), false);
  assert.equal(olderThan("2.4.8", "2.4.8"), false);
});
