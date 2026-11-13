// ─────────────────────────────────────────────────────────────────────────────
// MOCK 237 PIECE 2 - THE SHOP'S "MESSAGES" TAB (approved by Sana 10 Nov 2026;
// "GO 237 piece 2" 12 Nov 2026). The words and the day groups, worked out
// here so they can be tested. The tab is stores/[id]/parts-messages.tsx; the
// list comes from the server (routers/shop_timeline.py).
// ─────────────────────────────────────────────────────────────────────────────
import { clock, dayMonth } from "./needs-today.ts";

export type MsgKind = "assistant" | "blur" | "sent_back" | "whatsapp" | "vendor" | "note" | "called";
export type ShopEvent = { id: string; kind: MsgKind; label: string; text: string; by: string; lang?: string | null;
  at: string; times: string[]; repeat: number; pressed_twice: boolean; still_waiting?: boolean };
export type ShopTimeline = { events: ShopEvent[]; counts: Record<string, number>; more: boolean };

export type Filter = "all" | "assistant" | "sent_back" | "whatsapp" | "notes" | "vendor";

/** The filter buttons, in the mock's order. Office notes holds notes and calls;
 *  Assistant holds its messages and the pictures it blurred. */
export const FILTERS: { key: Filter; label: string; icon: string; kinds: MsgKind[] }[] = [
  { key: "all", label: "All", icon: "", kinds: [] },
  { key: "assistant", label: "Assistant", icon: "🤖", kinds: ["assistant", "blur"] },
  { key: "sent_back", label: "Sent back", icon: "↩️", kinds: ["sent_back"] },
  { key: "whatsapp", label: "WhatsApp", icon: "💬", kinds: ["whatsapp"] },
  { key: "notes", label: "Office notes", icon: "📝", kinds: ["note", "called"] },
  { key: "vendor", label: "Vendor", icon: "🏪", kinds: ["vendor"] },
];

/** The round picture at the left of each line. */
export const KIND_ICON: Record<MsgKind, string> = {
  assistant: "🤖", blur: "🫥", sent_back: "↩️", whatsapp: "💬", vendor: "🏪", note: "📝", called: "📞",
};

export function inFilter(e: ShopEvent, f: Filter): boolean {
  if (f === "all") return true;
  return FILTERS.find((x) => x.key === f)!.kinds.includes(e.kind);
}

export function filterCount(events: ShopEvent[], f: Filter): number {
  return events.filter((e) => inFilter(e, f)).length;
}

/** "TODAY · 12 NOV", "YESTERDAY · 11 NOV" or "9 NOV" - days in Swat. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = dayMonth(iso).toUpperCase();
  const today = dayMonth(now.toISOString()).toUpperCase();
  const yesterday = dayMonth(new Date(now.getTime() - 86400000).toISOString()).toUpperCase();
  if (d === today) return `TODAY · ${d}`;
  if (d === yesterday) return `YESTERDAY · ${d}`;
  return d;
}

/** The list cut into days, newest first: [["TODAY · 12 NOV", [...]], ...]. */
export function byDay(events: ShopEvent[], now: Date = new Date()): [string, ShopEvent[]][] {
  const out: [string, ShopEvent[]][] = [];
  for (const e of events) {
    const label = dayLabel(e.at, now);
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(e);
    else out.push([label, [e]]);
  }
  return out;
}

/** "same message 5 times · 5, 6, 7, 8, 9 Nov" - "" for one. */
export function repeatLine(e: ShopEvent): string {
  if (e.repeat < 2) return "";
  const days = [...e.times].reverse().map((t) => dayMonth(t));
  const month = days[days.length - 1].split(" ")[1];
  const sameMonth = days.every((d) => d.endsWith(` ${month}`));
  const list = sameMonth ? `${days.map((d) => d.split(" ")[0]).join(", ")} ${month}` : days.join(", ");
  return `same message ${e.repeat} times · ${list}`;
}

/** The time on the line: "11:30". */
export function timeOf(e: ShopEvent): string {
  return clock(e.at);
}

/** The first `n` letters, cut at a word: long messages open with "Show all". */
export function shortText(text: string, n = 220): { text: string; cut: boolean } {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= n) return { text: flat, cut: false };
  const at = flat.lastIndexOf(" ", n);
  return { text: `${flat.slice(0, at > n * 0.6 ? at : n)}…`, cut: true };
}
