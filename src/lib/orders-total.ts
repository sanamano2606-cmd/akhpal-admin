/**
 * THE ORDERS TABLE'S TOTAL LEAVES OUT CANCELLED ORDERS.
 * Item 8 (Sana, 2 October 2026: "GO 8").
 *
 * The bold row under All Orders added up EVERY order shown, cancelled ones
 * included, while "Takal keeps" beside it counts delivered orders only. Ten
 * orders of Rs 1,000 with two cancelled said Rs 10,000 - but only Rs 8,000 of
 * real orders exist. Cancelled and rejected (the shop turned it down) orders
 * are now left out, and the row says how many.
 *
 * Each row's own amount is untouched. Refunds stay in their own column.
 *
 * No imports on purpose: the panel's tests run on plain Node and read this
 * file directly (tests/orders-total.test.ts).
 */
export const NOT_COUNTED = ["cancelled", "rejected"];

export type OrdersTotal = { sum: number; skipped: number };

export function ordersTotal(
  orders: { status?: string | null; total_amount?: unknown }[],
): OrdersTotal {
  let sum = 0;
  let skipped = 0;
  for (const o of orders) {
    const st = String(o?.status || "").trim().toLowerCase();
    if (NOT_COUNTED.includes(st)) {
      skipped += 1;
      continue;
    }
    sum += Number(o?.total_amount) || 0;
  }
  return { sum, skipped };
}
