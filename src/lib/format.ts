// Shared formatting helpers so currency etc. is consistent everywhere.

/** Format a number as Pakistani Rupees, e.g. money(12744) -> "Rs 12,744".
 *
 * Whole rupees, grouped. This is the one used for amounts somebody acts on -
 * an order total, a payout, a balance - and rounding is deliberate: the figure
 * on the screen and the figure in the settlement have to be the same figure.
 */
export const money = (n: any) => "Rs " + Math.round(Number(n) || 0).toLocaleString();

/** The same, but keeping the decimals when there are any: moneyExact(12.5) ->
 *  "Rs 12.5", moneyExact(500) -> "Rs 500".
 *
 *  For a RATE or a SETTING, not for an amount. A per-kilometre rate of Rs 12.5
 *  rounded to "Rs 13/km" is not a rounded amount, it is a wrong setting - and
 *  the screen would be telling the operator something the server does not
 *  believe. Two decimals is the most the money columns hold.
 */
export const moneyExact = (n: any) => {
  const v = Number(n) || 0;
  const rounded = Math.round(v * 100) / 100;
  return "Rs " + rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/** Title-case a status word, e.g. "pending" -> "Pending". */
// Dates are always shown in Pakistan time so they match the apps and your day.
const PK_TZ = "Asia/Karachi";

/**
 * A-3: The backend stores timestamps in UTC but often sends them WITHOUT a
 * timezone marker (e.g. "2026-07-22T12:25:00" or "2026-07-22 12:25:00").
 * JavaScript parses such strings as LOCAL time, which shifted every displayed
 * time by ~5 hours in Asia/Karachi — the exact bug both mobile apps already
 * fixed. If a value has a time part but no timezone, we treat it as UTC by
 * normalizing to ISO and appending "Z". Values that already carry a timezone
 * (Z or +hh:mm), plain dates, and real Date objects pass through untouched.
 */
const parseServerDate = (d: any): Date => {
  if (d instanceof Date) return d;
  let s = String(d).trim();
  const hasTime = /\d{2}:\d{2}/.test(s);
  const hasTz = /([zZ])$|[+-]\d{2}:?\d{2}$/.test(s);
  if (hasTime && !hasTz) {
    s = s.replace(" ", "T") + "Z";
  }
  return new Date(s);
};

export const fmtDate = (d: any) => {
  if (!d) return "—";
  try {
    return parseServerDate(d).toLocaleDateString("en-GB", { timeZone: PK_TZ, day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

export const fmtDateTime = (d: any) => {
  if (!d) return "—";
  try {
    return parseServerDate(d).toLocaleString("en-GB", {
      timeZone: PK_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
};
