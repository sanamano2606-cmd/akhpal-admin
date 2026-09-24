// ─────────────────────────────────────────────────────────────────────────────
// DID THE ORDER LAND WHERE IT WAS PRICED? — the panel's half.
// Money audit M14, decided by Sana on 24 September 2026.
//
// The delivery pin comes straight from the customer's phone and is checked
// against nothing. A pin dragged toward the shop makes the order cheaper, and
// on the live rates the RIDER carries three quarters of the loss for a ride he
// still makes in full.
//
// THE SCREEN DECIDES NOTHING. Sana's option A: the money already taken is
// never changed, the order's address and pin are never changed, and no rider
// is paid by the server. She reads the two figures and presses the button.
//
// TWO RULES EVERYTHING BELOW PROTECTS:
//
//   1. NULL means NOBODY EVER CHECKED. That is a different fact from "checked
//      and found to be fine", and a screen that shows them the same way is
//      telling Sana that every old order was examined and passed.
//   2. The panel never moves the pin. The pin is what the customer was charged
//      from; the landing is a finding placed BESIDE it.
//
// Every check either CALLS the real function or reads what is actually
// rendered. A comment cannot satisfy them — CLAUDE.md section 3.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// BY ITS REAL PATH, WITH THE EXTENSION. The panel's tests run on plain Node,
// which understands neither the "@/" shorthand nor a .tsx file. See the note
// at the top of src/lib/where-it-landed.ts for the deploy this broke.
import {
  GAP_THAT_MATTERS_M,
  gapInWords,
  whatWeFound,
} from "../src/lib/where-it-landed.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// A BLOCK COMMENT STARTS A LINE. Anchored with ^[ \t]* and /m on purpose:
// without it, `/*` INSIDE A STRING opens a comment that runs to the next `*/`.
const bare = (src: string) =>
  src
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const panel = bare(read("src/app/dashboard/orders/parts-where-it-landed.tsx"));
const orderPanel = bare(read("src/app/dashboard/orders/parts-order-panel.tsx"));
const list = bare(read("src/app/dashboard/orders/page.tsx"));
const server = read(
  "../swat-delivery-app/backend/core_delivery_pin.py",
);
// The rule, with no screen around it. Plain Node can read this one.
const rule = bare(read("src/lib/where-it-landed.ts"));

const far = {
  delivery_pin_checked_at: "2026-09-24T12:00:00Z",
  delivery_gap_m: 3000,
  priced_distance_km: 2.0,
  delivered_distance_km: 5.0,
  delivery_underpaid: 60,
  rider_underpaid: 45,
  rider_id: "rider-1",
};

// ── 1. NEVER CHECKED IS NOT THE SAME AS CHECKED AND FINE ───────────────────

test("an order nobody ever checked says so, not that it was fine", () => {
  assert.equal(whatWeFound({}).checked, false);
  assert.equal(whatWeFound({ delivery_gap_m: 4000 }).checked, false,
    "A gap with no time on it was treated as a real finding.");
  assert.equal(
    whatWeFound({ delivery_pin_checked_at: "2026-09-24T12:00:00Z" }).checked,
    false,
  );
});

test("an order that was checked and was fine is a real answer", () => {
  const f = whatWeFound({ ...far, delivery_gap_m: 40,
                          delivery_underpaid: 0, rider_underpaid: 0 });
  assert.equal(f.checked, true);
  if (!f.checked) return;
  assert.equal(f.far, false);
});

// ── 2. SANA'S THREE KILOMETRES ─────────────────────────────────────────────

test("the screen and the server use the same figure", () => {
  // Read out of the SERVER'S own file, so the two cannot drift apart while
  // both still look right on their own.
  const m = server.match(/DELIVERY_GAP_FLAG_M\s*=\s*(\d+)/);
  assert.ok(m, "the server no longer names its flag figure");
  assert.equal(
    Number(m![1]),
    GAP_THAT_MATTERS_M,
    "The panel and the server disagree about how far is too far, so an order " +
      "can be flagged on one screen and not the other.",
  );
});

test("Sana's figure is three kilometres", () => {
  assert.equal(GAP_THAT_MATTERS_M, 3000);
});

/** whatWeFound(), with "we did check this one" already established.
 *
 *  The answer is deliberately two different shapes - a checked order carries
 *  figures, an unchecked one carries none - so that no screen can read a
 *  figure off an order nobody ever looked at. That is worth the two lines. */
function found(o: any) {
  const f = whatWeFound(o);
  assert.equal(f.checked, true, "this order reads as never checked");
  if (!f.checked) throw new Error("unreachable");
  return f;
}

test("under it, nothing is shown; at it, something is", () => {
  assert.equal(found({ ...far, delivery_gap_m: 2999 }).far, false);
  assert.equal(found({ ...far, delivery_gap_m: 3000 }).far, true);
});

// ── 3. THE WORDS A PERSON READS ────────────────────────────────────────────

test("a doorway is talked about in metres, a ride in kilometres", () => {
  assert.equal(gapInWords(250), "250 m");
  assert.equal(gapInWords(999), "999 m");
  assert.equal(gapInWords(3000), "3.0 km");
  assert.equal(gapInWords(5200), "5.2 km");
});

test("the screen says that nothing has happened to the money", () => {
  // A screen showing two shortfalls and saying nothing else reads as though
  // somebody has already dealt with them.
  assert.ok(panel.includes("Nothing has been charged and nothing has been paid"),
    "The panel shows two shortfalls without saying that neither was acted on.");
});

test("both shortfalls are shown, not just Takal's", () => {
  assert.ok(panel.includes("Customer under-paid"), "the customer's side is missing");
  assert.ok(panel.includes("Rider is short"),
    "The rider carries three quarters of this and his figure is not on the screen.");
});

test("what it was priced on is shown beside what it really was", () => {
  // The rule reads both columns...
  assert.ok(rule.includes("priced_distance_km") &&
            rule.includes("delivered_distance_km"),
    "The rule no longer reads what the order was priced on.");
  // ...and the screen actually PAINTS both. A figure worked out and never
  // drawn is a figure nobody ever sees.
  assert.ok(panel.includes("found.pricedKm"),
    "Only the real distance is shown, with nothing to compare it to.");
  assert.ok(panel.includes("found.realKm"));
});

// ── 4. IT DECIDES NOTHING ──────────────────────────────────────────────────

test("the panel never moves the pin or the money", () => {
  for (const field of [
    "delivery_latitude", "delivery_longitude", "delivery_address",
    "delivery_fee", "total_amount", "rider_earning",
  ]) {
    assert.ok(
      !new RegExp(`${field}\\s*[:=]`).test(panel),
      `The finding panel is writing ${field}. The pin is what the customer ` +
        `was charged from and the receipt already says that price.`,
    );
  }
});

test("paying the rider is a button somebody presses, never automatic", () => {
  assert.ok(panel.includes('data-testid="pay-the-rider"'),
    "There is no button, so the rider's money depends on somebody noticing.");
  assert.ok(panel.includes("const payTheRider = async ()"),
    "the payment is not behind a click");
  assert.ok(!/useEffect\([^)]*payTheRider/.test(panel),
    "The rider is being paid the moment the panel opens.");
});

test("the button is only offered to somebody who may use it", () => {
  assert.ok(panel.includes('canAccess("riders.earnings")'),
    "Anybody who can open an order is offered a payment the server refuses.");
});

test("the button pays exactly what the rider is short, and nothing else", () => {
  const block = panel.slice(panel.indexOf("const payTheRider"));
  assert.ok(block.includes("found.riderShort"),
    "The button pays some other figure than the shortfall.");
  assert.ok(block.includes("newIdempotencyKey()"),
    "A second click on a slow connection would pay the rider twice.");
});

// ── 5. WIRING ──────────────────────────────────────────────────────────────

test("the finding sits under the address, never instead of it", () => {
  const map = orderPanel.indexOf("<OrderMap");
  const landed = orderPanel.indexOf("<WhereItLanded");
  assert.ok(map > 0 && landed > 0, "one of the two is not on the page at all");
  assert.ok(landed > map,
    "The finding is drawn above the address and the pin it is about.");
});

test("the order list flags one that landed far away", () => {
  assert.ok(list.includes('key: "landed"'), "nothing marks it in the list");
  assert.ok(list.includes("GAP_THAT_MATTERS_M"),
    "the list has its own idea of how far is too far");
  assert.ok(list.includes("o.delivery_pin_checked_at &&"),
    "An order nobody checked is being flagged, or an unchecked one shown as fine.");
});
