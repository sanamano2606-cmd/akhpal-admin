// AUDIT 204 (19 October 2026) - Sana: "Go but the number is 75%" and "Go for
// the video plan (15 sec, 720p, 10 MB limit)".
//
// D1 The highest discount is 75%: the editor, the list's own discount box and
//    "Discount %" for many products all stop 76+ with the same words as the
//    server ("The highest discount is 75%.").
// V1 A product video is 15 seconds / 10 MB at most: the editor says what is
//    wrong before sending; the welcome screen keeps 100 MB (purpose=welcome).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDiscount, DISCOUNT_TOO_HIGH, MAX_DISCOUNT } from "../src/lib/edit-in-the-list.ts";
import { MAX_PRODUCT_VIDEO_MB, MAX_PRODUCT_VIDEO_SECONDS, productVideoProblem } from "../src/lib/product-video.ts";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8");
const MB = 1024 * 1024;

test("D1 the highest discount is 75%, in the server's own words", () => {
  assert.equal(MAX_DISCOUNT, 75);
  assert.equal(DISCOUNT_TOO_HIGH, "The highest discount is 75%.");
  assert.deepEqual(checkDiscount("75"), { ok: true, value: 75 });
  assert.deepEqual(checkDiscount("75%"), { ok: true, value: 75 });
  for (const bad of ["76", "80", "100", "150"]) {
    const c = checkDiscount(bad);
    assert.equal(c.ok, false, bad);
    assert.equal((c as { reason: string }).reason, "the highest discount is 75%", bad);
  }
  assert.equal(checkDiscount("ten").ok, false);
});

test("D1 the editor box and 'Discount %' for many products stop at 75", () => {
  const modal = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.match(modal, /min=\{0\} max=\{MAX_DISCOUNT\}/);
  assert.match(modal, /checkDiscount\(discount\)/, "Save checks the discount");
  const list = code("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.match(list, /ask\.action === "discount" && n > MAX_DISCOUNT/);
  assert.match(list, /toast\(DISCOUNT_TOO_HIGH, "error"\)/);
  assert.match(list, /max=\{ask\.action === "discount" \? MAX_DISCOUNT : undefined\}/);
  const prices = code("src/app/dashboard/stores/[id]/parts-products-prices.tsx");
  assert.match(prices, /checkDiscount\(edit\.val\)/, "the fixed-price row uses the same check");
});

test("V1 a product video is 15 seconds and 10 MB at most", () => {
  assert.equal(MAX_PRODUCT_VIDEO_SECONDS, 15);
  assert.equal(MAX_PRODUCT_VIDEO_MB, 10);
  assert.equal(productVideoProblem(6 * MB, 15.3), null, "a phone's 15 seconds");
  assert.equal(productVideoProblem(6 * MB, null), null, "length unknown - the server checks");
  assert.match(productVideoProblem(80 * MB, 12) ?? "", /^This video is 80 MB\. A product video must be 15 seconds or less and 10 MB or less\./);
  assert.match(productVideoProblem(6 * MB, 22.4) ?? "", /^This video is 22 seconds long\./);
});

test("V1 the editor checks before sending; the welcome screen keeps its 100 MB", () => {
  const modal = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.match(modal, /productVideoProblem\(file\.size, await videoSeconds\(file\)\)/);
  assert.match(modal, /up to \$\{MAX_PRODUCT_VIDEO_SECONDS\} seconds, \$\{MAX_VIDEO_MB\} MB/);
  assert.doesNotMatch(modal, /MAX_VIDEO_MB = 100/);
  const api = code("src/lib/api-stores.ts");
  assert.match(api, /upload-video\?purpose=\$\{purpose\}/);
  assert.match(api, /purpose: "product" \| "welcome" = "product"/);
  const welcome = code("src/app/dashboard/marketing/welcome/page.tsx");
  assert.match(welcome, /uploadVideo\(file, "welcome"\)/);
});
