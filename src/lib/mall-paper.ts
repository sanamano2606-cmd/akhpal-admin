// ─────────────────────────────────────────────────────────────────────────────
// ONE MALL ORDER IS ONE PARCEL: ONE LABEL, ONE RECEIPT (rule M1; money audit
// 21 Oct 2026, M11 / AREA-7-3).
//
// A mall basket - or a trip, or a parcel basket of several shops (Mock 181) -
// is ONE order number, ONE delivery fee and ONE box for the customer. In the
// database it is one order row per store. The Parcels desk and the order page
// printed each store's row as if it were the parcel:
//
//   Wakeel Mall #10045: Fashion Rs 4,200 (with the delivery) + Beauty Rs 1,800
//   label 1 "COLLECT ON DELIVERY PKR 4,200", label 2 "PKR 1,800",
//   and a receipt with only Fashion's lines under "#10045".
//
// The customer owes PKR 6,000 for the one box. A carrier given the first label
// asks for PKR 4,200.
//
// The server now sends the WHOLE order with every store's part
// (GET /admin/orders/{id}/full -> "mall": mall_orders.summary, with lines).
// These rules turn that into the one paper. They are plain functions so the
// panel's tests can run them for real - the screens only call them.
//
// THE SAFE DIRECTION. A part of a group whose whole could not be read is NOT
// printed: one store's figure printed as the amount to collect is exactly the
// fault being fixed. The desk is told which one and why.
// ─────────────────────────────────────────────────────────────────────────────

import { orderCode } from "./format.ts";

type Any = Record<string, any>;

/** True when this order row is one store's part of a bigger order. */
export function isPartOfGroup(order: Any | null | undefined): boolean {
  return !!(order && order.mall_order_id);
}

/** "mall order", "trip" or "parcel basket" - the server's `mall.kind`. */
export function groupWord(whole: Any | null | undefined): string {
  const k = String(whole?.kind || "mall");
  return k === "trip" ? "trip" : k === "parcels" ? "parcel basket" : "mall order";
}

export type Paper =
  | { ok: true; order: Any; items: Any[]; storeCount: number }
  | { ok: false; why: string };

/**
 * What the papers print for one order, given the office's full reply
 * ({ order, items, mall? }).
 *
 *  - an ordinary order: itself, unchanged;
 *  - one store's part of a group, with the whole order: ONE order carrying
 *    the lead's number, the group's name and the WHOLE money (subtotal,
 *    delivery, discount, credit, total), and every store's lines - a store
 *    that dropped out is left out, as the server leaves it out of the total;
 *  - a part whose whole could not be read: refused, with the reason.
 */
export function paperFor(full: { order?: Any; items?: Any[]; mall?: Any } | null | undefined): Paper {
  const order = full?.order;
  if (!order) return { ok: false, why: "This order could not be read." };
  if (!isPartOfGroup(order)) {
    return { ok: true, order, items: Array.isArray(full?.items) ? full!.items! : [], storeCount: 1 };
  }
  const whole = full?.mall;
  if (!whole || whole.total == null) {
    return {
      ok: false,
      why:
        `Order #${orderCode(order).toUpperCase()} is one part of a bigger order, and the ` +
        "other stores could not be read just now - so its whole amount is not known. " +
        "Nothing was printed for it. Refresh and print it again.",
    };
  }
  const stores: Any[] = Array.isArray(whole.stores) ? whole.stores : [];
  const live = stores.filter((s) => s && s.dropped_out !== true);
  const items: Any[] = [];
  for (const s of live) {
    for (const it of Array.isArray(s.items) ? s.items : []) {
      // The summary's lines carry the name as `product_name`; the receipt
      // reads `item_name` (the order page's own lines).
      items.push({ ...it, item_name: it.item_name ?? it.product_name });
    }
  }
  const { mall: _m, items: _i, ...rest } = order as Any;
  const merged: Any = {
    ...rest,
    order_no: whole.order_no ?? order.order_no,
    restaurant_name: whole.mall_name || order.restaurant_name,
    subtotal: whole.subtotal,
    delivery_fee: whole.delivery_fee,
    discount: whole.discount,
    credit_used: whole.credit_used,
    total_amount: whole.total,
  };
  return { ok: true, order: merged, items, storeCount: live.length || 1 };
}

/**
 * The order the OUTSIDE label is given. Never the lines (CLAUDE.md §21): the
 * label is handed an order with no `items` and no `mall` block at all, so a
 * product cannot reach the outside of a box even by accident.
 */
export function labelOrderOf(paper: Paper): Any | null {
  if (!paper.ok) return null;
  const { items: _i, mall: _m, ...rest } = paper.order as Any;
  return rest;
}

/**
 * The ticked parcels, ONE per group. Ticking Fashion and Beauty of the same
 * mall basket prints the one parcel once. `rows` are the desk's rows, which
 * carry `mall_order_id`.
 */
export function onePerParcel(ids: string[], rows: Any[]): { ids: string[]; merged: number } {
  const byId = new Map(rows.map((r) => [String(r?.id), r]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const lead = byId.get(String(id))?.mall_order_id;
    const key = lead ? `group:${lead}` : `order:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return { ids: out, merged: ids.length - out.length };
}
