// ─────────────────────────────────────────────────────────────────────────────
// A MALL'S STAFF WINDOW  (Mock 172-4 / 172-5, approved by Sana 8 October 2026;
// Step 5, 9 October 2026).
//
// Sana: "staff log in should have access to all stores of that Mall." One
// login, a row of store buttons, "All stores" as one overview, Move to another
// store, and a mall basket as ONE order that the staff take a step at a time.
// The rules are checked as functions; the screens for the calls and words that
// carry them.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  actionsAt, isMallLogin, partsFor, pickedStore, staffStores, storePrices, wholeOrders,
  windowAddress, withNewLogo,
} from "../src/lib/mall-staff-window.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const shop = (id: string, name = id, vendor_type = "clothing_store") => ({
  id, name, vendor_type, address: null, phone: null, description: null, image_url: null,
  opening_time: null, closing_time: null, minimum_order: null, is_open: true, is_approved: true,
  latitude: null, longitude: null, updated_at: null,
});
const user = { id: "u", full_name: "Imran", phone: "", email: null, must_change_password: false };
const MALL = { id: "m", name: "Wakeel Shopping Mall", image_url: null, cover_url: null, address: null, phone: null, minimum_order: 1000 };
const mallLogin = { user, shop: shop("fa"), shops: [shop("fa"), shop("be"), shop("kt")], mall: MALL };
const oneShop = { user, shop: shop("fa") };

// ── 1. Who gets the store buttons ───────────────────────────────────────────

test("a whole-mall login gets the store buttons; a one-shop login keeps its window", () => {
  assert.equal(isMallLogin(mallLogin), true);
  assert.equal(isMallLogin(oneShop), false);
  assert.equal(isMallLogin({ ...oneShop, shops: [shop("fa")], mall: MALL }), false, "a mall of one store has nothing to switch");
  assert.equal(isMallLogin({ ...mallLogin, mall: null }), false, "a switched-off mall = the home store only");
  assert.deepEqual(staffStores(oneShop).map((s) => s.id), ["fa"], "a server from before 8 Oct still works");
});

test("the window opens on All stores, a chosen store, never a store that is not the login's", () => {
  assert.equal(pickedStore(null, mallLogin), "all");
  assert.equal(pickedStore("be", mallLogin), "be");
  assert.equal(pickedStore("someone-else", mallLogin), "all");
  assert.equal(pickedStore("be", oneShop), "fa", "a one-shop login is always on its own shop");
});

test("the address keeps the store and tab, and leaves the defaults off", () => {
  assert.equal(windowAddress("https://x/shop", "be", "orders", "all"), "https://x/shop?store=be&tab=orders");
  assert.equal(windowAddress("https://x/shop?store=be&tab=money", "all", "products", "all"), "https://x/shop");
});

test("a new logo shows on that store wherever the window shows it", () => {
  const m = withNewLogo(mallLogin, "be", "https://x/be.png");
  assert.equal(m.shops!.find((s) => s.id === "be")!.image_url, "https://x/be.png");
  assert.equal(m.shop.image_url, null, "the home store is another store");
  assert.equal(withNewLogo(oneShop, "fa", "https://x/fa.png").shop.image_url, "https://x/fa.png");
});

// ── 2. A mall basket is ONE order ───────────────────────────────────────────

const part = (id: string, store: string, status: string, lead: string | null, sub = 0, t = "2026-10-09T10:00:00Z") =>
  ({ id, restaurant_id: store, status, mall_order_id: lead, vendor_subtotal: sub, created_at: t, items: [] });

test("#10045: Fashion's and Beauty's parts are one order, the lead first; an ordinary order stands alone", () => {
  const w = wholeOrders([
    part("b", "be", "pending", "a", 1800), part("a", "fa", "pending", "a", 4050),
    part("x", "kt", "accepted", null, 900, "2026-10-09T09:00:00Z"),
    part("old", "fa", "delivered", null),
  ]);
  assert.equal(w.length, 2, "a delivered order is Takal's - not shown");
  assert.deepEqual(w[0].parts.map((p) => p.id), ["a", "b"]);
  assert.equal(w[0].isMall, true);
  assert.equal(w[0].stage, "new", "new orders first, even when older ones wait");
  assert.equal(storePrices(w[0]), 5850, "Rs 4,050 + Rs 1,800 - the store's own prices");
  assert.equal(w[1].isMall, false);
});

test("the whole order is at its slowest part's step", () => {
  assert.equal(wholeOrders([part("a", "fa", "ready", "a"), part("b", "be", "accepted", "a")])[0].stage, "accepted");
  assert.equal(wholeOrders([part("a", "fa", "ready", "a"), part("b", "be", "preparing", "a")])[0].stage, "packing");
  assert.equal(wholeOrders([part("a", "fa", "ready", "a"), part("b", "be", "ready", "a")])[0].stage, "ready");
});

test("one press moves every part, and only the parts still at that step", () => {
  const [o] = wholeOrders([part("a", "fa", "pending", "a"), part("b", "be", "accepted", "a")]);
  assert.deepEqual(partsFor(o, "accept"), [{ id: "a", to: "accepted" }], "Beauty already took it");
  const [p] = wholeOrders([part("a", "fa", "accepted", "a"), part("b", "be", "preparing", "a")]);
  assert.deepEqual(partsFor(p, "ready"), [{ id: "a", to: "ready" }, { id: "b", to: "ready" }]);
});

test("Reject or Cancel stops the WHOLE mall order: new parts rejected, taken parts cancelled", () => {
  const [o] = wholeOrders([part("a", "fa", "pending", "a"), part("b", "be", "accepted", "a")]);
  assert.deepEqual(partsFor(o, "reject"), [{ id: "a", to: "rejected" }, { id: "b", to: "cancelled" }]);
  const [r] = wholeOrders([part("a", "fa", "ready", "a"), part("b", "be", "ready", "a")]);
  assert.deepEqual(partsFor(r, "cancel"), [{ id: "a", to: "cancelled" }, { id: "b", to: "cancelled" }]);
});

test("the buttons at each step - never Takal's steps (send out, deliver)", () => {
  const at = (s: string) => actionsAt(wholeOrders([part("a", "fa", s, null)])[0]);
  assert.deepEqual(at("pending"), ["reject", "accept"]);
  assert.deepEqual(at("accepted"), ["cancel", "ready"]);
  assert.deepEqual(at("preparing"), ["cancel", "ready"]);
  assert.deepEqual(at("ready"), ["cancel"]);
  for (const s of ["pending", "accepted", "ready"]) {
    const [o] = wholeOrders([part("a", "fa", s, null)]);
    for (const a of actionsAt(o)) {
      for (const st of partsFor(o, a)) {
        assert.ok(["accepted", "preparing", "ready", "rejected", "cancelled"].includes(st.to),
          `${st.to} is not a shop's step (routers/orders_status.py STAFF_STEPS)`);
      }
    }
  }
});

// ── 3. The screens carry the rules ──────────────────────────────────────────

const SHOP = read("src/app/shop/page.tsx");
const STORES = read("src/app/shop/parts-stores.tsx");
const ORDERS = read("src/app/shop/parts-orders.tsx");
const MOVE = read("src/app/dashboard/stores/[id]/parts-move.tsx");
const PRODUCTS = read("src/app/dashboard/stores/[id]/parts-products.tsx");

test("the store buttons and All stores are drawn for a whole-mall login only", () => {
  assert.match(SHOP, /\{mallLogin && \(\n\s+<StoreSwitcher/);
  assert.match(SHOP, /needsAStore && shownTab === "products" \? \(\n\s+<AllStores/);
  assert.ok(STORES.includes('<Chip id="all" label="All stores" n={total} />'));
  for (const w of ["Products", "Need a picture", "Out of stock", "New orders", "Open store", "Orders waiting", "Open Orders"]) {
    assert.ok(STORES.includes(w), w);
  }
  assert.ok(STORES.includes("They show “–”"), "a figure that could not be read is never a 0");
});

test("a store's own pages need a store; Orders works for the whole mall", () => {
  assert.ok(SHOP.includes("belongs to one store - <b className=\"text-takal-ink\">choose a store above</b>"));
  assert.match(SHOP, /onlyStore=\{shop \? String\(shop\.id\) : null\}/);
  assert.match(SHOP, /<ProductsTab key=\{shop\.id\}/, "a new store is a new list");
});

test("a mall order is one card: one parcel, the store's own prices, one press for every part", () => {
  assert.ok(ORDERS.includes("✓ Accept whole order"));
  assert.ok(ORDERS.includes("Packed - ready for Takal"));
  assert.ok(ORDERS.includes("Takal collects it once."));
  assert.ok(ORDERS.includes("Your item prices"));
  assert.match(ORDERS, /await apiClient\.setOrderStatus\(st\.id, st\.to, reason\);/);
  assert.ok(ORDERS.includes("Not every part was changed"), "a part that failed is named, never hidden");
  // The code, without its comments (which explain WHY Takal's money is left out).
  const code = ORDERS.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.doesNotMatch(code, /commission|rider_earning|delivery_code/i);
});

test("Move to another store: the mall's other stores, a category of the new store, refusals in words", () => {
  assert.ok(PRODUCTS.includes("{!!moveTo?.length && ("));
  assert.ok(PRODUCTS.includes("Move to another store"));
  assert.match(MOVE, /apiClient\.moveProductToStore\(fromStoreId, product\.id, to\.id, categoryId \|\| null\)/);
  assert.match(MOVE, /apiClient\.getCategoryTree\(to\.vendorType\)/);
  assert.ok(MOVE.includes("Category in the new store"));
  assert.ok(MOVE.includes("Not possible while the product is in an order that is not finished"));
  const api = read("src/lib/api-stores.ts");
  assert.ok(api.includes("/products/${encodeURIComponent(productId)}/move`"));
});

test("each order line shows the product's picture - or says it has none", () => {
  // Sana, 9 Oct 2026: "The order page should show Picture of the products too".
  assert.match(ORDERS, /\{it\.item_image \? \(/);
  assert.match(ORDERS, /<img src=\{it\.item_image\} alt=\{it\.item_name \|\| "Product"\}/);
  assert.ok(ORDERS.includes("No picture"), "a missing picture is said, never a broken image");
  assert.ok(read("src/lib/api-orders.ts").includes("item_image?: string | null"));
});

test("a one-shop login's part of a mall order says the rest is packed by the other stores", () => {
  assert.ok(ORDERS.includes("Part of a mall order - the other stores pack theirs."));
});

