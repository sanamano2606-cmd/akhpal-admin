// MOCK 198, BOARD 3 - "NEEDS A CALL" IN THE ADMIN PANEL.
//
// Sana, 15 Oct 2026: "The Office Phone her" ... "Approved. please built
// exactly as mocks. double check everything went perfectly".
//
// A shop marked an item "Not available"; the customer did not answer in her
// app within 10 minutes. The order goes to Orders -> Needs a call: a red card
// with her number big and Call now, what is missing, and three answers after
// the call - Keep the rest / She will add items (10 more min) / Cancel whole
// order (no strike). Every step is in the order's history with times and the
// name of whoever pressed it. The office can also mark an item Not available
// from the order's own page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  areaOf, boldParts, callsLabel, clock, firstName, hhmm, isWaiting, itemChangeReady,
  missingChip, missingWords, officeMayMark, phoneForCall, secondsLeft, storyOf, telHref,
} from "../src/lib/item-change.ts";
import { NAVIGATION, sectionForPath, tabsFor } from "../src/lib/navigation.ts";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── The mock's own order (times in Pakistan: 10:19 is 05:19 UTC) ────────────
const NOW = new Date("2026-10-15T05:36:00Z");
const ROW = {
  order_id: "o1", order_no: 10861, status: "accepted",
  customer_name: "Ayesha K.", customer_phone: "03123454567", delivery_address: "House 4, Saidu Road, Mingora",
  store_name: "Tar Kora Mart", store_kind: "grocery", price_mode: "fixed",
  created_at: "2026-10-15T05:19:00Z", accepted_at: "2026-10-15T05:21:00Z", promo_code: "SWAT10",
  waiting_for_customer_until: "2026-10-15T05:34:00Z", minutes_waiting: 12,
  lines_now: [{ name: "Nestle Nido" }, { name: "Ajwa Dates" }, { name: "Olive oil" }],
  money: { total_before: 9645, total_now: 6045 },
  missing: [
    { name: "Nutella Chocolate Spread", was: 1, now: 0 },
    { name: "Ajwa Dates · 500 g", was: 2, now: 1 },
  ],
};
const ASK = {
  kind: "items_missing", made_at: "2026-10-15T05:24:00Z", made_by_role: "shop",
  total_before: 9645, total_after: 6045, discount_before: 1055, discount_after: 655,
  lines: ROW.missing,
};

// ── The rules ────────────────────────────────────────────────────────────────

test("nothing of this shows before the server has migration 135", () => {
  assert.equal(itemChangeReady({ status: "accepted" }), false);
  assert.equal(officeMayMark({ status: "accepted" }), false);
  assert.equal(itemChangeReady({ status: "accepted", waiting_for_customer_until: null }), true);
});

test("the office may mark an item while the order is in the store - again and again, never while she is asked", () => {
  const o = (status: string, w: string | null = null, asked: string | null = null) =>
    ({ status, waiting_for_customer_until: w, missing_asked_at: asked });
  for (const s of ["pending", "accepted", "preparing", "ready", "on_the_way_to_restaurant"]) {
    assert.equal(officeMayMark(o(s)), true, s);
  }
  for (const s of ["picked_up", "on_the_way", "delivered", "cancelled", "rejected"]) {
    assert.equal(officeMayMark(o(s)), false, s);
  }
  assert.equal(officeMayMark(o("accepted", "2026-10-15T05:34:00Z")), false, "she is being asked");
  assert.equal(isWaiting(o("accepted", "2026-10-15T05:34:00Z")), true);
  // Unlike the shop (once only), the office is where any later change goes.
  assert.equal(officeMayMark(o("accepted", null, "2026-10-15T05:24:00Z")), true);
});

test("the clock, the count, her number, her area", () => {
  assert.equal(secondsLeft({ waiting_for_customer_until: "2026-10-15T05:34:00Z" }, new Date("2026-10-15T05:25:19Z")), 521);
  assert.equal(secondsLeft({ waiting_for_customer_until: "2026-10-15T05:34:00Z" }, NOW), 0);
  assert.equal(clock(521), "8:41");
  assert.equal(callsLabel(1), "1 call");
  assert.equal(callsLabel(3), "3 calls");
  assert.equal(phoneForCall("03123454567"), "0312 345 4567");
  assert.equal(phoneForCall("+92 312 3454567"), "0312 345 4567");
  assert.equal(phoneForCall("042-111-222"), "042-111-222", "anything else as it came");
  assert.equal(telHref("0312 345 4567"), "tel:03123454567");
  assert.equal(telHref(""), "");
  assert.equal(firstName("Ayesha K."), "Ayesha");
  assert.equal(areaOf("House 4, Saidu Road, Mingora"), "Mingora");
});

test("what is missing: the chip and the words", () => {
  assert.deepEqual(missingChip({ was: 1, now: 0 }), { text: "Not available", tone: "red" });
  assert.deepEqual(missingChip({ was: 2, now: 1 }), { text: "1 of 2", tone: "orange" });
  assert.equal(missingWords(ROW.missing), "Nutella Chocolate Spread not available, Ajwa Dates · 500 g 1 of 2");
});

test("times are Pakistan's, whatever the computer is set to", () => {
  assert.equal(hhmm("2026-10-15T05:24:00Z"), "10:24");
  assert.equal(hhmm(""), "");
});

test("THE HISTORY of the mock: placed, accepted, missing, told, no answer -> Needs a call", () => {
  const lines = storyOf(ROW, [ASK], NOW);
  assert.deepEqual(lines.map((l) => [hhmm(l.at), l.dot]), [
    ["10:19", "grey"], ["10:21", "green"], ["10:24", "red"], ["10:24", "yellow"], ["10:34", "red"],
  ]);
  const words = lines.map((l) => boldParts(l.text).map((p) => p.text).join(""));
  assert.equal(words[0], "Placed by Ayesha · 4 items · Rs 9,645 (promo SWAT10)");
  assert.equal(words[1], "Accepted by Tar Kora Mart");
  assert.equal(words[2], "Tar Kora Mart: Nutella Chocolate Spread not available, Ajwa Dates · 500 g 1 of 2. " +
    "Total Rs 9,645 → Rs 6,045, promo Rs 1,055 → Rs 655. Nutella Chocolate Spread set Out of stock.");
  assert.equal(words[3], "Ayesha told in the app (push message) · asked to choose");
  assert.equal(words[4], "No answer in 10 min → moved to Needs a call");
});

test("the history goes on after the call, with the office person's name", () => {
  const more = { kind: "more_time", made_at: "2026-10-15T05:37:00Z", made_by_role: "office", made_by_name: "Sana" };
  const keep = { kind: "answer", answer: "keep", made_at: "2026-10-15T05:41:00Z", made_by_role: "customer" };
  const words = storyOf(ROW, [ASK, more, keep], new Date("2026-10-15T06:00:00Z"))
    .map((l) => boldParts(l.text).map((p) => p.text).join(""));
  assert.ok(words.includes("Takal office (Sana): called — she will add items · 10 more min"), words.join("\n"));
  assert.ok(words.includes("Ayesha: she keeps the rest"));
  // She answered 4 minutes after the call - so no second "Needs a call".
  assert.equal(words.filter((w) => w.startsWith("No answer")).length, 1);
  const cancel = { kind: "answer", answer: "cancel", made_at: "2026-10-15T05:38:00Z", made_by_role: "office", made_by_name: "Sana" };
  const w2 = storyOf(ROW, [ASK, cancel], NOW).map((l) => boldParts(l.text).map((p) => p.text).join(""));
  assert.ok(w2.includes("Takal office (Sana): cancelled the whole order — no strike"));
});

test("an answer inside the 10 minutes never says 'No answer'", () => {
  const keep = { kind: "answer", answer: "keep", made_at: "2026-10-15T05:30:00Z", made_by_role: "customer" };
  const words = storyOf(ROW, [ASK, keep], NOW).map((l) => boldParts(l.text).map((p) => p.text).join(""));
  assert.equal(words.filter((w) => w.startsWith("No answer")).length, 0);
});

// ── Where it lives ───────────────────────────────────────────────────────────

test("Orders has a 'Needs a call' tab, with the All Orders permission", () => {
  const tab = tabsFor("/dashboard/orders").find((t) => t.href === "/dashboard/orders/needs-call");
  assert.ok(tab, "the tab is there");
  assert.equal(tab!.label, "Needs a call");
  assert.equal(tab!.section, "orders.all");
  assert.equal(sectionForPath("/dashboard/orders/needs-call"), "orders.all");
  const orders = NAVIGATION.find((n) => n.href === "/dashboard/orders")!;
  assert.equal(orders.tabs![1].href, "/dashboard/orders/needs-call", "right after All Orders");
});

test("the red count: on the tab and beside Orders in the menu, asked once a minute by one counter", () => {
  const layout = src("src/app/dashboard/orders/layout.tsx");
  assert.match(layout, /useNeedsCallCount\(\)/);
  assert.match(layout, /\{ \.\.\.t, badge: calls \}/);
  const tabs = src("src/components/ui/DomainTabs.tsx");
  assert.match(tabs, /☎ \$\{t\.label\} · \$\{t\.badge\}/);
  assert.match(tabs, /!text-takal-red/);
  // Found in the pictures: the tabs were copied once when the page opened, so
  // the count that arrived a second later never showed. Only the permission
  // check is kept; the tabs drawn are always the ones passed in now.
  assert.doesNotMatch(tabs, /useState<DomainTab\[\]>\(tabs\)/, "no frozen copy of the tabs");
  assert.match(tabs, /const visible = allowed \? tabs\.filter\(\(t\) => allowed\.has\(t\.href\)\) : tabs;/);
  const menu = src("src/app/dashboard/layout.tsx");
  assert.match(menu, /item\.href === "\/dashboard\/orders" && needsCall > 0/);
  // The words people SEE: "1 call" when the menu is open, "1" when it is narrow.
  assert.match(menu, /\{sidebarOpen \? callsLabel\(needsCall\) : needsCall\}/);
  assert.match(menu, /bg-takal-red/);
  const hook = src("src/lib/hooks/useNeedsCallCount.ts");
  assert.match(hook, /mayAccess\("orders\.all", getMyPerms\(\)\)/, "only somebody allowed asks");
  assert.match(hook, /setInterval\(ask, 60 \* 1000\)/);
});

test("the page: honest about a failed read, and about a database without migration 135", () => {
  const page = src("src/app/dashboard/orders/needs-call/page.tsx");
  assert.match(page, /if \(error\) return <ErrorState/);
  assert.match(page, /readFailure\(err/);
  assert.match(page, /ready \? |!ready \?/);
  assert.match(page, /Nobody needs a call right now/);
  assert.match(page, /setInterval\(load, 30 \* 1000\)/);
});

test("the red card: her number big, Call now, what is missing, the three answers - cancel asks first", () => {
  const parts = src("src/app/dashboard/orders/parts-item-change.tsx");
  for (const w of ["The customer did not answer about a missing item", "Call her", "Call now", "What is missing",
    "Total now", "After the call — what did she say?", "Keep the rest · ", "She will add items · ",
    "Cancel whole order · no strike", "Your call and her answer are written here"]) {
    assert.ok(parts.includes(w), w);
  }
  assert.match(parts, /send\("keep"\)/);
  assert.match(parts, /send\("more_time"\)/);
  assert.match(parts, /onConfirm=\{\(\) => send\("cancel"\)\}/, "cancel only through the confirmation");
  // The red button only opens the question; "cancel" is sent from ONE place.
  assert.match(parts, /onClick=\{\(\) => setAskCancel\(true\)\}[^>]*data-testid="answer-cancel"/s);
  assert.equal(parts.split('send("cancel")').length - 1, 1, "cancel is sent only from the confirmation");
  assert.match(parts, /href=\{tel\}/);
});

test("the order's own page: the box, the office's 'Mark an item not available', the figures shown first", () => {
  const panel = src("src/app/dashboard/orders/parts-order-panel.tsx");
  assert.match(panel, /import \{ ItemChangeBox \} from "\.\/parts-item-change";/);
  assert.match(panel, /<ItemChangeBox\n\s+orderId=/, "the box itself, on the order page");
  const parts = src("src/app/dashboard/orders/parts-item-change.tsx");
  assert.match(parts, /officeMayMark\(order\)/);
  assert.match(parts, /markItemsMissing\(orderId, body, true\)/, "a dry run first - nothing saved");
  assert.match(parts, /markItemsMissing\(orderId, body\)\)/, "then saved");
  assert.match(parts, /She pays/);
  // Found in the pictures: the window had no product photos (board 1 has them).
  // Found in the pictures: the history's dots sat on top of the order window's
  // button bar. The list keeps its layers to itself.
  assert.match(parts, /<ol className="relative isolate mt-3">/);
  assert.match(parts, /<Thumb url=\{photos\[String\(it\.menu_item_id\)\]\} \/>/);
  assert.match(parts, /await apiClient\.getItemChange\(orderId\)\) as any;\n\s+const m: Record<string, string> = \{\};/);
  assert.match(parts, /The shop gets/);
});

test("the server doors the panel uses", () => {
  const api = src("src/lib/api-orders.ts");
  assert.match(api, /"\/admin\/orders\/needs-call"/);
  assert.match(api, /`\/admin\/orders\/\$\{orderId\}\/item-change\/answer`/);
  assert.match(api, /`\/orders\/\$\{orderId\}\/item-change`/);
  assert.match(api, /`\/orders\/\$\{orderId\}\/missing`/);
});
