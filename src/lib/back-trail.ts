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

/** The trail after arriving at `path`: the same page = no change; the page
 *  before the last = she went BACK (drop the last); anything else = forward. */
export function nextTrail(trail: string[], path: string): string[] {
  if (!path) return trail;
  if (trail[trail.length - 1] === path) return trail;
  if (trail.length >= 2 && trail[trail.length - 2] === path) return trail.slice(0, -1);
  return [...trail, path].slice(-KEEP);
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
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(nextTrail(readTrail(), path)));
  } catch {
    /* blocked storage: the corner button falls back to the page's own list */
  }
}

/** What one tap does: scrolled down -> to the top; at the top -> back. */
export function cornerStep(scrollTop: number): "top" | "back" {
  return scrollTop > 40 ? "top" : "back";
}
