// ─────────────────────────────────────────────────────────────────────────────
// STORE NAMES FOLLOW THE KIND - THE PANEL  (Mock 177, approved by Sana
// 9 October 2026; Step C)
//
// Sana: "the Store inside the Mall must be with the same name, The 13 main
// types stores" - "i want this setting in the admin panel so there will be no
// need of code changing."
//
// The rule is the DATABASE's (migration 129) and the words are the SERVER's
// (backend/mall_names.py). The panel shows what will happen BEFORE it happens:
// the card, the names a switch-on renames, the names a new mall name gives,
// the name "Add a store" gives, and a store's locked name box.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addPreview, kindName, NAME_DASH, namesForNewMallName, namesToChange } from "../src/lib/malls.ts";

const card = {
  follow: true,
  all_match: true,
  kind_taken: null,
  stores: [
    { id: "fa", kind: "clothing_store", kind_name: "Fashion", saved_as: "Wakeel Shopping Mall — Fashion",
      will_be: "Wakeel Shopping Mall — Fashion", matches: true },
    { id: "be", kind: "beauty_cosmetics", kind_name: "Beauty & Personal Care",
      saved_as: "Wakeel Shopping Mall — Beauty & Personal Care",
      will_be: "Wakeel Shopping Mall — Beauty & Personal Care", matches: true },
    { id: "hk", kind: "home_kitchen", kind_name: "", saved_as: "Wakeel Shopping Mall - Home & Kitchen",
      will_be: null, matches: true },
  ],
};
const mall = {
  name: "Wakeel Shopping Mall",
  stores: [{ vendor_type: "clothing_store" }, { vendor_type: "beauty_cosmetics" }] as any[],
  store_names: card,
};

test("the name is the mall, the same dash the database writes, then the kind", () => {
  assert.equal(NAME_DASH, " — ");
  assert.equal(kindName("Wakeel Shopping Mall", "Fashion"), "Wakeel Shopping Mall — Fashion");
  assert.equal(kindName("Wakeel Shopping Mall", ""), null, "no kind name - no rule");
  assert.equal(kindName("", "Fashion"), null);
});

test("turning the switch on lists exactly the names it will change", () => {
  assert.deepEqual(namesToChange(card), [], "Wakeel: every name already matches");
  const off = {
    ...card, follow: false, all_match: false,
    stores: [{ ...card.stores[0], saved_as: "City Centre — Fashion & Accessories",
               will_be: "City Centre — Fashion", matches: false }, card.stores[2]],
  };
  assert.deepEqual(namesToChange(off), [
    { from: "City Centre — Fashion & Accessories", to: "City Centre — Fashion" }]);
  assert.deepEqual(namesToChange(undefined), [], "before migration 129 - nothing");
});

test("a new mall name lists the stores that follow it - not the one of an unnamed kind", () => {
  assert.deepEqual(namesForNewMallName(card, "Wakeel Shopping Mall", "Wakeel Mall"), [
    { from: "Wakeel Shopping Mall — Fashion", to: "Wakeel Mall — Fashion" },
    { from: "Wakeel Shopping Mall — Beauty & Personal Care", to: "Wakeel Mall — Beauty & Personal Care" },
  ]);
  assert.deepEqual(namesForNewMallName(card, "Wakeel Shopping Mall", "Wakeel Shopping Mall"), [],
    "the same name - nothing");
  assert.deepEqual(namesForNewMallName({ ...card, follow: false }, "Wakeel Shopping Mall", "Wakeel Mall"), [],
    "switch off - names are free");
  assert.deepEqual(namesForNewMallName(card, "Wakeel Shopping Mall", "W"), [], "not a name yet");
});

test("Add a store: the name it will get, and a kind the mall already has", () => {
  assert.deepEqual(addPreview({ vendor_type: "flowers_gifts", kind_name: "Flowers & Gifts" }, mall),
    { willBe: "Wakeel Shopping Mall — Flowers & Gifts", takenBy: null });
  assert.deepEqual(addPreview({ vendor_type: "clothing_store", kind_name: "Fashion" }, mall),
    { willBe: "Wakeel Shopping Mall — Fashion", takenBy: "This mall already has a Fashion store" });
  assert.deepEqual(addPreview({ vendor_type: "clothing_store", kind_name: "Fashion" },
    { ...mall, store_names: { ...card, follow: false } }), { willBe: null, takenBy: null },
    "switch off - any store may go in, its name stays");
  assert.deepEqual(addPreview({ vendor_type: "clothing_store", kind_name: "Fashion" },
    { ...mall, store_names: undefined }), { willBe: null, takenBy: null }, "before migration 129");
});

// ── Wired into the screens ──────────────────────────────────────────────────
const page = readFileSync("src/app/dashboard/stores/malls/[id]/page.tsx", "utf8");
const cardFile = readFileSync("src/app/dashboard/stores/malls/[id]/parts-store-names.tsx", "utf8");
const settings = readFileSync("src/app/dashboard/stores/[id]/parts-settings.tsx", "utf8");
const storePage = readFileSync("src/app/dashboard/stores/[id]/page.tsx", "utf8");

test("the mall page shows the card, and the card is a real switch that asks first", () => {
  assert.match(page, /<StoreNamesCard mall=\{mall\} onSaved=\{load\} \/>/);
  assert.match(cardFile, /role="switch"/);
  assert.match(cardFile, /aria-checked=\{card\.follow\}/);
  assert.match(cardFile, /if \(!card\) return null;/, "no card before migration 129");
  assert.match(cardFile, /Turn on and rename \$\{changes\.length\} store/);
  assert.match(cardFile, /store_names_follow_kind: on/);
  assert.match(cardFile, /disabled=\{busy \|\| blocked\}/, "two stores of one kind: cannot turn on");
});

test("renaming the mall shows the store names that follow, before Save", () => {
  assert.match(page, /namesForNewMallName\(mall\.store_names, mall\.name, name\)/);
  assert.match(page, /store name\{follow\.length === 1 \? " changes" : "s change"\} too/);
});

test("Add a store says the name a store will get, and refuses a taken kind", () => {
  assert.match(page, /const pv = addPreview\(c, mall\);/);
  assert.match(page, /const can = c\.can_join && !pv\.takenBy;/);
  assert.match(page, /Will be named <b>\{pv\.willBe\}<\/b>/);
});

test("a store of such a mall has its name box locked, and the server's words are shown", () => {
  assert.match(settings, /disabled=\{!!locked\}/);
  assert.match(settings, /Set by \$\{nameSetBy\}: “Name every store after its kind” is on/);
  assert.match(settings, /r\?\.name_set_by_mall \? String\(r\.message\)/);
  assert.match(storePage, /nameSetBy=\{mall\?\.store_names\?\.follow \? mall\.name : null\}/);
});

test("the card tells today's truth: what customers see now, and no promise it cannot keep", () => {
  assert.match(cardFile, /shortName\(r\.saved_as, mall\.name\)/, "customers see the saved name, not the future one");
  assert.match(cardFile, /\{!blocked && \(/, "two stores of one kind: no 'turning it on renames them'");
});
