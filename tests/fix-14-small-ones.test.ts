// ─────────────────────────────────────────────────────────────────────────────
// FIX 14 (All Stores audit; Sana 14 Nov 2026: "GO all 14") - six small ones.
//   a. Orders tab: plain status words + "See all this shop's orders"
//   b. Money tab: "Pay this shop" (opens Payments with the shop found)
//   c. Settings: "Open 24 hours" switch + a 3-line Description
//   e. "📷 No picture": the big number is what customers see
//   f. Product editor: the whole picture, not cut
// (d - the unused 100-product read - is guarded in the server's tests.)
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const store = read("src/app/dashboard/stores/[id]/page.tsx");
const liveOrders = read("src/app/dashboard/stores/[id]/parts-orders.tsx");
const ordersPage = read("src/app/dashboard/orders/page.tsx");
const payments = read("src/app/dashboard/payments/page.tsx");
const settings = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const list = read("src/app/dashboard/stores/page.tsx");
const api = read("src/lib/api-stores.ts");
const editor = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");

test("14a: plain status words, and the way to all of a shop's orders", () => {
  assert.match(store, /<OrderStatusBadge status=\{o\.status\} \/>/);
  assert.doesNotMatch(store, />\{o\.status\}</);
  assert.match(liveOrders, /\{orderStatusLabel\(s\)\}/);
  assert.doesNotMatch(liveOrders, /s\.replace\(\/_\/g, " "\)/);
  assert.match(store, /href=\{`\/dashboard\/orders\?shop=\$\{encodeURIComponent\(String\(id\)\)\}&shop_name=/);
  // the Orders page reads it, sends restaurant_id, and shows a removable "Shop:" pill
  assert.match(ordersPage, /const sid = sp\.get\("shop"\) \|\| "";/);
  assert.match(ordersPage, /restaurant_id: shopId,/);
  assert.match(ordersPage, /\[queue, status, search, type, payment, dateFrom, dateTo, sort, shopId\]/);
  assert.match(ordersPage, /shopId && \{ key: "shop", label: `Shop: \$\{shopName \|\| "one shop"\}`/);
});

test("14b: Pay this shop - only for those who may open Payments, and it only fills the search", () => {
  assert.match(store, /useEffect\(\(\) => setMayPay\(mayAccess\("payments\.balances", getMyPerms\(\)\)\), \[\]\);/);
  assert.match(store, /\{mayPay && \(\s*<Link data-pay-this-shop/);
  // every hook above the early return
  assert.ok(store.indexOf("const [mayPay, setMayPay]") < store.indexOf("if (error && !data) return <ErrorState"));
  assert.match(payments, /if \(find\) \{ setTab\("restaurants"\); setQ\(find\.slice\(0, 80\)\); \}/);
});

test("14c: Open 24 hours is the same time twice, like Create store and the server", () => {
  const isOpen24 = (o: string, c: string) => !!o && o === c;
  assert.equal(isOpen24("00:00", "00:00"), true);
  assert.equal(isOpen24("08:00", "22:00"), false);
  assert.equal(isOpen24("", ""), false);
  assert.match(settings, /export function isOpen24\(opening: string, closing: string\): boolean \{\n\s+return !!opening && opening === closing;/);
  assert.match(settings, /opening_time: on \? OPEN_24_TIME : "08:00", closing_time: on \? OPEN_24_TIME : "22:00"/);
  assert.match(settings, /role="switch" aria-checked=\{isOpen24\(f\.opening_time, f\.closing_time\)\} data-open-24/);
  assert.match(settings, /bg-takal-yellow ring-\[1\.5px\] ring-inset ring-takal-ink/);   // Mock 240's yellow switch
  assert.match(settings, /<textarea data-settings-description rows=\{3\}/);
});

test("14e: the big No picture number is what customers see; each shop's number is unchanged", () => {
  assert.match(list, /deriveStatus\(r\) === "approved" && !isDemoShop\(r\.id\)/);
  assert.match(list, /apiClient\.getNoPictureCounts\(ids, liveIds\)/);
  assert.match(list, /\(noPicSeen \?\? noPicTotal\)\.toLocaleString\(\)/);
  assert.match(api, /&on_sale_ids=\$\{liveIds\.map\(encodeURIComponent\)\.join\(","\)\}/);
});

test("14f: the editor shows the whole picture", () => {
  const i = editor.indexOf("data-editor-picture");
  const block = editor.slice(i, i + 600);
  assert.match(block, /object-contain/);
  assert.doesNotMatch(block, /object-cover/);
});
