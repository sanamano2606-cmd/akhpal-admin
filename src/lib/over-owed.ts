/**
 * PAYING MORE THAN IS OWED ASKS FIRST.
 *
 * Admin audit, low item 2 (Sana, 6 October 2026: "OK"). Every "record a
 * payment" window - a shop, a rider, staff, and cash handed in - used to save
 * any amount without a word. A typing slip (30000 for 3000) became a real
 * payment line in the books.
 *
 * It is a WARNING, not a wall: there are honest reasons to pay ahead. The
 * first press shows the sentence below; the second press saves it.
 * Kept in a .ts file so plain Node can test it.
 */

export type OverOwedKind = "owed" | "held";

/** The sentence to show, or "" when the amount is not more than owed. */
export function overOwedSentence(
  amount: number,
  owed: number,
  money: (n: number) => string,
  who: string,
  kind: OverOwedKind = "owed",
): string {
  const a = Math.round(Number(amount));
  const o = Math.max(0, Math.round(Number(owed) || 0));
  if (!Number.isFinite(a) || a <= 0 || a <= o) return "";
  const name = (who || "").trim() || (kind === "held" ? "This person" : "this person");
  if (kind === "held") {
    return o === 0
      ? `${name} is not holding any of Takal's cash right now, but you typed ${money(a)}. `
        + `Press again to record it anyway.`
      : `${money(a)} is ${money(a - o)} more than ${name} is holding (${money(o)}). `
        + `Press again to record it anyway.`;
  }
  return o === 0
    ? `Nothing is owed to ${name} right now, but you typed ${money(a)}. `
      + `Press again to record it anyway.`
    : `${money(a)} is ${money(a - o)} more than ${name} is owed (${money(o)}). `
      + `Press again to record it anyway.`;
}
