"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 243 - THE CORNER BACK BUTTON (Sana 11 Nov 2026: "Please also Add a
// second Back button too all over the Pages those opens" -> A, the corner
// button -> "Approved But tapping this should first Take a scrolled page to
// top then tap again the previous page the the previous" -> "Go"; then, after
// the deploy, "not applied to all screens" -> "go": EVERY panel screen).
//
// ONE yellow button for the whole panel, drawn once by dashboard/layout.tsx
// (CornerBackButton). One tap = one step:
//   scrolled down  "↑ Top"   -> the page glides to the top (stays on the page)
//   at the top     "‹ Back"  -> the page before, like the browser's Back -
//                               tap again there for the one before it
//   at the top with no page before (the first page opened in this tab, on a
//   page with no list of its own to go to) -> the button hides itself.
//
// The 7 pages that open from a list add <CornerBack fallback leave /> - it
// draws nothing; it tells the one button where to go when there is no page
// before (the same place as the page's top Back) and, on one shop's page, to
// ask "leave without saving?" first.
//
// Drawn on <body> so nothing on the page cuts it off; it lifts above a bar
// fixed at the bottom of the screen (the ticked-products bar, the Review
// page's phone bar) and gives the page room under its last line.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { cornerStep, hasPreviousPage, readTrail, trailWith } from "@/lib/back-trail";

type PageRules = {
  /** Where to go when there is no page before (the top Back's place). */
  fallback: () => void;
  /** Optional "leave without saving?" check around going back. */
  leave?: (go: () => void) => void;
};

// The rules of the page on screen now (one page at a time).
let pageRules: PageRules | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

/** On a page that opens from a list: where Back goes with no page before. */
export function CornerBack(props: PageRules) {
  const latest = useRef(props);
  latest.current = props;
  const withLeave = !!props.leave;
  useEffect(() => {
    const mine: PageRules = {
      fallback: () => latest.current.fallback(),
      leave: withLeave ? (go) => (latest.current.leave ? latest.current.leave(go) : go()) : undefined,
    };
    pageRules = mine;
    changed();
    return () => {
      if (pageRules === mine) { pageRules = null; changed(); }
    };
  }, [withLeave]);
  return null;
}

// The Review page's black bar is only on small screens (lg:hidden), so that
// lift only applies under 1024 px. AND room under the page's last line, so
// at the very end the button sits on empty space - it covered "1 - 40 of 40"
// in the first real-browser check (11 Nov 2026).
// The room is there ALL the time (not only while the button shows): added when
// the button appeared, it came too late - the end of All Stores was already
// on screen and the last shop sat under the button (browser check, 11 Nov).
// NOT padding on the scroller (14 Nov 2026, live check): padding there also
// lifted every bar pinned to the bottom of a page by 84 px - Commission's
// Save strip floated mid-page over a store type. The room is now an empty
// block after the page (data-corner-room in dashboard/layout.tsx).
// A bar pinned to the bottom marked data-lifts-corner (Photo check's
// "N selected" bar) lifts the button above it too.
const LIFT_CSS =
  "body:has([aria-label=\"Change the ticked products\"]) [data-corner-back]," +
  "body:has([data-lifts-corner]) [data-corner-back]{bottom:84px!important}" +
  "@media (max-width:1023px){body:has(.fixed.inset-x-0.bottom-0) [data-corner-back]{bottom:84px!important}}";

/** The one button, drawn by dashboard/layout.tsx on every screen. */
export function CornerBackButton() {
  const router = useRouter();
  const path = usePathname();
  const [spot, setSpot] = useState<{ left: number; step: "top" | "back"; canBack: boolean } | null>(null);

  useEffect(() => {
    const box = document.querySelector<HTMLElement>("[data-panel-scroller]");
    const check = () => {
      const left = box ? box.getBoundingClientRect().left + 24 : 24;
      // trailWith(path): this page counts even before the layout's own
      // rememberPage has run (a child's effects run first).
      const canBack = hasPreviousPage(trailWith(path)) || !!pageRules;
      setSpot({ left, step: cornerStep(box ? box.scrollTop : window.scrollY), canBack });
    };
    check();
    listeners.add(check);
    (box || window).addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      listeners.delete(check);
      (box || window).removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [path]);

  if (typeof document === "undefined") return null;
  const show = !!spot && !(spot.step === "back" && !spot.canBack);

  const tap = () => {
    if (!spot) return;
    const box = document.querySelector<HTMLElement>("[data-panel-scroller]");
    if (spot.step === "top") {
      (box || window).scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const rules = pageRules;
    const go = () => (hasPreviousPage(readTrail()) ? router.back() : rules ? rules.fallback() : undefined);
    if (rules?.leave) rules.leave(go); else go();
  };

  return createPortal(
    <>
      <style>{LIFT_CSS}</style>
      {show && spot && <button type="button" data-corner-back={spot.step} onClick={tap}
        title={spot.step === "top" ? "To the top of this page" : "Back to the page before"}
        style={{ position: "fixed", left: spot.left, bottom: 20 }}
        className="z-40 inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-takal-ink bg-takal-yellow pl-3 pr-4 text-sm font-bold text-takal-ink shadow-[0_3px_0_#111] transition hover:bg-takal-ink hover:text-takal-yellow">
        <span className="text-lg leading-none" aria-hidden="true">{spot.step === "top" ? "↑" : "‹"}</span>
        {spot.step === "top" ? "Top" : "Back"}
      </button>}
    </>,
    document.body,
  );
}
