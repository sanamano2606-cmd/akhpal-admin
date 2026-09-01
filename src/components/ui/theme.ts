// TAKAL'S COLOURS — THE CODE VERSION OF THE BRAND KIT.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE DOES NOT DECIDE ANYTHING. It copies.
//
// The decisions live in Takal_Brand_Kit/TAKAL_STYLE_GUIDE.md (version 2.0,
// 1 September 2026) and its takal-colors.css. That guide says, in its own
// words: "If these ever disagree, this file wins." So every value below is
// taken from there, unchanged, and every deliberate difference is written down
// as a difference instead of quietly happening.
//
// THE ONE RULE THAT NEVER CHANGES:
//   Yellow #FFFF00 is Takal's main colour. Text on yellow is always pure BLACK.
//   Yellow is never used for text, and never used to mean "warning".
//
// WHY THE PANEL NEEDED THIS FILE:
//   The admin panel had SEVEN separate status-colour maps that disagreed with
//   each other, three different yellows written by hand, two different sets of
//   chart colours for the same revenue line, and green/amber/red/blue taken
//   from a general-purpose colour set rather than from the Brand Kit at all.
// ─────────────────────────────────────────────────────────────────────────────

/** THE BRAND. */
export const BRAND = "#FFFF00";        // takal-yellow
export const BRAND_PRESSED = "#E6E600"; // while a yellow button is held down
export const BRAND_WASH = "#FFFDE0";    // a gentle yellow behind an important note

/** Text on yellow. Pure black, per the Brand Kit - not slate, not grey. */
export const ON_BRAND = "#000000";

/**
 * The brand yellow, darkened until it can be READ as a line.
 *
 * A DIFFERENCE FROM THE BRAND KIT, and the reason for it: #FFFF00 is right on
 * a button, where it is a filled shape with black text on it. As a one-pixel
 * line on a white chart it is almost invisible - it has nearly the same
 * lightness as the paper. The Brand Kit does not cover charts. So chart LINES
 * use this, and the pure yellow stays as the FILL underneath, which still
 * reads as Takal while the line stays legible.
 *
 * This is also why the panel's charts were purple: somebody tried yellow,
 * could not see it, and reached for a colour that is not Takal's at all.
 */
export const BRAND_DARK = "#8A8A00";

/**
 * THE MEANING COLOURS. Each one means exactly one thing. Never decorative.
 * Straight from Takal_Brand_Kit/takal-colors.css.
 */
export const ACCENT = {
  /** Good, finished, money in. Delivered · Paid · Approved */
  green: "#1F6F4A",
  /** Waiting, needs you, over a limit. Waiting on shop · Over cash limit */
  orange: "#FF6B35",
  /** In progress, information. On the way · Ready · a help note */
  blue: "#004E89",
  /** Refused, blocked, deleted, danger. Suspended · Reject · Delete */
  red: "#D62839",
  /** Marketplace and parcel jobs. */
  purple: "#6A3FA0",
  /** Grocery. */
  teal: "#0F7B8A",
} as const;

/** The soft background that goes with each meaning colour. */
export const ACCENT_SOFT = {
  green: "#E8F3EE",
  orange: "#FFEFE8",
  blue: "#E6EEF4",
  red: "#FBE7E9",
  purple: "#EFE9F6",
  teal: "#E4F1F3",
} as const;

/** Plain colours - text, lines, paper. */
export const PLAIN = {
  text: "#000000",
  textSoft: "#4A4A4A",
  line: "#E5E5E5",
  page: "#FAFAFA",
  card: "#FFFFFF",
  disabledBg: "#D9D9D9",
  disabledText: "#8A8A8A",
} as const;

/* ─────────────────────────────── CHARTS ─────────────────────────────────── */

/**
 * The order chart colours are used in. The Dashboard and the Analytics page
 * each had their OWN list, so the same revenue line was a different colour
 * depending which screen you opened.
 *
 * Chosen to stay apart from each other for someone who cannot easily tell red
 * from green - they differ in lightness as well as in hue.
 */
export const CHART_SERIES = [
  BRAND_DARK,      // readable brand yellow - always the main series
  ACCENT.blue,
  ACCENT.orange,
  ACCENT.green,
  ACCENT.purple,
  ACCENT.teal,
] as const;

/** The furniture of a chart: the faint grid and the axis labels. */
export const CHART = {
  grid: PLAIN.line,
  axis: PLAIN.textSoft,
  line: BRAND_DARK,
  fill: BRAND,
} as const;

/* ─────────────────────────── STATUS COLOURS ─────────────────────────────── */

/**
 * ONE map for the whole panel. There were seven, and they disagreed -
 * "Suspended" was red on the Riders page and grey on the Stores page, for the
 * same meaning.
 *
 * The classes below match the .takal-badge-* rules in the Brand Kit's own
 * stylesheet: a soft background, the meaning colour as text, a matching border.
 */
export type Tone =
  | "good"      // delivered, paid, approved
  | "warn"      // waiting on somebody
  | "bad"       // refused, blocked, deleted
  | "busy"      // in progress
  | "parcel"    // marketplace / parcel jobs
  | "grocery"   // grocery
  | "neutral";  // no meaning attached, or a word we do not recognise

export const TONE_CLASS: Record<Tone, string> = {
  good:    "bg-takal-green-soft  text-takal-green  ring-[#BFE0D2]",
  warn:    "bg-takal-orange-soft text-[#C8410F]    ring-[#FFD2BF]",
  bad:     "bg-takal-red-soft    text-takal-red    ring-[#F3C2C7]",
  busy:    "bg-takal-blue-soft   text-takal-blue   ring-[#BFD4E4]",
  parcel:  "bg-takal-purple-soft text-takal-purple ring-[#D8C9EA]",
  grocery: "bg-takal-teal-soft   text-takal-teal   ring-[#C2DFE4]",
  neutral: "bg-slate-100         text-takal-ink-soft ring-takal-line",
};

/** The same tones as solid colours, for charts - where a Tailwind class is no
 *  use because the drawing library needs a real colour value. */
export const TONE_HEX: Record<Tone, string> = {
  good: ACCENT.green,
  warn: ACCENT.orange,
  bad: ACCENT.red,
  busy: ACCENT.blue,
  parcel: ACCENT.purple,
  grocery: ACCENT.teal,
  neutral: "#8A8A8A",
};

/** Which tone each status word carries. Covers orders, riders and stores. */
export const STATUS_TONE: Record<string, Tone> = {
  // order lifecycle
  pending: "warn",
  confirmed: "busy",
  accepted: "busy",
  preparing: "busy",
  cooking: "busy",
  ready: "busy",
  picked_up: "busy",
  on_the_way: "busy",
  on_the_way_to_restaurant: "busy",
  delivering: "busy",
  delivered: "good",
  cancelled: "bad",
  rejected: "bad",
  returned: "bad",
  // returns
  approved: "good",
  paid: "good",
  // accounts - riders and stores
  active: "good",
  online: "good",
  inactive: "neutral",
  offline: "neutral",
  suspended: "bad",
  blocked: "bad",
  // stock
  in_stock: "good",
  low_stock: "warn",
  out_of_stock: "bad",
};

/** Which tone a KIND of order carries. The Brand Kit gives parcel and grocery
 *  their own colours; a food order has no colour of its own - its status is
 *  what matters. */
export const ORDER_KIND_TONE: Record<string, Tone> = {
  parcel: "parcel",
  standard: "parcel",
  marketplace: "parcel",
  grocery: "grocery",
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return STATUS_TONE[String(status).toLowerCase()] ?? "neutral";
}

/** Chart colour for a status word. Same meaning as the pill beside it. */
export function statusHex(status: string | null | undefined): string {
  return TONE_HEX[toneFor(status)];
}

/** "on_the_way" -> "On the way". Used wherever a raw status is shown. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const s = String(status).replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
