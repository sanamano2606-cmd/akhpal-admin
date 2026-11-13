// ─────────────────────────────────────────────────────────────────────────────
// FIX 12 (All Stores audit; Sana 12 Nov 2026: "GO Fix 12")
// THE PRODUCT EDITOR SAYS "HIDDEN BY TAKAL" AND WHY.
//
// The products LIST had a "Hidden by Takal" tag, but the editor window said
// nothing: "Available for customers" was simply unticked. Ticking it and
// pressing Save "worked" - and the database lock (migration 152) quietly kept
// the product OFF. Now the editor shows the reason at the top, greys the tick
// out, and the Main Admin can press Show again right there.
//
// Two kinds of hide (backend product_checks.py):
//   ordinary (picture / words / no picture / price 0) - comes back BY ITSELF
//       within an hour once the reason is fixed and saved;
//   LOCKED (legal check, or "Hide and lock" by an admin) - only the Main
//       Admin's Show again opens it.
// ─────────────────────────────────────────────────────────────────────────────

import { reasonTags, type TakalHiddenProduct } from "./takal-hidden.ts";

export interface EditorTakalHide {
  at: string;
  reason: string;
  kind: "legal" | "admin" | null;
  word: string;
  locked: boolean;
}

/** The hide written on a product row (list row or the fresh read), or null. */
export function takalHideOf(row: unknown): EditorTakalHide | null {
  const r = (row || {}) as Record<string, unknown>;
  const at = typeof r.takal_hidden_at === "string" ? r.takal_hidden_at : "";
  if (!at) return null;
  const kind = r.takal_hidden_kind === "legal" || r.takal_hidden_kind === "admin" ? r.takal_hidden_kind : null;
  return {
    at,
    reason: typeof r.takal_hidden_reason === "string" ? r.takal_hidden_reason : "",
    kind,
    word: typeof r.takal_hidden_word === "string" ? r.takal_hidden_word : "",
    locked: kind !== null,
  };
}

/** The bold first line: "🔒 Hidden by Takal - No picture". */
export function takalHideTitle(h: EditorTakalHide): string {
  if (h.kind === "legal") return `⚖️ Hidden and locked by Takal's legal check${h.word ? ` - word "${h.word}"` : ""}`;
  if (h.kind === "admin") return "👤 Hidden and locked by an admin";
  return `🔒 Hidden by Takal - ${reasonTags(h.reason, null).join(", ")}`;
}

/** What happens next, in plain words. */
export function takalHideNext(h: EditorTakalHide): string {
  return h.locked
    ? "It stays off even after changes. Only the Main Admin's Show again opens it."
    : "Fix the reason and save: the Takal Assistant checks it again within an hour and switches it back on.";
}

/** Under the greyed-out "Available for customers" tick. */
export const TAKAL_HIDE_SWITCH_WORDS = "Takal keeps this off until it is shown again.";

/** The same shape the Hidden by Takal list uses, for its Show again question. */
export function asHiddenProduct(id: string, name: string, h: EditorTakalHide): TakalHiddenProduct {
  return {
    id, restaurant_id: "", name, takal_hidden_at: h.at, takal_hidden_reason: h.reason,
    takal_hidden_kind: h.kind, takal_hidden_word: h.word,
  };
}

/** After Show again the product's "available" changed ON THE SERVER, not in a
 *  box - so the "Leave without saving?" picture (Fix 8) is moved with it. */
export function shotWithBox(shot: string | null, key: string, value: unknown): string | null {
  if (shot === null) return null;
  try {
    const rows = JSON.parse(shot) as [string, unknown][];
    return JSON.stringify(rows.map(([k, v]) => (k === key ? [k, value] : [k, v])));
  } catch {
    return shot; // not a picture this file made - leave it as it was
  }
}
