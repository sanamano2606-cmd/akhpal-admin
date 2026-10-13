// WHAT THE RELIABILITY PAGE SAYS WHEN ITS TABLE IS EMPTY (Stores page fix 10,
// Sana 12 Oct 2026: "OK fix 10"; audit O14).
//
// WAS: shops with too few orders are hidden by default, and when that hid
// every shop the page said "No shop has dropped an accepted order yet" - which
// reads as "every shop is reliable" when really NO shop could be judged.
// NOW: it says which of the two it is, with the server's own rules.

export function reliabilityEmptyWords(
  rows: number, hidden: number,
  rules?: { window_days?: number | null; min_orders_to_judge?: number | null } | null,
): { text: string; offerShowAll: boolean } {
  const days = rules?.window_days ?? null;
  const min = rules?.min_orders_to_judge ?? null;
  const inDays = days ? ` in the last ${days} days` : "";
  if (rows === 0) {
    return { text: `No orders${inDays} yet, so there is nothing to judge.`, offerShowAll: false };
  }
  if (hidden > 0) {
    const need = min ? ` A shop needs at least ${min} finished orders${inDays} before it can be judged.` : "";
    return { text: `No shop has enough orders to judge yet.${need}`, offerShowAll: true };
  }
  return { text: "No shop has dropped an accepted order.", offerShowAll: false };
}
