// ─────────────────────────────────────────────────────────────────────────────
// THE SERVER NOW REFUSES A PAYMENT ABOVE WHAT IS OWED (money audit AREA-4-09 /
// AREA-5-06, 21 Oct 2026) unless the request says `overpay=true`.
//
// The panel already asked first ("Rs 30,000 is Rs 27,000 more than Cupbar is
// owed ... Press again to record it anyway"), but with figures read minutes
// earlier. Two tabs each paying "to pay Rs 5,000" both passed that check. The
// server's own refusal now lands in the SAME orange box, and the SECOND press
// sends `overpay` - no new control, the existing "press again".
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overOwedRefusal } from "../src/lib/over-owed.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the server's refusal is read as 'more than is owed', in the panel's words", () => {
  const err = Object.assign(new Error(
    "Rs 5,000 is more than the Rs 0 Cupbar is owed right now, so it has NOT been " +
    "recorded. If you really mean to pay more than is owed, tick \"Pay more than " +
    "owed\" and save again."), { status: 409 });
  assert.equal(overOwedRefusal(err),
    "Rs 5,000 is more than the Rs 0 Cupbar is owed right now, so it has NOT been " +
    "recorded. Press again to record it anyway.");
});

test("any other error is not mistaken for it", () => {
  assert.equal(overOwedRefusal(Object.assign(new Error("Restaurant not found"), { status: 404 })), "");
  assert.equal(overOwedRefusal(Object.assign(new Error("What is owed could not be checked"), { status: 503 })), "",
    "a failed check is never turned into 'you may overpay'");
  assert.equal(overOwedRefusal(null), "");
});

test("the three pay windows send overpay only after the warning was seen", () => {
  const files = {
    shop: read("src/app/dashboard/payments/page.tsx"),
    rider: read("src/domains/riders/RiderMoney.tsx"),
    staff: read("src/app/dashboard/payments/staff/page.tsx"),
  };
  for (const [name, src] of Object.entries(files)) {
    const i = src.indexOf("const overpay = payOver.confirmed;");
    assert.ok(i > 0, `${name}: overpay is not read from the warning`);
    assert.ok(i < src.indexOf("if (!payOver.mayGo()) return;", i), `${name}: read it BEFORE the press is counted`);
    assert.ok(src.includes("payOver.refused(err)"), `${name}: the server's refusal is not shown in the box`);
  }
  assert.ok(files.shop.includes("}, payKey, overpay);"));
  assert.ok(files.rider.includes("payKey, overpay);"));
  assert.ok(files.staff.includes("}, moneyKey, overpay);"));
  const api = read("src/lib/api-money.ts");
  for (const door of ["/admin/payouts/record", "/admin/riders/payouts/record", "/admin/staff/payouts/record"]) {
    assert.ok(api.includes(`${door}\${overpay ? "?overpay=true" : ""}`), door);
  }
  // The server's own name for it - the panel and the server must agree.
  const server = read("../swat-delivery-app/backend/routers/settlements.py");
  assert.ok(server.includes('OVERPAY_FIELD = "overpay"'));
});

test("a server refusal waits for a second press, then goes", () => {
  const hook = read("src/components/OverOwedNote.tsx");
  assert.match(hook, /if \(serverWhy\) return true;/);
  assert.match(hook, /confirmed: \(shown && !!sentence\) \|\| !!serverWhy/);
  assert.match(hook, /useEffect\(\(\) => \{\s*setServerWhy\(""\);\s*\}, \[sentence, resetKey\]\);/,
    "a new amount must ask again");
});
