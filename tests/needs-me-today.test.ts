// MOCK 237 PIECE 1 (Sana, 10 Nov 2026: "Approved" -> "GO 237"): "Needs me
// today" at the top of Stores - four tiles and the shops behind them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TILES, calledLine, clock, dayMonth, fixesLine, picturesLine, quietLine, readyLine, telLink,
  tileCount, tileLine, type NeedsToday,
} from "../src/lib/needs-today.ts";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");
const BOX = code("src/app/dashboard/stores/parts-needs-today.tsx");
const PAGE = code("src/app/dashboard/stores/page.tsx");
const API = code("src/lib/api-stores.ts");
const SERVER = code("../swat-delivery-app/backend/routers/needs_today.py");

const DATA: NeedsToday = {
  ready: [{ id: "a", name: "Aizal Parsa Collection", products_on_sale: 12, payout_given: true }],
  fixes: [],
  pictures: [{ id: "a", name: "Aizal Parsa Collection", pictures: ["u1", "u2"], found_at: "2026-11-08T05:00:00Z" },
             { id: "z", name: "Zamarud Cosmetics", pictures: ["u3"], live: true }],
  quiet: [{ id: "k", name: "Khan Restaurant", on_sale: 3, quiet_days: 19, reminded_at: "2026-11-09T06:30:00Z" }],
  failed: [], quiet_days: 7, checked_at: "2026-11-10T09:00:00Z",
};

test("the four tiles, in the mock's order", () => {
  assert.deepEqual(TILES.map((t) => t.label), ["Ready to switch on", "Sent fixes back", "Pictures to look at", "Quiet shops"]);
  assert.equal(tileCount("ready", DATA), 1);
  assert.equal(tileCount("pictures", DATA), 3, "pictures count pictures, not shops");
  assert.equal(tileLine("pictures", DATA), "In 2 shops - may show a phone number");
  assert.equal(tileLine("fixes", DATA), "No vendor has sent fixes yet");
  assert.equal(tileLine("quiet", DATA), "Nothing added for 7 days or more");
  assert.equal(tileCount("quiet", null), null);
  assert.equal(tileLine("ready", null), "Checking…");
});

test("a part the server could not read says so - never a quiet 0", () => {
  assert.equal(tileLine("pictures", { ...DATA, failed: ["pictures"] }), "Could not be read just now");
  assert.match(BOX, /\{bad \? "–" : n \?\? "…"\}/);
});

test("days and times are Swat's", () => {
  assert.equal(dayMonth("2026-11-09T20:00:00Z"), "10 Nov", "1 am on the 10th in Swat");
  assert.equal(clock("2026-11-10T06:40:00Z"), "11:40");
  assert.equal(dayMonth(null), "");
});

test("the rows' words", () => {
  assert.equal(quietLine(DATA.quiet[0]), "3 of 5 products on sale · nothing added for 19 days · Assistant reminded 9 Nov");
  assert.equal(quietLine({ id: "x", name: "X", on_sale: 0, quiet_days: 30, added_anything: false }),
    "0 of 5 products on sale · nothing added in 30 days since approval");
  assert.equal(readyLine(DATA.ready[0]), "12 products on sale · logo ✓ · payout ✓");
  assert.equal(readyLine({ id: "s", name: "S", products_on_sale: 7 }),
    "7 products on sale · logo ✓ · payout not yet (not needed to go live)");
  assert.equal(fixesLine({ id: "m", name: "MZ", fixed: 1, asked: 1, first_fix: "Cool Drinks",
    sent_back_at: "2026-11-05T00:06:00Z", fixed_at: "2026-11-10T04:00:00Z" }),
    "1 of 1 fix done: Cool Drinks · sent back 5 Nov · fixed 10 Nov");
  assert.equal(picturesLine(DATA.pictures[0]), "2 pictures · found 8 Nov");
  assert.equal(picturesLine(DATA.pictures[1]), "1 picture · live shop - customers can see it");
});

test("I called: today shows the time, another day shows the day", () => {
  const now = new Date("2026-11-10T09:00:00Z");
  assert.equal(calledLine("2026-11-10T06:40:00Z", now), "✓ Called today, 11:40");
  assert.equal(calledLine("2026-11-08T06:40:00Z", now), "✓ Called 8 Nov");
  assert.equal(calledLine(null, now), "");
});

test("Call is a phone link, or nothing", () => {
  assert.equal(telLink("0300-111 2233"), "tel:03001112233");
  assert.equal(telLink(""), "");
});

test("the box asks the server's own doors", () => {
  assert.match(SERVER, /@router\.get\("\/admin\/stores\/needs-today", tags=\["Admin"\]\)/);
  assert.match(SERVER, /@router\.get\("\/admin\/stores\/needs-today\/whatsapp\/\{restaurant_id\}"/);
  assert.match(SERVER, /@router\.post\("\/admin\/restaurants\/\{restaurant_id\}\/called"/);
  assert.match(API, /`\/admin\/stores\/needs-today\$\{fresh \? "\?fresh=1" : ""\}`/);
  assert.match(API, /`\/admin\/stores\/needs-today\/whatsapp\/\$\{restaurantId\}`/);
  assert.match(API, /`\/admin\/restaurants\/\$\{restaurantId\}\/called`, \{ method: "POST" \}/);
});

test("it sits at the top of All Stores, asked after the list is drawn", () => {
  assert.match(PAGE, /import \{ NeedsMeToday \} from "\.\/parts-needs-today";/);
  assert.match(PAGE, /<NeedsMeToday start=\{!loading\} isMain=\{isMain\} onShown=\{readyShown\} \/>/);
  assert.ok(PAGE.indexOf("<NeedsMeToday") < PAGE.indexOf("THE LISTS, AS COUNT BUTTONS"), "above the list buttons");
});

test("Show to customers is the Main Admin's, asked once; WhatsApp only opens - you press Send", () => {
  assert.match(BOX, /disabled=\{!isMain \|\| busy !== null\}/);
  assert.match(BOX, /<ConfirmDialog open=\{!!ask\}/);
  assert.match(BOX, /window\.open\("", "_blank"\)/);
  assert.doesNotMatch(SERVER, /send_whatsapp|_notify\(/, "the server sends nothing");
});
