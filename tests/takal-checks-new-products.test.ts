// MIGRATION 152 - THE TAKAL ASSISTANT CHECKS NEW AND CHANGED PRODUCTS.
// Sana, 29 Oct 2026: "the next hour the Assistant Ai should check what changed
// and not avoiding Takal rules. if any hide them." - "GO".
//
// The panel's part: it reads new product pictures in the background
// (the server cannot read pictures for free), gently, only for reviewers,
// only while the tab is visible - and the addresses agree with the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HOOK = readFileSync("src/lib/hooks/useBackgroundPictureReader.ts", "utf8");
const LAYOUT = readFileSync("src/app/dashboard/layout.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const NAV = readFileSync("src/lib/navigation.ts", "utf8");
const SERVER = readFileSync("../swat-delivery-app/backend/routers/product_checks_admin.py", "utf8");
const GUARD = readFileSync("../swat-delivery-app/backend/app_guard.py", "utf8");

test("every dashboard page runs the reader", () => {
  assert.match(LAYOUT, /\n  useBackgroundPictureReader\(\);\n/);
});

test("only for admins who may review shops", () => {
  assert.match(HOOK, /if \(!canAccess\("stores\.approve"\)\) return;/);
});

test("only while the tab is visible - a hidden tab reads nothing", () => {
  assert.match(HOOK, /if \(!visible\(\)\) \{ await sleep\(30_000\); continue; \}/);
  assert.match(HOOK, /if \(!alive \|\| !visible\(\)\) break;/);
});

test("one picture at a time, with a pause, a few per round", () => {
  assert.match(HOOK, /for \(const p of pictures\) \{/);
  assert.match(HOOK, /const c = await checkPicture\(p\.url, false\);/);
  assert.match(HOOK, /await sleep\(READ_PAUSE_MS\);/);
  assert.match(HOOK, /export const PER_ROUND = 8;/);
});

test("a picture that cannot be opened is still reported, so it never blocks the queue", () => {
  assert.doesNotMatch(HOOK, /if \(c\.failed\) continue/);
  assert.match(HOOK, /read\.push\(\{ product_id: p\.product_id, url: p\.url/);
});

test("the reading library is loaded only when there is something to read", () => {
  assert.match(HOOK, /await import\("@\/lib\/picture-check"\)/);
  assert.doesNotMatch(HOOK, /^import .*picture-check/m);
});

test("the panel's addresses are the server's", () => {
  assert.match(API, /`\/admin\/pictures\/to-read\?limit=\$\{limit\}`/);
  assert.match(API, /`\/admin\/pictures\/read`/);
  assert.match(API, /`\/admin\/products\/show-again\/\$\{itemId\}`/);
  assert.match(SERVER, /@router\.get\("\/admin\/pictures\/to-read"/);
  assert.match(SERVER, /@router\.post\("\/admin\/pictures\/read"/);
  assert.match(SERVER, /@router\.put\("\/admin\/products\/show-again\/\{item_id\}"/);
});

test("Show again is the Main Admin's on both sides", () => {
  assert.match(NAV, /\["\/admin\/products\/show-again", "__super__"\]/);
  assert.match(GUARD, /\("\/admin\/products\/show-again", "__super__"\)/);
});
