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
