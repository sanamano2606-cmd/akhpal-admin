// ─────────────────────────────────────────────────────────────────────────────
// THE STORE PAGE OPENS ON ITS PRODUCTS, AND EVERY PRODUCT CAN BE REACHED.
// (Mock 132 step 2, approved by Sana 30 September 2026.)
//
// What these guard, each one a fault the audit found on the live panel:
//   * the list came from getRestaurantDetail, which stops at 100 products;
//   * one picture took ten steps, through a popup and a Save button;
//   * every price or stock change reloaded the WHOLE store;
//   * the "..." menu was drawn inside a table that cuts off its own edges.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { hoursInWords } from "../src/lib/shop-hours.ts";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const TAB = read("app/dashboard/stores/[id]/parts-products.tsx");
const PAGE = read("app/dashboard/stores/[id]/page.tsx");
const API = read("lib/api-stores.ts");

/** The body of one function in a file - from its name to the next `const x =` at
 *  the same indent. Enough to ask "does THIS function do that?". */
function fn(src: string, name: string): string {
  const start = src.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `${name} is missing`);
  const next = src.indexOf("\n  const ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

test("the products come one page at a time from the server's own list, never from the store detail", () => {
  assert.match(TAB, /apiClient\.getShopProducts\(restaurantId, \{\s*page, perPage: PER_PAGE, search, show,/);
  assert.doesNotMatch(TAB, /getRestaurantDetail/, "the detail stops at 100 products");
  assert.doesNotMatch(PAGE, /data\.menu|\bmenu\.map\(/, "the page must not draw the old 100-product list");
  assert.match(API, /`\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/products\/manage\?\$\{p\.toString\(\)\}`/);
});

test("a picture square takes a photo only for a product with NO picture", () => {
  const clicked = fn(TAB, "squareClicked");
  // A product that has a picture opens the editor - adding one would make the
  // new photo the cover and lose an imported picture from view.
  assert.match(clicked, /if \(p\.image_url\) \{ openEditor\(p\); return; \}/);
  const dropped = fn(TAB, "dropped");
  assert.match(dropped, /if \(p\.image_url\) \{[\s\S]*?openEditor\(p\);[\s\S]*?return;/);
});

test("the one-click picture ADDS a photo as the cover and never replaces the list", () => {
  const up = fn(TAB, "uploadPicture");
  assert.match(up, /apiClient\.uploadImage\(file\)/);
  assert.match(up, /apiClient\.addProductPhoto\(p\.id, up\.url, 0\)/);
  assert.doesNotMatch(up, /setProductImages/, "setProductImages REPLACES every photo");
  assert.match(API, /async addProductPhoto[\s\S]{0,200}method: "POST"/);
});

test("a change updates its own row and never reloads the whole store", () => {
  for (const name of ["uploadPicture", "savePrice", "saveStock", "flip", "feature"]) {
    const body = fn(TAB, name);
    assert.match(body, /patchRow\(p\.id,/, `${name} must update its own row`);
    assert.doesNotMatch(body, /setReloadKey|load\(\)/, `${name} must not reload the list`);
  }
  // The products tab is never handed the page's reload of the whole store.
  assert.match(PAGE, /<ProductsTab restaurantId=\{id\} vendorType=\{[^}]+\} onCounts=\{setCounts\} \/>/);
});

test("the numbers on the filter buttons follow the change", () => {
  assert.match(fn(TAB, "uploadPicture"), /bump\("no_picture", -1\)/);
  assert.match(fn(TAB, "flip"), /bump\("off", on \? -1 : 1\)/);
  assert.match(fn(TAB, "feature"), /bump\("featured", p\.is_featured \? -1 : 1\)/);
});

test("a number that could not be counted is a dash, never 0", () => {
  assert.match(TAB, /n === null \|\| n === undefined \? "–"/);
});

test("the page opens on Products and draws the other tabs only when they are opened", () => {
  assert.match(PAGE, /useState<TabId>\("products"\)/);
  assert.match(PAGE, /\{tab === "orders" && \(/);
  assert.match(PAGE, /\{tab === "money" && data && \(/);
  // Products stays alive when hidden, so a search survives a tab switch.
  assert.match(PAGE, /<div hidden=\{tab !== "products"\}>/);
});

test("the ... menu is drawn outside the table, where nothing can cut it off", () => {
  assert.match(TAB, /style=\{\{ position: "fixed", left: menu\.x, top: menu\.y \}\}/);
  assert.doesNotMatch(TAB, /className="absolute right-3 top-11/);
});

test("a closing time before the opening time is said to be the next day", () => {
  // Moved to lib/shop-hours.ts (1 Oct 2026) so the Mall staff panel says it
  // the same way - and now RUN, not just read.
  assert.equal(hoursInWords("11:00", "03:00"), "Opens 11:00 AM – 3:00 AM (next day)");
  assert.equal(hoursInWords("09:00:00", "23:00:00"), "Opens 9:00 AM – 11:00 PM");
  assert.equal(hoursInWords("00:00", "00:00"), "Open all day");
  assert.equal(hoursInWords(null, "23:00"), "");
  assert.match(PAGE, /import \{ hoursInWords \} from "@\/lib\/shop-hours";/);
});

// ── Step 3: many products at once ──────────────────────────────────────────

test("the tick boxes empty whenever the list changes", () => {
  assert.match(TAB, /useEffect\(\(\) => \{ setPicked\(new Set\(\)\); \}, \[restaurantId, page, search, show, categoryId, reloadKey\]\);/);
});

test("a button changes only the ticked products that are on the screen", () => {
  const run = fn(TAB, "runBulk");
  assert.match(run, /const ids = pickedOnPage\.map\(\(p\) => p\.id\);/);
  assert.match(TAB, /const pickedOnPage = \(data\?\.items \|\| \[\]\)\.filter\(\(p\) => picked\.has\(p\.id\)\);/);
  assert.match(run, /apiClient\.bulkChangeProducts\(restaurantId, ids, action, value\)/);
});

test("Remove always asks first and names the products", () => {
  // The bar's Remove button only opens the question...
  assert.match(TAB, /onClick=\{\(\) => setAsk\(\{ action: "remove", value: "" \}\)\}/);
  assert.doesNotMatch(TAB, /label: "Remove"[^}]*go: \(\) => runBulk\("remove"\)/);
  // ...and the question lists them before anything is removed.
  assert.match(TAB, /pickedOnPage\.slice\(0, 8\)\.map\(\(p\) => p\.name\)/);
});

test("the number is checked before it is sent", () => {
  const c = fn(TAB, "confirmAsk");
  assert.match(c, /const max = ask\.action === "discount" \? 100 : 10_000_000;/);
  assert.match(c, /!Number\.isInteger\(n\) \|\| n < 0 \|\| n > max/);
});

test("a product that could not be changed is named, not hidden in a total", () => {
  const run = fn(TAB, "runBulk");
  assert.match(run, /bad\.slice\(0, 3\)\.map\(\(f\) => f\.name/);
});

test("the bulk address is the server's own", () => {
  assert.match(API, /`\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/products\/bulk`,\s*\{\s*method: "POST"/);
});

