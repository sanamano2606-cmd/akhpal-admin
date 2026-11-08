// ─────────────────────────────────────────────────────────────────────────────
// BILL-PRICE STORES - the panel's rules.  (Mock 231, approved by Sana on
// 8 November 2026: "both ways together" / "YES" / "Approved".)
//
// A bill-price store gives Takal no commission and no buying price, but a
// discount on every bill. The shop types its bill total for each order in the
// Partners app; the office may correct it here from the paper bill, with a
// reason. The shop is paid the bill; Takal earns the difference.
//
// The SERVER decides (order_bills.py) - these only say the same thing early,
// in the same words, so a person is not sent a refusal for something the box
// could have told them. Whole rupees, at least Rs 1, never above the shop's own
// total. "Listed total" is ALWAYS the shop's own total, never the customer's.
// ─────────────────────────────────────────────────────────────────────────────

/** The server's own refusal, word for word (order_bills._refuse). */
export function billTooHighWords(listed: number): string {
  return `The bill cannot be more than the listed total, Rs ${Math.round(listed).toLocaleString("en-US")}. Please check the bill.`;
}

/** What is wrong with a typed bill, or null when it may be sent. */
export function billProblem(typed: string, listed: number | null | undefined): string | null {
  const t = (typed || "").replace(/,/g, "").trim();
  if (!t) return "Type the bill total.";
  if (!/^\d+$/.test(t)) return "Whole rupees only - no paisa, no letters.";
  const n = Number(t);
  if (n < 1) return "The bill must be at least Rs 1.";
  if (listed != null && listed > 0 && n > listed) return billTooHighWords(listed);
  return null;
}

/** The shop's discount to Takal on a bill: rupees and percent (1 decimal). */
export function billDiscount(listed: number, bill: number): { rupees: number; percent: number } {
  if (!(listed > 0)) return { rupees: 0, percent: 0 };
  const rupees = Math.round(listed - bill);
  return { rupees, percent: Math.round(((listed - bill) / listed) * 1000) / 10 };
}

/** The little mark on an order row: a bill-price order with no bill yet (once
 *  the shop has made it ready), or a bill whose discount was low. Same rule as
 *  the server's "Bill not typed" / "Low discount" chips (orders_desk.QUEUES). */
export function billMark(o: any): "missing" | "low" | null {
  if (!o || o.price_mode !== "bill") return null;
  const st = String(o.status || "");
  if (o.bill_total == null) {
    return ["pending", "accepted", "preparing", "cancelled", "rejected"].includes(st) ? null : "missing";
  }
  return o.bill_low && !["cancelled", "rejected"].includes(st) ? "low" : null;
}

/** The "Low discount" warning a store is given when nobody chose one. */
export const DEFAULT_LOW_PERCENT = 2;
