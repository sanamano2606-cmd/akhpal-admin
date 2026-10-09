// ─────────────────────────────────────────────────────────────────────────────
// MALL STAFF IN THE PANEL (Mock 133, step 5b, 1 October 2026).
// The sign-in box must send EXACTLY what the server stored, and the panel's
// calls must go to the doors the server walls in.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { staffSignInId, staffSignInMessage } from "../src/lib/staff-sign-in.ts";

test("a phone is sent the way the server stored it - spaces, dashes, brackets out", () => {
  // routers/shop_staff.py stores re.sub(r"[\s\-()]", "", phone)
  assert.deepEqual(staffSignInId("0312 3456789"), { phone: "03123456789" });
  assert.deepEqual(staffSignInId("0312-3456789"), { phone: "03123456789" });
  assert.deepEqual(staffSignInId(" (0312) 345 6789 "), { phone: "03123456789" });
  assert.deepEqual(staffSignInId("+92 312 3456789"), { phone: "+923123456789" });
});

test("an email is sent trimmed and in small letters, as the server stored it", () => {
  // routers/shop_staff.py stores (email or "").strip().lower()
  assert.deepEqual(staffSignInId("  Bilal@CityMall.pk "), { email: "bilal@citymall.pk" });
});

test("an empty box sends nothing", () => {
  assert.equal(staffSignInId(""), null);
  assert.equal(staffSignInId("   "), null);
  assert.equal(staffSignInId(" - ( ) "), null);
});

test("the server's 'register first' is never shown to a staff member", () => {
  const m = staffSignInMessage("No account found for this role. Please register first.");
  assert.ok(!/register/i.test(m), m);
  assert.match(m, /No staff login/);
  // every other message passes through untouched
  const off = "This staff login is switched off. Please contact Takal.";
  assert.equal(staffSignInMessage(off), off);
});

test("the panel's staff calls use the walled doors, and nothing else", () => {
  const src = readFileSync(new URL("../src/lib/api-people.ts", import.meta.url), "utf8");
  const start = src.indexOf("MALL STAFF LOGINS");
  const end = src.indexOf("async getReviewSettings");
  assert.ok(start > 0 && end > start, "the Mall staff block has moved");
  const block = src.slice(start, end);
  const paths = [...block.matchAll(/`(\/[^`$?]*)/g)].map((m) => m[1]);
  for (const p of paths) {
    assert.ok(p.startsWith("/admin/shop-staff") || p === "/shop-staff/me",
      `unexpected door in the staff calls: ${p}`);
  }
  for (const name of ["getShopStaff", "addShopStaff", "setShopStaffActive",
                      "resetShopStaffPassword", "getMyShopAsStaff"]) {
    assert.ok(block.includes(`async ${name}(`), `${name} is missing`);
  }
  // A password is sent, never asked for back.
  assert.ok(!/password[^\n]*Promise<[^>]*password/.test(block));
});

test("the panel's guard copy keeps /admin/shop-staff as Main Admin only", () => {
  const nav = readFileSync(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");
  assert.ok(nav.includes('["/admin/shop-staff", "__super__"]'));
});

// ── The screens (Mock 133, approved 1 Oct 2026) ─────────────────────────────
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LOGIN = read("src/app/auth/login/page.tsx");
const SHOP = read("src/app/shop/page.tsx");
const MONEY = read("src/app/shop/parts-money.tsx");
// Step 5 (Mock 172-4 / 172-5): a whole-mall login's store buttons, "All
// stores" and Orders.
const SHOPSTORES = read("src/app/shop/parts-stores.tsx");
const SHOPORDERS = read("src/app/shop/parts-orders.tsx");
const STAFFTAB = read("src/app/dashboard/stores/[id]/parts-staff.tsx");
const STORE = read("src/app/dashboard/stores/[id]/page.tsx");
const PRODUCTS = read("src/app/dashboard/stores/[id]/parts-products.tsx");
const EDITOR = read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const LAYOUT = read("src/app/dashboard/layout.tsx");
const CORE = read("src/lib/api-core.ts");

test("sign-in opens on Takal Admin, and asks the server for the staff role only when Shop staff is chosen", () => {
  assert.match(LOGIN, /useState<"admin" \| "staff">\("admin"\)/);
  assert.match(LOGIN, /body = \{ \.\.\.id, password, role: STAFF_ROLE \};/);
  // Spaces off since 6 Oct 2026 (admin audit low item 10).
  assert.match(LOGIN, /body = \{ email: email\.trim\(\), password, role: "admin" \};/);
  // Where to go is decided by the role the SERVER gave back.
  assert.match(LOGIN, /router\.push\(data\.user\.role === STAFF_ROLE \? "\/shop" : "\/dashboard"\)/);
});

test("a staff member whose session ended comes back to Shop staff already chosen", () => {
  assert.match(LOGIN, /if \(qs\.get\("as"\) === "staff"\) setWho\("staff"\);/);
  assert.match(CORE, /asStaff \? "\/auth\/login\?expired=1&as=staff" : "\/auth\/login\?expired=1"/);
  // read BEFORE the profile is removed
  assert.ok(CORE.indexOf("asStaff = JSON.parse") < CORE.indexOf('localStorage.removeItem("admin_user")'));
});

test("the Admin dashboard sends a staff login to the Shop panel before drawing anything", () => {
  const i = LAYOUT.indexOf("if (signedInAsStaff()) {");
  assert.ok(i > 0, "the redirect has gone");
  assert.ok(i < LAYOUT.indexOf("applyNav();\n    setLoading(false);"), "it must run before the menu is drawn");
  assert.match(LAYOUT, /router\.replace\("\/shop"\);/);
});

test("the Shop panel shows the approved tabs - Orders for every staff login, never Team", () => {
  const ids = [...SHOP.matchAll(/\{ id: "([a-z]+)", label:/g)].map((m) => m[1]);
  // Step 5 (Mock 172-5, approved 8 Oct 2026): Orders, because the order doors
  // opened for a mall's staff in Step 3c. Sana, 9 Oct 2026 ("Yes"): for a
  // one-shop login too, not only a whole-mall one.
  assert.deepEqual(ids, ["products", "orders", "settings", "location", "money"]);
  assert.match(SHOP, /\{ id: "orders", label: "Orders", side: "Orders", Icon: Receipt \}/);
  assert.match(SHOP, /shownTab === "orders" && stores\.length > 0 \? \(\n\s+<ShopOrdersTab/);
  // The office's order card (cancel any order, /admin doors) is never used here.
  assert.doesNotMatch(SHOP + SHOPORDERS, /StoreOrdersCard|MallStaffTab|PayoutDetailsCard|getRestaurantDetail/);
});

test("the Shop panel only calls the staff doors, and never an /admin one", () => {
  const all = SHOP + MONEY + SHOPSTORES + SHOPORDERS;
  const calls = [...all.matchAll(/apiClient\.([a-zA-Z]+)/g)].map((m) => m[1]);
  // Step 5: the store figures and the orders read the SHOP's own doors
  // (products/manage, /orders/restaurant), and the order steps go through
  // /orders/{id}/status, where the server allows a staff login the shop's
  // steps only (STAFF_STEPS).
  assert.deepEqual([...new Set(calls)].sort(),
    ["getMyShopAsStaff", "getShopEarnings", "getShopOrders", "getShopProducts", "setOrderStatus"]);
  assert.doesNotMatch(all, /\/admin\//);
  const api = read("src/lib/api-orders.ts");
  assert.match(api, /`\/orders\/restaurant\/\$\{encodeURIComponent\(restaurantId\)\}\?\$\{p\.toString\(\)\}`/);
  assert.match(api, /return this\.request\(`\/orders\/\$\{orderId\}\/status\?\$\{p\.toString\(\)\}`/);
});

test("the Shop panel's products list is the staff one: no Featured; Whole catalogue on the shop's own page", () => {
  assert.match(SHOP, /onCounts=\{setCounts\} staffView\n\s+moveTo=\{mallLogin \? others : undefined\}/);
  // (Step 5b: a fixed-price store adds two red buttons first - staff never
  // get the fixed-price list, and Featured is still taken out for them.)
  assert.match(PRODUCTS, /FILTERS\)\s*\.filter\(\(f\) => !staffView \|\| f\.id !== "featured"\)/);
  assert.match(PRODUCTS, /const fixed = !staffView && data\?\.price_mode === "fixed";/);
  assert.match(PRODUCTS, /href=\{staffView \? `\/shop\/catalogue\/\$\{restaurantId\}` : `\/dashboard\/stores\/\$\{restaurantId\}\/catalogue`\}/);
  assert.match(PRODUCTS, /\{!staffView && \(\n\s+<button role="menuitem" onClick=\{\(\) => feature\(menu\.p\)\}/);
  assert.match(PRODUCTS, /canFeature=\{!staffView\}/);
  assert.match(EDITOR, /if \(canFeature\) try \{\n\s+await apiClient\.setProductFeatured/);
  assert.match(EDITOR, /\{canFeature && \(\n\s+<label/);
});

test("a first password must be replaced before anything else", () => {
  assert.match(SHOP, /if \(out\?\.user\?\.must_change_password === true\) \{\n\s+setPwForced\(true\);\n\s+setPwOpen\(true\);/);
  assert.match(SHOP, /<ChangePasswordModal\n\s+open=\{pwOpen\}\n\s+forced=\{pwForced\}/);
});

test("a switched-off login sees why, and a way out - not a broken page", () => {
  assert.match(SHOP, /if \(e instanceof AccessDeniedError\) \{/);
  assert.match(SHOP, /You cannot use the Shop panel/);
});

test("the staff Money tab never shows Takal's commission", () => {
  // The code, without its comments (which explain WHY commission is left out).
  const code = MONEY.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.doesNotMatch(code, /commission/i);
  const typeBlock = read("src/lib/api-stores.ts").split("export type ShopEarnings = {")[1].split("};")[0];
  assert.doesNotMatch(typeBlock, /commission\s*[?:]/);
});

test("the Mall staff tab is drawn for the Main Admin only", () => {
  assert.match(STORE, /const tabs = TABS\.filter\(\(t\) => t\.id !== "staff" \|\| isMain\);/);
  assert.match(STORE, /const main = getMyPerms\(\)\.isSuper;/);
  assert.match(STORE, /\{tab === "staff" && isMain && \(/);
  assert.match(STORE, /if \(isTab\(t\) && \(t !== "staff" \|\| getMyPerms\(\)\.isSuper\)\) setTab\(t\);/);
});

test("the Mall staff tab only uses the Main Admin's staff doors", () => {
  const calls = [...STAFFTAB.matchAll(/apiClient\.([a-zA-Z]+)/g)].map((m) => m[1]);
  // setShopStaffMall: Step 4 (Mock 172-6) - "Give the whole mall" / "Only its own store".
  // Its door PUT /admin/shop-staff/{id}/mall is the Main Admin's (__super__), like the rest.
  assert.deepEqual([...new Set(calls)].sort(),
    ["addShopStaff", "resetShopStaffPassword", "setShopStaffActive", "setShopStaffMall"]);
  // Switching off and on always asks first.
  assert.match(STAFFTAB, /<ConfirmDialog\n\s+open=\{flip !== null\}/);
});

test("new screens never build a colour class from a variable (the style tool cannot see it)", () => {
  for (const [name, src] of [["login", LOGIN], ["shop", SHOP], ["money", MONEY], ["staff tab", STAFFTAB],
                             ["store buttons", SHOPSTORES], ["shop orders", SHOPORDERS],
                             ["move", read("src/app/dashboard/stores/[id]/parts-move.tsx")]] as const) {
    assert.doesNotMatch(src, /\[[^\]\n]*\$\{[^\]\n]*\]/, `${name}: a [..\${..}..] class`);
  }
});

test("the Location tab asks staff the PUBLIC shop-types list, never the Admin one", () => {
  const MAP = read("src/app/dashboard/stores/[id]/parts-map.tsx");
  assert.match(MAP, /signedInAsStaff\(\)\n\s+\? await apiClient\.getPublicShopTypes\(\)\n\s+: await apiClient\.getAdminShopTypes\(\)/);
  assert.match(read("src/lib/api-stores.ts"), /async getPublicShopTypes\(\) \{\n\s+return this\.request\(`\/shop-types`\);/);
});

test("the first-password window says only true things to Mall staff", () => {
  const CPM = read("src/components/ChangePasswordModal.tsx");
  assert.match(CPM, /\{staff \? "Mall staff" : "Add Admin"\} form/);
  // The server writes wrong tries to the Audit Log for ADMIN accounts only.
  assert.match(CPM, /\{!staff && <li>· Wrong tries are written to the Audit Log\.<\/li>\}/);
  assert.match(SHOP, /forced=\{pwForced\}\n\s+staff\n/);
});

// ── Whole catalogue for Mall staff (Sana: "Yes Catalogue", 1 Oct 2026) ──────
const STORES = read("src/lib/api-stores.ts");
const CATPAGE = read("src/app/dashboard/stores/[id]/catalogue/page.tsx");
const SHOPCAT = read("src/app/shop/catalogue/[id]/page.tsx");

test("the three catalogue calls use the shop's own doors for Mall staff, the admin ones otherwise", () => {
  assert.match(STORES, /signedInAsStaff\(\)\n\s+\? `\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/catalogue\/product-names`\n\s+: `\/admin\/vendor-intake\/shop\/\$\{restaurantId\}\/product-names`/);
  assert.match(STORES, /signedInAsStaff\(\) && restaurantId\n\s+\? `\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/catalogue\/read-sheet`\n\s+: `\/admin\/vendor-intake\/read-sheet`/);
  assert.match(STORES, /signedInAsStaff\(\)\n\s+\? `\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/catalogue\/undo-upload`\n\s+: `\/admin\/vendor-intake\/shop\/\$\{restaurantId\}\/undo-upload`/);
  // the sheet is read WITH the shop id, or staff would fall back to the admin door
  assert.match(CATPAGE, /apiClient\.readSheetFile\(file, shopId\)/);
});

test("the catalogue page sends staff back to their Shop panel, never to an admin page", () => {
  // Step 5: back to the SAME store of the panel (a whole-mall login has several).
  assert.match(CATPAGE, /if \(signedInAsStaff\(\)\) setBackHref\(`\/shop\?store=\$\{encodeURIComponent\(shopId\)\}`\);/);
  assert.doesNotMatch(CATPAGE, /<Link href=\{`\/dashboard\/stores\/\$\{shopId\}`\}/);
});

test("the staff catalogue page sends everybody else to the right place", () => {
  assert.match(SHOPCAT, /router\.replace\("\/auth\/login\?as=staff"\)/);
  assert.match(SHOPCAT, /if \(!signedInAsStaff\(\)\) \{\n\s+router\.replace\(`\/dashboard\/stores\/\$\{id\}\/catalogue`\);/);
  // Step 5: any store of the login's OWN list (a whole-mall login: its mall's
  // stores); anything else goes to the home store's catalogue.
  assert.match(SHOPCAT, /const mine = staffStores\(me\)\.find\(\(s\) => String\(s\.id\) === id\);\n\s+if \(me\?\.shop\?\.id && !mine\) \{\n\s+router\.replace\(`\/shop\/catalogue\/\$\{me\.shop\.id\}`\);/);
  assert.match(SHOPCAT, /<CataloguePage params=\{\{ id \}\} \/>/);
  assert.doesNotMatch(SHOPCAT, /\/admin\//);
});
