// MOCK 233 PIECE 2 (Sana, 8 Nov 2026: "GO 2"): the shop gives its payout
// account in the Partners app. The first one saves at once; a CHANGE waits on
// the shop's Money card here until the payments office approves or refuses it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { waitingLine, PAYOUT_REFUSE_REASONS } from "../src/lib/payout-details.ts";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");
const CARD = code("src/components/PayoutDetailsCard.tsx");
const API = code("src/lib/api-stores.ts");
const SERVER = code("../swat-delivery-app/backend/routers/shop_payout.py");
const READ = code("../swat-delivery-app/backend/routers/vendor_intake.py");

test("one line for the change: method, bank, name, number as the server sent it", () => {
  assert.equal(
    waitingLine({ method: "jazzcash", method_label: "JazzCash", account_title: "Majid Khan",
                  account_number: "0333 *** 6543", bank_name: "", asked_at: "x" }),
    "JazzCash · Majid Khan · 0333 *** 6543");
  assert.equal(
    waitingLine({ method: "bank", account_title: "Majid Khan", account_number: "0123 ******** 2345",
                  bank_name: "Meezan Bank", asked_at: "x" }),
    "Bank transfer · Meezan Bank · Majid Khan · 0123 ******** 2345");
  assert.equal(waitingLine({ method: "cash", asked_at: "x" }), "Cash in person");
});

test("the panel calls the server's own doors, with the change it looked at", () => {
  assert.match(SERVER, /@router\.post\("\/admin\/payout-details\/\{restaurant_id\}\/change\/approve"/);
  assert.match(SERVER, /@router\.post\("\/admin\/payout-details\/\{restaurant_id\}\/change\/refuse"/);
  assert.match(API, /`\/admin\/payout-details\/\$\{restaurantId\}\/change\/approve`/);
  assert.match(API, /`\/admin\/payout-details\/\$\{restaurantId\}\/change\/refuse`/);
  assert.match(API, /body: JSON\.stringify\(\{ asked_at: askedAt \}\)/);
  assert.match(API, /body: JSON\.stringify\(\{ asked_at: askedAt, reason \}\)/);
  assert.match(CARD, /apiClient\.approvePayoutChange\(restaurantId, w\.asked_at\)/);
  assert.match(CARD, /apiClient\.refusePayoutChange\(restaurantId, w\.asked_at, reason\)/);
  // The Money card's one read carries it - no second request per shop page.
  assert.match(READ, /"waiting": _waiting_change\(restaurant_id, full\),/);
});

test("approve is asked twice, refuse asks why, and only the payments office sees the buttons", () => {
  const box = CARD.slice(CARD.indexOf('data-testid="payout-change-waiting"'),
                         CARD.indexOf("<RejectReasonDialog"));
  assert.ok(box.length > 100);
  assert.match(box, /\{maySave \? \(/);
  assert.match(box, /onClick=\{\(\) => setSure\(true\)\}[\s\S]*Approve change/);
  assert.match(box, /onClick=\{\(\) => decide\(true\)\}[\s\S]*Yes, approve/);
  assert.match(box, /Until it is approved, Takal keeps paying the account above\./);
  assert.match(CARD, /suggestions=\{PAYOUT_REFUSE_REASONS\}/);
  assert.match(CARD, /confirmLabel="Yes, refuse"/);
  assert.match(CARD, /onConfirm=\{\(reason\) => decide\(false, reason\)\}/);
  for (const r of PAYOUT_REFUSE_REASONS) assert.ok(r.length >= 3, "the server needs 3 letters or more");
});

test("no CNIC anywhere in the new pieces (Sana, 22 Sep 2026)", () => {
  for (const src of [SERVER, CARD.slice(CARD.indexOf("Mock 233-2"))]) {
    assert.doesNotMatch(src.replace(/NO CNIC|"NO CNIC"|no CNIC/gi, ""), /cnic_number|cnic:/i);
  }
});
