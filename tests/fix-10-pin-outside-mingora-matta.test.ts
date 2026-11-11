// ─────────────────────────────────────────────────────────────────────────────
// FIX 10 (All Stores audit; Sana 10 Nov 2026): "only the pins that pointed
// outside MINGORA and Matta should be marked - the pins can be anywhere in
// Pakistan." A mark, never a block.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOME_TOWN_KM, HOME_TOWNS, kmBetween, nearestHomeTown, pinOutsideHomeTowns, pinOutsideWords,
} from "../src/lib/shop-location.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const list = read("src/app/dashboard/stores/page.tsx");
const box = read("src/app/dashboard/stores/parts-shop-location.tsx");

test("shops in Mingora and Matta get no mark", () => {
  assert.equal(pinOutsideHomeTowns(34.7717, 72.36), false);        // Green Chowk, Mingora
  assert.equal(pinOutsideHomeTowns("34.7550", "72.3536"), false);  // text, as the database sends it
  assert.equal(pinOutsideHomeTowns(34.9249, 72.4144), false);      // Gulab Market, Matta
  assert.equal(pinOutsideHomeTowns(34.9469, 72.4342), false);      // Kalakot, by Matta
});

test("a pin far away is marked - Karachi, Malakand, Talash", () => {
  assert.equal(pinOutsideHomeTowns(24.8607, 67.0011), true);
  assert.equal(pinOutsideHomeTowns(34.5085, 72.124), true);
  assert.equal(pinOutsideHomeTowns(34.7409, 71.8653), true);
});

test("Matta is Matta Bazaar, where the Matta shops really are", () => {
  const matta = HOME_TOWNS.find((t) => t.name === "Matta")!;
  assert.ok(kmBetween(matta.lat, matta.lon, 34.9252, 72.4143) < 0.2);   // Zaman Market
  assert.equal(HOME_TOWN_KM, 10);
});

test("no pin is not 'outside' - it has its own No pin mark", () => {
  for (const [la, lo] of [[0, 0], ["", ""], [null, null], [undefined, undefined], ["x", "y"]]) {
    assert.equal(pinOutsideHomeTowns(la, lo), false);
    assert.equal(nearestHomeTown(la, lo), null);
  }
});

test("the hover words say how far, from which town, and that it can still be saved", () => {
  const w = pinOutsideWords(24.8607, 67.0011);
  assert.match(w, /^Pin is 1,\d{3} km from Mingora/);
  assert.match(w, /can still be saved/);
});

test("both list views show the mark; nothing blocks Save", () => {
  assert.equal((list.match(/data-pin-outside /g) || []).length, 2);
  assert.equal((list.match(/pinOutsideHomeTowns\(restaurant\.latitude, restaurant\.longitude\)/g) || []).length, 2);
  assert.match(box, /set && pinOutsideHomeTowns\(value\.lat, value\.lon\) && \(/);
  assert.match(box, /data-pin-outside-note/);
  // the box never turns the mark into an error
  assert.doesNotMatch(box, /pinOutsideHomeTowns[^\n]*(pinError|setErr|return false)/);
});
