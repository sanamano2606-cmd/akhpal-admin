/**
 * MOCK 203 v2 - STORES: EASY PRODUCT EDITING (approved by Sana 20 Oct 2026:
 * "Ok Now i approved the v2 all Mocks please Built all at once exactly as
 * Mocks and double check after you done.")
 *
 *   203-1  All Stores: the search finds PRODUCTS in every store; logos; "📷 3".
 *   203-2  Grid: Buy · Sell · Disc · Stock typed ON the card; dots; upload on
 *          the card; ☆ Featured; ON; money line; red on a loss.
 *   203-3  Table: one picture square with dots; Buying + Margin for every
 *          store; Edit only on the row under the mouse.
 *   203-4  The card up close (the same card).
 *   203-5  Buy ± / Sell ± / ★ / Pictures on the bar; rounding to Rs 10.
 *   203-6  Edit: one compact window; ‹ prev · next ›; Save & next; Ctrl+S.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { movePrice, roundToStep, planPriceChange, type PriceItem } from "../src/lib/fixed-prices.ts";

const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const TAB = code("app/dashboard/stores/[id]/parts-products.tsx");
const GRID = code("app/dashboard/stores/[id]/parts-products-grid.tsx");
const PAGE = code("app/dashboard/stores/[id]/page.tsx");
const EDITOR = code("app/dashboard/stores/[id]/ProductEditorModal.tsx");
const SELL = code("app/dashboard/stores/[id]/parts-products-sell.tsx");
const PRICES = code("app/dashboard/stores/[id]/parts-products-prices.tsx");
const LIST = code("app/dashboard/stores/page.tsx");
const API = code("lib/api-stores.ts");

// ── The arithmetic ──────────────────────────────────────────────────────────

test("round to the nearest Rs 10 - and whole rupees stay as they were", () => {
  assert.equal(roundToStep(4537, 10), 4540);
  assert.equal(roundToStep(4535, 10), 4540, "half goes up");
  assert.equal(roundToStep(6050, 10), 6050);
  assert.equal(roundToStep(1313, 1), 1313, "step 1 = unchanged");
  assert.equal(movePrice(5000, "up", "pct", 10, 10), 5500);
  assert.equal(movePrice(1250, "up", "pct", 5), 1313, "the old rule, unchanged without a step");
  assert.equal(movePrice(1250, "up", "pct", 5, 10), 1310);
});

test("Sell ± for many: before -> after, rounded to Rs 10 (Classic Shoes 5,000 + 10% = 5,500)", () => {
  const item: PriceItem = {
    id: "p1", name: "Classic Shoes", selling_price: 5000, discount_percent: 20, customer_pays: 4000,
    buying_price: 3200, takal_earns: 800, missing: false, loss: false, is_available: true, options: [],
  };
  const [line] = planPriceChange([item], "selling", "up", "pct", 10, 10);
  assert.equal(line.sellingAfter, 5500);
  assert.equal(line.paysAfter, 4400);
  assert.equal(line.earnAfter, 1200, "makes +1,200 after the change");
});

// ── 203-2 / 203-4: the card ─────────────────────────────────────────────────

test("the card has the four boxes - Buy, Sell, Disc, Stock - and Tab walks them", () => {
  assert.match(GRID, /export const cardFields = \(withBuy: boolean\): CardField\[\] =>\s*withBuy \? \["buy", "sell", "disc", "stock"\] : \["sell", "disc", "stock"\];/);
  for (const f of ['f: "buy", label: "Buy"', 'f: "sell", label: "Sell"', 'f: "disc", label: "Disc"', 'f: "stock", label: "Stock"']) {
    assert.ok(GRID.includes(f), f);
  }
  // Enter saves, Esc cancels, Tab next, ↓ ↑ the card below / above.
  assert.match(GRID, /if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); onSave\(\); \}/);
  assert.match(GRID, /else if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); onCancel\(\); \}/);
  assert.match(GRID, /else if \(e\.key === "Tab"\) \{ e\.preventDefault\(\); onTab\(e\.shiftKey\); \}/);
  assert.match(GRID, /e\.key === "ArrowDown" \|\| e\.key === "ArrowUp"/);
  // The open box is NOT a component made inside the card (it would lose focus).
  assert.match(GRID, /const box = \(\{ f, label, value, tone = "", title, wide = false \}/);
  assert.doesNotMatch(GRID, /<Box /);
});

test("the card's pictures: dots like the customer app, ‹ ›, upload on the card, ＋ Add / ★ Cover / ↺ Change", () => {
  assert.match(GRID, /data-card-dots/);
  assert.match(GRID, /aria-label="Previous picture"/);
  assert.match(GRID, /aria-label="Next picture"/);
  assert.match(GRID, /data-card-upload onClick=\{\(\) => props\.onChoose\("add"\)\}/, "no picture: the card IS the upload box");
  assert.match(GRID, /<b className="text-takal-ink">Click or drop photos<\/b>/);
  assert.match(GRID, /data-card-uploading/, "uploading shows a green bar and saves by itself");
  for (const w of ["＋ Add more", "↺ Change", "★ Cover", "＋ Add"]) assert.ok(GRID.includes(w), w);
  assert.match(TAB, /onDrop=\{\(e\) => dropped\(p, e\)\}/);
});

test("the money line: customer pays · what Takal makes - red, and the card red, on a loss", () => {
  assert.match(GRID, /export function cardMoney\(p: ShopProduct, priced: PriceItem \| undefined, fixed: boolean\)/);
  assert.match(GRID, /Pays \{n0\(m\.pays\)\}/);
  assert.match(GRID, /` · LOSS \$\{n0\(-m\.makes\)\}`/);
  assert.match(GRID, /red \? "border-2 border-takal-red"/);
  assert.match(GRID, /＋ add<\/b>/, "a missing buying price is a red '＋ add'");
});

test("every save from a card goes through the SAME doors as the list", () => {
  const save = TAB.slice(TAB.indexOf("const saveCard = async"), TAB.indexOf("// ── The dots: slide"));
  assert.match(save, /const ok = await savePrices\(\[change\]\);/, "Buy (and a fixed-price store's Sell / Disc) - the one prices door");
  assert.match(save, /await apiClient\.updateMenuItem\(p\.id, \{ \[key\]: c\.value \}\);/, "name, stock, a standard store's price and discount");
  assert.match(save, /checkFixedPrice\(raw, f === "buy" \? "buying" : "selling", "product"\)/);
  assert.match(save, /checkDiscount\(raw\)/);
  assert.match(save, /checkStock\(raw\)/);
  // An emptied Buy box never takes the buying price off by surprise.
  assert.match(save, /if \(f === "buy" && raw\.trim\(\) === ""\) \{ go\(\); return; \}/);
});

test("a buying price only where there is one - never on a standard store, never for Mall staff", () => {
  // Sana, 21 Oct 2026, on Wakeel (Standard · 10%): "This is not a fixed store type".
  assert.match(TAB, /const showBuy = fixed \|\| prepare;/);
  assert.match(TAB, /const fixed = !staffView && data\?\.price_mode === "fixed";/);
  assert.match(TAB, /const prepare = !staffView && !fixed && buyingFirst;/);
  assert.match(TAB, /showBuy=\{showBuy\}/);
  assert.match(TAB, /FILTERS\.filter\(\(f\) => \(!staffView \|\| f\.id !== "featured"\) && \(showBuy \|\| !PRICE_FILTER_IDS\.includes\(f\.id\)\)\)/);
});

test("a standard store never reads buying prices - it shows Takal's commission instead", () => {
  assert.match(TAB, /useStorePrices\(restaurantId, showBuy\);/);
  assert.doesNotMatch(API, /\?ids=\$\{ids/, "the prices door is read whole, and only for a store that has buying prices");
  assert.match(TAB, /const commission = !staffView && !showBuy && commissionPercent != null/);
  assert.match(code("app/dashboard/stores/[id]/page.tsx"), /commissionPercent=\{fixedStore \? null : r\.commission_percent \?\? state\.commission_in_use_percent \?\? null\}/);
  assert.match(GRID, /\{!showBuy && takes !== null && ` · Takal \$\{n0\(takes\)\}`\}/, "the card: Pays 4,125 · Takal 413");
  assert.match(GRID, /wide: !showBuy/, "Stock fills the empty Buy place");
  assert.match(TAB, /Takal \{commission\}%/, "the table's commission column");
  assert.match(EDITOR, / · Takal \$\{commission\}% = \$\{money\(takes\)\} · shop gets/);
  assert.match(SELL, /commission != null \? `Takal \$\{commission\}%` : "Makes"/);
});

test("the commission is worked out like the server's order: whole rupees, half up", async () => {
  const { commissionOf, customerPays } = await import("../src/lib/fixed-prices.ts");
  assert.equal(commissionOf(customerPays(5500, 25), 10), 413, "Rs 4,125 at 10% -> 412.5 -> Rs 413");
  assert.equal(commissionOf(2700, 10), 270);
  assert.equal(commissionOf(null, 10), null);
  assert.equal(commissionOf(2700, null), null);
});

test("Grid or Table, remembered; '/' jumps to search; Ctrl+V pastes a picture on the card under the mouse", () => {
  assert.match(TAB, /const VIEW_KEY = "takal_products_view";/);
  assert.match(TAB, /window\.localStorage\.setItem\(VIEW_KEY, v\)/);
  assert.match(TAB, /if \(e\.key === "\/" && !typingSomewhere\(e\.target\)\) \{ e\.preventDefault\(\); searchRef\.current\?\.focus\(\); \}/);
  assert.match(TAB, /window\.addEventListener\("paste", onPaste\);/);
  assert.match(TAB, /uploadPictures\(p, files, "add"\);/);
});

test("the new filters: No picture, No buy price, Loss, Out, Low, Off, Disc, ★ - pressed again shows all", () => {
  const ids = [...TAB.matchAll(/\{ id: "([a-z_]+)", label: "([^"]+)", tone:/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(ids, ["no_picture:No picture", "missing_buying:No buy price", "loss:Loss", "out_of_stock:Out",
    "low:Low", "off:Off", "discount:Disc", "featured:★"]);
  assert.match(TAB, /onClick=\{\(\) => \{ setShow\(on \? "all" : f\.id\); setPage\(1\); \}\}/);
  assert.match(API, /\| "low" \| "discount"/);
});

// ── 203-3: the table ─────────────────────────────────────────────────────────

test("the table: Buying and Margin only with buying prices; a standard store's commission column; the size rows keep their columns", () => {
  assert.match(TAB, /const cols = fixed \? COLUMNS_FIXED : showBuy \? COLUMNS \+ 2 : commission !== null \? COLUMNS \+ 1 : COLUMNS;/);
  assert.match(TAB, /Margin<span title="Margin = what the customer pays − the buying price/);
  assert.match(TAB, /marginColumn=\{!fixed && \(showBuy \|\| commission !== null\)\}/);
  assert.match(code("app/dashboard/stores/[id]/parts-products-edit.tsx"), /\{marginColumn && <td className="border-b border-\[#EFEFEA\]" \/>\}/);
  assert.match(TAB, /py-1 border-b border-\[#F0F0F0\]/, "shorter rows");
  assert.doesNotMatch(TAB, /py-1\.5 border-b border-\[#F0F0F0\]/);
});

// ── 203-5: many at once ─────────────────────────────────────────────────────

test("the bar: Buy ±, Sell ±, Disc %, Stock, Category, ON, OFF, ★, Pictures, Remove", () => {
  const bar = TAB.slice(TAB.indexOf('role="toolbar" aria-label="Change the ticked products"'));
  const order = ["Buy ±", "Sell ±", "Disc %", "Stock", "Category", '"ON"', '"OFF"', '"★"', '"🖼"', "Remove"];
  let at = 0;
  for (const w of order) {
    const i = bar.indexOf(w, at);
    assert.ok(i > 0, w);
    at = i;
  }
  assert.match(TAB, /targets=\{fixed \? \["buying", "selling", "both"\] : \["buying"\]\}/, "a standard store's selling price is its own");
  assert.match(SELL, /await apiClient\.updateMenuItem\(l\.id, \{ price: l\.after \}\);/);
  assert.doesNotMatch(PRICES, /updateMenuItem/, "the fixed-price file still uses only the prices door");
  assert.match(SELL, /would sell below the buying price/);
  assert.match(TAB, /const featureMany = async \(\) => \{/);
});

// ── 203-6: the edit window ──────────────────────────────────────────────────

test("Edit is ONE compact window: three columns, Buy · Sell · Disc · Stock on one line, Save always in sight", () => {
  assert.match(EDITOR, /<div data-product-editor className="bg-white rounded-2xl w-full max-w-\[1100px\] max-h-\[92vh\] flex flex-col overflow-hidden"/);
  assert.match(EDITOR, /lg:grid-cols-\[230px_minmax\(0,1fr\)_250px\]/);
  for (const col of ['data-editor-col="pictures"', 'data-editor-col="details"', 'data-editor-col="more"']) assert.ok(EDITOR.includes(col), col);
  assert.match(EDITOR, /<div className=\{`grid gap-2 \$\{showBuy \? "grid-cols-4" : "grid-cols-3"\}`\}>/);
  assert.match(EDITOR, /data-testid="money-line"/);
  assert.match(EDITOR, /data-editor-picture/, "the big picture with dots");
  assert.match(EDITOR, /data-testid="size-prices"/, "each size its own buy / sell");
  assert.match(EDITOR, /Save &amp; next ›/);
  assert.match(EDITOR, /‹ prev<\/button>/);
  assert.match(EDITOR, /if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key\.toLowerCase\(\) === "s"\)/);
  // Prices typed here go through the one prices door, a loss asks first.
  assert.match(EDITOR, /await apiClient\.setStorePrices\(restaurantId, changes, confirm\);/);
  assert.match(EDITOR, /if \(e\?\.status === 409 && Array\.isArray\(e\.detail\?\.losses\)\)/);
});

test("the products tab hands the window its prices, prev / next and Save & next", () => {
  assert.match(TAB, /key=\{editor\.product\?\.id \|\| "new"\}/);
  assert.match(TAB, /priced=\{editor\.product \? priceOf\.get\(editor\.product\.id\) : undefined\}/);
  assert.match(TAB, /onSavedNext=\{\(\) => \{/);
});

// ── 203-2: the one line ──────────────────────────────────────────────────────

test("the store's one line keeps every action: status buttons, ⋯ with owner, figures and Featured", () => {
  assert.match(PAGE, /<StoreStatusActions r=\{r\} status=\{status\}/);
  assert.match(PAGE, /onClick=\{\(\) => setMoreOpen\(\(o\) => !o\)\}/);
  assert.match(PAGE, /href=\{`tel:\$\{owner\.phone\}`\}/);
  assert.match(PAGE, /his login is switched off/);
  assert.match(PAGE, /⚠ No map pin — hidden from customers/);
});

// ── 203-1: All Stores ───────────────────────────────────────────────────────

test("All Stores: Products | Stores search, results with Open ›, logos and '📷 No picture'", () => {
  assert.match(LIST, /\(\["products", "stores"\] as const\)\.map/);
  assert.match(LIST, /apiClient\.findProductsInEveryStore\(words, show, limit\)/);
  assert.match(LIST, /href=\{`\/dashboard\/stores\/\$\{p\.restaurant_id\}\?product=\$\{encodeURIComponent\(p\.id\)\}&find=\$\{encodeURIComponent\(p\.name\)\}`\}/);
  assert.match(LIST, /data-no-picture-everywhere/);
  assert.match(LIST, /apiClient\.getNoPictureCounts\(ids\)/, "asked AFTER the list is drawn");
  assert.match(LIST, /restaurant\.image_url/, "each store's logo");
  // The store opened from a result finds and rings the product.
  assert.match(TAB, /const f = q0\.get\("find"\);/);
  assert.match(TAB, /highlight === p\.id \? "rounded-\[13px\] ring-4 ring-takal-yellow"/);
  assert.match(API, /\/admin\/stores\/find-products\?/);
  assert.match(API, /\/admin\/stores\/no-picture-counts\?ids=/);
});
