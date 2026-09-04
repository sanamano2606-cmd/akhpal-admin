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

/**
 * Which tone each status word carries. Covers orders, riders and stores.
 *
 * THE ORDER HALF OF THIS LIST IS NOT WRITTEN HERE ANY MORE.
 *
 * It used to be typed out a second time, and the two copies had drifted: this
 * one still carried `cooking`, `delivering`, `confirmed` and `returned` - words
 * the system has never sent - and was MISSING `at_hub`, which is live every
 * day. So one badge painted an at-hub order blue and the other painted it grey,
 * on the same screen, for the same order.
 *
 * The eleven real order statuses now come straight from ORDER_STATUS below,
 * which is itself copied from the backend's ORDER_STATUS_FLOW. Two copies of a
 * fact are two facts; there is one now.
 */
export const STATUS_TONE: Record<string, Tone> = {
  // The order lifecycle is filled in from ORDER_STATUS further down this
  // file. Only the statuses that are NOT an order's are written out here.
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

/* ───────────────────── THE ELEVEN STATUSES AN ORDER CAN HAVE ─────────────── */

/**
 * EVERY status this system really uses, with the words a person can read.
 *
 * WHY THIS EXISTS. The Orders page offered six statuses to filter by, and two
 * of them - "Cooking" and "Delivering" - are words the system has never used.
 * Choosing either showed an empty page, for ever. Seven statuses that DO exist
 * were missing from the list altogether: on Sana's real 34 test orders, five
 * orders could not be found by any filter on the page.
 *
 * The list below is taken from ORDER_STATUS_FLOW in the backend's
 * core_orders.py, which is the only place the rules actually live. Anything
 * that offers a status - a filter, a pill, a move button - reads it from here,
 * so a status can never again be offered that does not exist.
 *
 * THE WORDS. `at_hub` means nothing to anybody. "At a Takal office" does.
 *
 * THE COLOURS all come from the Brand Kit's six meaning colours. Statuses that
 * mean the same KIND of thing share a colour - waiting is orange, in progress
 * is blue, a rider carrying it is purple, ready and moving is teal, done is
 * green, ended is red - and the DOT separates the ones inside a group, using a
 * lighter or darker shade of that same colour.
 *
 * "Waiting for shop" is ORANGE, not yellow, even though the mock-up drew it
 * yellow: the Brand Kit forbids yellow meaning "warning", because yellow is
 * Takal's own colour and must keep meaning Takal.
 */
export const ORDER_STATUS: Record<
  string,
  { label: string; tone: Tone; dot: string }
> = {
  pending:                  { label: "Waiting for shop",    tone: "warn",    dot: ACCENT.orange },
  accepted:                 { label: "Shop accepted",       tone: "busy",    dot: ACCENT.blue },
  preparing:                { label: "Cooking / packing",   tone: "busy",    dot: "#2E7EB8" },
  ready:                    { label: "Ready",               tone: "grocery", dot: ACCENT.teal },
  on_the_way_to_restaurant: { label: "Rider going to shop", tone: "parcel",  dot: ACCENT.purple },
  picked_up:                { label: "Rider has it",        tone: "parcel",  dot: "#452470" },
  at_hub:                   { label: "At a Takal office",   tone: "busy",    dot: "#00325A" },
  on_the_way:               { label: "On the way",          tone: "grocery", dot: "#12A0B3" },
  delivered:                { label: "Delivered",           tone: "good",    dot: ACCENT.green },
  cancelled:                { label: "Cancelled",           tone: "bad",     dot: ACCENT.red },
  rejected:                 { label: "Shop refused",        tone: "bad",     dot: "#8C1F2A" },
};

/**
 * Fold the eleven real order statuses into STATUS_TONE, so anything reading
 * that map gets the same answer ORDER_STATUS gives. Done here, after
 * ORDER_STATUS exists, rather than by typing the list out twice.
 */
for (const [status, meta] of Object.entries(ORDER_STATUS)) {
  STATUS_TONE[status] = meta.tone;
}

/** The statuses in the order an order actually goes through, for a dropdown. */
export const ORDER_STATUS_ORDER: string[] = [
  "pending", "accepted", "preparing", "ready",
  "on_the_way_to_restaurant", "picked_up", "at_hub", "on_the_way",
  "delivered", "cancelled", "rejected",
];

/** "at_hub" -> "At a Takal office". Falls back to tidying up whatever it was
 *  given, so a status added to the backend tomorrow still reads sensibly. */
export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ORDER_STATUS[String(status).toLowerCase()]?.label ?? statusLabel(status);
}

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
