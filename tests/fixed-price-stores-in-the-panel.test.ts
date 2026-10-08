// ─────────────────────────────────────────────────────────────────────────────
// FIXED-PRICE STORES IN THE ADMIN PANEL.  (Plan Steps 5b, 5c, 5d.)
//
// Sana, 8 October 2026: Option 2, Mock 171 APPROVED, "Do all what you
// suggest". The plan's worked example (section 4) is checked figure by figure:
//
//   Almonds 1 kg + Gift box   buying 2,150 + 80    selling 2,450 + 120
//   Walnut 250 g, 10% off     buying 600           selling 690 -> 621
//   1 x Almonds + box, 2 x Walnut, promo Rs 100, delivery 90 (rider 75)
//   customer 3,802 = vendor 3,430 + rider 75 + Takal 297
//
// What is held here: the arithmetic (run for real), that every price goes
// through ONE door, that a loss is asked about before it is saved, that a
// switch is never made without the warning, and that the money screens show
// the price difference on its own line.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  changesFor, checkFixedPrice, customerPays, earnPercent, earnTone, groupHistory, matchSheet,
  movePrice, orderMoney, planPriceChange, pricesIn, sellingAfterSwitch, sheetColumns, takalEarns,
  type PriceItem,
} from "../src/lib/fixed-prices.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const TAB = read("src/app/dashboard/stores/[id]/parts-products.tsx");
const PRICES = read("src/app/dashboard/stores/[id]/parts-products-prices.tsx");
const MODE = read("src/app/dashboard/stores/[id]/parts-price-mode.tsx");
const PAGE = read("src/app/dashboard/stores/[id]/page.tsx");
const LIST = read("src/app/dashboard/stores/page.tsx");
const CREATE = read("src/app/dashboard/stores/parts-create-store.tsx");
const EARN = read("src/app/dashboard/earnings/page.tsx");
const DASH = read("src/app/dashboard/page.tsx");
const ORDER = read("src/app/dashboard/orders/parts-order-panel.tsx");
const API = read("src/lib/api-stores.ts");
const CORE = read("src/lib/api-core.ts");

const WALNUT: PriceItem = {
  id: "walnut", name: "Walnut 250 g", selling_price: 690, discount_percent: 10, customer_pays: 621,
  buying_price: 600, takal_earns: 21, missing: false, loss: false, is_available: true, options: [],
};
const ALMONDS: PriceItem = {
  id: "almonds", name: "Almonds", selling_price: 1250, discount_percent: 0, customer_pays: 1250,
  buying_price: 1100, takal_earns: 150, missing: false, loss: false, is_available: true,
  options: [
    { id: "half", kind: "size", label: "500 g", selling_price: 1250, has_own_price: false, customer_pays: 1250,
      buying_price: null, uses_buying_price: 1100, takal_earns: 150, missing: false, loss: false, is_available: true },
    { id: "kg", kind: "size", label: "1 kg", selling_price: 2450, has_own_price: true, customer_pays: 2450,
      buying_price: 2150, uses_buying_price: 2150, takal_earns: 300, missing: false, loss: false, is_available: true },
    { id: "gift", kind: "extra", label: "Gift box", selling_price: 120, has_own_price: true, customer_pays: 120,
      buying_price: 80, uses_buying_price: 80, takal_earns: 40, missing: false, loss: false, is_available: true },
  ],
};
const PISTACHIO: PriceItem = {
  id: "pista", name: "Pistachio 250 g", selling_price: 1150, discount_percent: 0, customer_pays: 1150,
  buying_price: 1200, takal_earns: -50, missing: false, loss: true, is_available: true, options: [],
};

// ── 1. THE ARITHMETIC - the server's, to the rupee ──────────────────────────

test("walnut Rs 690 at 10% off: the customer pays Rs 621, Takal earns Rs 21 (3%)", () => {
  assert.equal(customerPays(690, 10), 621);
  assert.equal(takalEarns(621, 600), 21);
  assert.equal(earnPercent(21, 621), 3);
  assert.equal(earnTone(21, 621), "low", "under 5% is orange - the discount is Takal's");
  assert.equal(earnTone(300, 2450), "good");
});

test("20% off is Rs 552 - a loss of Rs 48 each, shown as a loss", () => {
  assert.equal(customerPays(690, 20), 552);
  assert.equal(takalEarns(552, 600), -48);
  assert.equal(earnTone(-48, 552), "loss");
});

test("no buying price: nothing to earn yet, and it is red", () => {
  assert.equal(takalEarns(480, null), null);
  assert.equal(earnTone(null, 480), "missing");
});

test("prices are whole rupees; a product or size buys for at least Rs 1; an extra may be free", () => {
  assert.deepEqual(checkFixedPrice("520", "buying", "product"), { ok: true, value: 520 });
  assert.deepEqual(checkFixedPrice("Rs 1,150", "selling", "product"), { ok: true, value: 1150 });
  assert.equal(checkFixedPrice("519.50", "buying", "product").ok, false);
  assert.match((checkFixedPrice("519.50", "buying", "product") as any).reason, /whole rupees/);
  assert.equal(checkFixedPrice("0", "buying", "product").ok, false);
  assert.equal(checkFixedPrice("0", "buying", "size").ok, false);
  assert.deepEqual(checkFixedPrice("0", "buying", "extra"), { ok: true, value: 0 });
  assert.deepEqual(checkFixedPrice("+80", "buying", "extra"), { ok: true, value: 80 });
});

test("switching keeps what customers pay: walnut Rs 657 + 5% = Rs 690; 2,450 + 5% = 2,573", () => {
  assert.equal(sellingAfterSwitch(657, 5), 690);
  assert.equal(sellingAfterSwitch(2450, 5), 2573);
});

// ── 2. CHANGE MANY PRICES AT ONCE (Mock 171-4) ──────────────────────────────

test("up 5%, whole rupees, half going up: 1,250 -> 1,313; 600 -> 630; 690 -> 725", () => {
  assert.equal(movePrice(1250, "up", "pct", 5), 1313);
  assert.equal(movePrice(600, "up", "pct", 5), 630);
  assert.equal(movePrice(690, "up", "pct", 5), 725);
  assert.equal(movePrice(100, "down", "rs", 150), 0, "never below 0");
});

test("the before -> after table of Mock 171-4, line for line", () => {
  const plan = planPriceChange([ALMONDS, WALNUT, PISTACHIO], "both", "up", "pct", 5);
  const line = (k: string) => plan.find((l) => l.key === k)!;
  assert.deepEqual([line("v:half").buyingAfter, line("v:half").sellingAfter], [1155, 1313],
    "500 g has no price of its own - it follows the product");
  assert.deepEqual([line("v:kg").buyingAfter, line("v:kg").sellingAfter, line("v:kg").earnAfter], [2258, 2573, 315]);
  assert.deepEqual([line("v:gift").buyingAfter, line("v:gift").sellingAfter, line("v:gift").earnAfter], [84, 126, 42]);
  assert.deepEqual([line("p:walnut").sellingAfter, line("p:walnut").paysAfter, line("p:walnut").earnAfter], [725, 653, 23]);
  assert.deepEqual([line("p:pista").earnBefore, line("p:pista").earnAfter], [-50, -52], "still a loss - and shown");
  assert.equal(line("p:almonds").hidden, true, "a product sold in sizes is drawn by its sizes");
});

test("only what really changes is sent - and a size never gets a price of its own by accident", () => {
  const plan = planPriceChange([ALMONDS, WALNUT], "both", "up", "pct", 5);
  const sent = changesFor(plan, [ALMONDS, WALNUT]);
  const half = sent.find((c) => c.variant_id === "half");
  assert.equal(half, undefined, "500 g follows the product's prices; nothing is sent for it");
  assert.deepEqual(sent.find((c) => c.product_id === "almonds" && !c.variant_id), { product_id: "almonds", buying_price: 1155, selling_price: 1313 });
  assert.deepEqual(sent.find((c) => c.variant_id === "kg"), { product_id: "almonds", variant_id: "kg", buying_price: 2258, selling_price: 2573 });
  assert.equal(pricesIn(sent), 8, "almonds 2 + 1 kg 2 + gift box 2 + walnut 2");
  const onlySelling = changesFor(planPriceChange([WALNUT], "selling", "up", "rs", 10), [WALNUT]);
  assert.deepEqual(onlySelling, [{ product_id: "walnut", selling_price: 700 }]);
});

test("a buying price that is not set stays not set - it is still flagged missing", () => {
  const raisins: PriceItem = { ...WALNUT, id: "raisins", name: "Raisins", buying_price: null, takal_earns: null, missing: true, discount_percent: 0 };
  const sent = changesFor(planPriceChange([raisins], "both", "up", "pct", 5), [raisins]);
  assert.deepEqual(sent, [{ product_id: "raisins", selling_price: 725 }]);
});

// ── 3. PRICE HISTORY AND THE PRICES SHEET ───────────────────────────────────

test("one line per save: buying 600 -> 630 and selling 690 -> 725 together", () => {
  const rows = [
    { product_id: "walnut", variant_id: null, item_name: "Walnut", field: "buying_price", old_value: 600, new_value: 630,
      changed_by: "u1", changed_by_name: "Sana", changed_by_role: "admin", created_at: "2026-10-12T11:10:05Z" },
    { product_id: "walnut", variant_id: null, item_name: "Walnut", field: "selling_price", old_value: 690, new_value: 725,
      changed_by: "u1", changed_by_name: "Sana", changed_by_role: "admin", created_at: "2026-10-12T11:10:06Z" },
    { product_id: "walnut", variant_id: null, item_name: "Walnut", field: "buying_price", old_value: null, new_value: 600,
      changed_by: "u1", changed_by_name: "Sana", changed_by_role: "admin", created_at: "2026-10-09T06:02:00Z" },
  ] as any;
  const lines = groupHistory(rows);
  assert.equal(lines.length, 2);
  assert.deepEqual([lines[0].buying, lines[0].selling], [{ old: 600, new: 630 }, { old: 690, new: 725 }]);
  assert.deepEqual(lines[1].buying, { old: null, new: 600 });
  assert.equal(lines[0].who, "Sana");
});

test("a prices sheet matches products of THIS store by name, and never invents one", () => {
  assert.deepEqual(sheetColumns(["Product", "Size", "Buying price", "Selling price"]), { name: 0, size: 1, buying: 2, selling: 3 });
  const m = matchSheet([
    ["Product", "Size", "Buying price", "Selling price"],
    ["walnut 250 g", "", "620", "725"],
    ["Almonds", "1 kg", "2200", ""],
    ["Almonds", "2 kg", "4000", "4500"],
    ["Saffron", "", "900", "1000"],
    ["Pistachio 250 g", "", "1200.5", ""],
  ], [WALNUT, ALMONDS, PISTACHIO]);
  assert.deepEqual([m[0].item?.id, m[0].buying, m[0].selling, m[0].problem], ["walnut", 620, 725, null]);
  assert.deepEqual([m[1].option?.id, m[1].buying, m[1].selling], ["kg", 2200, null]);
  assert.match(m[2].problem!, /not a size or extra/);
  assert.equal(m[3].problem, "not found in this store");
  assert.match(m[4].problem!, /whole rupees/);
  assert.equal(m[4].row, 6, "the sheet's own row number");
});

// ── 4. ONE ORDER (Mock 171-5) ───────────────────────────────────────────────

test("order of the worked example: 3,802 = 3,430 + 75 + 297", () => {
  const m = orderMoney(
    { subtotal: 3812, vendor_subtotal: 3430, discount: 100, delivery_fee: 90, rider_earning: 75, total_amount: 3802, credit_used: 0 },
    [{ product_name: "Almonds", variant_label: "1 kg + Gift box", quantity: 1, price: 2570, base_price: 2230 },
     { product_name: "Walnut 250 g", quantity: 2, price: 621, base_price: 600 }]);
  assert.deepEqual(m.lines.map((l) => [l.customer, l.vendor, l.takal]), [[2570, 2230, 340], [1242, 1200, 42]]);
  assert.deepEqual(m.goods, { customer: 3812, vendor: 3430, takal: 382 });
  assert.deepEqual(m.delivery, { customer: 90, rider: 75, takal: 15 });
  assert.deepEqual(m.total, { customer: 3802, vendor: 3430, rider: 75, takal: 297 });
  assert.equal(m.checksOut, true);
});

test("wallet credit is Takal's money - the order still adds up", () => {
  const m = orderMoney({ subtotal: 1242, vendor_subtotal: 1200, discount: 0, delivery_fee: 90, rider_earning: 75,
    total_amount: 1282, credit_used: 50 }, []);
  assert.equal(m.total.takal, 7, "42 + 15 - 50");
  assert.equal(m.checksOut, true);
});

// ── 5. THE SCREENS REALLY DO IT ─────────────────────────────────────────────

test("every price of a fixed-price store goes through the ONE prices door", () => {
  assert.match(API, /\/admin\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/set-prices`, \{\s*method: "PUT"/);
  assert.match(TAB, /const savePrices = async \(changes: PriceChange\[\]\): Promise<boolean> => \{/);
  assert.match(TAB, /apiClient\.setStorePrices\(restaurantId, changes, false\)/);
  assert.doesNotMatch(PRICES, /updateMenuItem|updateVariant|bulkChangeProducts/, "no ordinary door is used for a price");
  // The bulk discount of a fixed-price store goes through it too.
  assert.match(TAB, /if \(ask\.action === "discount" && fixed\) \{[\s\S]*?savePrices\(pickedOnPage\.map\(\(p\) => \(\{ product_id: p\.id, discount_percent: n \}\)\)\)/);
});

test("a loss is saved only after 'Save at a loss?' - the server's list is shown", () => {
  assert.match(CORE, /\{ status: response\.status, detail: error\.detail \}/, "the server's answer reaches the screen");
  assert.match(TAB, /if \(e\?\.status === 409 && Array\.isArray\(e\.detail\?\.losses\)\) \{/);
  assert.match(TAB, /apiClient\.setStorePrices\(restaurantId, lossAsk\.changes, true\)/);
  assert.match(PRICES, /Yes, save at a loss/);
  assert.match(PRICES, /Loss \{money\(l\.loss_each\)\} each/);
});

test("the red buttons: 'Buying price missing' and 'Loss', for a fixed-price store only", () => {
  assert.match(TAB, /\{ id: "missing_buying", label: "Buying price missing", tone: "alarm" \}/);
  assert.match(TAB, /\{ id: "loss", label: "Loss", tone: "alarm" \}/);
  assert.match(TAB, /\(fixed \? \[FILTERS\[0\], \.\.\.PRICE_FILTERS, \.\.\.FILTERS\.slice\(1\)\] : FILTERS\)/);
  assert.match(TAB, /const fixed = !staffView && data\?\.price_mode === "fixed";/, "Mall staff never see buying prices");
});

test("a row customers cannot order is red and says why", () => {
  assert.match(TAB, /const red = !!n\.failed \|\| !!priced\?\.missing \|\| !!priced\?\.loss;/);
  assert.match(TAB, /Customers cannot order it until/);
  assert.match(PRICES, /Add buying price/);
});

test("'Takal earns' is worked out AS YOU TYPE, before anything is saved", () => {
  assert.match(PRICES, /const earnNow = takalEarns\(paysNow, buyNow\);/);
  assert.match(PRICES, /as you type - Enter asks first/);
});

test("the switch: never at once - a warning with this store's numbers, and 'Fill buying prices first'", () => {
  assert.match(MODE, /onClick=\{openAsk\}/);
  assert.match(MODE, /Fill buying prices first/);
  assert.match(MODE, /apiClient\.setPriceMode\(String\(store\.id\), choice\)/);
  assert.match(MODE, /const allowed = canAccess\("stores\.prices"\);/);
  assert.match(MODE, /still need one/);
  assert.match(PAGE, /onFillBuyingFirst=\{\(\) => \{ setBuyingFirst\(true\); openTab\("products"\); \}\}/);
  assert.match(PAGE, /buyingFirst=\{buyingFirst && !fixedStore\}/);
});

test("a new store can be fixed-price from day one - only by somebody with 'Store prices'", () => {
  assert.match(CREATE, /const mayFixPrices = useMemo\(\(\) => canAccess\("stores\.prices"\), \[\]\);/);
  assert.match(CREATE, /if \(fixedPrice && mayFixPrices\) \{[\s\S]*?apiClient\.setPriceMode\(st\.id, "fixed"\)/);
});

test("the stores list locks the commission of a fixed-price store", () => {
  assert.match(LIST, /restaurant\.price_mode === "fixed" \? \(/);
  assert.match(LIST, /Fixed-price - no commission/);
});

test("the money screens show the price difference on its own line", () => {
  assert.match(EARN, /title="Price difference" badge="NEW"/);
  assert.match(EARN, /value=\{p\.price_difference \?\? 0\}/);
  assert.match(EARN, /of which sold at a loss/);
  assert.match(EARN, /Fixed-price stores —/);
  for (const k of ["goods_charged", "paid_to_shop", "takal_kept"]) assert.ok(EARN.includes(`r.${k}`), k);
  assert.match(DASH, /data\.price_difference_earnings/);
  assert.match(ORDER, /o\.price_mode === "fixed" && \(\(\) => \{\s*const m = orderMoney\(o, items\);/);
  assert.match(ORDER, /Checks out/);
});
