/**
 * WHEN THE REFUND BUTTON MAY BE USED, AND WHAT IT MAY RECORD.
 *
 * Admin audit, low item 1 (Sana, 6 October 2026). Kept in a .ts file so plain
 * Node can test it; the server says the same (admin_orders.py
 * REFUND_NEEDS_AN_AMOUNT, refund_on_cancelled_refused, and
 * core_catalog.second_refund_refused).
 *
 *   * Rs 0 records nothing. It used to be accepted, mark the order
 *     "refunded", and then block the real refund ("already refunded Rs 0").
 *   * A cancelled order that was never paid (every cash order, or an online
 *     one whose payment did not go through) has nothing to give back.
 */

/** The sentence to show, or "" when the amount may be sent. */
export function refundAmountProblem(amount: number, orderTotal: number, money: (n: number) => string): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Type how much was given back to the customer. A refund of Rs 0 records nothing.";
  }
  if (orderTotal > 0 && amount > orderTotal) {
    return `This order came to ${money(orderTotal)}. You cannot refund ${money(amount)}.`;
  }
  return "";
}

/** A refund already recorded - Rs 0 that charged nobody does not count. */
export function alreadyRefunded(o: any): boolean {
  if (!o?.refunded) return false;
  const amt = o.refund_amount;
  const nothing = amt !== null && amt !== undefined && Number(amt) === 0;
  return !(nothing && !o.refund_charged_to && !Number(o.refund_charged_amount || 0));
}

/** Was this a cancelled order on which no money was ever taken? */
export function cancelledBeforePayment(o: any): boolean {
  return String(o?.status || "").toLowerCase() === "cancelled"
    && String(o?.payment_status || "").toLowerCase() !== "paid";
}

/** Should the "Record a refund" button be shown at all? */
export function mayRecordRefund(o: any): boolean {
  return !alreadyRefunded(o) && !cancelledBeforePayment(o);
}
