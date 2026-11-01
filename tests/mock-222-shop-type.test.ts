// MOCK 222 - THE SHOP TYPE BOX ON STORE SETTINGS (approved by Sana, 1 Nov 2026).
// Sana: "there is no shop type changing Option". The rules are run for real
// (src/lib/shop-type-change.ts); the screen is checked for who may press it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  typesToOffer, isRider, licenceIsGood, whyNot, commissionAfter, whatChanges, todayPk,
} from "../src/lib/shop-type-change.ts";
import { SIGNUP_VERTICALS } from "../src/lib/verticals.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BOX = read("src/app/dashboard/stores/[id]/parts-shop-type.tsx");
const PAGE = read("src/app/dashboard/stores/[id]/page.tsx");
const SETTINGS = read("src/app/dashboard/stores/[id]/parts-settings.tsx");
const STAFF = read("src/app/shop/page.tsx");
const RIDER = ["restaurant", "grocery", "pharmacy", "bakery", "fruits_vegetables", "meat_chicken"];
const TODAY = "2026-11-01";
const GOOD = { number: "DSL-12345", valid_until: "2027-06-30", has_photo: true, ok_at: "2026-10-20T10:00:00Z" };

// ── 1. the window offers the thirteen, and never hides the shop's own type ──
test("the window offers the thirteen types a new shop may choose", () => {
  assert.equal(typesToOffer("clothing_store").length, 13);
  assert.deepEqual(typesToOffer("clothing_store").map((v) => v.value), SIGNUP_VERTICALS.map((v) => v.value));
});

test("a shop on a RETIRED type sees its own type first, called by its name", () => {
  const t = typesToOffer("bakery");
  assert.equal(t.length, 14);
  assert.equal(t[0].value, "bakery");
  assert.equal(t[0].label, "Bakery & Sweets");
});

test("rider or parcel comes from the live list of rider types", () => {
  assert.equal(isRider("grocery", RIDER), true);
  assert.equal(isRider("clothing_store", RIDER), false);
  assert.equal(isRider("", RIDER), true, "a blank type is Food (the column default) - a rider type");
});

// ── 2. pharmacy: the server's licence rule, never promised when it would refuse ──
test("a checked, valid licence is good; anything missing is not", () => {
  assert.equal(licenceIsGood(GOOD, TODAY), true);
  assert.equal(licenceIsGood({ ...GOOD, ok_at: null }, TODAY), false, "not checked by the office");
  assert.equal(licenceIsGood({ ...GOOD, has_photo: false }, TODAY), false, "no photo");
  assert.equal(licenceIsGood({ ...GOOD, number: "12" }, TODAY), false, "number too short");
  assert.equal(licenceIsGood({ ...GOOD, valid_until: "2026-10-31" }, TODAY), false, "run out yesterday");
  assert.equal(licenceIsGood({ ...GOOD, valid_until: TODAY }, TODAY), true, "valid until today is still valid");
  assert.equal(licenceIsGood(null, TODAY), false);
});

test("a LIVE shop cannot become a pharmacy without a good licence - a waiting one can", () => {
  const live = { is_approved: true, vendor_type: "clothing_store" };
  assert.match(String(whyNot("pharmacy", live, null, TODAY)), /checked drug sale licence/);
  assert.equal(whyNot("pharmacy", live, GOOD, TODAY), null);
  assert.equal(whyNot("pharmacy", { ...live, is_approved: false }, null, TODAY), null,
    "a shop still waiting may switch - Approve asks for the licence later");
  assert.equal(whyNot("grocery", live, null, TODAY), null, "only becoming a pharmacy needs it");
  assert.equal(whyNot("pharmacy", { ...live, vendor_type: "pharmacy" }, null, TODAY), null);
});

test("Pakistan's date is used for the licence, not the computer's", () => {
  // 8pm UTC on 31 Oct is already 1 Nov in Swat.
  assert.equal(todayPk(new Date("2026-10-31T20:00:00Z")), "2026-11-01");
});

// ── 3. commission: said only when it is known ──
test("commission: a fixed-price shop and a shop with its own rate keep theirs", () => {
  assert.deepEqual(commissionAfter({ fixed: true, own: null, inUse: 0 }, "a", "b", {}), { same: true, words: "None - fixed-price store" });
  assert.equal(commissionAfter({ fixed: false, own: 8, inUse: 8 }, "a", "b", {}).same, true);
});

test("commission: follows the type's rate, and never guesses when the rates cannot be read", () => {
  const now = { fixed: false, own: null, inUse: 10 };
  assert.deepEqual(commissionAfter(now, "clothing_store", "grocery", { clothing_store: null, grocery: null }),
    { same: true, words: "Takal rate 10%" });
  const r = commissionAfter(now, "clothing_store", "grocery", { clothing_store: null, grocery: 5 });
  assert.equal(r.same, false); assert.match(r.words, /5%/);
  assert.equal(commissionAfter(now, "clothing_store", "grocery", null).same, null);
});

// ── 4. what changes ──
test("Fashion -> Grocery: where and delivery change; the map pin is said", () => {
  const c = whatChanges({ from: "clothing_store", to: "grocery", express: RIDER, hasPin: true,
    commission: { fixed: false, own: null, inUse: 10 }, rates: {} });
  const by = Object.fromEntries(c.map((x) => [x.key, x]));
  assert.equal(by.where.changes, true);
  assert.equal(by.delivery.changes, true);
  assert.equal(by.products.changes, false);
  assert.equal(by.pin.bad, undefined);
});

test("a shop with NO map pin becoming rider-delivered gets the red line", () => {
  const c = whatChanges({ from: "clothing_store", to: "grocery", express: RIDER, hasPin: false,
    commission: { fixed: false, own: null, inUse: 10 }, rates: {} });
  assert.equal(c.find((x) => x.key === "pin")?.bad, true);
});

test("Fashion -> Beauty: delivery stays the same and no pin line", () => {
  const c = whatChanges({ from: "clothing_store", to: "beauty_cosmetics", express: RIDER, hasPin: false,
    commission: { fixed: false, own: null, inUse: 10 }, rates: {} });
  assert.equal(c.find((x) => x.key === "delivery")?.changes, false);
  assert.equal(c.find((x) => x.key === "pin"), undefined);
});

// ── 5. the screen ──
test("only the Main Admin and 'Shop money' get the button - the pencil's own rule", () => {
  assert.match(PAGE, /mayAccess\("stores\.money", getMyPerms\(\)\)/);
  assert.match(PAGE, /<ShopTypeBox[^>]*mayChange=\{mayChangeType\}/);
  assert.match(BOX, /\{mayChange && \(\s*<button[^>]*data-change-shop-type/);
});

test("it saves through the same door as the pencil, so the server's checks answer", () => {
  assert.match(BOX, /apiClient\.setRestaurantVendorType\(String\(store\.id\), pick\)/);
});

test("nothing is saved from the window itself - only from 'Yes, change it'", () => {
  const go = BOX.slice(BOX.indexOf("data-go-change"), BOX.indexOf("data-go-change") + 200);
  assert.match(go, /setSure\(true\)/);
  assert.doesNotMatch(go, /save\b/);
  assert.match(BOX, /data-yes-change[^>]*onClick=\{save\}/);
  assert.match(BOX, /disabled=\{pick === now \|\| !!blocked\}/, "no change and a refused change cannot be sent");
});

test("the box sits inside Store settings, and the mall staff page never gets it", () => {
  assert.match(SETTINGS, /\{typeBox\}/);
  assert.doesNotMatch(STAFF, /ShopTypeBox|typeBox=/);
});
