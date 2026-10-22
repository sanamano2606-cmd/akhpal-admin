// ─────────────────────────────────────────────────────────────────────────────
// THE SERVER'S NEW MONEY FIELDS ARE SHOWN, NOT DROPPED (final money audit,
// fixer I, 22 Oct 2026). Fixer B added them to the replies; a field the
// panel never reads helps nobody.
//
//   store page / Balances   `outstanding` is signed + `overpaid`  (AREA-4-13)
//                           Earned Rs 5,000, paid Rs 10,000: "Rs 0" / "Rs -5,000"
//                           -> "Rs 5,000 overpaid"
//   rider page              `money_hidden`, `overpaid`            (AREA-3-18, 3-14)
//   Earnings                `kept_rate` beside `take_rate`        (AREA-6-10)
//   Referrals               a null bill count is "not known"      (AREA-6-4)
//   Promo cost              `discount_at_checkout` beside `discount` (AREA-6-5)
//   Products tab            `price_mode_checked: false`           (AREA-7-9 side)
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("one helper words a signed balance with its overpaid figure", () => {
  const src = read("src/app/dashboard/payments/money.ts");
  assert.match(src, /export const owedOrOverpaid = \(balance: any, overpaid\?: any\) =>\s*\(Number\(overpaid\) \|\| 0\) >= 0\.5 \? money\(overpaid\) \+ " overpaid" : signed\(balance\);/);
  assert.match(src, /return v < 0 \? money\(Math\.abs\(v\)\) \+ " overpaid" : money\(v\);/,
    "a minus balance from an older server still reads as overpaid");
});

test("the store page shows an overpaid shop as overpaid, in both places", () => {
  const page = read("src/app/dashboard/stores/[id]/page.tsx");
  assert.equal((page.match(/owedOrOverpaid\(stats\.outstanding, stats\.overpaid\)/g) || []).length, 2);
  assert.ok(!page.includes("money(stats.outstanding)"), "Rs -5,000 / Rs 0 would come back");
  assert.match(page, /data\.incomplete \? "not known" : owedOrOverpaid/);
});

test("Balances: an overpaid shop or rider is never a red minus", () => {
  const shops = read("src/app/dashboard/payments/parts-tab-restaurants.tsx");
  assert.ok(shops.includes("{signed(r.outstanding)}"));
  assert.ok(!shops.includes("money(r.outstanding)"));
  const riders = read("src/domains/riders/RiderMoney.tsx");
  assert.match(riders, /\(Number\(r\.outstanding\) \|\| 0\) < 0\s*\? <span className="tabular-nums text-sky-700">\{signed\(r\.outstanding\)\}<\/span>/);
});

test("the rider page says why his money is hidden, and never shows the customer's fee as his pay", () => {
  const page = read("src/app/dashboard/riders/[id]/page.tsx");
  const i = page.indexOf("{data.money_hidden ? (");
  assert.ok(i > 0, "money_hidden is not read");
  assert.ok(page.slice(i, i + 400).includes("Money hidden — needs the Riders → Earnings permission"));
  assert.ok(page.includes('{data.money_hidden ? "—" : money(o.rider_earning ?? o.delivery_fee)}'),
    "with rider_earning left out, `?? o.delivery_fee` would show the CUSTOMER's fee as his pay");
  assert.match(page, /\(Number\(stats\.overpaid\) \|\| 0\) >= 0\.5 \? owedOrOverpaid\(stats\.balance, stats\.overpaid\)/);
});

test("Earnings: earns (take_rate) AND keeps (kept_rate), a minus kept said in words", () => {
  const page = read("src/app/dashboard/earnings/page.tsx");
  assert.ok(page.includes("{Math.round(p.take_rate ?? 0)}"));
  assert.match(page, /p\.kept_rate < 0\s*\? `nothing \(minus Rs \$\{Math\.abs\(Math\.round\(p\.kept_rate\)\)\}\)`\s*: `about Rs \$\{Math\.round\(p\.kept_rate\)\}`/);
});

test("Referrals: a bill count that could not be read is not shown as 0", () => {
  const page = read("src/app/dashboard/payments/referrals/page.tsx");
  assert.ok(!page.includes("orders_credit_came_off ?? 0"));
  assert.ok(page.includes('t.orders_credit_came_off == null ? "Number of bills not known"'));
});

test("Promo cost: what really went, and the checkout figure when it differs", () => {
  const panel = read("src/app/dashboard/marketing/parts-promo-cost.tsx");
  assert.ok(panel.includes("{money(u.discount)}"));
  assert.ok(panel.includes("{money(u.discount_at_checkout)} at checkout"));
  assert.ok(panel.includes('{ key: "at_checkout", label: "At checkout", money: true }'));
});

test("Products tab: an unchecked price type says so in a small grey line", () => {
  const tab = read("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.match(tab, /\{data\?\.price_mode_checked === false && \(\s*<p data-price-mode-unchecked className="text-\[12px\] text-takal-ink-soft">\s*Could not check the price type just now/);
  assert.ok(read("src/lib/api-stores.ts").includes("price_mode_checked?: boolean;"));
});
