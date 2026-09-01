"use client";

/**
 * The one button.
 *
 * The primary button's styling was typed out by hand in 36 different places,
 * and three of those wrote the yellow as a raw #FFFF00 with a different text
 * colour and a different hover. There was already a .btn-primary class in
 * globals.css saying exactly the right thing - nothing used it.
 *
 * A component, not a CSS class, because a class cannot stop you passing the
 * wrong text colour and cannot give you a loading state.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

// Exactly the four buttons in Takal_Brand_Kit/TAKAL_STYLE_GUIDE.md section 7,
// plus two quiet ones for actions inside a table row that the guide does not
// cover. Black text on yellow, per the brand kit - not slate, not grey.
const VARIANT: Record<Variant, string> = {
  // MAIN. Save · Approve · Record · Confirm. One of these visible at a time -
  // if everything is yellow, nothing is.
  primary:
    "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-bold border-2 border-takal-yellow",
  // SECOND. Cancel · Back. White with a YELLOW border, per the brand kit -
  // it used to be a grey border, which read as "disabled".
  secondary:
    "bg-white hover:bg-takal-yellow-soft text-takal-ink font-bold border-2 border-takal-yellow",
  // DANGER. Suspend · Delete · Reject. Always paired with a confirmation.
  danger:
    "bg-takal-red hover:brightness-110 text-white font-bold border-2 border-takal-red",
  // Not in the brand kit: no box at all, for a small action inside a row.
  ghost: "bg-transparent text-takal-ink-soft hover:bg-slate-100 border-2 border-transparent",
  // Not in the brand kit: a filled but quiet button, for a third-rank action.
  subtle: "bg-slate-100 hover:bg-slate-200 text-takal-ink border-2 border-transparent",
};

// The brand kit's button padding is 12px top/bottom and 24px left/right -
// that is "lg" here. "md" and "sm" are tighter, for buttons that live inside a
// table row where the full size would push the table off the screen.
const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks further clicks. Use it on anything that saves,
   *  pays or deletes - a second click on a slow connection is a second payment. */
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const isOff = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isOff}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center rounded-lg transition-all",
        // A visible focus ring, so the panel can be driven from the keyboard.
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-takal-ink",
        SIZE[size],
        VARIANT[variant],
        // The brand kit's own disabled pair, so a button that cannot be
        // pressed looks the same everywhere instead of being a faded copy.
        isOff
          ? "!bg-takal-disabled-bg !text-takal-disabled-text !border-takal-disabled-bg cursor-not-allowed"
          : "",
        className,
      ].join(" ")}
    >
      {loading ? (
        <span
          aria-hidden
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
