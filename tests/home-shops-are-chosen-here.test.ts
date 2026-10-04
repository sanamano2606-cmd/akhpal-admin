// HOME SHOPS ARE CHOSEN AND STYLED HERE - Mock 151, Sana 4 Oct 2026:
// "i want the setting in Admin Panel" ... "D but a little Taller. And add the
// similar design and styling options so i can chose from there too".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DIR = "src/app/dashboard/marketing/home-shops/";
const PAGE = readFileSync(DIR + "page.tsx", "utf8");
const DIALOG = readFileSync(DIR + "parts-shop-dialog.tsx", "utf8");
const PREVIEW = readFileSync(DIR + "parts-card-preview.tsx", "utf8");
const API = readFileSync("src/lib/api-money.ts", "utf8");
const NAV = readFileSync("src/lib/navigation.ts", "utf8");

test("the page is in Marketing, under the Home Banners option", () => {
  assert.ok(NAV.includes('{ label: "Home Shops", href: "/dashboard/marketing/home-shops", section: "marketing.banners"'));
  assert.ok(NAV.includes('["/admin/home-shops", "marketing.banners"]'));
});

test("every call the page makes exists in the API client", () => {
  for (const m of ["getHomeShops", "addHomeShop", "updateHomeShop", "removeHomeShop",
                   "reorderHomeShops", "updateHomeShopsSettings"]) {
    assert.ok(API.includes(`async ${m}(`), `${m} is missing`);
    assert.ok((PAGE + DIALOG).includes(`apiClient.${m}(`), `${m} is never used`);
  }
  assert.ok(API.includes("/admin/home-shops/settings"));
  assert.ok(API.includes("/admin/home-shops/reorder"));
});

test("the row: on/off, slides by itself, speed", () => {
  assert.ok(PAGE.includes("Show the shops row"));
  assert.ok(PAGE.includes("Slides by itself"));
  assert.ok(PAGE.includes("interval_seconds"));
});

test("every look choice the server accepts has a button", () => {
  for (const v of ['"corner"', '"band"', '"tag"', '"black"', '"yellow"', '"white"', '"logo"',
                   '"rating"', '"time"', '"name"', '"normal"', '"tall"', '"round"', '"soft"']) {
    assert.ok(PAGE.includes(`[${v},`), `${v} cannot be chosen`);
  }
  assert.ok(PAGE.includes("ribbon_color") && PAGE.includes('type="color"'), "any ribbon colour");
});

test("the approved look (style D, Takal yellow) is the default", () => {
  assert.ok(PREVIEW.includes('TAKAL_YELLOW = "#FFFF00"'));
  assert.ok(/ribbon_style: "corner", ribbon_color: TAKAL_YELLOW, strip_color: "black",\s*strip_shows: "rating", card_height: "normal", corners: "round"/.test(PAGE));
});

test("there is a live card preview, drawn like the app", () => {
  assert.ok(PAGE.includes("<RowPreview"));
  assert.ok(DIALOG.includes("<ShopCardPreview"));
  assert.ok(PREVIEW.includes('look.card_height === "tall" ? 0.5 : 0.4'), "100 tall on a 250 card, as the app");
  assert.ok(PREVIEW.includes("rotate(30deg)"), "the ribbon across the corner");
});

test("no title box: Sana said remove the Title", () => {
  assert.ok(!/title_ur|Title \(English\)/.test(PAGE + DIALOG));
});

test("each shop: short line in English and Urdu (40 letters), dates, on/off, logo colour", () => {
  assert.ok(DIALOG.includes("export const MAX_TAGLINE = 40;"));
  for (const k of ["tagline", "tagline_ur", "starts_at", "ends_at", "is_active", "logo_color"]) {
    assert.ok(DIALOG.includes(k), `${k} is not saved`);
  }
  assert.ok(DIALOG.includes("getImageData"), "the logo colour is read from the logo");
});

test("shops are moved, edited and removed; a failed read is not shown as 'no shops'", () => {
  assert.ok(PAGE.includes("move(i, -1)") && PAGE.includes("move(i, 1)"));
  assert.ok(PAGE.includes("setRemoving(r)"));
  assert.ok(PAGE.includes("readFailure(") && PAGE.includes("<ErrorState"));
});
