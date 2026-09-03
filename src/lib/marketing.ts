/**
 * Marketing, in the panel's words.
 *
 * The SERVER decides what a code gives, whether it is live, and what it has
 * cost (backend/core_marketing.py). This file does not re-decide any of that —
 * it holds the labels and colours the screens paint those answers with, plus
 * one thing the server cannot do: read the two banner colours and say whether
 * a customer will be able to read the words on top of them.
 *
 * WHY THE SERVER IS THE ONE THAT DECIDES.
 * The old screen worked out "Active" for itself, from `is_active` alone, and
 * was wrong about an expired code. Two places deciding the same thing is how
 * the panel ends up saying one thing and the customer app another.
 *
 * Written 2026-09-03 with the Marketing rebuild.
 */

import type { Tone } from "@/components/ui";

/** The five things a discount code can be, as the server reports them. */
export const PROMO_STATUS: Record<string, { label: string; tone: Tone }> = {
  live: { label: "Active", tone: "good" },
  // Deliberately NOT the same word as "Disabled". A code that ran out of time
  // and a code somebody switched off are different problems with different
  // answers, and both used to show as a green "Active".
  ended: { label: "Ended", tone: "warn" },
  used_up: { label: "Used up", tone: "warn" },
  scheduled: { label: "Starts later", tone: "busy" },
  off: { label: "Disabled", tone: "neutral" },
};

export function promoStatusLabel(status?: string): string {
  return PROMO_STATUS[status || "off"]?.label ?? "Disabled";
}

/** The four things a banner can be. Same shape, same reasons. */
export const BANNER_STATUS: Record<string, { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "good" },
  ended: { label: "Finished", tone: "warn" },
  scheduled: { label: "Starts later", tone: "busy" },
  off: { label: "Hidden", tone: "neutral" },
};

/** Where a banner can send somebody. Must match BANNER_ACTION_TYPES on the
 *  server and the CHECK constraint from migration 062 — a value this list
 *  offers and the database refuses is a save that fails for no visible reason. */
export const BANNER_DESTINATIONS = [
  { value: "promo", label: "A discount code", hint: "Opens the code, ready to use" },
  { value: "vertical", label: "A section", hint: "Food, grocery, fashion…" },
  { value: "shop", label: "One shop", hint: "Straight to that shop's page" },
  { value: "url", label: "A web page", hint: "Must start with https://" },
  { value: "none", label: "Nowhere", hint: "Tapping it does nothing" },
] as const;

/**
 * How light a colour is, 0 (black) to 1 (white).
 *
 * This is the sRGB relative-luminance formula from WCAG, not an average of the
 * three channels: the eye is far more sensitive to green than to blue, and an
 * average calls #0000FF and #00FF00 equally light when one of them is nearly
 * black to look at and the other is nearly white.
 */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  // All THREE channels go through channel(). The blue one was written without
  // it on the first pass, which made white come out roughly 19 instead of 1 —
  // so black-on-yellow was judged less readable than white-on-yellow, and the
  // banner preview would have put white text on Takal's own yellow. The test
  // for "black on #FFFF00" caught it.
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** The WCAG contrast ratio between two colours, 1 (identical) to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever can actually be read on this colour. */
export function readableInk(background: string): "#000000" | "#FFFFFF" {
  return contrast(background, "#000000") >= contrast(background, "#FFFFFF")
    ? "#000000"
    : "#FFFFFF";
}

/**
 * What is wrong with this banner's two colours, in one sentence, or "".
 *
 * WARNS, NEVER REFUSES. These are Sana's colours and her choice. Two of the
 * four live banners have a fade nobody can see (#1e00ff → #001eff is the same
 * blue twice) and that is worth saying once, on the screen, before saving —
 * not worth blocking a save over.
 */
export function colourWarning(color1: string, color2: string): string {
  const c1 = (color1 || "").trim();
  const c2 = (color2 || "").trim();
  if (!/^#?[0-9a-f]{6}$/i.test(c1) || !/^#?[0-9a-f]{6}$/i.test(c2)) return "";

  // 1.2 is roughly the point below which a fade stops reading as a fade. Two
  // identical colours are exactly 1.0.
  if (contrast(c1, c2) < 1.2) {
    return "These two colours are almost the same, so the fade will not be visible.";
  }

  // The words sit on top of BOTH colours as the fade crosses the card, so the
  // worse of the two is the one that decides whether they can be read. 3.0 is
  // the WCAG floor for large text.
  const ink = readableInk(c1);
  const worst = Math.min(contrast(c1, ink), contrast(c2, ink));
  if (worst < 3) {
    return "The title will be hard to read against these colours.";
  }
  return "";
}

/** "1,204 shown · 86 tapped (7%)" — or a plain sentence when nobody has seen
 *  it yet. A brand new banner has no tap rate, and printing "0%" beside one
 *  reads as "this banner failed". */
export function bannerReach(shown?: number | null, tapped?: number | null): string {
  const s = Number(shown || 0);
  const t = Number(tapped || 0);
  if (s <= 0) return "Not shown yet";
  return `${s.toLocaleString()} shown · ${t.toLocaleString()} tapped (${Math.round((t / s) * 100)}%)`;
}
