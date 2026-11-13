// MOCK 237 PIECE 2 (Sana, 12 Nov 2026: "GO 237 piece 2"): the shop page's
// Messages tab - everything said to the shop in one list, newest first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTERS, byDay, dayLabel, filterCount, inFilter, repeatLine, shortText, type ShopEvent }
  from "../src/lib/shop-messages.ts";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");
const TAB = code("src/app/dashboard/stores/[id]/parts-messages.tsx");
const PAGE = code("src/app/dashboard/stores/[id]/page.tsx");
const API = code("src/lib/api-stores.ts");
const SERVER = code("../swat-delivery-app/backend/routers/shop_timeline.py");

const ev = (kind: ShopEvent["kind"], at: string, extra: Partial<ShopEvent> = {}): ShopEvent =>
  ({ id: at, kind, label: "", text: "x", by: "Sana Ullah", at, times: [at], repeat: 1, pressed_twice: false, ...extra });

const NOW = new Date("2026-11-12T10:00:00Z");
const LIST = [
  ev("called", "2026-11-12T06:40:00Z"), ev("vendor", "2026-11-11T04:12:00Z"),
  ev("assistant", "2026-11-09T06:30:00Z", { repeat: 5, times: ["2026-11-09T06:30:00Z", "2026-11-08T06:14:00Z",
    "2026-11-07T05:58:00Z", "2026-11-06T05:03:00Z", "2026-11-05T04:57:00Z"] }),
  ev("sent_back", "2026-11-05T00:06:57Z", { pressed_twice: true }), ev("blur", "2026-10-31T04:14:00Z"),
  ev("note", "2026-11-09T05:00:00Z"),
];

test("the filters, in the mock's order, and what each holds", () => {
  assert.deepEqual(FILTERS.map((f) => f.label), ["All", "Assistant", "Sent back", "WhatsApp", "Office notes", "Vendor"]);
  assert.equal(filterCount(LIST, "all"), 6);
  assert.equal(filterCount(LIST, "assistant"), 2, "its messages and the pictures it blurred");
  assert.equal(filterCount(LIST, "notes"), 2, "notes and calls");
  assert.ok(inFilter(LIST[1], "vendor"));
  assert.equal(filterCount(LIST, "whatsapp"), 0);
});

test("days are Swat's: today, yesterday, then the date", () => {
  assert.equal(dayLabel("2026-11-12T06:40:00Z", NOW), "TODAY · 12 NOV");
  assert.equal(dayLabel("2026-11-11T04:12:00Z", NOW), "YESTERDAY · 11 NOV");
  assert.equal(dayLabel("2026-11-11T20:00:00Z", NOW), "TODAY · 12 NOV", "1 am on the 12th in Swat");
  assert.deepEqual(byDay(LIST.slice(0, 3), NOW).map(([d, l]) => [d, l.length]),
    [["TODAY · 12 NOV", 1], ["YESTERDAY · 11 NOV", 1], ["9 NOV", 1]]);
});

test("the same reminder on five days is one line that says so", () => {
  assert.equal(repeatLine(LIST[2]), "same message 5 times · 5, 6, 7, 8, 9 Nov");
  assert.equal(repeatLine(LIST[0]), "");
  assert.equal(repeatLine(ev("assistant", "2026-11-01T05:00:00Z", { repeat: 2,
    times: ["2026-11-01T05:00:00Z", "2026-10-31T05:00:00Z"] })), "same message 2 times · 31 Oct, 1 Nov");
});

test("long messages open with Show all", () => {
  const long = "Assalam o Alaikum! ".repeat(20);
  const s = shortText(long);
  assert.ok(s.cut && s.text.endsWith("…") && s.text.length <= 221);
  assert.deepEqual(shortText("short"), { text: "short", cut: false });
  assert.match(TAB, /Show all ▼/);
});

test("the tab asks the server's own door, and notes use the notes door", () => {
  assert.match(SERVER, /@router\.get\("\/admin\/restaurants\/\{restaurant_id\}\/messages"/);
  assert.match(API, /`\/admin\/restaurants\/\$\{restaurantId\}\/messages`/);
  assert.match(TAB, /apiClient\.addShopNote\(restaurantId, text\)/);
  assert.match(TAB, /Pressed twice within 2 minutes - kept once here\./);
});

test("it is a tab on the shop page, beside Staff", () => {
  assert.match(PAGE, /\{ id: "messages", label: "Messages", Icon: MessageSquare \}/);
  assert.match(PAGE, /\{tab === "messages" && <ShopMessagesTab restaurantId=\{id\} \/>\}/);
  assert.match(PAGE, /"staff" \| "messages"/);
});
