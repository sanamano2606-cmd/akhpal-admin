/**
 * ONE STORE'S OWN PAGE (Mock 188, Sana 14 Oct 2026: "the Page is too spreader
 * ... make it the most compacted").
 *
 * On a store's own page the Stores section's title, sentence and tabs are not
 * drawn - the page's own "‹ All stores / name" line does that job, and the
 * products start about 600 px higher. Kept here, not in the layout: a Next.js
 * layout file may only export its layout.
 */

/** The pages of the Stores section that are NOT one store's own page. */
const SECTION_PAGES = new Set(["catalogue", "commission", "inventory", "malls", "onboarding", "reliability"]);

export function isOneStorePage(path: string | null | undefined): boolean {
  const m = /^\/dashboard\/stores\/([^/?#]+)/.exec(path || "");
  return !!m && !SECTION_PAGES.has(m[1]);
}
