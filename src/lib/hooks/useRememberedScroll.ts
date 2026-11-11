"use client";

/**
 * BACK REMEMBERS WHERE YOU WERE (page reload audit, Fix C, 10 Nov 2026).
 *
 * Sana: "the page get refreshed all and i need to scroll down again and again".
 *
 * The panel does not scroll the browser window. Everything scrolls inside ONE
 * box, the <main> of app/dashboard/layout.tsx. The browser only remembers how
 * far down the WINDOW was, so its own Back never brought her back to her place:
 * Stores list at shop 40 -> open the shop -> Back -> the top of the list.
 *
 * What this does:
 *  - while she scrolls, it keeps how far down that box is, one number per
 *    address (path AND the ?search part, so "Live" and "Hidden" are separate);
 *  - when she presses Back or Forward, it puts the box back to that number as
 *    soon as the page is tall enough to go there (the list may still be
 *    reading from the server), for up to RESTORE_FOR_MS;
 *  - the moment SHE scrolls, clicks or types, it stops trying - it never
 *    fights her;
 *  - an ordinary click on a menu link opens the page at the top, as before.
 *
 * It asks the server nothing. The numbers live only in this browser tab
 * (sessionStorage), and a browser that refuses storage still works - it just
 * forgets on reload.
 */

import { useEffect } from "react";

export const RESTORE_FOR_MS = 6000;
const KEY = "takal.scroll.";
const memory = new Map<string, number>();

/** The address a place belongs to: the path and the ?search part. */
export function placeKey(loc: { pathname: string; search: string }): string {
  return `${loc.pathname}${loc.search || ""}`;
}

export function rememberPlace(key: string, top: number) {
  const y = Math.max(0, Math.round(top));
  memory.set(key, y);
  try { sessionStorage.setItem(KEY + key, String(y)); } catch { /* storage refused - memory still works */ }
}

export function placeFor(key: string): number | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const v = sessionStorage.getItem(KEY + key);
    if (v != null && /^\d+$/.test(v)) return Number(v);
  } catch { /* storage refused */ }
  return null;
}

/** The box the panel scrolls in. */
export function panelScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector("main[data-panel-scroller]") || document.querySelector("main");
}

/** Scroll the PANEL (not the window) to the top - for "Edit" buttons whose
 *  form sits at the top of the page. window.scrollTo did nothing at all,
 *  because the window never scrolls: the form opened out of sight. */
export function scrollPanelToTop() {
  const box = panelScroller();
  if (box) box.scrollTo({ top: 0, behavior: "smooth" });
  else if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

/** `el` is the <main> box itself (given through a callback ref, so this also
 *  works when the box is drawn only after the sign-in check). */
export function useRememberedScroll(el: HTMLElement | null) {
  // 1. Keep the place while she scrolls (one write per frame at most).
  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        rememberPlace(placeKey(window.location), el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [el]);

  // 2. Back / Forward: put the place back once the page is tall enough.
  useEffect(() => {
    let stop: (() => void) | null = null;
    if (!el) return;
    const onPop = () => {
      if (stop) stop();
      const key = placeKey(window.location);
      const want = placeFor(key);
      if (want == null || want <= 0) return;
      const started = Date.now();
      let timer = 0;
      // Right after Back, the OLD page can still be in the box for a moment
      // (or the new one is drawn before this runs). So the place is put back
      // as soon as the box is tall enough, and put back AGAIN each time the
      // page is redrawn (the list arriving, then its checklists...) - until
      // she touches anything, or RESTORE_FOR_MS runs out.
      let redrawn = true;
      const watch = new MutationObserver(() => { redrawn = true; });
      watch.observe(el, { childList: true, subtree: true });
      const giveUp = () => {
        watch.disconnect();
        window.clearInterval(timer);
        ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) => el.removeEventListener(t, giveUp));
        stop = null;
      };
      ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) => el.addEventListener(t, giveUp, { passive: true }));
      const tryNow = () => {
        // She went somewhere else meanwhile - this place is not hers any more.
        if (placeKey(window.location) !== key) return giveUp();
        if (Date.now() - started > RESTORE_FOR_MS) return giveUp();
        if (redrawn && el.scrollTop !== want && el.scrollHeight - el.clientHeight >= want) {
          el.scrollTop = want;
          redrawn = false;
        }
      };
      timer = window.setInterval(tryNow, 100);
      stop = giveUp;
      tryNow();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (stop) stop();
    };
  }, [el]);
}
