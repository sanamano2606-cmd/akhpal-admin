// REPORTED REVIEWS  (Mock 208-2, approved by Sana 26 October 2026)
//
// The small sums the Reported tab and its red number share. Apple asks for a
// report to be handled within 24 hours; the clock turns red after 20 so there
// is time left to act.

/** Sent by the Reported page after a decision, so the tab's red number is
 *  counted again at once. */
export const REPORTS_CHANGED = "takal:review-reports-changed";

/** The hour the clock turns red. */
export const LATE_AFTER_HOURS = 20;

/** Example: 19.9 -> false, 20 -> true, null -> false. */
export function isLate(hours?: number | null): boolean {
  return typeof hours === "number" && hours >= LATE_AFTER_HOURS;
}

/** How long a report has waited, in words.
 *  Examples: 0.2 -> "12 min ago", 3.4 -> "3 h ago", 30 -> "1 day 6 h ago",
 *  null -> "just now". */
export function waitingWords(hours?: number | null): string {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) return "just now";
  const mins = Math.round(hours * 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(hours);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return `${d} day${d === 1 ? "" : "s"}${rest ? ` ${rest} h` : ""} ago`;
}
