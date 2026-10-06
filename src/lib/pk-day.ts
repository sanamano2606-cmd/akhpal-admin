/**
 * The DAY a stored moment falls on in Pakistan, as "YYYY-MM-DD" - what a date
 * box shows.
 *
 * Admin audit low item 7 (Sana, 6 October 2026). A date typed into a banner or
 * a discount code is now kept as midnight-to-midnight PAKISTAN time, so "starts
 * 10 Oct" is stored as 19:00 on the 9th in London time. Cutting the first ten
 * letters off that would show the 9th - the day before - so the boxes read the
 * day in Pakistan instead. A plain "YYYY-MM-DD" (an older row) is shown as it is.
 */
const PK_OFFSET_MS = 5 * 60 * 60 * 1000;

export function pkDay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return text.slice(0, 10);
  return new Date(ms + PK_OFFSET_MS).toISOString().slice(0, 10);
}
