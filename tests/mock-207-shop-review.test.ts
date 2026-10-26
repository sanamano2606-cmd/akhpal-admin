// ─────────────────────────────────────────────────────────────────────────────
// MOCK 207 - REVIEW A NEW SHOP, SEND IT BACK, SHOW IT BY HAND
// (approved by Sana 23 October 2026: "Approved all ... Built All at once")
//
// The server decides (backend/routers/shop_review.py, restaurants_admin.py
// show_to_customers, shop_visibility.py). These tests hold the panel to the
// same rules: the words the vendor reads, the list "Send back" sends, the
// WhatsApp link, the order of the waiting list, the five states, and that
// every screen wires the switch and the review the way the pictures show.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fixesFromMarks, fixesMissingAReason, whatsappLink, sortByReview, reviewStateOf,
  reasonsFor, REVIEW_SECTIONS, checkedCount, productKey, PICTURE_REASONS,
} from "../src/lib/shop-review.ts";
import { storeStatusOf } from "../src/lib/store-status.ts";
import { waitingOrder } from "../src/lib/vendor-queue.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const SERVER = code("../swat-delivery-app/backend/routers/shop_review.py");
const REVIEW = code("src/app/dashboard/stores/[id]/review/page.tsx");
const LIST = code("src/app/dashboard/stores/page.tsx");
const BAR = code("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const SWITCH = code("src/app/dashboard/stores/parts-customers-see.tsx");

// ── the five states ──────────────────────────────────────────────────────────
test("a shop approved but not switched on is HIDDEN, never waiting", () => {
  assert.equal(storeStatusOf({ is_approved: false, approved_at: "2026-10-23" }), "hidden");
  assert.equal(storeStatusOf({ is_approved: true, approved_at: "2026-10-23" }), "approved");
  assert.equal(storeStatusOf({ is_approved: false }), "pending");
  // A rejection always wins over an old approved_at.
  assert.equal(storeStatusOf({ is_approved: false, approved_at: "x", rejected_at: "y" }), "rejected");
  assert.equal(storeStatusOf({}, "hidden"), "hidden", "the server's answer is believed");
});

test("the list works the status out the same way", () => {
  assert.match(LIST, /: r\.approved_at \? "hidden"/);
  assert.match(LIST, /key: "hidden", label: "Hidden from customers"/);
});

// ── what Send back sends ─────────────────────────────────────────────────────
test("Send back sends every thing marked Needs fix, with the vendor's words", () => {
  const out = fixesFromMarks({
    logo: { state: "fix", reason: "Picture is blurry", words: "  Send the  sign board logo " },
    "shop.name": { state: "ok" },
    [productKey("p1")]: { state: "fix", words: "Photo is upside down" },
  });
  assert.deepEqual(out, [
    { key: "logo", reason: "Picture is blurry", words: "Send the sign board logo" },
    // Own words and no chip: the words ARE the reason.
    { key: "product:p1", reason: "Photo is upside down" },
  ]);
});

test("a Needs fix with nothing said holds Send back", () => {
  assert.deepEqual(fixesMissingAReason({ logo: { state: "fix" }, place: { state: "fix", reason: "Address is not complete" } }), ["logo"]);
  assert.match(REVIEW, /disabled=\{!waiting \|\| fixes\.length === 0 \|\| noReason\.length > 0 \|\| busy\}/);
});

test("every thing on the page is a thing the server lets you mark", () => {
  for (const k of REVIEW_SECTIONS.flatMap((s) => s.keys)) {
    assert.ok(SERVER.includes(`"${k}":`), `${k} is not in shop_review.FIXED_KEYS`);
  }
  assert.ok(SERVER.includes('_PRODUCT_KEY = re.compile(r"^product:'));
  assert.equal(productKey("abc"), "product:abc");
});

test("the ready reasons fit the server's limit and a picture gets picture words", () => {
  assert.deepEqual(reasonsFor("logo"), PICTURE_REASONS);
  for (const k of [...REVIEW_SECTIONS.flatMap((s) => s.keys), "product:x"]) {
    for (const r of reasonsFor(k)) assert.ok(r.length >= 3 && r.length <= 120, `${k}: ${r}`);
  }
  assert.ok(SERVER.includes("REASON_MIN, REASON_MAX = 3, 120"));
});

test("checked means OK or Needs fix", () => {
  assert.equal(checkedCount(["a", "b", "c"], { a: { state: "ok" }, b: { state: "fix" } }), 2);
});

// ── WhatsApp ────────────────────────────────────────────────────────────────
test("WhatsApp opens with the message already written", () => {
  assert.equal(whatsappLink("923001234567", "Assalam o Alaikum\n1. Logo - Blurry"),
    "https://wa.me/923001234567?text=Assalam%20o%20Alaikum%0A1.%20Logo%20-%20Blurry");
  // wa.me takes digits only - a "+", a space or a dash breaks the link.
  assert.equal(whatsappLink("+92 300-1234567", "x"), "https://wa.me/923001234567?text=x");
  assert.equal(whatsappLink(null, "x"), null);
  assert.equal(whatsappLink("", "x"), null);
});

test("the WhatsApp window is opened IN the click, so the browser does not block it", () => {
  const send = REVIEW.slice(REVIEW.indexOf("const sendBack = async"), REVIEW.indexOf("// ── Approve"));
  const open = send.indexOf('window.open("about:blank"');
  const ask = send.indexOf("await apiClient.sendShopBack");
  assert.ok(open > -1 && ask > -1 && open < ask, "window first, then the server");
  assert.match(send, /wa\.location\.href = link/);
  assert.match(send, /wa\.close\(\)/, "an empty window is closed if the send fails");
});

// ── the waiting list (Mock 207-1) ───────────────────────────────────────────
test("FIXED shops come first, then new, then sent back - chosen order kept inside", () => {
  const rows = [
    { id: "a", review_state: "sent_back" }, { id: "b" }, { id: "c", review_state: "fixed" },
    { id: "d", review_state: "reviewing" }, { id: "e", review_state: "fixed" },
  ];
  assert.deepEqual(sortByReview(rows).map((r) => r.id), ["c", "e", "b", "d", "a"]);
  assert.equal(reviewStateOf({ review_state: "closed" }), "new");
  // Combined with the 23 Oct audit's order (ready first, then waiting longest):
  // the review group decides first, the audit's order inside each group.
  assert.match(LIST, /view === "pending"\s*\?\s*sortByReview\(sortBy === DEFAULT_STORE_SORT \? waitingOrder\(sortedByChoice, checklists\) : sortedByChoice\)/);
});

test("FIXED first, and inside each group ready first then waiting longest", () => {
  const shops = [
    { id: "new-old", review_state: null }, { id: "fixed-notready", review_state: "fixed" },
    { id: "new-ready", review_state: null }, { id: "fixed-ready", review_state: "fixed" },
    { id: "sent-ready", review_state: "sent_back" },
  ];
  const checks = {
    "new-old": { ready: false, days_waiting: 9 }, "fixed-notready": { ready: false, days_waiting: 1 },
    "new-ready": { ready: true, days_waiting: 2 }, "fixed-ready": { ready: true, days_waiting: 1 },
    "sent-ready": { ready: true, days_waiting: 5 },
  };
  assert.deepEqual(sortByReview(waitingOrder(shops, checks)).map((r) => r.id),
    ["fixed-ready", "fixed-notready", "new-ready", "new-old", "sent-ready"]);
});

test("Approve all ready says the shops stay hidden, never that they open", () => {
  assert.ok(!LIST.includes("open to customers at once"));
  assert.ok(LIST.includes("stay HIDDEN from customers until the main admin switches on Show to customers"));
});

test("Approve all ready never approves a shop Takal sent back for changes", () => {
  const start = LIST.indexOf("const readyToApprove");
  const ready = LIST.slice(start, LIST.indexOf(");", start));
  assert.match(ready, /reviewStateOf\(r\) !== "sent_back"/);
});

test("each waiting shop has a Review button and its review word", () => {
  assert.match(LIST, /href=\{`\/dashboard\/stores\/\$\{restaurant\.id\}\/review`\}/);
  assert.ok(LIST.includes("● FIXED · check again"));
  assert.ok(LIST.includes("New · not reviewed yet"));
  assert.match(LIST, /Sent back · \{restaurant\.review_fixes \|\| 0\} to fix/);
  assert.ok(LIST.includes("data-fixed-shops"), "the banner when a vendor sent a shop back fixed");
});

// ── Show to customers (Mock 207-6) ──────────────────────────────────────────
test("the switch is locked for everybody but the main admin", () => {
  assert.match(SWITCH, /disabled=\{!isMain \|\| busy\}/);
  assert.ok(SWITCH.includes("Locked: only the main admin can change this."));
  assert.match(SWITCH, /apiClient\.setShownToCustomers\(String\(shop\.id\), ask === "on"\)/);
  assert.ok(SWITCH.includes('confirmLabel="Show to customers"'));
  assert.ok(SWITCH.includes('confirmLabel="Hide from customers"'));
});

test("the switch is on the list AND on the store page, for approved shops only", () => {
  assert.match(LIST, /deriveStatus\(restaurant\) === "approved" \|\| deriveStatus\(restaurant\) === "hidden"\) && \(\s*<span className="inline-flex items-center gap-1\.5">\s*<CustomersSeeSwitch/);
  assert.match(BAR, /\(status === "approved" \|\| status === "hidden"\) && \(\s*<span/);
  assert.match(BAR, /<CustomersSeeSwitch shop=/);
  assert.ok(BAR.includes("✓ Approved · Hidden from customers"));
});

test("approving says the shop stays hidden - everywhere it can be pressed", () => {
  for (const [name, src] of [["list", LIST], ["store page", BAR], ["review page", REVIEW]] as const) {
    assert.ok(/hidden from customers/i.test(src), `${name} does not say it stays hidden`);
    assert.ok(!src.includes("Customers will see this shop straight away"), `${name} still promises it is live`);
  }
  assert.ok(REVIEW.includes("After approving, the shop stays HIDDEN from customers."));
});

// ── the review page ─────────────────────────────────────────────────────────
test("Approve opens only when nothing is marked Needs fix", () => {
  // ...and, for a pharmacy, only once its licence is marked OK (Mock 208-4).
  assert.match(REVIEW, /data-approve disabled=\{!waiting \|\| fixes\.length > 0 \|\| licenceLocked \|\| busy\}/);
});

test("the ticks are saved as you go, and only for a waiting shop", () => {
  assert.match(REVIEW, /apiClient\.saveShopReviewMarks\(id, marks\)/);
  assert.match(REVIEW, /if \(!dirty\.current \|\| !waiting\) return;/);
});

test("the reason box is drawn by components that keep their place", () => {
  // A component defined inside the page is a NEW kind of thing on every draw,
  // so React would rebuild the box being typed in. These must stay outside.
  const page = REVIEW.indexOf("export default function ShopReviewPage");
  for (const fn of ["function ReasonBox(", "function ItemRow(", "function Section("]) {
    const at = REVIEW.indexOf(fn);
    assert.ok(at > -1 && at < page, `${fn} must be outside the page`);
  }
  assert.doesNotMatch(REVIEW, /<Row /);
  assert.doesNotMatch(REVIEW, /<FixList/);
});

test("the panel asks the server's own addresses", () => {
  const api = code("src/lib/api-stores.ts");
  assert.ok(api.includes("`/admin/restaurants/${restaurantId}/review?page=${page}`"));
  assert.ok(api.includes("`/admin/restaurants/${restaurantId}/review-marks`"));
  assert.ok(api.includes("`/admin/restaurants/${restaurantId}/send-back`"));
  assert.ok(api.includes("`/admin/restaurants/${restaurantId}/customers-see`"));
  for (const door of ['"/admin/restaurants/{restaurant_id}/review"', '"/admin/restaurants/{restaurant_id}/review-marks"',
                      '"/admin/restaurants/{restaurant_id}/send-back"']) {
    assert.ok(SERVER.includes(door), `the server has no ${door}`);
  }
  const ra = code("../swat-delivery-app/backend/routers/restaurants_admin.py");
  assert.ok(ra.includes('"/admin/restaurants/{restaurant_id}/customers-see"'));
});

test("the menu knows the new doors exactly as the server does", () => {
  const nav = code("src/lib/navigation.ts");
  assert.ok(nav.includes('["/admin/restaurants/*/customers-see", "__super__"]'));
  for (const d of ["review-marks", "review", "send-back"]) {
    assert.ok(nav.includes(`["/admin/restaurants/*/${d}", "stores.approve"]`), d);
  }
});

// 26 Oct 2026: readyToApprove sat ABOVE deriveStatus. It is worked out while
// the page draws, so the first waiting shop crashed the whole Stores page for
// everyone ("Cannot access 'tr' before initialization"). Types, build and every
// text check passed it - only opening the page showed it.
test("Approve all ready is worked out only after deriveStatus exists", () => {
  const helper = LIST.indexOf("const deriveStatus = ");
  const ready = LIST.indexOf("const readyToApprove = ");
  assert.ok(helper > 0 && ready > 0, "both are still on the page");
  assert.ok(ready > helper, "readyToApprove must come AFTER deriveStatus");
});
