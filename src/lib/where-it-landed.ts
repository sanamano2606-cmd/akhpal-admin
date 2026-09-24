// ─────────────────────────────────────────────────────────────────────────────
// DID THE ORDER LAND WHERE IT WAS PRICED? — the rule, with no screen around it.
//
// WHY THIS FILE EXISTS. These three lived inside
// src/app/dashboard/orders/parts-where-it-landed.tsx. The panel's test runner
// is plain Node (`node --experimental-strip-types`), and plain Node cannot
// read a .tsx file at all — it stops at the extension before it reads a line.
// So the test that guards this rule could never run, and `npm test` failed on
// 24 September 2026, which blocked the whole deploy.
//
// This is the SECOND time the same mistake was made in one day. The first was
// src/lib/rider-cash-limits.ts, a few hours earlier. The cause both times was
// checking the work with a different test runner from the one the deploy uses.
//
// The rule now lives here, in a plain .ts file, exactly like every other rule
// in src/lib. The screen imports it and draws it. Nothing about the rule
// itself changed — same words, same numbers, same behaviour.
//
// Money audit M14, decided by Sana on 24 September 2026. The delivery pin
// comes straight from the customer's phone and is checked against nothing. A
// pin dragged toward the shop makes the order cheaper — and the RIDER carries
// three quarters of the loss for a ride he still makes in full. It cannot be
// caught at checkout, so the server compares where the rider really was when
// he pressed Delivered with the pin the order was priced on.
// ─────────────────────────────────────────────────────────────────────────────

/** Sana's figure, 24 September 2026. Read out of the server's own file by a
 *  test, so the screen and the server cannot drift apart silently. */
export const GAP_THAT_MATTERS_M = 3000;

export type Landing =
  | { checked: false }
  | {
      checked: true;
      gapM: number;
      far: boolean;
      pricedKm: number | null;
      realKm: number | null;
      customerShort: number;
      riderShort: number;
    };

export function whatWeFound(o: any): Landing {
  // NULL MEANS NOBODY EVER CHECKED, which is a different fact from "checked
  // and found to be fine". The screen must never show them the same way.
  const checked = o?.delivery_pin_checked_at != null && o?.delivery_gap_m != null;
  if (!checked) return { checked: false };
  const gapM = Math.round(Number(o.delivery_gap_m) || 0);
  return {
    checked: true,
    gapM,
    far: gapM >= GAP_THAT_MATTERS_M,
    pricedKm: Number(o.priced_distance_km ?? 0) || null,
    realKm: Number(o.delivered_distance_km ?? 0) || null,
    customerShort: Number(o.delivery_underpaid ?? 0) || 0,
    riderShort: Number(o.rider_underpaid ?? 0) || 0,
  };
}

/** "300 m" below a kilometre, "5.2 km" above it. A rider's round trip is
 *  talked about in kilometres; a doorway is talked about in metres. */
export function gapInWords(m: number): string {
  return m < 1000 ? `${Math.round(m).toLocaleString()} m`
                  : `${(m / 1000).toFixed(1)} km`;
}
