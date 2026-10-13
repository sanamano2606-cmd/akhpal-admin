// STORES PAGE FIX 10 (Sana, 12 October 2026: "OK fix 10").
// O14 - Reliability no longer says "No shop has dropped an accepted order"
//       when really no shop has enough orders to be judged.
// O8  - on a store's page, unsaved typing in Settings or Location is not
//       thrown away by a tab switch or "← All stores": it asks first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reliabilityEmptyWords } from "../src/lib/reliability-words.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const rel = read("src/app/dashboard/stores/reliability/page.tsx");
const store = read("src/app/dashboard/stores/[id]/page.tsx");
const settings = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const location = read("src/app/dashboard/stores/parts-shop-location.tsx");

const RULES = { window_days: 30, min_orders_to_judge: 10 };

test("O14: too few orders is said as too few orders", () => {
  const w = reliabilityEmptyWords(12, 12, RULES);
  assert.equal(w.text, "No shop has enough orders to judge yet. A shop needs at least 10 finished orders in the last 30 days before it can be judged.");
  assert.equal(w.offerShowAll, true);
});

test("O14: no orders at all is said as that", () => {
  assert.deepEqual(reliabilityEmptyWords(0, 0, RULES),
    { text: "No orders in the last 30 days yet, so there is nothing to judge.", offerShowAll: false });
  assert.match(reliabilityEmptyWords(0, 0, null).text, /^No orders yet/);
});

test("O14: the page uses it and the old sentence is gone", () => {
  assert.match(rel, /reliabilityEmptyWords\(rows\.length, hidden, meta\?\.rules\)/);
  assert.doesNotMatch(rel, /No shop has dropped an accepted order yet\./);
  assert.match(rel, /Show all shops/);
});

test("O8: Settings and Location say when they hold unsaved changes", () => {
  assert.match(settings, /const dirty = settingsFormChanged\(f, serverRef\.current\);/);
  assert.match(settings, /useEffect\(\(\) => \{ onDirty\?\.\(dirty\); \}, \[dirty, onDirty\]\);/);
  assert.match(location, /const dirty = v\.lat !== held\.lat \|\| v\.lon !== held\.lon \|\| v\.address !== held\.address;/);
  assert.match(store, /<StoreSettingsCard store=\{r\} onSaved=\{load\} onDirty=\{settingsDirty\}/);
  assert.match(store, /<ShopLocationCard store=\{r\} onSaved=\{load\} onDirty=\{locationDirty\} \/>/);
});

test("O8: a tab switch and All stores ask first; the browser warns on close", () => {
  assert.match(store, /if \(t !== tab && unsaved\) \{ setLeaving/);
  assert.match(store, /leaveIfSaved\(\(\) => \{ setDirtyParts\(\{\}\); router\.push\(allStoresHref\(\)\); \}\)/);
  assert.match(store, /title="Leave without saving\?"/);
  assert.match(store, /cancelLabel="Stay"/);
  assert.match(store, /addEventListener\("beforeunload", warn\)/);
});
