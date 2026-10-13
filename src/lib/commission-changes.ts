// ONE "SAVE CHANGES" THAT SAVES EVERYTHING YOU TYPED (Stores page fix 9,
// Sana 12 Oct 2026: "OK fix 9"; audit O13).
//
// WAS: on Stores → Commission you typed 10% as the default, Pharmacy 5% and
// Grocery 8%, then pressed the big "Save changes". Only the 10% was saved -
// each shop-type row had its own small Save, nobody pressed them, and nothing
// said the two rates were lost.
//
// NOW: the big button saves the default, the markup AND every shop-type row
// you changed; rows you did not touch are not sent. A changed row says "not
// saved yet" until it is saved. Every number is checked BEFORE anything is
// written, so a typo saves nothing rather than half of it.

/** What one row's box means: a rate, or blank = the global rate. */
export function rowPercent(raw: string | null | undefined):
  { ok: true; percent: number | null } | { ok: false } {
  const t = String(raw ?? "").trim();
  if (t === "") return { ok: true, percent: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false };
  return { ok: true, percent: n };
}

/** The same box, compared the way the server stores it ("8" = "8.0"). */
function sameRate(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = rowPercent(a), y = rowPercent(b);
  if (x.ok && y.ok) return x.percent === y.percent;
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/** The shop types whose box differs from what was read (or last saved). */
export function changedRows(typed: Record<string, string>, saved: Record<string, string>, keys: string[]): string[] {
  return keys.filter((k) => !sameRate(typed[k], saved[k]));
}

/** The same test for the two top boxes. */
export function sameNumber(a: string, b: string): boolean {
  return sameRate(a, b);
}

/** "Saved: default rate 10%, Pharmacy 5%, Grocery: global rate". */
export function savedWords(parts: string[]): string {
  return parts.length ? `Saved: ${parts.join(", ")}` : "Nothing was changed, so nothing was saved";
}

/** How a row reads in that sentence. */
export function rowWords(label: string, percent: number | null): string {
  return percent === null ? `${label}: global rate` : `${label} ${percent}%`;
}
