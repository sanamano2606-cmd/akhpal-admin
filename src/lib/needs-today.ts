// ─────────────────────────────────────────────────────────────────────────────
// MOCK 237 PIECE 1 - "NEEDS ME TODAY" (approved by Sana 10 Nov 2026; "GO 237").
// The words on the box's rows, worked out here so they can be tested. The
// box itself is src/app/dashboard/stores/parts-needs-today.tsx; the numbers
// come from the server (routers/needs_today.py).
// ─────────────────────────────────────────────────────────────────────────────

export type NeedsKind = "ready" | "fixes" | "pictures" | "quiet";

export type ReadyRow = { id: string; name: string; vendor_type?: string; products_on_sale?: number | null;
  payout_given?: boolean; pictures_blurred?: number; logo_by_takal?: boolean };
export type FixesRow = { id: string; name: string; vendor_type?: string; fixed: number; asked: number;
  first_fix?: string; sent_back_at?: string | null; fixed_at?: string | null };
export type PicturesRow = { id: string; name: string; vendor_type?: string; live?: boolean;
  pictures: string[]; found_at?: string | null };
export type QuietRow = { id: string; name: string; vendor_type?: string; on_sale: number; quiet_days: number;
  added_anything?: boolean; left?: string[]; phone?: string; reminded_at?: string | null;
  called_at?: string | null; called_by?: string | null };
export type NeedsToday = { ready: ReadyRow[]; fixes: FixesRow[]; pictures: PicturesRow[]; quiet: QuietRow[];
  failed: NeedsKind[]; quiet_days: number; checked_at: string };

/** The four tiles, in the order of the mock. */
export const TILES: { key: NeedsKind; label: string; icon: string }[] = [
  { key: "ready", label: "Ready to switch on", icon: "✅" },
  { key: "fixes", label: "Sent fixes back", icon: "↩️" },
  { key: "pictures", label: "Pictures to look at", icon: "🖼️" },
  { key: "quiet", label: "Quiet shops", icon: "💤" },
];

/** How many rows a tile opens with, before "See all". */
export const FIRST_ROWS = 5;

const MIN_PRODUCTS = 5;
const PKT_MS = 5 * 3600 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Nov" - the day in Swat. "" when it cannot be read. */
export function dayMonth(iso?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!isFinite(t)) return "";
  const d = new Date(t + PKT_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "11:40" - the time in Swat. */
export function clock(iso?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!isFinite(t)) return "";
  const d = new Date(t + PKT_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** The big number on a tile: pictures count pictures, the rest count shops. */
export function tileCount(kind: NeedsKind, d: NeedsToday | null): number | null {
  if (!d) return null;
  if (kind === "pictures") return d.pictures.reduce((n, s) => n + s.pictures.length, 0);
  return d[kind].length;
}

/** The small line under a tile's name. */
export function tileLine(kind: NeedsKind, d: NeedsToday | null): string {
  if (!d) return "Checking…";
  if (d.failed?.includes(kind)) return "Could not be read just now";
  const n = tileCount(kind, d) || 0;
  if (kind === "ready") return n ? "Finished every step - only your switch is left" : "No shop is waiting for your switch";
  if (kind === "fixes") return n ? "A vendor fixed what you sent back" : "No vendor has sent fixes yet";
  if (kind === "pictures") {
    const shops = d.pictures.length;
    return n ? `In ${shops} shop${shops === 1 ? "" : "s"} - may show a phone number` : "Nothing to look at";
  }
  return n ? `Nothing added for ${d.quiet_days || 7} days or more` : "Every shop added something this week";
}

/** "3 of 5 products on sale · nothing added for 19 days · Assistant reminded 9 Nov" */
export function quietLine(r: QuietRow): string {
  const parts = [
    `${r.on_sale >= MIN_PRODUCTS ? r.on_sale : `${r.on_sale} of ${MIN_PRODUCTS}`} product${r.on_sale === 1 && r.on_sale >= MIN_PRODUCTS ? "" : "s"} on sale`,
    r.added_anything === false ? `nothing added in ${r.quiet_days} days since approval`
      : `nothing added for ${r.quiet_days} day${r.quiet_days === 1 ? "" : "s"}`,
  ];
  const told = dayMonth(r.reminded_at);
  if (told) parts.push(`Assistant reminded ${told}`);
  return parts.join(" · ");
}

/** "✓ Called today, 11:40" or "✓ Called 8 Nov" - "" when never called. */
export function calledLine(at: string | null | undefined, now: Date = new Date()): string {
  const day = dayMonth(at);
  if (!day) return "";
  return day === dayMonth(now.toISOString()) ? `✓ Called today, ${clock(at)}` : `✓ Called ${day}`;
}

/** "12 products on sale · payout ✓" for a shop ready to switch on. */
export function readyLine(r: ReadyRow): string {
  const n = r.products_on_sale ?? 0;
  const parts = [`${n} product${n === 1 ? "" : "s"} on sale`, "logo ✓",
    r.payout_given ? "payout ✓" : "payout not yet (not needed to go live)"];
  if (r.pictures_blurred) parts.push(`${r.pictures_blurred} picture${r.pictures_blurred === 1 ? "" : "s"} blurred by Takal - look once`);
  return parts.join(" · ");
}

/** "1 of 1 fix done: Cool Drinks · sent back 5 Nov · fixed 10 Nov" */
export function fixesLine(r: FixesRow): string {
  const parts = [`${r.fixed} of ${r.asked} fix${r.asked === 1 ? "" : "es"} done${r.first_fix ? `: ${r.first_fix}${r.asked > 1 ? " and more" : ""}` : ""}`];
  if (dayMonth(r.sent_back_at)) parts.push(`sent back ${dayMonth(r.sent_back_at)}`);
  if (dayMonth(r.fixed_at)) parts.push(`fixed ${dayMonth(r.fixed_at)}`);
  return parts.join(" · ");
}

/** "2 pictures · found 8 Nov · live shop" */
export function picturesLine(r: PicturesRow): string {
  const n = r.pictures.length;
  const parts = [`${n} picture${n === 1 ? "" : "s"}`];
  if (dayMonth(r.found_at)) parts.push(`found ${dayMonth(r.found_at)}`);
  if (r.live) parts.push("live shop - customers can see it");
  return parts.join(" · ");
}

/** A tel: link for the Call button, or "" for no number. */
export function telLink(phone?: string | null): string {
  const d = String(phone || "").replace(/[^\d+]/g, "");
  return d.length >= 10 ? `tel:${d}` : "";
}
