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

/** Was this a cancelled (or rejected) order on which no money was ever taken? */
export function cancelledBeforePayment(o: any): boolean {
  const st = String(o?.status || "").toLowerCase();
  return (st === "cancelled" || st === "rejected")
    && String(o?.payment_status || "").toLowerCase() !== "paid";
}

/** Still going - a refund waits until it is delivered (money audit B7). */
export function notDeliveredYet(o: any): boolean {
  const st = String(o?.status || "").toLowerCase();
  return !!st && !["delivered", "cancelled", "rejected"].includes(st);
}

/** Should the "Record a refund" button be shown at all?
 *  `mayReturn` is the Returns & Refunds permission (money audit M1): the
 *  server refuses anybody without it, so the button is not offered either. */
export function mayRecordRefund(o: any, mayReturn = true): boolean {
  return mayReturn && !alreadyRefunded(o) && !cancelledBeforePayment(o) && !notDeliveredYet(o);
}
