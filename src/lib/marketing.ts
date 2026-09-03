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

/* ───────────────────────────────────────────────────────────────────────────
   THE TAG CARD — the banner as a photograph with a coloured bar underneath.

   Sana, 3 September 2026: "Make the colour of writing and bar editable from
   Admin panel", and "Use light bright colours for Bars NOT That Dark".

   The bar colour is not decoration. The photograph FADES INTO it, which is
   what stops the card looking like two pieces stuck together. So the colour
   has to come out of the picture, or be chosen to sit near it.
   ─────────────────────────────────────────────────────────────────────────── */

/** The three tag shapes, matching TAG_STYLES on the server and the CHECK from
 *  migration 064. A value offered here and refused by the database would be a
 *  save that fails for no visible reason. */
export const TAG_STYLES = [
  { value: "notch", label: "Notch tag", hint: "A bite out of each side — says 'offer'" },
  { value: "clean", label: "Clean", hint: "No tag shape, just the card" },
  { value: "swing", label: "Swing tag", hint: "Cut corner and a punched hole" },
] as const;

/** The bright set. Every one is light enough to take black writing, and no two
 *  of them are close enough to be mistaken for each other on a phone. */
export const BAR_PRESETS = [
  { hex: "#FFE566", name: "Lemon" },
  { hex: "#9FE6C4", name: "Mint" },
  { hex: "#A5D8FF", name: "Sky" },
  { hex: "#FFB3A7", name: "Coral" },
  { hex: "#C9B8FF", name: "Lilac" },
  { hex: "#E8D1AF", name: "Sand" },
  { hex: "#FFC9DE", name: "Blush" },
  { hex: "#D8F09A", name: "Lime" },
] as const;

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Black or white on this colour — the SAME rule as ink_for() on the server.
 *  A test pins the two together; if they ever disagreed, a banner could look
 *  readable in this preview and be unreadable on a phone. */
export function inkFor(background?: string | null): "#000000" | "#FFFFFF" {
  if (!background || !HEX.test(background)) return "#000000";
  return readableInk(background);
}

/** What is wrong with this pair of colours, in one sentence, or "".
 *  WARNS, NEVER REFUSES — these are Sana's colours. */
export function textWarning(bar?: string | null, text?: string | null): string {
  if (!bar || !HEX.test(bar)) return "";
  const ink = text && HEX.test(text) ? text : inkFor(bar);
  const ratio = contrast(bar, ink);
  // 4.5 is the WCAG floor for ordinary text; the subline on the bar is small.
  if (ratio < 3) return "The writing will be very hard to read on this bar.";
  if (ratio < 4.5) return "The small line under the headline will be hard to read.";
  return "";
}

/**
 * The bar colour read out of a picture: the bottom of it, brightened.
 *
 * WHY THE BOTTOM. That is the edge the bar touches. Taking the average of the
 * whole photograph gives a colour that is nowhere near the join, and the join
 * is the entire point.
 *
 * WHY BRIGHTENED. Sana asked for light bright bars, not dark ones. The hue is
 * kept and the colour is pushed up into a tint, so it still belongs to the
 * photograph but always takes black writing.
 *
 * Returns null when the picture cannot be read — a broken address, or a host
 * that will not allow it. Null means "no suggestion", never a guessed colour.
 */
export async function barColourFromImage(src: string): Promise<string | null> {
  if (typeof document === "undefined" || !src) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      // Needed to read the pixels back out of a picture already uploaded.
      // Supabase storage answers with access-control-allow-origin: *, so the
      // four banners already live can be read without re-uploading them.
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("could not load"));
      el.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 40;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    // Draw only the part the phone actually shows — the middle 2.83-wide slice
    // — so the colour comes from pixels a customer will really see.
    const keep = Math.min(img.naturalHeight, img.naturalWidth / 2.83);
    const top = (img.naturalHeight - keep) / 2;
    ctx.drawImage(img, 0, top, img.naturalWidth, keep, 0, 0, 60, 40);

    // The bottom 30% of that.
    const { data } = ctx.getImageData(0, 28, 60, 12);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return null;
    return brighten(r / n / 255, g / n / 255, b / n / 255);
  } catch {
    // A picture that cannot be read is not a failure worth showing anybody:
    // the colour box simply stays as it was and she picks one herself.
    return null;
  }
}

/** Keep the hue, force a light bright tint. */
function brighten(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0)
      : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
    h /= 6;
  }
  // 0.80 light and at least 0.55 saturated: bright enough not to be grey,
  // light enough that black writing always reads on it.
  return hslToHex(h, Math.min(Math.max(s, 0.55), 0.85), 0.8);
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v);
  };
  const hex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
