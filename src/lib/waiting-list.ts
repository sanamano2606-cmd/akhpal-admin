// ─────────────────────────────────────────────────────────────────────────────
// MOCK 211 - THE COMPACT WAITING LIST (approved by Sana 27 October 2026)
//
// "make it easier to find the newest store, what message sent and sent back
// for review and the ones vendors re submit after changes." The rules the
// Waiting list follows, kept out of the page so they can be checked:
//
//   * QUEUES   Fixed – check again / New / Reviewing / Sent back / All waiting.
//   * GROUPS   Fixed first, then Today and Earlier (newest first inside), then
//              Sent back - those wait for the vendor, not for the office.
//   * TIMES    Pakistan time, whatever the computer's clock is set to.
//   * MESSAGE  the later of the send-back and the last "WhatsApp what is left".
// ─────────────────────────────────────────────────────────────────────────────
import { reviewStateOf, reviewingLine } from "./shop-review.ts";

export type Queue = "fixed" | "new" | "reviewing" | "sent_back" | "all";

export const QUEUES: { key: Queue; label: string }[] = [
  { key: "fixed", label: "Fixed – check again" },
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "sent_back", label: "Sent back" },
  { key: "all", label: "All waiting" },
];

type Row = {
  created_at?: string | null; review_state?: string | null; review_checked?: number | null;
  review_to_fix?: number | null; sent_back_at?: string | null; last_whatsapp_at?: string | null;
};

/** Which queue a waiting shop is in. Started-but-not-sent-back = Reviewing. */
export function queueOf(r: Row): Exclude<Queue, "all"> {
  const s = reviewStateOf(r);
  if (s === "fixed") return "fixed";
  if (s === "sent_back") return "sent_back";
  return reviewingLine(r) ? "reviewing" : "new";
}

export function inQueue(r: Row, q: Queue): boolean {
  return q === "all" || queueOf(r) === q;
}

const PKT = "Asia/Karachi";

/** The Pakistan calendar day of a moment, "2026-10-27". "" when unreadable. */
export function pktDay(at: string | Date | null | undefined): string {
  const d = at instanceof Date ? at : at ? new Date(at) : null;
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". "" when unreadable. */
export function agoText(at: string | null | undefined, now: Date = new Date()): string {
  const t = at ? new Date(at).getTime() : NaN;
  if (isNaN(t)) return "";
  const min = Math.max(0, Math.floor((now.getTime() - t) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / (24 * 60))} d ago`;
}

/** Today: "8:04 pm". Another day: "Sat 24 Oct, 8:20 pm". Pakistan time. */
export function whenText(at: string | null | undefined, now: Date = new Date()): string {
  const d = at ? new Date(at) : null;
  if (!d || isNaN(d.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: PKT, hour: "numeric", minute: "2-digit", hour12: true })
    .format(d).replace(/\s?([AP]M)$/i, (_m, x) => ` ${String(x).toLowerCase()}`);
  if (pktDay(d) === pktDay(now)) return time;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: PKT, weekday: "short", day: "numeric", month: "short" }).format(d);
  return `${day.replace(",", "")}, ${time}`;
}

/** How many waiting shops joined today (Pakistan day). */
export function joinedToday(rows: Row[], now: Date = new Date()): number {
  const today = pktDay(now);
  return rows.filter((r) => pktDay(r.created_at) === today).length;
}

export type WaitingGroup<T> = { key: "fixed" | "today" | "earlier" | "sent_back"; label: string; rows: T[] };

/** The Waiting list in its groups. The order inside a group is the order the
 *  rows came in (the chosen sort - Newest first unless a person chose). */
export function waitingGroups<T extends Row>(rows: T[], now: Date = new Date()): WaitingGroup<T>[] {
  const today = pktDay(now);
  const g = { fixed: [] as T[], today: [] as T[], earlier: [] as T[], sent_back: [] as T[] };
  for (const r of rows) {
    const q = queueOf(r);
    if (q === "fixed") g.fixed.push(r);
    else if (q === "sent_back") g.sent_back.push(r);
    else if (pktDay(r.created_at) === today) g.today.push(r);
    else g.earlier.push(r);
  }
  const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: PKT, weekday: "short", day: "numeric", month: "short" })
    .format(now).replace(",", "").toUpperCase();
  const out: WaitingGroup<T>[] = [
    { key: "fixed", label: `✓ FIXED BY THE VENDOR — CHECK AGAIN (${g.fixed.length})`, rows: g.fixed },
    { key: "today", label: `TODAY · ${dayName} (${g.today.length})`, rows: g.today },
    { key: "earlier", label: `EARLIER (${g.earlier.length})`, rows: g.earlier },
    { key: "sent_back", label: `↩ SENT BACK — WAITING FOR THE VENDOR (${g.sent_back.length})`, rows: g.sent_back },
  ];
  return out.filter((x) => x.rows.length > 0);
}

/** The last message Takal sent this shop: the send-back, or the last
 *  "WhatsApp what is left" - whichever is later. null = never. */
export function lastMessage(r: Row): { kind: "sent_back" | "whatsapp"; at: string } | null {
  const sb = r.sent_back_at ? new Date(r.sent_back_at).getTime() : NaN;
  const wa = r.last_whatsapp_at ? new Date(r.last_whatsapp_at).getTime() : NaN;
  if (isNaN(sb) && isNaN(wa)) return null;
  if (isNaN(wa) || (!isNaN(sb) && sb >= wa)) return { kind: "sent_back", at: String(r.sent_back_at) };
  return { kind: "whatsapp", at: String(r.last_whatsapp_at) };
}

/** The short words for a checklist step that is still missing. */
const SHORT: Record<string, string> = {
  details: "Phone", place: "Map pin", hours: "Hours", logo: "Logo", photos: "Photos", payout: "Payout",
};

/** "Logo · Products 0/5 · Photos · Payout" - only what is still missing. */
export function missingWords(steps: { key: string; label: string; done: boolean; note?: string }[]): string[] {
  return (steps || []).filter((s) => !s.done).map((s) => {
    if (s.key === "products") {
      const m = /(\d+)\s*of\s*(\d+)/.exec(s.note || "");
      return m ? `Products ${m[1]}/${m[2]}` : "Products";
    }
    return SHORT[s.key] || s.label;
  });
}
