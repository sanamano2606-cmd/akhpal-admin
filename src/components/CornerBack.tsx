"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 243 - THE SECOND BACK BUTTON (Sana 11 Nov 2026: "Please also Add a
// second Back button too all over the Pages those opens" -> A, the corner
// button -> "Approved But tapping this should first Take a scrolled page to
// top then tap again the previous page the the previous" -> "Go").
//
// A yellow button in the bottom-left corner of the 7 pages that open from a
// list. One tap = one step:
//   scrolled down  "↑ Top"   -> the page glides to the top (stays on the page)
//   at the top     "‹ Back"  -> the page before, like the browser's Back -
//                               tap again on that page for the one before it
// No page before in this tab (opened from a link): the page's own list, the
// same place its top Back goes. `leave` lets a page ask "leave without
// saving?" first (one shop's page). Drawn on <body> so nothing on the page
// cuts it off; it lifts above a bar fixed at the bottom of the screen (the
// ticked-products bar, the Review page's phone bar) so it never covers one.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cornerStep, hasPreviousPage, readTrail } from "@/lib/back-trail";

// The Review page's black bar is only on small screens (lg:hidden), so that
// lift only applies under 1024 px. AND room under the page's last line, so
// at the very end the button sits on empty space - it covered "1 - 40 of 40"
// in the first real-browser check (11 Nov 2026).
const LIFT_CSS =
  "body:has([data-corner-back]) [data-panel-scroller]{padding-bottom:84px}" +
  "body:has([aria-label=\"Change the ticked products\"]) [data-corner-back]{bottom:84px!important}" +
  "@media (max-width:1023px){body:has(.fixed.inset-x-0.bottom-0) [data-corner-back]{bottom:84px!important}}";

export function CornerBack({ fallback, leave }: {
  /** Where to go when there is no page before (the top Back's place). */
  fallback: () => void;
  /** Optional "leave without saving?" check around going back. */
  leave?: (go: () => void) => void;
}) {
  const router = useRouter();
  const [spot, setSpot] = useState<{ left: number; step: "top" | "back" } | null>(null);

  useEffect(() => {
    const box = document.querySelector<HTMLElement>("[data-panel-scroller]");
    const check = () => {
      const left = box ? box.getBoundingClientRect().left + 24 : 24;
      setSpot({ left, step: cornerStep(box ? box.scrollTop : window.scrollY) });
    };
    check();
    (box || window).addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      (box || window).removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  if (!spot || typeof document === "undefined") return null;

  const tap = () => {
    const box = document.querySelector<HTMLElement>("[data-panel-scroller]");
    if (spot.step === "top") {
      (box || window).scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const go = () => (hasPreviousPage(readTrail()) ? router.back() : fallback());
    if (leave) leave(go); else go();
  };

  return createPortal(
    <>
      <style>{LIFT_CSS}</style>
      <button type="button" data-corner-back={spot.step} onClick={tap}
        title={spot.step === "top" ? "To the top of this page" : "Back to the page before"}
        style={{ position: "fixed", left: spot.left, bottom: 20 }}
        className="z-40 inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-takal-ink bg-takal-yellow pl-3 pr-4 text-sm font-bold text-takal-ink shadow-[0_3px_0_#111] transition hover:bg-takal-ink hover:text-takal-yellow">
        <span className="text-lg leading-none" aria-hidden="true">{spot.step === "top" ? "↑" : "‹"}</span>
        {spot.step === "top" ? "Top" : "Back"}
      </button>
    </>,
    document.body,
  );
}
