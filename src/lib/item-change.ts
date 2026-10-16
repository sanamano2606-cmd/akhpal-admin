/**
 * MOCK 198, BOARD 3 - AN ITEM IS NOT AVAILABLE, the office's side
 * (approved by Sana, 15 Oct 2026: "Approved. please built exactly as mocks").
 *
 * Sana: "The Office Phone her". When a customer does not answer about a
 * missing item within 10 minutes, the order goes to Orders -> Needs a call.
 * The office phones her and presses what she said: keep the rest / she will
 * add items (10 more minutes) / cancel the whole order, no strike. Every step
 * is in the order's history, with the name of whoever pressed it.
 *
 * Pure functions - no screen, no server - so each rule is proved by a test.
 */

import { money } from "./format.ts";

/** The server's wait, in minutes (item_changes.WAIT_MINUTES). */
export const WAIT_MINUTES = 10;

/** The server has migration 135 when an order carries this column. */
export function itemChangeReady(order: any): boolean {
  return !!order && typeof order === "object" && "waiting_for_customer_until" in order;
}

const STILL_IN_THE_STORE = ["pending", "accepted", "preparing", "ready", "on_the_way_to_restaurant"];

/** She is being asked right now (the 10 minutes, or the office's call). */
export function isWaiting(order: any): boolean {
  return (
    itemChangeReady(order) &&
    String(order.waiting_for_customer_until ?? "").trim() !== "" &&
    STILL_IN_THE_STORE.includes(String(order.status ?? ""))
  );
}

/** The office may mark an item "Not available" while the order is still in
 *  the store and nobody is being asked already. Unlike the shop (once only),
 *  the office can do it again - it is where any later change goes. */
export function officeMayMark(order: any): boolean {
  return itemChangeReady(order) && STILL_IN_THE_STORE.includes(String(order?.status ?? "")) && !isWaiting(order);
}

/** Seconds left of her 10 minutes; 0 when the time is up. */
export function secondsLeft(order: any, now: Date = new Date()): number {
  const until = Date.parse(String(order?.waiting_for_customer_until ?? ""));
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, Math.floor((until - now.getTime()) / 1000));
}

/** 521 -> "8:41". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "1 call" / "2 calls" - the red count beside Orders in the menu. */
export function callsLabel(n: number): string {
  return `${n} call${n === 1 ? "" : "s"}`;
}

/** 03123454567 -> "0312 345 4567": big and easy to read out while dialling.
 *  +92 312 3454567 -> "0312 345 4567". Anything else is shown as it came. */
export function phoneForCall(phone: any): string {
  const raw = String(phone ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) d = "0" + d.slice(2);
  if (d.length === 11 && d.startsWith("03")) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return raw;
}

/** What the "Call now" button dials. */
export function telHref(phone: any): string {
  const d = String(phone ?? "").replace(/[^\d+]/g, "");
  return d ? `tel:${d}` : "";
}

/** "Ayesha K." -> "Ayesha". */
export function firstName(name: any): string {
  const n = String(name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "";
}

/** "Test street, Mingora" -> "Mingora": the area, for "Ayesha K. · Mingora". */
export function areaOf(address: any): string {
  const parts = String(address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/** One line of "What is missing": the chip says "Not available" or "1 of 2". */
export function missingChip(m: any): { text: string; tone: "red" | "orange" } {
  const was = Number(m?.was ?? 0);
  const now = Number(m?.now ?? 0);
  return now <= 0 ? { text: "Not available", tone: "red" } : { text: `${now} of ${was}`, tone: "orange" };
}

/** "Nutella not available, Ajwa Dates 1 of 2" - from the server's lines. */
export function missingWords(lines: any[]): string {
  return (lines || [])
    .filter((m) => Number(m?.now ?? 0) < Number(m?.was ?? 0))
    .map((m) => (Number(m.now) <= 0 ? `${m.name} not available` : `${m.name} ${m.now} of ${m.was}`))
    .join(", ");
}

/** "10:24" in Pakistan time, whatever the computer's own clock is set to. */
export function hhmm(iso: any): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi",
  }).format(new Date(t));
}

// The one money format of the panel (lib/format.ts) - whole rupees.
const rs = money;

export type StoryLine = {
  at: string;            // ISO time
  dot: "grey" | "green" | "red" | "yellow" | "blue";
  text: string;          // plain words; **bold** parts are marked with ** **
};

/**
 * THE ORDER'S STORY (board 3, right-hand column):
 *   10:19 Placed by Ayesha - 4 items - Rs 9,645 (promo SWAT10)
 *   10:21 Accepted by Tar Kora Mart
 *   10:24 Tar Kora Mart: Nutella not available, Ajwa Dates 1 of 2. Total ...
 *   10:24 Ayesha told in the app (push message) - asked to choose
 *   10:34 No answer in 10 min -> moved to Needs a call
 *   ...   Your call and her answer are written here
 *
 * `o` is the order (or a Needs-a-call row); `history` is the server's office
 * history, oldest first. Nothing here is guessed: every line comes from a
 * time the server wrote down, and "moved to Needs a call" is the moment her
 * 10 minutes ran out with nothing pressed.
 */
export function storyOf(o: any, history: any[], now: Date = new Date()): StoryLine[] {
  const out: StoryLine[] = [];
  const her = firstName(o?.customer_name) || "The customer";
  const store = String(o?.store_name ?? o?.restaurant_name ?? "The shop");
  const rows = [...(history || [])].sort((a, b) => String(a?.made_at).localeCompare(String(b?.made_at)));
  const firstAsk = rows.find((h) => h?.kind === "items_missing");

  if (o?.created_at) {
    // What she ordered at first: today's lines plus what went missing.
    const now0 = (o?.lines_now || []).length;
    const gone = (firstAsk?.lines || []).filter((m: any) => Number(m?.now) <= 0).length;
    const items = now0 + gone;
    const total = firstAsk?.total_before ?? o?.money?.total_before ?? o?.total_amount;
    const promo = o?.promo_code ?? o?.money?.promo_code;
    out.push({
      at: o.created_at, dot: "grey",
      text: `Placed by ${her}${items ? ` · ${items} item${items === 1 ? "" : "s"}` : ""}` +
        (total != null ? ` · **${rs(total)}**` : "") + (promo ? ` (promo ${promo})` : ""),
    });
  }
  if (o?.accepted_at) out.push({ at: o.accepted_at, dot: "green", text: `Accepted by **${store}**` });

  const who = (h: any) =>
    h?.made_by_role === "office" ? `Takal office${h?.made_by_name ? ` (${h.made_by_name})` : ""}`
    : h?.made_by_role === "customer" ? her
    : store;
  const late = (from: string, next: any) => {
    // Her 10 minutes from `from` ran out before anything else was pressed.
    const end = Date.parse(from) + WAIT_MINUTES * 60_000;
    const until = next ? Date.parse(String(next.made_at)) : now.getTime();
    if (Number.isFinite(end) && until > end) {
      out.push({ at: new Date(end).toISOString(), dot: "red", text: `**No answer in ${WAIT_MINUTES} min** → moved to **Needs a call**` });
    }
  };

  rows.forEach((h, i) => {
    const next = rows[i + 1];
    switch (h?.kind) {
      case "items_missing": {
        const gone = (h.lines || []).filter((m: any) => Number(m?.now) <= 0).map((m: any) => m.name);
        out.push({
          at: h.made_at, dot: "red",
          text: `${who(h)}: **${missingWords(h.lines)}**.` +
            (h.total_before != null && h.total_after != null ? ` Total **${rs(h.total_before)}** → **${rs(h.total_after)}**` : "") +
            (h.discount_before != null && Number(h.discount_before) > 0
              ? `, promo ${rs(h.discount_before)} → ${rs(h.discount_after)}` : "") + "." +
            (gone.length ? ` ${gone.join(", ")} set **Out of stock**.` : ""),
        });
        out.push({ at: h.made_at, dot: "yellow", text: `${her} told in the app (push message) · asked to choose` });
        late(h.made_at, next);
        break;
      }
      case "more_time":
        out.push({ at: h.made_at, dot: "blue", text: `${who(h)}: called — she will add items · **${WAIT_MINUTES} more min**` });
        late(h.made_at, next);
        break;
      case "answer":
        out.push(h.answer === "cancel"
          ? { at: h.made_at, dot: "red", text: `${who(h)}: **cancelled the whole order** — no strike` }
          : { at: h.made_at, dot: "green", text: `${who(h)}: **she keeps the rest**` });
        break;
      case "items_added": {
        const n = (h.lines || []).reduce((s: number, a: any) => s + (Number(a?.quantity) || 0), 0);
        out.push({
          at: h.made_at, dot: "green",
          text: `${her} **added ${n} item${n === 1 ? "" : "s"}**` +
            (h.total_before != null && h.total_after != null ? ` · total ${rs(h.total_before)} → **${rs(h.total_after)}**` : ""),
        });
        break;
      }
      case "all_missing":
        out.push({ at: h.made_at, dot: "red", text: `${who(h)}: nothing left — **the order ended** (Item not available)` });
        break;
    }
  });
  return out;
}

/** Split "a **b** c" into [{text:"a ",bold:false},{text:"b",bold:true},...]. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return String(text ?? "")
    .split("**")
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text !== "");
}
