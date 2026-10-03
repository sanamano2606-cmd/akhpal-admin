/**
 * Sana, 2 October 2026: the Dashboard's System Health box shows for anyone
 * who can open Settings.
 *
 * It asked canAccess("settings") - the WHOLE Settings tab. The old permission
 * word "settings" turns into the options inside the tab, never the tab key, and
 * a new-style sub-admin given only Settings -> General does not hold the tab
 * key either. Both could open Settings and saw no System Health.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mayOpen, NEW_FORMAT_MARK } from "../src/lib/tabs.ts";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "page.tsx"),
  "utf8",
);
const health = (saved: string[]) =>
  mayOpen("settings", saved) || mayOpen("settings.general", saved);

test("the reason for the fix: the tab key alone missed two kinds of account", () => {
  assert.equal(mayOpen("settings", ["settings"]), false, "old word");
  assert.equal(mayOpen("settings", [NEW_FORMAT_MARK, "settings.general"]), false, "General only");
});

test("the new rule: whole tab, General, or the old word - and nobody else", () => {
  assert.equal(health([NEW_FORMAT_MARK, "settings"]), true);
  assert.equal(health([NEW_FORMAT_MARK, "settings.general"]), true);
  assert.equal(health(["settings"]), true);
  assert.equal(health([NEW_FORMAT_MARK, "stores.all"]), false);
  assert.equal(health([NEW_FORMAT_MARK, "settings.letterhead"]), false);
});

test("the page loads AND shows the box by that one rule", () => {
  assert.ok(PAGE.includes('return canAccess("settings") || canAccess("settings.general");'));
  assert.ok(PAGE.includes("maySeeHealth()\n          ? fetch(`${base}/health`)"));
  assert.ok(PAGE.includes("const showHealth = maySeeHealth();"));
  assert.ok(!PAGE.includes('canAccess("settings")\n'), "no second copy of the old check");
});
