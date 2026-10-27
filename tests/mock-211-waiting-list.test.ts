// ─────────────────────────────────────────────────────────────────────────────
// MOCK 211 - THE COMPACT WAITING LIST (approved by Sana 27 October 2026:
// "Approved ... the same compact one-line rows also be used on the Live,
// Hidden, Suspended and Rejected tabs ... Yes if beneficial").
//
// The rules: queues with counts, Newest first, groups Fixed / Today / Earlier
// / Sent back, Pakistan time, the Last message (send-back or WhatsApp), one
// line per shop with the details a press away - and the server's door for
// remembering a WhatsApp press.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUEUES, agoText, inQueue, joinedToday, lastMessage, missingWords, pktDay, queueOf, waitingGroups, whenText,
} from "../src/lib/waiting-list.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const LIST = code("src/app/dashboard/stores/page.tsx");
const API = code("src/lib/api-stores.ts");
const NAV = code("src/lib/navigation.ts");
const GUARD = code("../swat-delivery-app/backend/app_guard.py");
const SERVER = code("../swat-delivery-app/backend/routers/shop_review.py");
const LIST_SERVER = code("../swat-delivery-app/backend/routers/restaurants_admin.py");

// 9:13 pm in Swat on Tue 27 Oct 2026 = 4:13 pm UTC.
const NOW = new Date("2026-10-27T16:13:00Z");

test("the five queues, in Mock 211's order", () => {
  assert.deepEqual(QUEUES.map((q) => q.key), ["fixed", "new", "reviewing", "sent_back", "all"]);
  assert.equal(QUEUES[0].label, "Fixed – check again");
});

test("each waiting shop is in exactly one queue", () => {
  assert.equal(queueOf({ review_state: "fixed" }), "fixed");
  assert.equal(queueOf({ review_state: "sent_back" }), "sent_back");
  assert.equal(queueOf({ review_state: "reviewing", review_checked: 3 }), "reviewing");
  // A review row with nothing ticked yet is still New.
  assert.equal(queueOf({ review_state: "reviewing", review_checked: 0 }), "new");
  assert.equal(queueOf({}), "new");
  // A finished review on a shop waiting again is New, never "sent back".
  assert.equal(queueOf({ review_state: "closed" }), "new");
  assert.ok(inQueue({ review_state: "fixed" }, "all"));
  assert.ok(!inQueue({ review_state: "fixed" }, "new"));
});

test("Pakistan days and times, whatever the computer's clock says", () => {
  // 7:30 pm UTC on the 27th is already 12:30 am on the 28th in Swat.
  assert.equal(pktDay("2026-10-27T19:30:00Z"), "2026-10-28");
  assert.equal(pktDay("2026-10-27T18:59:00Z"), "2026-10-27");
  assert.equal(pktDay("nonsense"), "");
  assert.equal(whenText("2026-10-27T15:04:19Z", NOW), "8:04 pm");
  assert.equal(whenText("2026-10-24T15:20:27Z", NOW), "Sat 24 Oct, 8:20 pm");
  assert.equal(whenText(null, NOW), "");
});

test("how long ago, in words a person reads at a glance", () => {
  assert.equal(agoText("2026-10-27T16:12:40Z", NOW), "just now");
  assert.equal(agoText("2026-10-27T16:02:00Z", NOW), "11 min ago");
  assert.equal(agoText("2026-10-27T15:04:00Z", NOW), "1 h ago");
  assert.equal(agoText("2026-10-24T15:20:00Z", NOW), "3 d ago");
  assert.equal(agoText("2026-10-27T17:00:00Z", NOW), "just now", "a clock a little ahead is never 'in the future'");
  assert.equal(agoText(undefined, NOW), "");
});

test("the groups: Fixed, Today, Earlier, Sent back - the given order kept inside", () => {
  const rows = [
    { id: "t1", created_at: "2026-10-27T15:04:00Z" },
    { id: "sb", created_at: "2026-10-24T11:00:00Z", review_state: "sent_back" },
    { id: "t2", created_at: "2026-10-27T10:00:00Z", review_state: "reviewing", review_checked: 2 },
    { id: "e1", created_at: "2026-10-26T18:59:00Z" },          // 11:59 pm on the 26th in Swat
    { id: "fx", created_at: "2026-10-20T10:00:00Z", review_state: "fixed" },
    { id: "t3", created_at: "2026-10-26T19:01:00Z" },          // 12:01 am on the 27th in Swat - TODAY
  ];
  const g = waitingGroups(rows, NOW);
  assert.deepEqual(g.map((x) => x.key), ["fixed", "today", "earlier", "sent_back"]);
  assert.deepEqual(g.map((x) => x.rows.map((r) => r.id)), [["fx"], ["t1", "t2", "t3"], ["e1"], ["sb"]]);
  assert.equal(g[1].label, "TODAY · TUE 27 OCT (3)");
  assert.equal(g[0].label, "✓ FIXED BY THE VENDOR — CHECK AGAIN (1)");
  // An empty group is not drawn at all.
  assert.deepEqual(waitingGroups([{ id: "x", created_at: "2026-10-27T15:00:00Z" }], NOW).map((x) => x.key), ["today"]);
  assert.equal(joinedToday(rows, NOW), 3);
});

test("the last message: the later of the send-back and the last WhatsApp", () => {
  assert.equal(lastMessage({}), null);
  assert.deepEqual(lastMessage({ sent_back_at: "2026-10-27T09:59:00Z" }), { kind: "sent_back", at: "2026-10-27T09:59:00Z" });
  assert.deepEqual(lastMessage({ last_whatsapp_at: "2026-10-26T06:02:00Z" }), { kind: "whatsapp", at: "2026-10-26T06:02:00Z" });
  assert.equal(lastMessage({ sent_back_at: "2026-10-27T09:59:00Z", last_whatsapp_at: "2026-10-27T11:00:00Z" })?.kind, "whatsapp");
  assert.equal(lastMessage({ sent_back_at: "2026-10-27T12:00:00Z", last_whatsapp_at: "2026-10-27T11:00:00Z" })?.kind, "sent_back");
  assert.equal(lastMessage({ sent_back_at: "not a date" }), null);
});

test("the checklist in one line says only what is missing, in short words", () => {
  const steps = [
    { key: "details", label: "Shop details and phone", done: true, note: "" },
    { key: "place", label: "Address and map pin", done: true, note: "" },
    { key: "hours", label: "Opening hours", done: true, note: "" },
    { key: "logo", label: "Shop logo", done: false, note: "No picture on the shop" },
    { key: "products", label: "At least 5 products", done: false, note: "2 of 5" },
    { key: "photos", label: "A photo on every product", done: false, note: "1 of 2 have none" },
    { key: "payout", label: "Where Takal sends the money", done: false, note: "Not given yet" },
  ];
  assert.deepEqual(missingWords(steps), ["Logo", "Products 2/5", "Photos", "Payout"]);
  assert.deepEqual(missingWords(steps.map((s) => ({ ...s, done: true }))), []);
  // A step the panel has no short word for keeps the server's own label.
  assert.deepEqual(missingWords([{ key: "new_step", label: "Something new", done: false }]), ["Something new"]);
});

// ── the page ────────────────────────────────────────────────────────────────
test("the Waiting list has its own six columns, and the others keep theirs", () => {
  for (const h of ["Shop · type · owner", "Joined", "Where it is", "Checklist", "Last message", "Actions"]) {
    assert.ok(LIST.includes(`>${h}</th>`), h);
  }
  assert.match(LIST, /\{!waitingView && \(\s*<tr className="border-b border-takal-line bg-takal-page">/);
  assert.match(LIST, /\{waitingView && waitingHead\}/);
  // Live, Hidden, Suspended and Rejected still have Products, Open now,
  // Commission and Delivery fee - edited right on the row as before.
  assert.ok(LIST.includes(">Products</th>") && LIST.includes(">Commission</th>") && LIST.includes(">Delivery fee</th>"));
});

test("the queues filter the list and count every waiting shop", () => {
  assert.match(LIST, /const matchesQueue = view !== "pending" \|\| inQueue\(r, queue\);/);
  assert.match(LIST, /return matchesSearch && matchesStatus && matchesType && matchesReady && matchesQueue;/);
  assert.match(LIST, /const queueCount = \(q: Queue\) => waitingAll\.filter\(\(r\) => inQueue\(r, q\)\)\.length;/);
  assert.match(LIST, /onClick=\{\(\) => \{ setQueue\(q\.key\); setOpenRow\(null\); \}\}/);
  assert.match(LIST, /data-ready-only/);
  assert.match(LIST, /setReadyFilter\(readyFilter === "ready" \? "all" : "ready"\)/);
});

test("Newest first on Waiting unless a person chose an order", () => {
  assert.match(LIST, /const sortByShown: StoreSort = view === "pending" && !sortPicked \? "newest" : sortBy;/);
  assert.match(LIST, /value=\{sortByShown\}/, "the box shows the order the list is really in");
  assert.match(LIST, /setSortPicked\(!!params\.get\("sort"\)\);/);
  assert.match(LIST, /setSortBy\(next\);\s*setSortPicked\(true\);/);
});

test("the Waiting rows are drawn in their groups", () => {
  assert.match(LIST, /const groups = waitingView \? waitingGroups\(sortedRestaurants, now\) : \[\];/);
  assert.match(LIST, /waitingView \? \(\s*groups\.map\(\(g\) => \(/);
  assert.match(LIST, /\{g\.rows\.map\(\(r\) => waitingRow\(r\)\)\}/);
});

test("everything the old waiting row had is still there", () => {
  const row = LIST.slice(LIST.indexOf("const waitingRow = "), LIST.indexOf("const getStatusBadge"));
  for (const must of [
    "● FIXED · check again", "Sent back · {restaurant.review_fixes || 0} to fix", "New · not reviewed yet",
    "const half = reviewingLine(restaurant);",
    "href={`/dashboard/stores/${restaurant.id}/review`}",          // Review / Check again / Open review
    "handleApprove(restaurant.id)", "setAnyway(restaurant)",         // Approve / Approve anyway
    'setPending({ store: restaurant, action: "reject" })',             // Reject
    "{c.done} of {c.total} done", '{s.done ? "✓" : "✕"} {s.label}',   // all seven checks
    "WhatsApp what is left", 'data-testid="approve-refused"',
    "LICENCE_FLAG.includes(restaurant.licence_state)", "!hasPin(restaurant)",
  ]) assert.ok(row.includes(must), must);
});

test("WhatsApp is remembered when it is pressed - and never claimed when it was not saved", () => {
  const row = LIST.slice(LIST.indexOf("const waitingRow = "), LIST.indexOf("const getStatusBadge"));
  // Both WhatsApp buttons - WA on the line, and "WhatsApp what is left" in the
  // row's details - tell the server they were pressed.
  assert.equal((row.match(/onClick=\{\(\) => noteWhatsapp\(restaurant\)\}/g) || []).length, 2);
  assert.ok(row.includes("💬 WhatsApp what is left"), "the details keep the full button");
  assert.match(LIST, /if \(res\?\.at\) setRestaurants/);
  assert.match(API, /async recordWhatsappSent\(restaurantId: string\)[\s\S]{0,200}\/admin\/restaurants\/\$\{restaurantId\}\/whatsapp-sent`, \{ method: "POST" \}/);
});

test("the panel and the server agree on the new door", () => {
  assert.ok(NAV.includes('["/admin/restaurants/*/whatsapp-sent", ["stores.all", "stores.approve"]]'));
  assert.ok(GUARD.includes('("/admin/restaurants/*/whatsapp-sent", ("stores.all", "stores.approve")),'));
  assert.match(SERVER, /@router\.post\("\/admin\/restaurants\/\{restaurant_id\}\/whatsapp-sent"/);
  assert.match(LIST_SERVER, /r\["last_whatsapp_at"\] = times\[str\(r\.get\("id"\)\)\]/);
});

test("the other lists are one line too", () => {
  // The status and the Show-to-customers switch side by side, not stacked.
  assert.match(LIST, /<div className="flex flex-wrap items-center gap-1\.5">\s*\{getStatusBadge\(deriveStatus\(restaurant\)\)\}/);
  // The rejection reason on one line, the whole of it on hover.
  assert.match(LIST, /className="line-clamp-1 max-w-xs text-xs leading-snug text-takal-red"\s*title=\{rejectedLine/);
  // No map pin and the licence beside the name, not on lines of their own.
  const shopCell = LIST.slice(LIST.indexOf("{row.inMall ? `↳ ${shortStoreName"), LIST.indexOf('<div className="mt-0.5 flex items-center gap-x-2'));
  assert.ok(shopCell.includes("!hasPin(restaurant)") && shopCell.includes("LICENCE_FLAG.includes"));
});
