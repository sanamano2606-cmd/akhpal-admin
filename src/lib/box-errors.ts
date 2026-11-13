// ─────────────────────────────────────────────────────────────────────────────
// FIX 13 (All Stores audit; Sana 13 Nov 2026: "GO Fix 13")
// THE WRONG BOX TURNS RED.
//
// The product editor checks 15 things when Save is pressed, and every one used
// to be only a short pop-up that fades - nothing showed WHICH box was wrong.
// Now the box (or its section) is marked red with the reason under it, the
// window scrolls to it, and the red goes the moment that box is changed.
// ─────────────────────────────────────────────────────────────────────────────

/** A single box, or a whole section (sizes, extras, options, key details,
 *  a fixed-price store's buy / sell prices). */
export type BoxKey =
  | "name" | "price" | "discount" | "stock" | "prep" | "category" | "buying"
  | "sizes" | "extras" | "options" | "specs" | "prices";

export interface BoxError { key: BoxKey; words: string; was: string }

/** What a box held when the mistake was found, as text to compare later. */
export function boxValue(v: unknown): string {
  try { return JSON.stringify(v ?? null); } catch { return String(v); }
}

/** The mistake, remembering what the box held then. */
export function boxError(key: BoxKey, words: string, value: unknown): BoxError {
  return { key, words, was: boxValue(value) };
}

/** Is the red still right? It goes as soon as THAT box is changed. */
export function stillWrong(err: BoxError | null, valueNow: unknown): boolean {
  return err !== null && boxValue(valueNow) === err.was;
}

/** The red look for a box: a red edge and a soft red ring. */
export const RED_BOX = " !border-takal-red !ring-2 !ring-takal-red/40";

/** Where to put the cursor inside a marked box or section. */
export const FOCUSABLE = "input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])";
