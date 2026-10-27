// ─────────────────────────────────────────────────────────────────────────────
// A SHOP WITH NO PRODUCTS CAN BE SENT BACK FOR THEM (Sana, 27 October 2026:
// "when a vendor does not upload the products and send the store for
// approval there is no need fix button same as others" - "Yes").
//
// The Review page's Products section starts with one line for the products
// as a whole, with OK / Needs fix like every other line. The server ticks it
// only when the shop has 5 products on sale, each with a photo.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCTS_LINE, PRODUCTS_NEEDED, REVIEW_SECTIONS, fixedKeysFor, productsMayBeMarkedOk, reasonsFor, fixesFromMarks,
} from "../src/lib/shop-review.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const REVIEW = code("src/app/dashboard/stores/[id]/review/page.tsx");
const SERVER = code("../swat-delivery-app/backend/routers/shop_review.py");
const INTAKE = code("../swat-delivery-app/backend/routers/vendor_intake.py");

test("the products line is one of the things the office checks", () => {
  assert.equal(PRODUCTS_LINE, "products");
  assert.ok(REVIEW_SECTIONS.some((s) => s.keys.includes("products")));
  assert.ok(fixedKeysFor(null).includes("products"));
  // A pharmacy's licence is still the last thing on its list (Mock 208-4).
  assert.deepEqual(fixedKeysFor({ licence: { needs_licence: true } as any }).slice(-1), ["licence"]);
});

test("the panel and the server use the same key and the same five", () => {
  assert.match(SERVER, /^PRODUCTS_KEY = "products"$/m);
  assert.match(SERVER, /^MIN_PRODUCTS_FOR_REVIEW = 5$/m);
  assert.match(INTAKE, /^MIN_PRODUCTS = 5$/m);
  assert.equal(PRODUCTS_NEEDED, 5);
});

test("ready reasons for an empty or thin shop", () => {
  assert.deepEqual(reasonsFor("products"), ["No products uploaded", "Fewer than 5 products", "Some products have no photo"]);
  for (const r of reasonsFor("products")) assert.ok(r.length <= 120, r);
});

test("it is sent back like any other line", () => {
  assert.deepEqual(fixesFromMarks({ products: { state: "fix", reason: "No products uploaded" } }),
    [{ key: "products", reason: "No products uploaded" }]);
});

test("'mark everything OK' never marks a thin shop's products OK", () => {
  assert.equal(productsMayBeMarkedOk({ products_total: 0 }), false);
  assert.equal(productsMayBeMarkedOk({ products_total: 4 }), false);
  assert.equal(productsMayBeMarkedOk({ products_total: 5 }), true);
  assert.equal(productsMayBeMarkedOk(null), false);
  assert.match(REVIEW, /if \(k === PRODUCTS_LINE && !productsMayBeMarkedOk\(data\)\) continue;/);
});

test("the line is drawn at the top of the Products section - even with no products", () => {
  const at = REVIEW.indexOf("<div data-products-line");
  assert.ok(at > REVIEW.indexOf("Section title={`Products ("), "inside the Products section");
  assert.ok(at < REVIEW.indexOf("{products.map((p) => {", at), "above the product pictures");
  assert.match(REVIEW, /\{row\(PRODUCTS_LINE, <>/);
  assert.match(REVIEW, /No products uploaded/);
  // Counted in the section's "N to fix · M not checked".
  assert.match(REVIEW, /const keys = \[PRODUCTS_LINE, \.\.\.products\.map\(\(p\) => productKey\(p\.id\)\)\];/);
});
