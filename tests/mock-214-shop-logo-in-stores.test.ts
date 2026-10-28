/**
 * MOCK 214 - THE SHOP'S LOGO IN THE STORES LISTS (approved by Sana, 28 Oct
 * 2026: "i want to see the vendors Logo here who has Uploaded and whose Not.
 * The Shop logo size must fit in the existing size line and when click on
 * Logo should fully view").
 *
 * Photographed on the live shop list (read-only, 28 Oct): 41 waiting shops
 * showed their logo, 13 the dashed red "No logo yet" box, and the rows kept
 * their height. The server half (the list now sends image_url) is tested in
 * backend/tests/test_mock_214_the_stores_list_sends_the_logo.py.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasLogo, logoThumb, smallPictureUrl } from "../src/lib/shop-logo.ts";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const PAGE = read("app/dashboard/stores/page.tsx");
const LOGO = read("components/ShopLogo.tsx");
const ST = "https://x.supabase.co/storage/v1/object/public/images/";

test("a list row reads the small copy of a stored logo (about 12 KB), not the full picture", () => {
  assert.equal(smallPictureUrl(`${ST}abc.webp`), `${ST}abc_sm.webp`);
  assert.equal(smallPictureUrl(`${ST}abc.jpg?v=3`), `${ST}abc_sm.webp`);
  assert.equal(smallPictureUrl(`${ST}abc_sm.webp`), `${ST}abc_sm.webp`, "already small");
  assert.equal(smallPictureUrl("https://example.com/logo.png"), null, "not one of Takal's own pictures");
  assert.equal(smallPictureUrl(`${ST}no-dot`), null);
  assert.equal(smallPictureUrl(""), null);
  assert.equal(smallPictureUrl(null), null);
});

test("the row's picture: small copy first, an outside picture as it is, nothing when there is no logo", () => {
  assert.equal(logoThumb(`${ST}abc.png`), `${ST}abc_sm.webp`);
  assert.equal(logoThumb("https://example.com/logo.png"), "https://example.com/logo.png");
  assert.equal(logoThumb("  "), "");
  assert.equal(logoThumb(undefined), "");
  assert.equal(hasLogo({ image_url: `${ST}a.webp` }), true);
  assert.equal(hasLogo({ image_url: " " }), false);
  assert.equal(hasLogo({ image_url: null }), false);
  assert.equal(hasLogo(null), false);
});

test("both kinds of box are the row's existing 30 x 30 size", () => {
  assert.equal((LOGO.match(/h-\[30px\] w-\[30px\]/g) || []).length, 2, "logo and no-logo box");
});

test("no logo = a dashed RED box that says 'No logo yet'", () => {
  const none = LOGO.slice(LOGO.indexOf("data-no-logo"), LOGO.indexOf("data-no-logo") + 700);
  assert.match(none, /title="No logo yet"/);
  assert.match(none, /border-dashed border-\[#D62839\]/);
  assert.match(none, /bg-\[#D62839\]/, "the red dot");
  assert.match(none, /\{sign\}/, "the type sign stays inside, faded");
});

test("a logo is a button that opens it full size, exactly as uploaded", () => {
  assert.match(LOGO, /<button type="button" data-logo onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(LOGO, /<Modal open=\{open\}/);
  assert.match(LOGO, /data-logo-full/);
  assert.match(LOGO, /<img src=\{full\}[^>]*object-contain/, "not cropped in the full view");
  assert.match(LOGO, /Open the picture in a new tab/);
  assert.match(LOGO, /rel="noopener noreferrer"/);
});

test("a logo with no small copy falls back to the full picture - never a broken box", () => {
  assert.match(LOGO, /onError=\{\(\) => \{ if \(!thumbFailed\) setThumbFailed\(true\); \}\}/);
  assert.match(LOGO, /thumbFailed \? full : logoThumb\(full\)/);
  assert.match(LOGO, /loading="lazy"/);
});

test("the Waiting list AND the other lists use it; the old sign-only box is gone", () => {
  assert.match(PAGE, /import \{ ShopLogo \} from "@\/components\/ShopLogo";/);
  const uses = PAGE.match(/<ShopLogo url=\{restaurant\.image_url\} name=\{restaurant\.name\} sign=\{verticalEmoji\(vendorTypeOf\(restaurant\)\)\} \/>/g) || [];
  assert.equal(uses.length, 2);
  assert.doesNotMatch(PAGE, /<img src=\{restaurant\.image_url\}/);
});

test("the theme stays: yellow ring on hover", () => {
  assert.match(LOGO, /hover:ring-takal-yellow/);
});
