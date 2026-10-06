/**
 * ADMIN AUDIT - LOW ITEMS, THIRD GO (Sana, 6 October 2026: "OK").
 *
 *   item 7   a banner's or a code's date boxes show the day in PAKISTAN
 *   item 14  "Send a test alert" only for the staff the server lets through
 *   item 15  Home Shops "Add shop" uses its own door (logos, Marketing access)
 *   item 8   "Close office" shows the server's reason when parcels are waiting
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pkDay } from "../src/lib/pk-day.ts";
import { mayUseTheTestAlert, TEST_ALERT_SECTIONS } from "../src/lib/test-alert.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ── item 7 ──────────────────────────────────────────────────────────────────
test("a stored moment shows as its day in Pakistan", () => {
  // what the server now keeps for a banner that starts / ends on 10 October
  assert.equal(pkDay("2026-10-09T19:00:00+00:00"), "2026-10-10");
  assert.equal(pkDay("2026-10-10T18:59:59+00:00"), "2026-10-10");
  // an older row typed as a plain date is shown as it is
  assert.equal(pkDay("2026-10-10"), "2026-10-10");
  assert.equal(pkDay(null), "");
  assert.equal(pkDay(""), "");
});

test("the banner and discount-code screens read the day in Pakistan", () => {
  const banners = read("src/app/dashboard/marketing/banners/page.tsx");
  const codes = read("src/app/dashboard/marketing/page.tsx");
  assert.match(banners, /starts_at: pkDay\(banner\.starts_at\)/);
  assert.match(banners, /ends_at: pkDay\(banner\.ends_at\)/);
  assert.match(banners, /Until \$\{pkDay\(b\.ends_at\)\}/);
  assert.match(codes, /starts_at: pkDay\(p\.starts_at\)/);
  assert.match(codes, /expires_at: pkDay\(p\.expires_at\)/);
  for (const src of [banners, codes]) {
    assert.doesNotMatch(src, /String\([a-z]+\.(starts_at|ends_at|expires_at)\)\.slice\(0, 10\)/);
  }
});

// ── item 14 ─────────────────────────────────────────────────────────────────
test("the test alert follows the server's own rule", () => {
  const only = (have: string[]) => (s: string) => have.includes(s);
  assert.equal(mayUseTheTestAlert(only(["settings.general"])), false);
  assert.equal(mayUseTheTestAlert(only(["support"])), true);
  assert.equal(mayUseTheTestAlert(only(["marketing.notifications"])), true);
  const nav = read("src/lib/navigation.ts");
  assert.match(nav, /\["\/admin\/fcm-test", \["marketing\.notifications", "support"\]\]/);
  assert.deepEqual([...TEST_ALERT_SECTIONS], ["marketing.notifications", "support"]);
});

test("the button is only drawn for them", () => {
  const card = read("src/app/dashboard/settings/parts-alerts.tsx");
  assert.match(card, /const mayTest = mayUseTheTestAlert\(canAccess\);/);
  assert.match(card, /\{mayTest && \(\s*<Button[^>]*\s*onClick=\{sendTest\}/);
});

// ── item 15 ─────────────────────────────────────────────────────────────────
test("Add shop asks its own door, which carries the logos", () => {
  const dialog = read("src/app/dashboard/marketing/home-shops/parts-shop-dialog.tsx");
  assert.match(dialog, /\.getHomeShopChoices\(\)/);
  assert.doesNotMatch(dialog, /\.getRestaurants\(\)/);
  const api = read("src/lib/api-money.ts");
  assert.match(api, /async getHomeShopChoices\(\) \{\s*return this\.request\(`\/admin\/home-shops\/shop-choices`\);/);
  const server = readFileSync(join(root, "..", "swat-delivery-app", "backend", "routers", "home_shops.py"), "utf8");
  assert.match(server, /@router\.get\("\/admin\/home-shops\/shop-choices"/);
  assert.match(server, /select=id,name,vendor_type,image_url,cover_url/);
});

// ── item 8 ──────────────────────────────────────────────────────────────────
test("Close office shows the server's reason, never a bare failure", () => {
  const page = read("src/app/dashboard/orders/offices/page.tsx");
  assert.match(page, /await apiClient\.updateHub\(h\.id, \{ is_active: !h\.is_active \}\);/);
  assert.match(page, /toast\(err instanceof Error \? err\.message : "Could not update office", "error"\);/);
});
