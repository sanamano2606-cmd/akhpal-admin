/**
 * WHAT A COMPLAINT IS WORTH, AND WHAT COMES OFF THE ONE AT FAULT.
 * (Mock 117 FINAL and Mock 118, approved by Sana on 24 September 2026.)
 *
 * The twin of `backend/core_complaints.py`. THE SERVER IS THE REAL GATE - it
 * works the ceiling out again when a decision arrives and refuses anything
 * outside it, and the database holds the hardest rule of all as a CHECK. What
 * this file buys is that the office is told what is wrong WHILE THEY ARE STILL
 * LOOKING AT THE FIELD, instead of after a round trip.
 *
 * SANA'S RULES, in her own words:
 *   "In both cases the customer will be refunded by full payment of the full
 *    order with delivery fee or the part of the order and half of the delivery
 *    fee."
 *   "if the mistake is restaurant's so the restaurant will just not get that
 *    order's money and the rider will be still paid what he earned on that
 *    delivery."
 *   "who is was responsible for this and the amount deduct from him with a
 *    short reason/message saved."
 *
 * Every figure below is checked against the real order 10001 in
 * tests/a-complaint-decides-who-pays.test.ts:
 *     paid 553 - the shop's own price 350 - delivery 185 - commission 35 -
 *     the rider earned 143.90.
 */

// THE ONE MONEY FORMAT, for the sentences below. A rule file with its own
// spelling of an amount is a rule file that stops matching the screens.
import { money } from "./format.ts";

export const COMPLAINT_PAYERS = ["shop", "rider", "takal", "customer"] as const;
export type ComplaintPayer = (typeof COMPLAINT_PAYERS)[number];

export const MAX_DECISION_NOTE = 200;

export interface MoneyOrder {
  total_amount?: number | string | null;
  vendor_subtotal?: number | string | null;
  delivery_fee?: number | string | null;
  commission?: number | string | null;
  rider_earning?: number | string | null;
}

export interface MoneyLine {
  price?: number | string | null;
  base_price?: number | string | null;
  quantity?: number | string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** Two decimals, half going UP - the same as `money()` on the server. */
export const money2 = (v: unknown): number =>
  Math.round((num(v) + Number.EPSILON) * 100) / 100;

/** Whole rupees, half going UP - `money(x, 0)` on the server. */
export const moneyWhole = (v: unknown): number =>
  Math.round(num(v) + Number.EPSILON);

/**
 * Half a delivery charge, in WHOLE RUPEES, half going up.
 *
 * Half of Rs 185 is Rs 92.50 and nobody in Swat hands back fifty paisa. It is
 * rounded the customer's way, so the figure a person is told is the figure
 * that moves.
 */
export const halfOf = (amount: unknown): number => moneyWhole(num(amount) / 2);

/** What the CUSTOMER paid for one line - the unit price times how many. */
export const lineCustomerAmount = (line: MoneyLine): number =>
  money2(num(line.price) * num(line.quantity));

/** What the SHOP charges for one line - its own price, no markup. */
export const lineShopAmount = (line: MoneyLine): number =>
  line.base_price == null
    ? lineCustomerAmount(line)
    : money2(num(line.base_price) * num(line.quantity));

/**
 * The commission rate THIS order was charged, read off the order.
 *
 * Never the rate in settings today. Order 10001 was charged 35 on 350 - ten
 * per cent, the rate that day - while the global rate is five per cent now.
 */
export function commissionRateOf(order: MoneyOrder): number {
  const base = num(order.vendor_subtotal);
  if (base <= 0) return 0;
  return num(order.commission) / base;
}

/** The shop's own price less the commission: what really left Takal. */
export const whatTakalPaidTheShop = (order: MoneyOrder): number =>
  money2(num(order.vendor_subtotal) - num(order.commission));

/**
 * THE MOST THAT MAY EVER BE GIVEN BACK.
 *
 * WHOLE - what he paid, full stop.
 * PART  - the lines he ticked, at what HE paid, plus half the delivery charge.
 */
export function ceilingFor(
  order: MoneyOrder, picked: MoneyLine[], wants: string,
): number {
  const paid = money2(order.total_amount);
  if (wants === "whole") return paid;
  const lines = picked.reduce((t, l) => t + lineCustomerAmount(l), 0);
  return Math.min(paid, money2(lines + halfOf(order.delivery_fee)));
}

/**
 * What the shop does not get, when the shop is the one at fault.
 *
 * Its OWN price for the lines complained about, less the commission it would
 * not have paid on them either. WHOLE on order 10001: 350 - 35 = Rs 315. Never
 * the Rs 368 the customer paid - the kitchen never saw the markup.
 */
export function shopLoses(
  order: MoneyOrder, picked: MoneyLine[], wants: string,
): number {
  const rate = commissionRateOf(order);
  const base = wants === "whole"
    ? num(order.vendor_subtotal)
    : picked.reduce((t, l) => t + lineShopAmount(l), 0);
  return money2(base * (1 - rate));
}

/**
 * OPTION A, chosen by Sana on 24 September 2026. An order that never arrived
 * and the rider at fault: he repays exactly what Takal paid the shop, and
 * earns nothing for the trip. Takal then ends the day at zero.
 */
export const riderLosesForALostOrder = (order: MoneyOrder): number =>
  whatTakalPaidTheShop(order);

/** What the office is OFFERED in the "how much comes off him" box. */
export function suggestedCharge(
  order: MoneyOrder, picked: MoneyLine[], wants: string,
  whoPays: string, refund: unknown,
): number {
  const back = money2(refund);
  if (whoPays === "shop") return Math.min(back, shopLoses(order, picked, wants));
  if (whoPays === "rider") {
    return wants === "whole"
      ? Math.min(back, riderLosesForALostOrder(order))
      : back;
  }
  return 0;
}

/**
 * Does the rider still get paid for the trip?
 *
 * YES whenever the shop is at fault. NO only when the order never arrived and
 * it was his own fault - he carried nothing to anybody.
 */
export const riderKeepsHisEarning = (whoPays: string, wants: string): boolean =>
  whoPays !== "rider" ? true : wants !== "whole";

/**
 * Why this decision cannot be approved yet - in words, "" when it can.
 *
 * The same four answers the server insists on, in the same order, so the
 * office never meets a refusal it was not already warned about.
 */
export function problemWithDecision(a: {
  order: MoneyOrder;
  picked: MoneyLine[];
  wants: string;
  refund: number | null;
  charge: number | null;
  whoPays: string | null;
  note: string;
  riderEarning?: number | null;
  overEarningAllowed?: boolean;
}): string {
  if (!a.whoPays || !(COMPLAINT_PAYERS as readonly string[]).includes(a.whoPays)) {
    return "Choose who was responsible before approving.";
  }
  if (a.refund == null || Number.isNaN(a.refund)) {
    return "Fill in what the customer gets back.";
  }
  if (a.charge == null || Number.isNaN(a.charge)) {
    return "Fill in how much comes off the one at fault.";
  }
  if (!a.note.trim()) {
    return "Write a short reason. The shop or the rider is shown it.";
  }
  if (a.note.length > MAX_DECISION_NOTE) {
    return `Please keep the reason under ${MAX_DECISION_NOTE} letters.`;
  }

  const refund = money2(a.refund);
  const charge = money2(a.charge);
  if (refund < 0 || charge < 0) return "An amount cannot be less than nothing.";

  const ceiling = ceilingFor(a.order, a.picked, a.wants);
  if (refund > ceiling) {
    return `This complaint allows at most ${money(moneyWhole(ceiling))}. `
      + "It can be lowered, never raised.";
  }
  if (charge > refund) {
    return "What comes off the one at fault cannot be more than the customer was given back.";
  }
  if (a.whoPays === "shop" && a.picked.some((l) => l.base_price == null)) {
    return "One of those items does not record the shop's own price, so what "
      + "the shop loses cannot be worked out. Charge Takal instead, or decide "
      + "it by hand.";
  }
  if (a.whoPays === "rider" && charge > 0
      && a.riderEarning != null && charge > num(a.riderEarning)
      && !a.overEarningAllowed) {
    return `That is more than the ${money(moneyWhole(a.riderEarning))} `
      + "he earned on this order. Only the Main Admin may go higher, and it is "
      + "written down.";
  }
  return "";
}
