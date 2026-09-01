"use client";

/**
 * The one pop-up window.
 *
 * There were 17 hand-built windows in this panel with FOUR different
 * backgrounds - bg-black/50, bg-black/40, and a blurred slate one - so the same
 * action looked different depending which page you opened it from. Some closed
 * on Escape, most did not. Some closed when you clicked outside, most did not.
 *
 * One component fixes all of that at once, and adds the two things people
 * expect from a window and almost never got here: Escape closes it, and the
 * page behind it stops scrolling.
 */

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

const WIDTH = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  hint,
  size = "md",
  footer,
  children,
  /** Set for a window that must not be dismissed by accident - one that is
   *  part-way through recording a payment, for instance. */
  lockClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  hint?: ReactNode;
  size?: keyof typeof WIDTH;
  footer?: ReactNode;
  children: ReactNode;
  lockClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind scrolling under the window.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, lockClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => { if (!lockClose) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`bg-takal-card rounded-xl shadow-xl w-full ${WIDTH[size]} max-h-[90vh] flex flex-col`}
      >
        <div className="px-6 py-4 border-b border-takal-line flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-takal-ink">{title}</h2>
            {hint && <p className="text-xs text-takal-ink-soft mt-0.5">{hint}</p>}
          </div>
          {!lockClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-lg text-takal-disabled-text hover:bg-slate-100 hover:text-takal-ink transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-takal-line flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
