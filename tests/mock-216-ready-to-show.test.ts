// MOCK 216 - "READY TO SHOW" (Sana, 29 Oct 2026: "They Should move to separate
// portion from where i can confirm and show them to customers." - "Approved").
//
// The server decides who is ready (backend routers/ready_to_show.py). These
// checks hold the panel to the picture: its own chip beside Live, its own box
// instead of the table, one "Show to customers" per shop that asks first,
// "Show all" through the same door one at a time, only the Main Admin presses,
// and the words the vendor is told match the server's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedDay, confirmTicks, liveMessageStart, readyTicks, showAllResult, unreadLine } from "../src/lib/ready-to-show.ts";

const PAGE = readFileSync("src/app/dashboard/stores/page.tsx", "utf8");
const PART = readFileSync("src/app/dashboard/stores/parts-ready-to-show.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const SERVER = readFileSync("../swat-delivery-app/backend/routers/restaurants_admin.py", "utf8");
const LIST = readFileSync("../swat-delivery-app/backend/routers/ready_to_show.py", "utf8");

const CROWN = { id: "c", name: "Crown 👑 Fashion", products_on_sale: 6, pictures_read: 34, pictures_total: 34,
  approved_at: "2026-10-28T13:39:35Z", payout_given: false };

test("the chip sits right after Live and says Ready to show", () => {
  const live = PAGE.indexOf('{ key: "live", label: "Live"');
  const ready = PAGE.indexOf('{ key: "ready", label: "Ready to show"');
  const hidden = PAGE.indexOf('{ key: "hidden", label: "Hidden from customers"');
  assert.ok(live > 0 && live < ready && ready < hidden);
  assert.match(PAGE, /type StoreView = "live" \| "ready" \| "hidden"/);
});

test("its number is the server's ready list, not a count of the shop table", () => {
  assert.match(PAGE, /v === "ready" \? \(readyData \? readyData\.ready\.length : "…"\)/);
});

test("the Ready view shows its own box instead of the filters and the table", () => {
  assert.match(PAGE, /\{view === "ready" && \(\s*<ReadyToShowSection/);
  // Mock 217 (30 Oct 2026): the "Hidden by Takal" list takes the table's place too.
  assert.equal((PAGE.match(/\{view !== "ready" && (?:!takalOpen && )?\(/g) || []).length, 2);
});

test("the list is read AFTER the shop list, once, so the page is never slower", () => {
  assert.match(PAGE, /if \(loading \|\| readyAsked\.current\) return;/);
  assert.match(API, /\/admin\/stores\/ready-to-show\$\{fresh \? "\?fresh=1" : ""\}/);
  assert.match(LIST, /@router\.get\("\/admin\/stores\/ready-to-show"/);
});

test("each shop: Open review, and Show to customers which asks first", () => {
  assert.match(PART, /data-show-one=\{s\.id\} onClick=\{\(\) => setAsk\(s\)\}/);
  assert.match(PART, /confirmLabel="Yes, show to customers"/);
  assert.match(PART, /href=\{`\/dashboard\/stores\/\$\{s\.id\}\/review`\}/);
});

test("only the Main Admin can press - the buttons are locked for anybody else", () => {
  assert.equal((PART.match(/disabled=\{!isMain \|\| busy !== null\}/g) || []).length, 2);
});

test("Show all goes through the SAME door, one shop at a time", () => {
  const all = PART.slice(PART.indexOf("const showAll"), PART.indexOf("return (", PART.indexOf("const showAll")));
  assert.match(all, /for \(const s of ready\)/);
  assert.match(all, /await apiClient\.setShownToCustomers\(s\.id, true\)/);
});

test("the ticks say what the server checked", () => {
  assert.deepEqual(readyTicks(CROWN as any), ["Checklist done", "6 products on sale",
    "34 of 34 pictures read - no phone number", "Nothing marked Needs fix"]);
  assert.equal(confirmTicks(CROWN as any)[1], "6 products on sale, every one with a picture");
  assert.deepEqual(unreadLine({ ...CROWN, pictures_read: 3, pictures_total: 12 } as any),
    { ticks: ["Checklist done", "6 products on sale"], left: "3 of 12 pictures read" });
  assert.equal(approvedDay("2026-10-28T20:30:00Z"), "approved 29 Oct", "Pakistan's day, not UTC's");
});

test("Show all names the shops that did not go live, and why", () => {
  assert.equal(showAllResult([{ name: "A", ok: true }, { name: "B", ok: true }]), "2 shops are live now.");
  assert.equal(showAllResult([{ name: "A", ok: true }, { name: "B", ok: false, why: "phone found" }]),
    "1 shop is live now. Not switched on: B (phone found)");
});

test("the vendor's words in the confirm box are the server's own words", () => {
  const start = liveMessageStart("Crown");
  assert.equal(start, 'Mubarak ho! Aap ki dukan "Crown" ab customers ko nazar aa rahi hai');
  assert.match(SERVER, /f'Mubarak ho! Aap ki dukan "\{name\}" ab customers ko nazar aa rahi hai aur '/);
});
