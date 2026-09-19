// ─────────────────────────────────────────────────────────────────────────────
// WHEN AN ORDER CAN BE GIVEN A RIDER — the panel's copy of the server's rule.
//
// Order management, Phase 1 (Sana, 17 September 2026). The server decides
// (swat-delivery-app/backend/core_orders.py -> rider_assignment_patch); this
// only decides which BUTTONS to show, so the office is never offered a button
// the server will refuse.
//
//   * The shop has not accepted yet        -> no rider yet ("waiting for the shop")
//   * Accepted / preparing / ready          -> "Assign a rider". While the shop is
//                                              still making it, the shop's step is
//                                              left alone; the rider is told when
//                                              it is ready.
//   * A rider is already carrying it        -> "Change rider" (never goes backwards)
//   * A parcel, a self-pickup, or finished  -> no rider, ever
// ─────────────────────────────────────────────────────────────────────────────

export const SHOP_STILL_WORKING = ["accepted", "preparing"];
export const RIDER_ON_THE_JOB = ["on_the_way_to_restaurant", "picked_up", "on_the_way"];
const CAN_TAKE_A_RIDER = [...SHOP_STILL_WORKING, "ready"];
const FINISHED = ["delivered", "cancelled", "rejected"];

type OrderLike = {
  status?: string | null;
  rider_id?: string | null;
  delivery_type?: string | null;
  is_pickup?: boolean | null;
};

const st = (o: OrderLike) => String(o?.status || "").trim().toLowerCase();

/** A parcel (standard delivery) never gets a rider. */
export function isParcel(o: OrderLike): boolean {
  return String(o?.delivery_type || "").toLowerCase() === "standard" || st(o) === "at_hub";
}

/** Nobody is carrying it yet, and the server will accept a rider now. */
export function canAssignRider(o: OrderLike): boolean {
  if (!o || o.rider_id || o.is_pickup || isParcel(o)) return false;
  return CAN_TAKE_A_RIDER.includes(st(o));
}

/** A rider is on it and may be swapped for another. */
export function canChangeRider(o: OrderLike): boolean {
  if (!o || !o.rider_id || o.is_pickup || isParcel(o)) return false;
  return CAN_TAKE_A_RIDER.includes(st(o)) || RIDER_ON_THE_JOB.includes(st(o));
}

/** What the "carried by" place says when there is no rider and no office. */
export function noCarrierText(o: OrderLike): string {
  const s = st(o);
  if (FINISHED.includes(s)) return "—";
  if (o?.is_pickup) return "customer collects";
  if (isParcel(o)) return "Parcel — Takal office";
  if (s === "pending") return "Waiting for the shop";
  return "Nobody yet";
}

/** The rider is on the order but the food is not ready yet. */
export function riderWaitingForShop(o: OrderLike): boolean {
  return Boolean(o?.rider_id) && SHOP_STILL_WORKING.includes(st(o));
}

// ─────────────────────────────────────────────────────────────────────────────
// WHAT ONE LINE OF AN ORDER IS WORTH.
//
// `order_items.price` is the price of ONE. Every screen in the system printed
// that figure next to a "3 x" and then, immediately underneath, a subtotal
// that was the sum of the LINES. So on any order of more than one of anything
// the bill visibly did not add up - on the customer's own order page, on the
// rider's screen, on the office's panel and on the receipt printed for the
// parcel. Only the vendor's app had ever multiplied.
//
// The rule now lives here, once, and both panel screens ask it.
//
// WHICH price it is depends on who is reading, and that is decided by the
// screen, not here: the customer, the rider and the office all read the
// MARKED-UP price (what the customer paid), and the vendor's app reads the
// shop's own `base_price` through its own helper. The customer must never be
// shown the shop's price (Sana, 19 September 2026).
// ─────────────────────────────────────────────────────────────────────────────

type LineLike = { price?: unknown; total?: unknown; quantity?: unknown } | null | undefined;

/** How many of this line. A missing or broken quantity counts as one. */
export function lineQuantity(it: LineLike): number {
  const n = Number(it?.quantity ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** The price of ONE, as the reader of this screen is allowed to see it. */
export function lineUnitPrice(it: LineLike): number {
  const n = Number(it?.price ?? it?.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** What the whole line costs: the price of one, times how many. */
export function lineTotal(it: LineLike): number {
  return lineUnitPrice(it) * lineQuantity(it);
}

// ─────────────────────────────────────────────────────────────────────────────
// A BILL THAT ADDS UP, EVEN WHEN A DISCOUNT CODE WAS USED.
//
// THE PROBLEM. `orders` has no discount column - the amount a promo code took
// off survives only as text inside the order's `notes` (money audit, M8,
// 18 September 2026). So no screen could print a Discount line, and the
// customer's own order page went further and worked its subtotal out backwards
// as `total - delivery fee`, which quietly folds the discount INTO the
// subtotal. On a Rs 200 promo the items read Rs 200 short, there was no line
// saying why, and the itemised list above it did not add up to it.
//
// THE FIX UNTIL THERE IS A REAL COLUMN. Every other figure IS stored, so the
// discount is the only unknown in an equation the server itself balanced:
//
//     total = subtotal + delivery fee - discount - wallet credit
//
// Rearranged, that is the discount. It cannot drift, because it is worked out
// from the server's own numbers every time rather than stored anywhere.
//
// A REAL `orders.discount` COLUMN IS STILL THE PROPER ANSWER. Then the reports
// could say what a code cost without reading English out of a notes field.
// ─────────────────────────────────────────────────────────────────────────────

type BillLike = {
  subtotal?: unknown;
  delivery_fee?: unknown;
  credit_used?: unknown;
  total_amount?: unknown;
  /** Migration 082. Absent on every order placed before it. */
  discount?: unknown;
} | null | undefined;

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Rounded to the paisa, so float dust never prints as a Rs 0.00 line. */
const paisa = (n: number): number => Math.round(n * 100) / 100;

/** What the goods cost, before any discount. */
export function orderSubtotal(o: BillLike): number {
  const stored = num(o?.subtotal);
  if (stored > 0) return paisa(stored);
  // An order from before the subtotal column existed. Worked out the old way,
  // which is right for every order that carried no discount - and every order
  // that old carried none.
  return paisa(Math.max(0, num(o?.total_amount) - num(o?.delivery_fee)));
}

/** Wallet credit spent on this order. */
export function orderCredit(o: BillLike): number {
  return paisa(Math.max(0, num(o?.credit_used)));
}

/** What a discount code took off. Zero when there was none. */
export function orderDiscount(o: BillLike): number {
  // THE STORED FIGURE FIRST (migration 082, 19 September 2026).
  //
  // The order now records what the code took off, so the sum below is no
  // longer a stand-in for a fact - it is the fallback for every order placed
  // before that column existed. Those cannot be repaired: their discount was
  // never written down, and the label in `notes` is English, not a number.
  const stored = num(o?.discount);
  if (stored > 0) return paisa(stored);

  const d = paisa(
    orderSubtotal(o) + num(o?.delivery_fee) - orderCredit(o) - num(o?.total_amount),
  );
  // Under a paisa is rounding, not a discount. A negative answer means one of
  // the stored figures is wrong, and inventing a "discount" of minus something
  // would only hide that.
  return d >= 0.01 ? d : 0;
}

