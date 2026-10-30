// MOCK 217 - "HIDDEN BY TAKAL" IN THE PANEL (approved by Sana, 30 Oct 2026).
//
// One place for every product the Takal Assistant hid: the reason in the
// server's own words, a red box round the number on the picture, "Show again"
// for the Main Admin only, and a red tag on the store's own Products tab.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WHY, reasonTags, boxPercent, foundText, pictureOf, showAgainWords } from "../src/lib/takal-hidden.ts";

const PAGE = readFileSync("src/app/dashboard/stores/page.tsx", "utf8");
const PART = readFileSync("src/app/dashboard/stores/parts-takal-hidden.tsx", "utf8");
const PRODUCTS = readFileSync("src/app/dashboard/stores/[id]/parts-products.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const CHECKS = readFileSync("../swat-delivery-app/backend/product_checks.py", "utf8");
const DOORS = readFileSync("../swat-delivery-app/backend/routers/product_checks_admin.py", "utf8");
const COLUMNS = readFileSync("../swat-delivery-app/backend/routers/shop_products.py", "utf8");

test("the tags are found by the server's own Roman Urdu reasons", () => {
  const server = (name: string) => new RegExp(`${name} = "([^"]+)"`).exec(CHECKS)![1];
  assert.equal(WHY.words, server("WHY_WORDS"));
  assert.equal(WHY.picture, server("WHY_PICTURE"));
  assert.equal(WHY.noPicture, server("WHY_NO_PICTURE"));
  assert.equal(WHY.noPrice, server("WHY_NO_PRICE"));
  assert.deepStrictEqual(reasonTags(`${WHY.picture}; ${WHY.noPrice}`), ["Picture", "Price"]);
  assert.deepStrictEqual(reasonTags(""), ["Takal rule"]);
});

test("the red box sits where the number is, at any size - or is not drawn", () => {
  assert.deepStrictEqual(boxPercent({ x0: 40, y0: 300, x1: 440, y1: 350 }, { width: 800, height: 1000 }),
    { left: 5, top: 30, width: 50, height: 5 });
  assert.equal(boxPercent({ x0: 1, y0: 1, x1: 2, y1: 2 }, null), null, "no size known - no box in the wrong place");
  const p = { id: "p", restaurant_id: "r", name: "Drees Coat", takal_hidden_at: "t", image_url: "https://x/main.jpg",
    takal_hidden_reason: WHY.picture,
    pictures_found: [{ url: "https://x/extra.jpg", hits: [{ kind: "phone", text: "0328 2236600" }], boxes: [] }] };
  assert.equal(pictureOf(p), "https://x/extra.jpg", "the picture with the number is the one shown");
  assert.equal(foundText(p), "0328 2236600");
  assert.match(showAgainWords(p), /will not hide it again/);
});

test("the chip sits before No picture and opens its own list in place of the table", () => {
  const chip = PAGE.indexOf("data-takal-hidden-chip");
  const noPic = PAGE.indexOf("data-no-picture-everywhere");
  assert.ok(chip > 0 && chip < noPic);
  assert.match(PAGE, /\{takalOpen && \(\s*<TakalHiddenSection/);
  assert.match(PAGE, /view !== "ready" && !takalOpen && \(<div className="bg-white rounded-lg/);
  // Its own read AFTER the shop list - the Stores page is never slower.
  assert.match(PAGE, /if \(loading \|\| takalAsked\.current\) return;/);
});

test("Show again is the Main Admin's: locked for anybody else, and asks first", () => {
  assert.match(PART, /disabled=\{!isMain \|\| busy\}/);
  assert.match(PART, /<ConfirmDialog/);
  assert.match(PART, /apiClient\.showProductAgain\(p\.id\)/);
  assert.match(DOORS, /_require_main_admin\(user\)/);
});

test("the panel asks the server's own addresses", () => {
  assert.match(API, /\/admin\/stores\/takal-hidden-products/);
  assert.match(DOORS, /@router\.get\("\/admin\/stores\/takal-hidden-products"/);
  assert.match(DOORS, /r\["pictures_found"\] = found\.get/);
});

test("the store's Products tab shows the red tag - and the server sends its columns", () => {
  assert.match(PRODUCTS, /\{p\.takal_hidden_at && \(\s*<span data-takal-hidden-tag/);
  assert.match(COLUMNS, /"takal_hidden_at,takal_hidden_reason"\)/);
});
