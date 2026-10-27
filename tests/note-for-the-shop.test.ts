// ─────────────────────────────────────────────────────────────────────────────
// "NOTE FOR THE SHOP" (Mock 209 B v2, approved by Sana 27 October 2026).
//
// A customer can write a short note on one product line ("No onions, less
// spicy"). The server stores it on the line as order_items.special_instructions
// and the Takal Partners app already shows it. Takal's office packs most
// orders and a mall's staff pack theirs on this panel - so they must read it
// too. It is a request only: it never changes a price.
//
// Like the size, the note can say what is in the box ("Size M if L is out"),
// so Sana's rule of 18 September 2026 holds for it too: never on the parcel
// label stuck OUTSIDE the box, never on the delivery staff's screen. Those two
// bans are in parcel-label.test.ts and who-sees-what-was-ordered.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The PRINTED form, not a mention - `{it.special_instructions}` is the answer
// on the page; `it.special_instructions ?` is only the question.
for (const [who, file] of [
  ["the office's order page", "src/app/dashboard/orders/parts-order-panel.tsx"],
  ["the customer's receipt", "src/app/dashboard/orders/parts-customer-receipt.tsx"],
  ["a mall's staff order card", "src/app/shop/parts-orders.tsx"],
] as const) {
  test(`${who} PRINTS the customer's note for the shop`, () => {
    assert.ok(
      read(file).includes("{it.special_instructions}"),
      `${who} does not show the note - the person packing never reads "No onions".`,
    );
  });

  test(`${who} prints nothing for a line with no note`, () => {
    // An empty note must not draw empty quotes: it is shown only when it has words.
    assert.ok(
      read(file).includes('String(it.special_instructions ?? "").trim() ?'),
      `${who} must hide the note line when there is no note.`,
    );
  });
}
