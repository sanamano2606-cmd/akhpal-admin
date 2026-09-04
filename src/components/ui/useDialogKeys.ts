"use client";

/**
 * ESCAPE, AND A PAGE THAT STOPS SCROLLING UNDERNEATH.
 *
 * The shared Modal does both. Seven windows in this panel are hand-built and
 * did neither: Escape did nothing, and the page carried on scrolling behind
 * them, so on a phone a flick of the thumb moved the page under the window and
 * left the person looking at a box floating over the wrong row.
 *
 * Rewriting all seven onto the shared Modal is a bigger change than it looks -
 * each has its own footer and its own shape - so this hook gives them the two
 * behaviours people actually notice, in one line each, today.
 *
 *   useDialogKeys(open, onClose, busy)
 *
 * `busy` is for a window part-way through recording something: Escape is
 * ignored while it is true, exactly as `lockClose` works on the shared Modal.
 */

import { useEffect } from "react";

export function useDialogKeys(open: boolean, onClose: () => void, busy = false) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, busy]);
}
