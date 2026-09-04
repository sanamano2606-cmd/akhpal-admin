/**
 * ANNOUNCEMENTS — the strip at the top of the three apps.
 *
 * WHY THIS FILE EXISTS AND WHAT IT MUST NEVER BECOME
 * --------------------------------------------------
 * The old strip was one text box on the Settings screen and a black bar inside
 * a Flutter widget. The panel's preview drew it YELLOW while the app drew it
 * BLACK — for months, and nobody could see that from the panel, because the two
 * had no shared idea of anything.
 *
 * So the rule for this file is: it holds the SAME words and the SAME maths as
 * `backend/core_announcements.py`, and `tests/announcements.test.ts` pins the
 * two together. If a list here ever grows an option the server does not accept,
 * the test fails before anybody can save a banner the phone cannot draw.
 *
 * The contrast maths is imported from `marketing.ts` rather than copied, for
 * exactly the same reason.
 */

// The .ts is deliberate. The panel's tests run on Node's own test runner with
// no bundler, and Node will not resolve an extensionless relative import. Every
// other lib file that a test loads is a leaf with no imports of its own; this
// one is not, because copying the contrast maths a second time is exactly how
// the panel and the app came to disagree about a colour in the first place.
import { HEX, contrast, inkFor } from "./marketing.ts";

// ── The choices, word for word from migration 065's CHECK constraints ────────
export const FONTS = [
  { value: "poppins",  label: "Poppins",  hint: "The app's own font" },
  { value: "roboto",   label: "Roboto",   hint: "Plainer, a little wider" },
  { value: "nastaliq", label: "Nastaliq", hint: "For Urdu and Pashto" },
] as const;

/**
 * THE THREE SIZES, AND WHY THEY ARE THESE THREE NUMBERS.
 *
 * The customer app has exactly six text sizes and a test that fails on a
 * seventh (customer_app/test/text_scale_test.dart): title 20, heading 16.5,
 * name 14, fact 12, small 11.5, tag 9.5.
 *
 * My first attempt at this preview used 11 / 12.5 / 14. Two of those three are
 * not on that scale, so the preview would have drawn sizes the phone cannot
 * produce — the exact class of fault this whole screen exists to end. The app's
 * guard caught it.
 *
 * So Small, Normal and Large are three of the app's own six.
 */
export const SIZES = [
  { value: "small",  label: "Small",  px: 11.5 },   // the app's `small`
  { value: "normal", label: "Normal", px: 12 },     // the app's `fact`
  { value: "large",  label: "Large",  px: 14 },     // the app's `name`
] as const;

/** The second line is one step DOWN the same scale — never "two pixels less",
 *  which is how a seventh size gets invented. Matches _secondLineSize() in
 *  announcement_card.dart. */
export const SECOND_LINE_PX: Record<string, number> = {
  small: 9.5, normal: 11.5, large: 12,
};

export const WEIGHTS = [
  { value: "normal", label: "Normal", css: 400 },
  { value: "bold",   label: "Bold",   css: 700 },
  { value: "heavy",  label: "Heavy",  css: 900 },
] as const;

export const SHAPES = [
  { value: "card",  label: "Card",  hint: "Rounded, inset, with a shadow" },
  { value: "pill",  label: "Pill",  hint: "Fully rounded, narrower" },
  { value: "strip", label: "Strip", hint: "Edge to edge, square" },
] as const;

export const ALIGNMENTS = [
  { value: "left",   label: "Left" },
  { value: "center", label: "Centre" },
] as const;

/**
 * HOW IT ARRIVES — including the three kinds of "rolling".
 *
 * Sana asked for the announcement to "roll". That one word covers three quite
 * different motions, so all three are offered and she picks, rather than me
 * guessing and being wrong at the cost of a whole round trip.
 */
export const ENTRANCES = [
  { value: "none",        label: "None",        hint: "It is just there" },
  { value: "fade",        label: "Fade",        hint: "Appears softly" },
  { value: "slide",       label: "Slide",       hint: "Drops down into place" },
  { value: "wave",        label: "Wave",        hint: "A band of light sweeps across it once" },
  { value: "roll_down",   label: "Roll down",   hint: "Flips down on its top edge, like a ticker board" },
  { value: "roll_across", label: "Roll across", hint: "Rolls in from the right, turning as it lands" },
  { value: "ticker",      label: "Rolling words", hint: "The card is still; the words scroll sideways" },
] as const;

/**
 * DO THE COLOURS MOVE?
 *
 * Three settings and not a switch. "Always" repaints every frame for as long as
 * the screen is open, which on the cheap Android phones most Takal customers
 * use means a warm phone and dropped frames while scrolling the shop list. That
 * is a real cost and it is Sana's to weigh, not mine to hide — so it is offered,
 * with the cost written next to it, and it is not the default.
 */
export const COLOUR_MOTION = [
  { value: "still",  label: "Still",             hint: "No movement at all" },
  { value: "settle", label: "Move, then settle", hint: "Drifts, then rests. Kind to the battery." },
  { value: "always", label: "Always moving",     hint: "Never stops — costs battery on older phones" },
] as const;

/**
 * THE MULTICOLOUR BACKGROUNDS.
 *
 * Every set stays inside ONE lightness band, and that is not decoration: a
 * gradient running dark to light cannot carry one writing colour — ink chosen
 * for the dark end vanishes at the light end. The first version of this list
 * had a "sea" running deep teal into pale green, where white measured 1.8 to 1
 * at the pale end. A test caught it. The numbers below are the worst contrast
 * each set reaches with its own ink.
 */
export const GRADIENTS: Record<string, string[]> = {
  // light — black writing
  sunrise: ["#FFF07A", "#FFD64A", "#FFB03A", "#FF8A3D"],
  sand:    ["#FFF3B0", "#FFE083", "#FFD166"],
  mint:    ["#D9F7E6", "#CFF3DE", "#E4F7D0"],
  sky:     ["#D8ECFF", "#CFE3FF", "#DCD9FF"],
  blush:   ["#FFD5CE", "#FFC2A8", "#FFD79B"],
  // dark — white writing
  night:   ["#1E3C72", "#2A5298", "#4B3B8F", "#7A3FA0"],
  sea:     ["#0E5F6B", "#155F52", "#1C6A45"],
  berry:   ["#4B2A7A", "#7A2E6B", "#8E2F4A"],
  chilli:  ["#8C1F2A", "#A83218", "#B4560D"],
};

export const GRADIENT_LABELS: Record<string, string> = {
  sunrise: "Sunrise", sand: "Sand", mint: "Mint", sky: "Sky", blush: "Blush",
  night: "Night", sea: "Sea", berry: "Berry", chilli: "Chilli",
};

/** Flat colours worth one tap. Any other colour can still be typed. */
export const FLAT_COLOURS = [
  "#FFFF00", "#000000", "#FFFFFF", "#004E89", "#1F6F4A",
  "#FF6B35", "#D62839", "#6A3FA0", "#0F7B8A",
  "#FFF3B0", "#CFE3FF", "#D6F5E3", "#FFD9C7",
];

/** The floor ordinary text has to clear. The same number the rest of the panel
 *  is measured against, and the same one `core_announcements.py` uses. */
export const READABLE_FLOOR = 4.5;

export const STATUS: Record<string, { word: string; tone: string }> = {
  live:     { word: "Live",      tone: "bg-takal-green-soft text-takal-green" },
  waiting:  { word: "Waiting",   tone: "bg-takal-blue-soft text-takal-blue" },
  asleep:   { word: "Asleep",    tone: "bg-takal-orange-soft text-[#C8410F]" },
  finished: { word: "Finished",  tone: "bg-slate-100 text-takal-ink-soft" },
  off:      { word: "Off",       tone: "bg-slate-100 text-takal-ink-soft" },
};

export const DAYS = [
  { value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
  { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// ── The maths, which must agree with the server ─────────────────────────────

/** The stops of a named gradient, or [] for a flat colour. */
export function gradientStops(name?: string | null): string[] {
  if (!name) return [];
  return GRADIENTS[String(name).trim().toLowerCase()] ?? [];
}

/**
 * The writing colour the app will paint.
 *
 * A hand-picked colour wins. Otherwise: on a flat colour, whichever of black or
 * white reads better; on a gradient, whichever survives the WORST stop.
 *
 * Judging a gradient by its darkest stop is the mistake this replaces — it
 * picks white for a set that also has a pale stop, which is perfect at one end
 * and invisible at the other.
 */
export function announcementInk(a: {
  text_color?: string | null;
  bg_gradient?: string | null;
  bg_color?: string | null;
}): string {
  const chosen = (a.text_color || "").trim();
  if (chosen && HEX.test(chosen)) return chosen;

  const stops = gradientStops(a.bg_gradient).filter((s) => HEX.test(s));
  if (stops.length) {
    const onBlack = Math.min(...stops.map((s) => contrast(s, "#000000")));
    const onWhite = Math.min(...stops.map((s) => contrast(s, "#FFFFFF")));
    return onBlack >= onWhite ? "#000000" : "#FFFFFF";
  }
  return inkFor(a.bg_color);
}

/** What is wrong with these colours, in one sentence, or "" when they are fine.
 *  WARNS, NEVER REFUSES — they are Sana's colours, and a warning she can read
 *  beats a refusal she cannot argue with. */
export function announcementColourWarning(a: {
  text_color?: string | null;
  bg_gradient?: string | null;
  bg_color?: string | null;
}): string {
  const ink = announcementInk(a);
  const stops = gradientStops(a.bg_gradient);
  const all = stops.length ? stops : [a.bg_color || ""];

  let worstStop = "";
  let worst = 99;
  for (const stop of all) {
    if (!stop || !HEX.test(stop)) continue;
    const ratio = contrast(stop, ink);
    if (ratio < worst) { worst = ratio; worstStop = stop; }
  }

  if (!worstStop) return "That is not a colour I can read. Use six digits, like #FFCC00.";
  if (worst < 3) {
    return `The writing will be hard to read on ${worstStop} (${worst.toFixed(1)} to 1). `
         + `Pick a lighter or darker colour.`;
  }
  if (worst < READABLE_FLOOR) {
    return `The writing is only just readable on ${worstStop} (${worst.toFixed(1)} to 1). `
         + `It is fine for big letters, and tight for small ones.`;
  }
  return "";
}

/** The background the preview should paint: one colour, or the gradient. */
export function announcementBackground(a: {
  bg_gradient?: string | null;
  bg_color?: string | null;
}): string {
  const stops = gradientStops(a.bg_gradient);
  if (stops.length) return `linear-gradient(100deg, ${stops.join(", ")})`;
  return a.bg_color || "#FFFF00";
}

/** How long it stays and whether it can be closed, as one readable line. */
export function timingLine(a: {
  stay_secs?: number | null;
  dismissible?: boolean | null;
  return_hours?: number | null;
}): string {
  const stay = Number(a.stay_secs ?? 0);
  const parts = [stay === 0 ? "stays until it is closed" : `stays ${stay}s`];
  if (a.dismissible) {
    const back = Number(a.return_hours ?? 0);
    parts.push(back === 0 ? "can be closed" : `can be closed, back after ${back}h`);
  } else {
    parts.push("cannot be closed");
  }
  return parts.join(" · ");
}

/** Which apps see it, in the order the sidebar lists them. */
export function appsLine(a: {
  for_customer?: boolean | null;
  for_rider?: boolean | null;
  for_vendor?: boolean | null;
}): string {
  const seen: string[] = [];
  if (a.for_customer) seen.push("Customers");
  if (a.for_rider) seen.push("Riders");
  if (a.for_vendor) seen.push("Partners");
  return seen.length ? seen.join(" · ") : "Nobody — no app is switched on";
}

/** When it shows, in words. Empty dates mean "always", which is the usual case
 *  and should read as a sentence rather than as two blanks. */
export function whenLine(a: {
  starts_at?: string | null;
  ends_at?: string | null;
  days?: number[] | null;
  hour_from?: number | null;
  hour_to?: number | null;
}): string {
  const bits: string[] = [];
  const when = (v?: string | null) =>
    v ? new Date(v).toLocaleDateString(undefined,
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  if (a.starts_at && a.ends_at) bits.push(`${when(a.starts_at)} → ${when(a.ends_at)}`);
  else if (a.starts_at) bits.push(`from ${when(a.starts_at)}`);
  else if (a.ends_at) bits.push(`until ${when(a.ends_at)}`);
  else bits.push("always on");

  const days = a.days || [];
  if (days.length && days.length < 7) {
    bits.push(days.map((d) => DAYS[d]?.label).filter(Boolean).join(", "));
  }
  const from = Number(a.hour_from ?? 0);
  const to = Number(a.hour_to ?? 0);
  if (from !== to) bits.push(`${String(from).padStart(2, "0")}:00–${String(to).padStart(2, "0")}:00`);

  return bits.join(" · ");
}

/** Taps per hundred showings, or null while it is too early to say.
 *  Under fifty showings the percentage swings wildly and reads as a fact. */
export function tapRate(a: { shown_count?: number | null; tap_count?: number | null }): number | null {
  const shown = Number(a.shown_count ?? 0);
  if (shown < 50) return null;
  return Math.round((Number(a.tap_count ?? 0) / shown) * 1000) / 10;
}

/** What the preview should actually print, capitals and all. */
export function previewText(message: string, uppercase?: boolean | null): string {
  const text = (message || "").trim();
  return uppercase ? text.toUpperCase() : text;
}
