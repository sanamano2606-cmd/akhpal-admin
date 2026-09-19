/**
 * A money record that was typed wrong is CANCELLED, never deleted.
 *
 * Money audit M3, 19 September 2026.
 *
 * You mean Rs 20,000, your finger slips, you record Rs 200,000. Until this
 * there was no way back at all: no edit, no delete, and a minus correction
 * refused by the server AND by the database. The books said Rs 200,000 for
 * ever.
 *
 * THE RULE, EVERYWHERE:
 *   * money is ADDED UP  -> cancelled rows are skipped      (liveRows/liveTotal)
 *   * history is LISTED  -> cancelled rows are SHOWN, marked
 *
 * Hiding a cancelled payment would make the mistake - and whoever made it -
 * disappear, which is the one thing a payments list must never do.
 *
 * A row with no `voided_at` field at all counts as real money. That is not a
 * guess: it is what every one of these rows was until somebody cancelled it,
 * and it is also what the server sends back before migration 085 has been run.
 * Erring the other way would make real payments vanish from the books.
 */

export type MoneyRow = { amount?: unknown; voided_at?: unknown; void_reason?: unknown };

/** Was this money record cancelled? */
export function isCancelled(row: MoneyRow | null | undefined): boolean {
  return !!(row && row.voided_at);
}

/** Why it was cancelled - empty string when it was not. */
export function cancelReason(row: MoneyRow | null | undefined): string {
  return isCancelled(row) ? String(row?.void_reason ?? "") : "";
}

/** Only the rows that still count as money. */
export function liveRows<T extends MoneyRow>(rows: readonly T[]): T[] {
  return (rows || []).filter((r) => !isCancelled(r));
}

/** Add up one money field, skipping cancelled rows. */
export function liveTotal(rows: readonly MoneyRow[], field: "amount" = "amount"): number {
  return liveRows(rows || []).reduce(
    (sum, r) => sum + (Number((r as Record<string, unknown>)[field]) || 0), 0);
}
