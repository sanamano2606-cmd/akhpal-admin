// ─────────────────────────────────────────────────────────────────────────────
// FIX 9 (All Stores audit 9 Nov 2026; Sana: "Go Fix 9")
// A short Google Maps link - the one a vendor sends on WhatsApp - puts the pin.
// Before: https://maps.app.goo.gl/AbC123 -> "Could not find a map point in that".
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_LINK_UNREAD, MAP_LINK_WAIT_MS, mapLinkIn } from "../src/lib/shop-location.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const box = read("src/app/dashboard/stores/parts-shop-location.tsx");
const api = read("src/lib/api-stores.ts");

test("the Google Maps link is found inside what was pasted", () => {
  assert.equal(mapLinkIn("https://maps.app.goo.gl/AbC123"), "https://maps.app.goo.gl/AbC123");
  assert.equal(mapLinkIn("Shop location: https://maps.app.goo.gl/AbC123 thanks"),
    "https://maps.app.goo.gl/AbC123");
  assert.equal(mapLinkIn("(https://maps.app.goo.gl/AbC123)."), "https://maps.app.goo.gl/AbC123");
  assert.equal(mapLinkIn("https://goo.gl/maps/xyz"), "https://goo.gl/maps/xyz");
  assert.equal(mapLinkIn("https://www.google.com/maps/place/Mingora"),
    "https://www.google.com/maps/place/Mingora");
  assert.equal(mapLinkIn("https://maps.google.com.pk/?cid=1"), "https://maps.google.com.pk/?cid=1");
});

test("anything that is not a Google Maps link is not sent to the server", () => {
  for (const bad of ["", "34.77 72.36 nothing", "http://maps.app.goo.gl/AbC", "https://goo.gl/AbC",
    "https://www.google.com/search?q=x", "https://maps.app.goo.gl.evil.com/x", "https://example.com/maps"]) {
    assert.equal(mapLinkIn(bad), "", bad);
  }
});

test("numbers and long links are still read in the panel first, with no server call", () => {
  const i = box.indexOf("const applyPaste = async");
  const body = box.slice(i, box.indexOf("const pick =", i));
  assert.ok(body.indexOf("parseCoords(paste)") < body.indexOf("apiClient.readMapLink"));
  assert.match(body, /if \(c\) \{ putPin\(c\.lat, c\.lon\); return; \}/);
});

test("a short link asks the server, puts the pin, and says plainly when it cannot", () => {
  assert.match(box, /const url = mapLinkIn\(paste\)/);
  assert.match(box, /await apiClient\.readMapLink\(url\)/);
  assert.match(box, /typeof got\.lat === "number" && typeof got\.lon === "number"\) putPin/);
  assert.equal((box.match(/toast\(MAP_LINK_UNREAD, "error"\)/g) || []).length, 2);
  assert.match(MAP_LINK_UNREAD, /copy the numbers instead/);
});

test("the button says Reading… and cannot be pressed twice", () => {
  assert.match(box, /disabled=\{readingLink\}/);
  assert.match(box, /\{readingLink \? "Reading…" : "Use"\}/);
  assert.match(box, /if \(readingLink\) return;/);
});

test("the panel asks the signed-in map-link door and waits long enough", () => {
  assert.match(api, /`\/geocode\/map-link\?url=\$\{encodeURIComponent\(url\)\}`/);
  assert.match(api, /timeoutMs: MAP_LINK_WAIT_MS/);
  assert.ok(MAP_LINK_WAIT_MS >= 30000);
  assert.doesNotMatch(api, /\/admin\/geocode\/map-link/);
});
