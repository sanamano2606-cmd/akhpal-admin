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

/* ── What an order is CALLED ────────────────────────────────────────────────
 *
 * Until 20 September 2026 an order was known by the first eight characters of
 * its database id - `#E407DF50`. Eight letters AND digits is fine for a
 * computer and useless for a person: nobody can read it down a bad line,
 * nobody copies it onto the back of a hand without getting one wrong, and the
 * office then types it into the search box and finds nothing.
 *
 * Migration 090 gave every order a plain counting number starting at 10001, so
 * the same order is now `#10001`. These two helpers are the ONLY place that
 * decides how it looks, so changing the look later is one edit and not
 * twenty-eight.
 *
 * THE FALLBACK IS THE POINT. If the panel is open for even a second against a
 * server that has not been deployed yet, `order_no` is missing. Without the
 * fallback every row would read `#undefined`. With it the worst case is the
 * old eight characters - exactly what the screen showed yesterday.
 */

/** The number alone, as a string, or null when the order has not got one. */
export const orderNo = (order: any): string | null => {
  const n = order && typeof order === "object"
    ? (order.order_no ?? order.orderNo)
    : null;
  if (n === null || n === undefined || String(n).trim() === "") return null;
  return String(n);
};

/** What to print INSIDE the `#`. The number when there is one, otherwise the
 *  first eight characters of the id, exactly as this screen showed before.
 *
 *  `order` may be the whole order OR a bare id, so a screen that only has the
 *  id in scope can still call it. `fallbackId` is for a row that carries the
 *  order's id under another name (`order_id` on a review or a support thread).
 */
export const orderCode = (order: any, fallbackId?: any): string => {
  const n = orderNo(order);
  if (n) return n;
  const id = order && typeof order === "object"
    ? (order.id ?? order.order_id ?? fallbackId)
    : (order ?? fallbackId);
  return String(id ?? "").slice(0, 8);
};

/** The same with the `#` in front: `#10001`, or `#e407df50` on an old server. */
export const orderLabel = (order: any, fallbackId?: any): string =>
  "#" + orderCode(order, fallbackId);
