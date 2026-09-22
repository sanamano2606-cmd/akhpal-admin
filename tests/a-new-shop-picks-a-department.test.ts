// A NEW SHOP IS OFFERED DEPARTMENTS, NOT SECTIONS.
//
// WHY THIS FILE EXISTS  (Mock 113, 22 September 2026.)
//
// Real vendors could not finish signing up. The create-store screen showed 20
// tiles that mixed two different things - "Food", a DEPARTMENT, beside
// "Bakery", a SECTION INSIDE Food & Drinks - as if they were equals. A baker
// cannot tell which one he is, because the question has no right answer.
//
// Eight of the twenty were sections. They are RETIRED, not switched off:
// shops already on them keep their type, keep rider delivery if it is an
// instant type, and keep their commission. They are simply no longer offered
// when a NEW shop is created.
//
// The two rules below are easy to break by accident - by mapping over
// VERTICALS again because it is the name that comes to mind, or by dropping a
// retired type out of the list entirely to "tidy up". Either would put a real
// shop or a real commission out of reach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { VERTICALS, SIGNUP_VERTICALS, verticalLabel } from "../src/lib/verticals.ts";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

const THE_EIGHT = ["bakery", "fruits_vegetables", "meat_chicken",
                   "cleaning_supplies", "furniture_decor", "garden_plants",
                   "jewelry_accessories", "toys_games"];

const THE_THIRTEEN = ["restaurant", "grocery", "pharmacy", "beauty_cosmetics",
                      "clothing_store", "electronics_shop", "home_appliances",
                      "baby_kids", "sports_fitness", "books_stationery",
                      "pet_supplies", "flowers_gifts", "auto_parts"];

test("a new shop is offered exactly the thirteen departments", () => {
  assert.deepEqual(SIGNUP_VERTICALS.map((v) => v.value), THE_THIRTEEN);
});

test("not one of the eight sections is offered to a new shop", () => {
  const offered = new Set(SIGNUP_VERTICALS.map((v) => v.value));
  for (const k of THE_EIGHT) {
    assert.ok(!offered.has(k),
      `${k} is a section inside a department, not a department. Offering it ` +
      `is the exact confusion vendors complained about.`);
  }
});

test("every offered tile carries its line of examples", () => {
  // This line IS the fix. "Food & Drinks" with nothing under it tells a baker
  // no more than "Food" did.
  for (const v of SIGNUP_VERTICALS) {
    assert.ok((v.examples || "").trim().length > 0,
      `${v.value} would be drawn with no line under it`);
  }
});

test("the eight retired types are still in the full list", () => {
  // A commission still has to be settable on them, a shop of that type still
  // has to be named, filtered and edited. Removing them from VERTICALS would
  // put Al Watan Baker and Waqas out of reach.
  const all = new Set(VERTICALS.map((v) => v.value));
  for (const k of THE_EIGHT) {
    assert.ok(all.has(k),
      `${k} vanished from the panel. A shop already on it can no longer be ` +
      `named, filtered, edited or given a commission.`);
  }
  assert.equal(VERTICALS.length, 21);
});

test("a retired type still has a proper name, not a code", () => {
  assert.equal(verticalLabel("bakery"), "Bakery & Sweets");
  assert.equal(verticalLabel("jewelry_accessories"), "Jewellery & Accessories");
});

test("the create-store screen maps over the SIGN-UP list, not all of them", () => {
  const src = read("app/dashboard/stores/parts-create-store.tsx");
  assert.match(src, /SIGNUP_VERTICALS\.map\(/,
    "the create-store grid must use SIGNUP_VERTICALS");
  assert.ok(!/[^_]VERTICALS\.map\(/.test(src),
    "something on the create-store screen is still mapping over all 21 types");
});

test("the create-store tile draws the examples line", () => {
  const src = read("app/dashboard/stores/parts-create-store.tsx");
  assert.match(src, /v\.examples/,
    "the tile no longer shows what goes in the department - that was the fix");
});
