/**
 * WHAT YOU OWE IS NOT NETTED AGAINST WHAT YOU OVERPAID.
 * Money fix 14 (Sana, 2 October 2026).
 *
 * Payments -> Balances added every shop's balance into "You owe Stores",
 * overpaid ones (a minus figure) included. Shop A owed Rs 5,000 and Shop B
 * overpaid Rs 2,000 showed "You owe Stores Rs 3,000" - but Rs 5,000 of cash is
 * needed to pay Shop A, and Shop B's Rs 2,000 is not money in hand. The same
 * happened to "You owe Riders".
 *
 * No imports on purpose: the panel's tests run on plain Node and read this
 * file directly (tests/owe-split.test.ts).
 */
export type OweSplit = { owed: number; overpaid: number; overpaidCount: number };

export function splitOwed(balances: unknown[]): OweSplit {
  let owed = 0;
  let overpaid = 0;
  let overpaidCount = 0;
  for (const b of balances) {
    const v = Number(b) || 0;
    if (v > 0) owed += v;
    else if (v < 0) {
      overpaid += -v;
      overpaidCount += 1;
    }
  }
  return { owed, overpaid, overpaidCount };
}
