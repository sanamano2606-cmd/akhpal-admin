// ─────────────────────────────────────────────────────────────────────────────
// MOCK 243 (Sana 11 Nov 2026: "Approved But tapping this should first Take a
// scrolled page to top then tap again the previous page the the previous").
//
// The pages Sana opened in THIS browser tab, in order, so the corner Back
// button knows whether there IS a previous panel page to go back to. Opened
// from a link or a new tab, there is not - the button then goes to the page's
// own list instead, exactly like the top Back.
// Kept in sessionStorage (this tab only, gone when the tab closes); every read
// and write is wrapped, so a browser that blocks it just loses the trail.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAIL_KEY = "takal_back_trail_v1";
const KEEP = 30;

/** The trail after arriving at `path`: the same page = no change; arriving by
 *  the browser's Back (or the corner button's) at the page before the last =
 *  drop the last; anything else - a menu or a link - is a new step forward.
 *  `byBack` matters: Stores -> Dashboard -> Stores from the left menu is three
 *  steps, not two (the first browser check counted it as a Back). */
export function nextTrail(trail: string[], path: string, byBack = false): string[] {
  if (!path) return trail;
  if (trail[trail.length - 1] === path) return trail;
  if (byBack && trail.length >= 2 && trail[trail.length - 2] === path) return trail.slice(0, -1);
  return [...trail, path].slice(-KEEP);
}

// The browser says "popstate" for Back and Forward (router.back() too) - just
// before the new page's address arrives. A menu click or a link does not.
let poppedAt = 0;
export function noteHistoryMove(): void { poppedAt = Date.now(); }
function arrivedByBack(): boolean { return Date.now() - poppedAt < 2000; }

/** The trail as it is once this page counts. */
export function trailWith(path: string): string[] {
  return nextTrail(readTrail(), path, arrivedByBack());
}

/** True when the browser's Back lands on a panel page of this tab. */
export function hasPreviousPage(trail: string[]): boolean {
  return trail.length >= 2;
}

export function readTrail(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(TRAIL_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberPage(path: string): void {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trailWith(path)));
  } catch {
    /* blocked storage: the corner button falls back to the page's own list */
  }
}

/** What one tap does: scrolled down -> to the top; at the top -> back. */
export function cornerStep(scrollTop: number): "top" | "back" {
  return scrollTop > 40 ? "top" : "back";
}
