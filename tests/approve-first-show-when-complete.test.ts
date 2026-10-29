// APPROVE FIRST, SHOW TO CUSTOMERS ONLY WHEN EVERYTHING IS DONE (Sana, 29 Oct 2026)
//
// "all stores those applied can be approved but never shows to customers until
//  all requirements fulfilled except money details" - "The review can be done
//  from admin panel of the approved store and live stores" - "send them back
//  for correction in Roman Urdu always".
//
// The server holds the rule (backend show_lock.py). These checks hold the
// panel to it: Approve is never greyed out by what is missing, the Review page
// works for hidden and live shops, and WhatsApp starts in Roman Urdu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approveState, approveWithChecklist } from "../src/lib/approve-rule.ts";
import { savedWaLang, sendBackMessage } from "../src/lib/whatsapp-words.ts";

const REVIEW = readFileSync("src/app/dashboard/stores/[id]/review/page.tsx", "utf8");
const SHOW_LOCK = readFileSync("../swat-delivery-app/backend/show_lock.py", "utf8");

test("Approve is open whatever is missing - for everybody who may approve", () => {
  for (const isMain of [true, false]) {
    for (const count of [0, 3, null, 9]) {
      const a = approveWithChecklist(approveState({ product_count: count }, isMain), ["Shop logo"], isMain);
      assert.equal(a.button, "approve", `count ${count}, main ${isMain}`);
    }
  }
});

test("the Review page: Approve only needs the shop to be waiting", () => {
  assert.match(REVIEW, /data-approve disabled=\{!waiting \|\| busy\}/);
  // What keeps it hidden is listed, from the server's own lock.
  assert.match(REVIEW, /\(data\.show_check\?\.problems \|\| \[\]\)\.map/);
});

test("hidden and live shops can be marked and sent back; only waiting ones approved or rejected", () => {
  assert.match(REVIEW, /const reviewable = waiting \|\| status === "hidden" \|\| status === "approved";/);
  assert.match(REVIEW, /data-send-back disabled=\{!reviewable/);
  assert.match(REVIEW, /disabled=\{!waiting \|\| busy\} onClick=\{\(\) => setAsk\("reject"\)\}/);
});

test("WhatsApp starts in Roman Urdu when nothing was chosen in this browser", () => {
  // No window here, exactly like a first visit.
  assert.equal(savedWaLang(), "roman");
});

test("a shop already approved is asked to reply, not to press Send for review again", () => {
  const fixes = [{ label: "Shop logo", reason: "Picture is blurry", vendor_can_fix: true }];
  const waiting = sendBackMessage("roman", "Ali Khan", "Ali Burgers", fixes);
  const live = sendBackMessage("roman", "Ali Khan", "Ali Burgers", fixes, true);
  assert.match(waiting, /Send for review again/);
  assert.doesNotMatch(live, /Send for review again/);
  assert.match(live, /isi message ka jawab/);
  assert.match(REVIEW, /vendor_can_fix: data\.keys\?\.\[f\.key\]\?\.where !== "office" \}\)\), !waiting\);/);
});

test("payout details are the one thing a shop may go live without", () => {
  assert.match(SHOW_LOCK, /PAYOUT_LABELS = \("Where Takal sends the money", "Where Takal sends your money"\)/);
  assert.match(SHOW_LOCK, /return \[x for x in left if x not in PAYOUT_LABELS\]/);
});
