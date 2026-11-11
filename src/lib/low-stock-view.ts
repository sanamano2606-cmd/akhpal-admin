/**
 * Low stock page: 50 rows at a time, and a "Store" choice (Stores visual audit,
 * 10 Nov 2026, finding A1).
 *
 * The page drew every row at once - 12,770 of them, 12,621 from one pharmacy -
 * and the browser froze for 30 seconds and more. Now it draws 50, like the
 * Orders page, and the Store choice lists each shop with its count, biggest
 * first. Example: "Health Mart Pharmacy (12,621)", "Wakeel ... Baby, Kids & Toys (24)".
 */

export const LOW_STOCK_PAGE_SIZE = 50;

export type StoreCount = { store: string; count: number };

/** Each shop once, with how many of its rows are low, biggest first. */
export function storeCounts(rows: { store: string }[]): StoreCount[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.store, (m.get(r.store) ?? 0) + 1);
  return [...m.entries()]
    .map(([store, count]) => ({ store, count }))
    .sort((a, b) => b.count - a.count || a.store.localeCompare(b.store));
}

/** The rows of one shop ("" = every shop). */
export function forStore<T extends { store: string }>(rows: T[], store: string): T[] {
  return store ? rows.filter((r) => r.store === store) : rows;
}

/** How many pages (at least 1). */
export function pageCount(total: number, size = LOW_STOCK_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** One page of rows; a page past the end gives the last page. */
export function pageOf<T>(rows: T[], page: number, size = LOW_STOCK_PAGE_SIZE): T[] {
  const last = pageCount(rows.length, size);
  const p = Math.min(Math.max(1, Math.floor(page) || 1), last);
  return rows.slice((p - 1) * size, p * size);
}

/** Whole numbers with commas: 12770 -> "12,770". */
export function count(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
