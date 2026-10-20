/**
 * SETTINGS > TIDY UP REMOVED PRODUCTS  (audit 204 fix 7, Mock 203 - APPROVED
 * by Sana 20 Oct 2026: "Do 7 Approved").
 *
 * Products a shop removed that are on NO order stay hidden for ever, with
 * their pictures in storage. On live: 219 old separate pizza sizes (joined
 * into one product on 5 Oct), 656 picture files. "Check first" changes
 * nothing; "Remove them for good" backs each one up first (server,
 * removed_products_backup) and then erases it with its pictures. A product on
 * any order is never touched. Main Admin only (server: app_guard "__super__").
 */

export type TidyCheck = {
  products: number;
  shops: number;
  first_removed: string | null;
  last_removed: string | null;
  files: number;
  on_orders_kept: number;
  per_press?: number;
};

export type TidyDone = {
  removed: number;
  files: number;
  kept_on_orders: number;
  left: number;
  message: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" -> "5 Oct 2026" (no clock, no time zone - the day as stored). */
export function dayWords(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "-";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "5 Aug - 5 Oct 2026", or one day when both are the same. */
export function removedBetween(c: Pick<TidyCheck, "first_removed" | "last_removed">): string {
  const a = dayWords(c.first_removed);
  const b = dayWords(c.last_removed);
  if (a === "-" && b === "-") return "-";
  if (a === b || b === "-") return a;
  const [ad, am, ay] = a.split(" ");
  const [, , by] = b.split(" ");
  return ay === by ? `${ad} ${am} - ${b}` : `${a} - ${b}`;
}

/** The lines of the "after Check first" list, exactly as Mock 203 shows them. */
export function checkLines(c: TidyCheck): [string, string][] {
  return [
    ["Removed products, on no order", c.products.toLocaleString("en-US")],
    ["Shops they belong to", c.shops.toLocaleString("en-US")],
    ["Removed between", removedBetween(c)],
    ["Picture files to remove (with small copies)", `up to ${c.files.toLocaleString("en-US")}`],
    ["Products on an order (kept)", "0 touched"],
  ];
}

/** Remove is only offered after a check that found something. */
export function mayRemove(c: TidyCheck | null): boolean {
  return !!c && c.products > 0;
}

export function confirmTitle(n: number): string {
  return `Remove ${n.toLocaleString("en-US")} product${n === 1 ? "" : "s"} for good?`;
}
