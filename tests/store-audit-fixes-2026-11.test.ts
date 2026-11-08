// STORE AUDIT 5 NOV 2026 - the panel fixes that needed no mock (Sana, 8 Nov
// 2026: "Fix All at once that you can Fix Without Mock").
// Report: docs/Audit/AUDIT-REPORT-STORE-2026-11-05.md.
//
//   H1  the Live list names a live pharmacy with no licence
//   H2  ... and a shop whose owner closed his account - never in the
//       vendor's WhatsApp (nobody is there to read it)
//   M8  a hidden shop's row says WHY it is hidden
//   M9  payout details have their own list, out of "Something to tell"
//   M10 the Review page of an approved / live shop says where it really is
//   M12 a message the Takal Assistant sent says so
//   L9  product counts carry a thousands comma
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tellItems, liveMessage, payoutMissing, hasVendorLines, type LiveCheck } from "../src/lib/live-tell.ts";
import { messageLabel, type ShopMessage } from "../src/lib/shop-review.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = read("src/app/dashboard/stores/page.tsx");
const REVIEW = read("src/app/dashboard/stores/[id]/review/page.tsx");
const CHECKS = read("src/app/dashboard/stores/[id]/review/parts-checks.tsx");
const API = read("src/lib/api-stores.ts");

const step = (key: string, done: boolean, note = "") => ({ key, label: key, done, note });
const check = (steps: ReturnType<typeof step>[]): LiveCheck => ({
  id: "s1", steps, what_is_left: steps.filter((s) => !s.done).map((s) => s.label),
  products: 9, products_without_photo: 0,
});

// ── H1 / H2 ──
test("H1: a live pharmacy with no licence is on the list, in its own words", () => {
  assert.deepEqual(tellItems({}, check([step("licence", false, "missing")])),
    [{ key: "licence", words: "Licence missing" }]);
  assert.equal(tellItems({}, check([step("licence", false, "expired")]))[0].words, "Licence expired");
  assert.equal(tellItems({}, check([step("licence", false, "waiting")]))[0].words, "Licence not checked yet");
  assert.deepEqual(tellItems({}, check([step("licence", true, "ok")])), []);
});

test("H1: the WhatsApp asks for the licence on WhatsApp - there is no box for it in the app (C2)", () => {
  const msg = liveMessage("Zeeshan Ahmad", "Helath Mart Pharmacy", check([step("licence", false, "missing")]));
  assert.match(msg, /Pharmacy ka licence/);
  assert.match(msg, /WhatsApp par bhejein/);
  assert.doesNotMatch(msg, /app mein daalein/);
});

test("H2: an owner who closed his account is listed for the office, never written to", () => {
  const c = check([step("owner", false)]);
  assert.deepEqual(tellItems({}, c), [{ key: "owner", words: "Owner closed his account" }]);
  assert.equal(hasVendorLines(c), false, "no WhatsApp button for nobody");
  const both = check([step("owner", false), step("logo", false)]);
  assert.equal(hasVendorLines(both), true);
  assert.doesNotMatch(liveMessage("x", "Swat Cap House", both), /owner/i);
});

// ── M9 ──
test("M9: payout is its own list; a check not read yet claims nothing", () => {
  assert.equal(payoutMissing(null), null);
  assert.equal(payoutMissing(check([step("payout", false)])), true);
  assert.equal(payoutMissing(check([step("payout", true)])), false);
  assert.deepEqual(tellItems({}, check([step("payout", false)])), [], "not in Something to tell");
  assert.match(LIST, /\{ key: "payout", label: "No payout details"/);
  assert.match(LIST, /v === "payout" \? deriveStatus\(r\) === "approved" && payoutMissing\(/);
  assert.match(LIST, /data-no-payout/);
});

// ── M8 ──
test("M8: a hidden row shows the server's reasons, only for a hidden shop", () => {
  assert.match(API, /left\?: Record<string, string\[\]>;/);
  assert.match(LIST, /deriveStatus\(restaurant\) === "hidden" && \(\(\) => \{\s*const left = readyData\?\.left\?\.\[String\(restaurant\.id\)\];/);
  assert.match(LIST, /data-hidden-left/);
  assert.match(LIST, /To go live: \{left\.join\(" · "\)\}/);
});

// ── M10 ──
test("M10: Approve and Reject are drawn for a waiting shop only", () => {
  assert.match(REVIEW, /\{waiting && \(\s*<button type="button" data-approve disabled=\{busy\}/);
  assert.match(REVIEW, /\{waiting && \(\s*<button type="button" disabled=\{busy\} onClick=\{\(\) => setAsk\("reject"\)\}/);
  assert.doesNotMatch(REVIEW, /disabled=\{!waiting \|\| busy\}/);
});

test("M10: the way back and the send-back box name the list the shop is really in", () => {
  assert.match(REVIEW, /status === "hidden" \? "Hidden from customers" : status === "approved" \? "Live"/);
  assert.match(REVIEW, /The shop stays <b>approved and hidden<\/b>/);
  assert.match(REVIEW, /The shop stays <b>live<\/b>/);
});

// ── M12 ──
const msg = (o: Partial<ShopMessage>): ShopMessage =>
  ({ id: "1", kind: "what_is_left", text: "hello", at: "2026-11-05T10:00:00Z", by_name: "Sana Ullah", ...o });

test("M12: the Assistant's app message is labelled as its own", () => {
  const a = messageLabel(msg({ by_assistant: true, text: "[Takal Assistant] Assalam o Alaikum!\nline 2" }));
  assert.deepEqual(a, { kind: "📲 App message", who: "Takal Assistant", text: "Assalam o Alaikum!\nline 2" });
  // An older server sends no flag - the mark at the front of the words is enough.
  assert.equal(messageLabel(msg({ text: "[Takal Assistant] hi" })).who, "Takal Assistant");
});

test("M12: what a person sent keeps its own label and name", () => {
  assert.deepEqual(messageLabel(msg({ kind: "whatsapp", text: "Salam" })),
    { kind: "WhatsApp", who: "Sana Ullah", text: "Salam" });
  assert.equal(messageLabel(msg({ kind: "sent_back" })).kind, "Sent back + WhatsApp");
  assert.equal(messageLabel(msg({ kind: "note", by_name: null })).who, "");
});

test("M12: the history list draws messageLabel, not its own words", () => {
  assert.match(CHECKS, /const lb = messageLabel\(m\);/);
  assert.match(CHECKS, /\{lb\.who \? `\$\{lb\.who\} · ` : ""\}/);
  assert.doesNotMatch(CHECKS, /KIND_WORDS\[m\.kind\]/);
});

// ── L9 ──
test("L9: product counts are written 14,150, not 14150", () => {
  assert.equal((14150).toLocaleString("en-US"), "14,150");
  assert.match(LIST, /\{a\.enough \? "" : "⚠ "\}\{a\.count\.toLocaleString\("en-US"\)\} product/);
  assert.match(LIST, /`✓ \$\{a\.count\.toLocaleString\("en-US"\)\} products`/);
});
