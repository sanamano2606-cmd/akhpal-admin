/**
 * A SHOP'S TRADING HOURS IN WORDS.
 *
 * Moved here from the admin store page on 1 October 2026 (Mock 133) so the
 * Mall staff Shop panel says the hours exactly the same way. A Next.js page
 * file may not export anything but the page, so the shared copy lives here.
 */

/** "15:30" -> "3:30 PM". Anything that is not a time is given back as it is. */
export function clock(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  if (!m) return String(t || "");
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** The trading hours in words. A closing time at or before the opening time
 *  is the next day - the server already reads it that way
 *  (core_catalog._within_hours); this only says so. Audit SM13. */
export function hoursInWords(open?: string | null, close?: string | null): string {
  if (!open || !close) return "";
  const o = String(open).slice(0, 5);
  const c = String(close).slice(0, 5);
  if (o === c) return "Open all day";
  return `Opens ${clock(o)} – ${clock(c)}${c < o ? " (next day)" : ""}`;
}
