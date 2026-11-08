// MOCK 223 - REVIEW AND WHATSAPP FOR LIVE SHOPS (approved by Sana, 1 Nov 2026:
// "Approved Please Build now"). The rules are run for real (src/lib/live-tell.ts);
// the screens are checked for where the buttons are and who sees them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tellItems, liveMessage, type LiveCheck } from "../src/lib/live-tell.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = read("src/app/dashboard/stores/page.tsx");
const BAR = read("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const API = read("src/lib/api-stores.ts");
const SERVER = read("../swat-delivery-app/backend/routers/vendor_intake.py");

const step = (key: string, done: boolean, label = key, note = "") => ({ key, label, done, note });
const ALL = ["details", "place", "hours", "logo", "products", "photos", "payout"];
const check = (missing: string[], extra: Partial<LiveCheck> = {}): LiveCheck => ({
  id: "s1", what_is_left: missing, products: 9, products_without_photo: 0,
  steps: ALL.map((k) => step(k, !missing.includes(k), k, k === "place" ? "No map pin - customers nearby will not see this shop at all" : "")),
  ...extra,
});

// ── 1. what is still to tell ──
test("payout details are told on their own list, not in Something to tell (store audit M9)", () => {
  assert.deepEqual(tellItems({}, check(["payout"])), []);
  const t = tellItems({}, check(["payout"]), { withPayout: true });
  assert.deepEqual(t, [{ key: "payout", words: "Where Takal sends your money" }]);
});

test("photos are counted, as the real Helath Mart case reads", () => {
  const t = tellItems({}, check(["photos", "payout"], { products: 14150, products_without_photo: 14149 }));
  // Photos on at least 5 products (Sana, 8 Nov 2026): 14,150 products, ONE with a photo.
  assert.equal(t[0].words, "1 of 5 products have a photo");
});

test("nothing missing and nothing marked = nothing to tell", () => {
  assert.deepEqual(tellItems({}, check([])), []);
});

test("what Review marked Needs fix counts - until it is sent back", () => {
  assert.equal(tellItems({ review_to_fix: 2, review_state: "open" }, check([]))[0].words, "Review: 2 marked Needs fix");
  assert.deepEqual(tellItems({ review_to_fix: 2, review_state: "sent_back" }, check([])), []);
});

test("checks not read = no claim about them at all", () => {
  assert.deepEqual(tellItems({}, null), []);
});

// ── 2. the WhatsApp message ──
test("the message is Roman Urdu, to the owner by first name, for a LIVE shop", () => {
  const m = liveMessage("Imad Khan", "Graan Crockery House", check(["payout"]));
  assert.match(m, /^Assalam o Alaikum Imad,/);
  assert.match(m, /"Graan Crockery House" check ki hai/);
  assert.match(m, /yeh cheez theek kar dein/);
  assert.match(m, /1\. Aap ki raqam kahan bheji jaye - abhi tak nahi di gayi\./);
  assert.match(m, /isi message ka jawab de dein/);
  assert.doesNotMatch(m, /Send for review again/, "a live shop has no such button");
});

test("several things are numbered, and a missing pin says pin", () => {
  const m = liveMessage("", "Ali Store", check(["place", "logo", "payout"]));
  assert.match(m, /^Assalam o Alaikum,/);
  assert.match(m, /yeh 3 cheezen/);
  assert.match(m, /1\. Map ka pin - abhi nahi laga\.\n2\. Dukan ka logo - abhi nahi lagaya\.\n3\. Aap ki raqam/);
});

// ── 3. the Stores list ──
test("the server answers the live checks, and the panel asks that door", () => {
  assert.match(API, /\/admin\/vendor-intake\/live/);
  assert.match(SERVER, /@router\.get\("\/admin\/vendor-intake\/live"/);
});

test("a failed read of the live checks hides the lines, never the list", () => {
  assert.match(LIST, /apiClient\.getLiveChecklists\(\)[\s\S]{0,400}\.catch\(\(\) => setLiveChecks\(null\)\)/);
  assert.match(LIST, /deriveStatus\(r\) === "approved" && liveChecks \? tellItems\(r, liveChecks\[String\(r\.id\)\]\) : null/);
});

test("'Something to tell' sits right after Live; Ready to show still comes before Hidden", () => {
  const live = LIST.indexOf('{ key: "live", label: "Live"');
  const tell = LIST.indexOf('{ key: "tell", label: "Something to tell"');
  const ready = LIST.indexOf('{ key: "ready", label: "Ready to show"');
  assert.ok(live > 0 && live < tell && tell < ready);
  assert.match(LIST, /v === "tell" \? \(tellOf\(r\)\?\.length \|\| 0\) > 0/);
});

test("a live row: Review for the approver only, WA records the Roman Urdu words", () => {
  const block = LIST.slice(LIST.indexOf("MOCK 223: Review and WhatsApp for a LIVE shop"));
  assert.match(block, /deriveStatus\(restaurant\) === "approved" && \(\(\) => \{/);
  assert.match(block, /\{canAccess\("stores\.approve"\) && \(\s*<Link href=\{`\/dashboard\/stores\/\$\{restaurant\.id\}\/review`\} data-live-review/);
  assert.match(LIST, /recordWhatsappSent\(id, \{ kind: "what_is_left", lang: "roman", text \}\)/);
  assert.match(block, /onClick=\{\(\) => noteLiveWhatsapp\(restaurant, text\)\}/);
});

// ── 4. the shop's own page ──
test("a live shop's page gets Review and WA what to tell - its Approve checklist stays the waiting shops'", () => {
  assert.match(BAR, /\{status === "approved" && \(\(\) => \{/);
  assert.match(BAR, /data-live-review-link/);
  assert.match(BAR, /💬 WA what to tell/);
  assert.match(BAR, /const readsList = wantsList \|\| status === "approved";/);
  assert.match(BAR, /\{wantsList && \(\s*<span className="relative">\s*<button type="button" data-testid="approve-checklist"/);
});
