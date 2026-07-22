// Shared formatting helpers so currency etc. is consistent everywhere.

/** Format a number as Pakistani Rupees, e.g. money(12744) -> "Rs 12,744". */
export const money = (n: any) => "Rs " + Math.round(Number(n) || 0).toLocaleString();

/** Title-case a status word, e.g. "pending" -> "Pending". */
export const titleCase = (s: any) => {
  const str = String(s || "");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
};

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
