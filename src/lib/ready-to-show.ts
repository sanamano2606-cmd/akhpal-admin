// ─────────────────────────────────────────────────────────────────────────────
// MOCK 216 - "READY TO SHOW" (approved by Sana 29 Oct 2026).
//
// "Few stores have fulfilled all requirements e.g. crown and they still in
// hidden part" -> "They Should move to separate portion from where i can
// confirm and show them to customers."
//
// The words on each row and in the confirm box. The server decides who is
// ready (routers/ready_to_show.py); this file only says it.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReadyShop } from "./api-stores";

/** "approved 28 Oct" - Pakistan's day, the day the office sees. */
export function approvedDay(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return "approved " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });
}

const productsWord = (n: number) => `${n} product${n === 1 ? "" : "s"} on sale`;

/** The green ticks under a READY shop. */
export function readyTicks(s: ReadyShop): string[] {
  const pics = s.pictures_total
    ? `${s.pictures_read} of ${s.pictures_total} pictures read - no phone number`
    : "Pictures read - no phone number";
  return ["Checklist done", productsWord(s.products_on_sale), pics, "Nothing marked Needs fix"];
}

/** What a PICTURES-UNREAD shop has done, and the one thing left. */
export function unreadLine(s: ReadyShop): { ticks: string[]; left: string } {
  return {
    ticks: ["Checklist done", productsWord(s.products_on_sale)],
    left: `${s.pictures_read ?? 0} of ${s.pictures_total ?? "?"} pictures read`,
  };
}

/** The confirm box's list - what the server checks again at that moment. */
export function confirmTicks(s: ReadyShop): string[] {
  return [
    "Shop details, address, map pin, hours, logo",
    `${productsWord(s.products_on_sale)}, every one with a picture`,
    s.pictures_total
      ? `${s.pictures_read} of ${s.pictures_total} pictures read - no phone number or website`
      : "Pictures read - no phone number or website",
    "Nothing marked Needs fix",
  ];
}

/** What the vendor is told (routers/restaurants_admin.py live_words). */
export const liveMessageStart = (name: string) =>
  `Mubarak ho! Aap ki dukan "${name}" ab customers ko nazar aa rahi hai`;

/** "Show all": every shop went through the door, which checked each one
 *  again. Say how many went live and name the ones that did not, with why. */
export function showAllResult(done: { name: string; ok: boolean; why?: string }[]): string {
  const ok = done.filter((d) => d.ok).length;
  const no = done.filter((d) => !d.ok);
  const head = ok === 0 ? "No shop went live." : `${ok} shop${ok === 1 ? " is" : "s are"} live now.`;
  if (!no.length) return head;
  return `${head} Not switched on: ${no.map((d) => `${d.name}${d.why ? ` (${d.why})` : ""}`).join(" · ")}`;
}
