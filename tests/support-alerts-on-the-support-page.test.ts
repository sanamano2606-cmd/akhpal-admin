/**
 * SUPPORT ALERTS CAN BE SWITCHED ON FROM THE SUPPORT PAGE (admin actions
 * audit M12, Sana 5 October 2026).
 *
 * The card was only on Settings -> General, which a Support-only sub-admin
 * usually cannot open. It is now on the Support page too - the SAME card -
 * and it stays on Settings -> General (CLAUDE.md section 6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const support = readFileSync(join(root, "src/app/dashboard/support/page.tsx"), "utf8");
const settings = readFileSync(join(root, "src/app/dashboard/settings/page.tsx"), "utf8");
const nav = readFileSync(join(root, "src/lib/navigation.ts"), "utf8");
const guard = readFileSync(
  join(root, "..", "swat-delivery-app", "backend", "app_guard.py"), "utf8");

test("the Support page shows the same alerts card", () => {
  assert.match(support, /import \{ SupportAlerts \} from "\.\.\/settings\/parts-alerts";/);
  // Drawn as one strip there since Mock 197 (Sana 15 Oct 2026: "GO") - the
  // SAME card and the same state, only laid out on one line.
  assert.match(support, /<SupportAlerts slim \/>/);
});

test("the card is still on Settings -> General", () => {
  assert.match(settings, /<SupportAlerts \/>/);
});

test("Support staff may send themselves a test, on the server and in the panel", () => {
  assert.match(guard, /\("\/admin\/fcm-test", \("marketing\.notifications", "support"\)\)/);
  assert.match(nav, /\["\/admin\/fcm-test", \["marketing\.notifications", "support"\]\]/);
});
