/**
 * WHO RECORDED THIS REFUND - the one line under the refunded box.
 *
 * Money audit M15, mock 125, approved by Sana on 25 September 2026.
 *
 * WHY THIS IS A .ts FILE AND NOT PART OF THE SCREEN. The panel's tests run on
 * plain Node (`node --experimental-strip-types --test "tests/*.test.ts"`),
 * which cannot read a .tsx file at all. A rule written inside the screen is a
 * rule no test can reach - that mistake broke a deploy twice in one day on
 * 24 September. Logic lives here; the .tsx only paints.
 *
 * THREE ANSWERS, NOT TWO. "No name" is not the same as "nobody did it":
 *
 *   named        the refund carries a person      -> say who, and when
 *   before-we-kept-it   refunded, but no name     -> say that plainly
 *   none         the order was never refunded     -> show nothing
 *
 * The middle one matters. Every refund recorded before migration 108 has no
 * name, and a blank space there would read as "nobody" - which is worse than
 * a wrong answer, because it is a wrong answer that looks like a fact.
 */

export type RefundedBy =
  | { kind: "none" }
  | { kind: "before-we-kept-it" }
  | { kind: "named"; name: string; at: string | null };

/** The order as the desk sends it (select=*), narrowed to what we read. */
export type OrderLike = {
  refunded?: boolean | null;
  refunded_by_id?: string | null;
  refunded_by_name?: string | null;
  refunded_at?: string | null;
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function whoRecordedTheRefund(order: OrderLike | null | undefined): RefundedBy {
  if (!order || order.refunded !== true) return { kind: "none" };

  // THE NAME IS PREFERRED, THE ID IS THE FALLBACK, AND THAT ORDER IS THE POINT.
  // The server freezes the name as it was on the day (migration 108) precisely
  // so a deleted account still reads as a person. If only the id survived - a
  // refund saved while the users table could not be read - the id is still a
  // real answer and far better than pretending nobody did it.
  const name = text(order.refunded_by_name);
  const id = text(order.refunded_by_id);
  if (!name && !id) return { kind: "before-we-kept-it" };

  return { kind: "named", name: name || id, at: text(order.refunded_at) || null };
}
