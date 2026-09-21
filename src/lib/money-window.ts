// ─────────────────────────────────────────────────────────────────────────────
// WHICH STRETCH OF TIME THE MONEY SCREENS ARE LOOKING AT.
//
// Mock 102, approved by Sana on 21 September 2026.
//
// The Balances & Payments screen had two separate ideas of "the period" living
// side by side - a rolling number of days, and an index into the pay periods -
// and every place that needed to know which one was chosen had to ask both.
// Adding months as a third would have made that three. So all three are one
// value now, and this file is the only place that knows how to read it.
//
// THE TWO SHAPES
//   { kind: "days",  days }              a rolling window: last 7 / 30 / 90 / all
//   { kind: "dates", label, from, to }   a real stretch with a first and a last
//                                        day: a pay period, or a month
//
// WHY MONTHS WERE ADDED (Sana, 21 September 2026: "when chose month so it must
// show month or a period"). "Last 30 days" is not September. It moves every
// day, so two people opening the same screen on different days see different
// money and neither is wrong. A month has a first day and a last day, and it is
// what shops are actually paid on.
//
// EVERYTHING HERE IS IN PAKISTAN TIME. A browser in another timezone must not
// decide that September started on the 31st of August. The dates the server is
// given are plain YYYY-MM-DD, which is what /admin/settlements/stores expects.
// ─────────────────────────────────────────────────────────────────────────────

/** A stretch of time one of the money screens can be looking at. */
export type MoneyWindow =
  | { kind: "days"; days: number | "all" }
  | { kind: "dates"; label: string; from: string; to: string };

/** A pay period as the server hands it over. */
export type PayPeriod = { label?: string; from: string; to: string };

const PK_TZ = "Asia/Karachi";

/** Today in Pakistan, as {y, m, d} - never the browser's own idea of today. */
function pkToday(now: Date = new Date()): { y: number; m: number; d: number } {
  // en-CA gives YYYY-MM-DD, which needs no month-name table and no parsing of
  // an American ordering.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: PK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The last day of a month, worked out rather than looked up (February). */
function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/**
 * This month and last month, in Pakistan time, newest first.
 *
 * The label carries the month's NAME ("September 2026") rather than only
 * "This month", so that a screenshot of a pay run still says which month it
 * was once the month has turned over.
 */
export function monthWindows(now: Date = new Date()): MoneyWindow[] {
  const { y, m } = pkToday(now);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return [
    {
      kind: "dates",
      label: `This month — ${MONTH_NAMES[m - 1]} ${y}`,
      from: dayOf(y, m, 1),
      to: dayOf(y, m, lastDay(y, m)),
    },
    {
      kind: "dates",
      label: `Last month — ${MONTH_NAMES[prevM - 1]} ${prevY}`,
      from: dayOf(prevY, prevM, 1),
      to: dayOf(prevY, prevM, lastDay(prevY, prevM)),
    },
  ];
}

// ─── The one value the dropdown carries ──────────────────────────────────────
//
// A <select> can only hold a string, so the chosen window travels as one:
//   "d:30" "d:all"   a rolling window
//   "pp:1"           pay period number 1, as the server listed them
//   "m:0"            month number 0 (this month)
//
// Parsing is deliberately forgiving in one direction only: anything it does not
// recognise comes back as the 30-day window, which is what the screen opened on
// before any of this existed. A screen that cannot read its own dropdown must
// still show real figures, not a blank.

export const DEFAULT_WINDOW_VALUE = "d:30";

export function parseWindow(
  value: string,
  payPeriods: PayPeriod[],
  months: MoneyWindow[],
): MoneyWindow {
  if (value.startsWith("d:")) {
    const rest = value.slice(2);
    if (rest === "all") return { kind: "days", days: "all" };
    const n = Number(rest);
    if (Number.isFinite(n) && n > 0) return { kind: "days", days: n };
  }
  if (value.startsWith("pp:")) {
    const p = payPeriods[Number(value.slice(3))];
    if (p) {
      return { kind: "dates", label: p.label || `${p.from} to ${p.to}`,
               from: p.from, to: p.to };
    }
  }
  if (value.startsWith("m:")) {
    const mo = months[Number(value.slice(2))];
    if (mo) return mo;
  }
  return { kind: "days", days: 30 };
}

/**
 * The number of days to send to an endpoint that only understands "last N
 * days", or undefined for "do not filter".
 *
 * A dated window returns undefined on purpose: those endpoints are asked with
 * from/to instead, and handing them a day count as well would quietly filter
 * twice.
 */
export function daysParam(w: MoneyWindow): number | undefined {
  if (w.kind !== "days") return undefined;
  return w.days === "all" ? undefined : w.days;
}

/** Plain words for the strip under the dropdown. */
export function windowLabel(w: MoneyWindow): string {
  if (w.kind === "dates") return `${w.label} (${w.from} to ${w.to})`;
  return w.days === "all" ? "All time" : `the last ${w.days} days`;
}

/** Do two dated windows cover exactly the same days? */
export function sameDates(a: MoneyWindow, b: PayPeriod | MoneyWindow): boolean {
  if (a.kind !== "dates") return false;
  const bf = (b as any).from, bt = (b as any).to;
  return a.from === bf && a.to === bt;
}
