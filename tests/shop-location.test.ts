// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP'S PLACE IS ONE THING: A MAP PIN, WITH ITS ADDRESS.  (Mock 85)
//
// Sana, 17 September 2026: "Why i need to set location and then put the
// address this is totally confusion. There should be Address bar and pick
// location On Map..." These checks keep the one "Shop location" box honest.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  afterPinMoved, hasPin, locationBody, riderDirectionsLink, savedAddress, searchText,
} from "../src/lib/shop-location.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const box = read("src/app/dashboard/stores/parts-shop-location.tsx");
const settings = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const page = read("src/app/dashboard/stores/[id]/page.tsx");
const map = read("src/app/dashboard/stores/[id]/parts-map.tsx");
const client = read("src/lib/api-stores.ts");

// ── the rules ───────────────────────────────────────────────────────────────

test("a moved pin fills an empty address, or one this box filled itself", () => {
  assert.equal(afterPinMoved("", "", "Green Chowk, Mingora"), "fill");
  assert.equal(afterPinMoved("   ", "", "Green Chowk, Mingora"), "fill");
  assert.equal(afterPinMoved("Green Chowk, Mingora", "Green Chowk, Mingora", "Saidu Road, Mingora"), "fill");
});

test("a moved pin ASKS before replacing what a person typed", () => {
  assert.equal(afterPinMoved("Shop 12, near Green Chowk", "Green Chowk, Mingora", "Saidu Road"), "ask");
  assert.equal(afterPinMoved("Shop 12, near Green Chowk", "", "Saidu Road"), "ask");
});

test("no answer from the map, or the same words, changes nothing", () => {
  assert.equal(afterPinMoved("Shop 12", "", ""), "keep");
  assert.equal(afterPinMoved("", "", "   "), "keep");
  assert.equal(afterPinMoved("Saidu Road", "x", " Saidu Road "), "keep");
});

test("a pin is real only when both halves are a place and it is not 0,0", () => {
  assert.equal(hasPin("34.7722", "72.3601"), true);
  assert.equal(hasPin(34.77, 72.36), true);
  for (const [a, b] of [["", ""], ["34.7", ""], [0, 0], ["0", "0"], [null, 72], [95, 72], [34, 181], ["x", "y"]] as const) {
    assert.equal(hasPin(a, b), false, `${a}, ${b}`);
  }
});

test("one save sends the pin and its address together, or says what is missing", () => {
  assert.deepEqual(locationBody("34.7722", "72.3601", "  Shop 12, Green Chowk "), {
    ok: true, body: { latitude: 34.7722, longitude: 72.3601, address: "Shop 12, Green Chowk" },
  });
  const noPin = locationBody("", "", "Shop 12");
  assert.equal(noPin.ok, false);
  assert.match((noPin as any).error, /map/);
  const noWords = locationBody("34.7", "72.3", "   ");
  assert.equal(noWords.ok, false);
  assert.match((noWords as any).error, /address/i);
  assert.equal(savedAddress("x".repeat(400)).length, 300, "the server allows 300");
});

test("search waits for three letters and tidies the spaces", () => {
  assert.equal(searchText(""), null);
  assert.equal(searchText("gr"), null);
  assert.equal(searchText("  green   chowk "), "green chowk");
  assert.equal(searchText("a".repeat(150))!.length, 100);
});

test("the rider link is the one the rider app opens", () => {
  assert.equal(riderDirectionsLink("34.7722", "72.3601"),
    "https://www.google.com/maps/dir/?api=1&destination=34.7722,72.3601&travelmode=driving");
  assert.equal(riderDirectionsLink("", ""), "");
});

// ── the box ─────────────────────────────────────────────────────────────────

test("the box has the mock's parts, in the mock's words", () => {
  for (const words of [
    "📍 Shop location", "✓ On the map", "⚠ Required",
    "Search area, street or landmark", "Pin is at:", "Shop address",
    "or paste a Google Maps link:", "You moved the pin.", "Use new address", "Keep mine",
    "Riders, customers, distance and delivery fee all use the",
    "Test in Google Maps ↗", "Save location and address",
  ]) {
    assert.ok(box.includes(words), `"${words}" is missing from the Shop location box`);
  }
});

test("the box searches through the server, never straight from the browser", () => {
  assert.match(box, /apiClient\.searchPlaces\(/);
  assert.match(client, /\/geocode\/search\?q=\$\{encodeURIComponent\(q\)\}/);
  assert.ok(!/nominatim/i.test(box), "the browser must not call the map service itself");
});

test("a search result moves the pin and names it in ONE update", () => {
  // Two updates in a row would have the second one wipe the first.
  const move = box.slice(box.indexOf("const movePin"), box.indexOf("const settle"));
  assert.equal((move.match(/changeRef\.current\(/g) || []).length, 1);
});

test("the address looked up is debounced, so dragging does not flood the map service", () => {
  assert.match(box, /apiClient\.reverseGeocode\(/);
  assert.match(box, /\}, 700\);/);
  assert.match(box, /\}, 450\);/);
});

// ── the store page ──────────────────────────────────────────────────────────

test("the store page has ONE location card, and settings no longer has an address box", () => {
  assert.match(page, /<ShopLocationCard store=\{r\} onSaved=\{load\} \/>/);
  assert.ok(!page.includes("<LocationCard"), "the old map card is back");
  assert.ok(!/label: "Address"/.test(settings), "Store settings has its own Address box again");
  assert.ok(!/body\.address/.test(settings), "Store settings saves the address apart from the pin again");
  assert.ok(!map.includes("export function LocationCard"));
  assert.ok(!map.includes("export function CreateStorePin"));
});

test("the location card saves the pin and address with one call", () => {
  const card = box.slice(box.indexOf("export function ShopLocationCard"));
  assert.match(card, /locationBody\(v\.lat, v\.lon, v\.address\)/);
  assert.equal((card.match(/apiClient\.updateRestaurant\(/g) || []).length, 1);
  assert.match(card, /updateRestaurant\(String\(store\.id\), r\.body\)/);
});
