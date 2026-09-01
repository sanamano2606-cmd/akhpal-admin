// How money is WORDED comes from the one shared place, lib/format.ts, so this
// page can never word an amount differently from the rest of the panel. Only
// the two overpaid-specific helpers live here.
import { money } from "@/lib/format";

export { money };

/** A negative balance means we have OVERPAID, which "Rs -50" does not say
 *  clearly. Show the size of the amount and label the direction instead. */
export const signed = (n: any) => {
  const v = Number(n) || 0;
  return v < 0 ? money(Math.abs(v)) + " overpaid" : money(v);
};

export const signedTone = (n: any, positive: string) =>
  (Number(n) || 0) < 0 ? "text-sky-700" : positive;
