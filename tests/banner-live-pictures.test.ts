// A HOME BANNER CAN SHOW LIVE PRODUCT PICTURES (MOCK 79-C).
//
// Sana approved Mock 79 on 16 September 2026. The banner editor gets a
// "Banner picture" block: the banner's own picture, or three real product
// pictures that change by themselves. These checks hold the panel's half:
//   - only "own" or "live" is ever saved, and an old banner reads as "own";
//   - the admin is told, in words, where the pictures come from;
//   - too few pictures is explained with what the customer sees instead;
//   - the upload is still there when live pictures are chosen;
//   - the preview shows the row of three the phone shows.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PICTURE_MODES,
  pictureModeOf,
  liveSource,
  liveShortage,
} from "../src/lib/marketing.ts";

function code(path: string): string {
  return readFileSync(path, "utf8")
    // A BLOCK COMMENT STARTS A LINE. Anchored with ^[ \t]* and /m on purpose:
    // without it, `/*` INSIDE A STRING opens a comment that runs to the next `*/`
    // — and src/lib/navigation.ts has rules like "/admin/riders/*/cash-limits".
    // Found on 24 September 2026: a lone starred rule swallowed fifty lines of
    // SERVER_RULES, and the check for a rule below it passed on a file that no
    // longer contained it. It had looked right only because the starred lines
    // happened to come in pairs, so each one closed the one before it.
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

const PAGE = code("src/app/dashboard/marketing/banners/page.tsx");
// Read as it is: `accept="image/*"` in this file looks like the start of a
// comment to the stripper above and would swallow the rest of the file.
const BLOCK = readFileSync("src/app/dashboard/marketing/banners/parts-banner-picture.tsx", "utf8");
const PREVIEW = code("src/app/dashboard/marketing/banners/parts-banner-preview.tsx");
const API = code("src/lib/api-money.ts");

test("only the two choices the database allows are offered", () => {
  // Migration 077: CHECK (picture_mode IN ('own', 'live')).
  assert.deepEqual(PICTURE_MODES.map((m) => m.value), ["own", "live"]);
  assert.equal(PICTURE_MODES[0].label, "My own picture");
  assert.equal(PICTURE_MODES[1].label, "Live product pictures");
});

test("a banner saved before the choice existed reads as its own picture", () => {
  for (const v of [undefined, null, "", "own", "LIVE", "video", 1]) {
    assert.equal(pictureModeOf(v), "own", `${String(v)} should read as own`);
  }
  assert.equal(pictureModeOf("live"), "live");
});

test("the admin is told where the pictures come from, the way the server picks", () => {
  assert.equal(liveSource("vertical", { section: "Food" }), "Food");
  assert.equal(liveSource("shop", { shop: "Khan Restaurant" }), "Khan Restaurant");
  assert.equal(liveSource("shop"), "This shop");
  for (const t of ["promo", "url", "none", undefined, null]) {
    assert.equal(liveSource(t as any), "All shops");
  }
});

test("too few pictures is explained with what the customer sees instead", () => {
  assert.equal(liveShortage("Food", 6, 3), null);
  assert.equal(liveShortage("Food", 3, 3), null);
  const none = liveShortage("Grocery", 0, 3)!;
  assert.match(none, /Grocery has no products with pictures yet/);
  assert.match(none, /your own picture/);
  const two = liveShortage("Pharmacy", 2, 3)!;
  assert.match(two, /only 2 product pictures/);
  assert.match(two, /3 are needed/);
  assert.match(liveShortage("Pharmacy", 1, 3)!, /only 1 product picture -/);
});

test("the choice is loaded, saved and never sent as nonsense", () => {
  assert.ok(PAGE.includes("picture_mode: pictureModeOf(banner.picture_mode)"));
  assert.ok(PAGE.includes("picture_mode: pictureModeOf(f.picture_mode)"));
  assert.ok(PAGE.includes('picture_mode: "own"'), "a new banner starts on its own picture");
});

test("the block sits where the old picture box was, and the upload is still inside it", () => {
  assert.ok(PAGE.includes("<BannerPicture"));
  assert.ok(!PAGE.includes("Background picture"), "the old picture box is still there too");
  assert.ok(BLOCK.includes('type="file"'), "the upload was lost");
  assert.ok(BLOCK.includes("Remove picture"));
  assert.ok(BLOCK.includes("paste a picture address"));
  assert.ok(BLOCK.includes("Pictures come from: {source}"));
  assert.ok(BLOCK.includes("liveShortage("));
  // Both choices are real radio buttons in one group, so the keyboard works.
  assert.equal((BLOCK.match(/type="radio"/g) || []).length, 2);
  assert.equal((BLOCK.match(/name="picture_mode"/g) || []).length, 2);
});

test("the pictures are asked of the server, never guessed by the panel", () => {
  assert.ok(API.includes("/admin/promo-banners/live-preview?"));
  assert.ok(PAGE.includes("getBannerLivePreview("));
  // A failed check must not block saving.
  assert.ok(BLOCK.includes("You can still save"));
});

test("the preview draws the row of three the phone draws", () => {
  assert.ok(PREVIEW.includes("livePictures.slice(0, 3)"));
  assert.ok(PAGE.includes("livePictures={livePictures}"));
  // Only when there are enough - otherwise the preview shows the own picture,
  // exactly like the app.
  assert.ok(PAGE.includes("live.pictures.length >= live.needed"));
});

test("the list says which banners use live pictures", () => {
  assert.ok(PAGE.includes("Live pictures"));
});
