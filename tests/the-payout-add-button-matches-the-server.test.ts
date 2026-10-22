// THE "ADD" BUTTON FOR A SHOP'S PAYOUT ACCOUNT MATCHES WHAT THE SERVER ALLOWS.
// (Review N8, 22 Oct 2026.)
//
// The final money audit (AREA-4-18) made the server refuse a store clerk
// ("Add & edit shops") the FIRST payout account of a shop too - only the
// payments office (Payments -> Balances) or the Main Admin may set it. The
// Payout card still showed the clerk "Add", and pressing it ended in a 403.
// The button is now shown only to somebody the server will let save, asking
// the server's own key through the same mayOpen() question.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mayEditPayoutAccount, PAYOUT_ACCOUNT_PERMISSION,
} from "../src/lib/payout-details.ts";

const CARD = readFileSync(
  new URL("../src/components/PayoutDetailsCard.tsx", import.meta.url), "utf8");
const SERVER = readFileSync(
  new URL("../../swat-delivery-app/backend/routers/vendor_intake.py", import.meta.url),
  "utf8");
const MARK = "__tabs_v2__";

test("the panel asks the same key the server checks before saving", () => {
  const key = SERVER.match(/^SEE_FULL_NUMBER = "([^"]+)"/m);
  assert.ok(key, "vendor_intake.py no longer names SEE_FULL_NUMBER");
  assert.equal(PAYOUT_ACCOUNT_PERMISSION, key![1]);
  // ...and the server's save really asks it for the FIRST account too.
  assert.match(SERVER, /THE FIRST ACCOUNT TOO[\s\S]{0,600}if not _admin_may\(user, SEE_FULL_NUMBER\):/);
});

test("a store clerk may not, the payments office and the Main Admin may", () => {
  assert.equal(mayEditPayoutAccount([MARK, "stores.all"]), false, "store clerk");
  assert.equal(mayEditPayoutAccount([MARK, "stores.all", "stores.inventory"]), false);
  assert.equal(mayEditPayoutAccount(["restaurants"]), false, "old-word store clerk");
  assert.equal(mayEditPayoutAccount([MARK, "payments.balances"]), true, "payments office");
  assert.equal(mayEditPayoutAccount([MARK, "payments"]), true, "the whole Payments tab");
  assert.equal(mayEditPayoutAccount(["payments"]), true, "old-word payments");
  assert.equal(mayEditPayoutAccount([], true), true, "Main Admin");
  assert.equal(mayEditPayoutAccount(null), false);
});

test("the card draws Add / Change only for somebody who may save", () => {
  assert.ok(CARD.includes("const maySave = mayEditPayoutAccount(me.sections, me.isSuper);"));
  // The ONE button that opens the form sits behind it.
  const at = CARD.indexOf("onClick={startEditing}");
  assert.ok(at > 0, "the Add / Change button is gone");
  const guard = CARD.slice(CARD.lastIndexOf("{!editing", at), at);
  assert.ok(guard.startsWith("{!editing && maySave && ("), guard);
  assert.equal(CARD.split("onClick={startEditing}").length - 1, 1, "a second way into the form");
});
