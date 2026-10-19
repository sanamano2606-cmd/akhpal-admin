// ─────────────────────────────────────────────────────────────────────────────
// "UNDO THIS UPLOAD" SURVIVES A PAGE RELOAD.  (Audit 202, A4, 19 Oct 2026.)
//
// WHAT WAS WRONG
// A whole-catalogue upload can be taken back for 60 minutes (the server's
// rule, catalogue_import.py UNDO_MINUTES). But the list of products it made
// was kept only in the page's memory - so a reload, a closed tab or a
// browser crash lost the Undo button, while the server would still have
// taken the upload back.
//
// NOW
// The ids are kept in this browser, under the store's id, with the time of
// the last save. A reload of the catalogue page offers "Undo this upload"
// again until the hour is up. They are cleared after an undo or once the
// hour has passed. Storage may be switched off or full (a private window):
// every read and write is wrapped, and the page works as before without it.
// ─────────────────────────────────────────────────────────────────────────────

/** The server's window, in minutes (catalogue_import.py UNDO_MINUTES). */
export const UNDO_MINUTES = 60;
export const UNDO_WINDOW_MS = UNDO_MINUTES * 60 * 1000;

/** What is kept for one store. `at` = when the last part was saved (ms). */
export type KeptUpload = { ids: string[]; at: number };

/** The small part of Storage this needs - so it can be tested without a browser. */
export type SmallStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function undoKey(shopId: string): string {
  return `takal_catalogue_undo_v1:${shopId}`;
}

/** This browser's storage, or null when there is none or it is blocked. */
export function browserStorage(): SmallStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Keep (or replace) a store's upload. Nothing kept = nothing to undo. */
export function keepUpload(store: SmallStorage | null, shopId: string, ids: string[], at = Date.now()): void {
  if (!store) return;
  try {
    if (!ids.length) { store.removeItem(undoKey(shopId)); return; }
    store.setItem(undoKey(shopId), JSON.stringify({ ids, at }));
  } catch {
    // Full or blocked: the Undo button on this page still works from memory.
  }
}

/** The store's upload, if it can still be taken back. An old or broken entry
 *  is cleared on the way. */
export function keptUpload(store: SmallStorage | null, shopId: string, now = Date.now()): KeptUpload | null {
  if (!store) return null;
  try {
    const raw = store.getItem(undoKey(shopId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    const ids = Array.isArray(v?.ids) ? v.ids.filter((x: unknown) => typeof x === "string" && x) : [];
    const at = Number(v?.at);
    if (!ids.length || !Number.isFinite(at) || now - at >= UNDO_WINDOW_MS || at > now + 60_000) {
      store.removeItem(undoKey(shopId));
      return null;
    }
    return { ids, at };
  } catch {
    try { store.removeItem(undoKey(shopId)); } catch { /* blocked */ }
    return null;
  }
}

/** Forget a store's upload - after it is undone, or when the hour is up. */
export function forgetUpload(store: SmallStorage | null, shopId: string): void {
  if (!store) return;
  try { store.removeItem(undoKey(shopId)); } catch { /* blocked */ }
}

/** Whole minutes left to undo, at least 1 while any time is left; 0 = over. */
export function minutesLeft(at: number, now = Date.now()): number {
  const ms = at + UNDO_WINDOW_MS - now;
  return ms <= 0 ? 0 : Math.max(1, Math.ceil(ms / 60_000));
}
