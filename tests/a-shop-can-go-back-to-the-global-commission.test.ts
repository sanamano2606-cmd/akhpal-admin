// ─────────────────────────────────────────────────────────────────────────────
// A SHOP CAN BE PUT BACK ON THE GLOBAL COMMISSION — 23 SEPTEMBER 2026.
//
// WHAT WENT WRONG
// A pharmacy was saved with its own commission of 0%. A shop's own rate beats
// the global rate, so that shop was charged nothing — and there was no way in
// the panel to undo it. The Save button refused an empty box and told the
// admin to "press the X", but the X is Cancel: it closed the editor and changed
// nothing. Meanwhile the delivery-fee box beside it had always handled an empty
// box correctly.
//
// THE RULE THIS PINS
//   empty box  -> no rate of its own -> the shop is charged the GLOBAL rate
//   0 typed in -> a real 0% override -> the shop is charged NOTHING
// These are different things and must never be collapsed into one.
//
// The server already supported it: PUT /admin/restaurants/{id}/commission with
// NO percent writes NULL. Only the panel had to catch up.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("an empty commission box clears the shop's own rate", () => {
  const page = read("app/dashboard/stores/page.tsx");
  const save = page.slice(page.indexOf("const saveCommission"),
                          page.indexOf("useEffect", page.indexOf("const saveCommission")));

  // An empty box must not be refused any more.
  assert.doesNotMatch(save, /press the X/,
    "the old message pointed at the Cancel button, which cleared nothing");

  // It must send null, and say so.
  assert.match(save, /let val: number \| null = null/);
  assert.match(save, /setRestaurantCommission\(restaurantId, val\)/);
  assert.match(save, /back on the global rate/i);
});

test("null is sent as NO percent, never as percent=0", () => {
  const api = read("lib/api-stores.ts");
  const fn = api.slice(api.indexOf("async setRestaurantCommission"),
                       api.indexOf("async ", api.indexOf("async setRestaurantCommission") + 10));

  assert.match(fn, /commission: number \| null/, "the call must accept null");
  assert.match(fn, /commission === null/, "null needs its own path");
  // The cleared form carries no percent at all.
  assert.match(fn, /\/commission`\s*$/m,
    "clearing must call the endpoint with no ?percent= on it");
  assert.doesNotMatch(fn, /percent=\$\{commission \|\| 0\}/,
    "falling back to 0 would charge the shop nothing instead of clearing it");
});

test("the list still shows 'Global rate' and not 0%", () => {
  const page = read("app/dashboard/stores/page.tsx");
  assert.match(page, /commission_percent == null \? \(/);
  assert.match(page, /Global rate/);
});
