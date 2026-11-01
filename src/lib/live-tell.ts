// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS STILL TO TELL A LIVE SHOP.  (Mock 223, approved by Sana 1 Nov 2026:
// "Approved Please Build now".)
//
// Sana: "i want The Same review Here Too for these Live store so if there is
// still something To be told about so the admin could send that with
// WhatsApp message too."
//
// "To tell" is:
//   * Takal's SEVEN checks - the same ones a waiting shop has (server:
//     vendor_intake.shop_readiness, read for every live shop at once from
//     GET /admin/vendor-intake/live);
//   * and what the office marked "Needs fix" on the Review page and has not
//     sent yet (the list row's review_to_fix / review_state).
// The WhatsApp message carries the seven checks, in Roman Urdu, ending
// "reply to this message" - a live shop has no "Send for review again"
// button. The Review page's own WhatsApp carries the marked fixes with the
// reviewer's reasons; the row says to send those from there.
//
// Nothing here talks to the server. Tests: tests/mock-223-live-review.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type LiveStep = { key: string; label: string; done: boolean; note?: string };
export type LiveCheck = {
  id: string; steps: LiveStep[]; what_is_left: string[];
  products?: number; products_without_photo?: number;
};

export const MIN_PRODUCTS = 5;

export type TellItem = { key: string; words: string };

/** The short words for one missing check, as the row shows them. */
function rowWords(s: LiveStep, c: LiveCheck): string {
  switch (s.key) {
    case "payout": return "Where Takal sends your money";
    case "photos": {
      const n = Number(c.products_without_photo || 0);
      return n > 0 ? `${n.toLocaleString("en-US")} product${n === 1 ? "" : "s"} without a photo` : "No products yet";
    }
    case "products": return `${Number(c.products || 0)} of ${MIN_PRODUCTS} products`;
    case "place": return s.note && /pin/i.test(s.note) ? "No map pin" : "No address";
    case "details": return "No phone number";
    case "hours": return "No opening hours";
    case "logo": return "No shop logo";
    default: return s.label;
  }
}

/** Everything still to tell this live shop, review marks first.
 *  null check = not read yet (or could not be): nothing is claimed. */
export function tellItems(row: Record<string, any>, check: LiveCheck | null | undefined): TellItem[] {
  const out: TellItem[] = [];
  const marked = Number(row?.review_to_fix || 0);
  if (marked > 0 && row?.review_state !== "sent_back") {
    out.push({ key: "review", words: `Review: ${marked} marked Needs fix` });
  }
  for (const s of check?.steps || []) {
    if (!s.done) out.push({ key: s.key, words: rowWords(s, check as LiveCheck) });
  }
  return out;
}

/** The Roman Urdu name of each check, and what is wrong with it. */
function romanLine(s: LiveStep, c: LiveCheck): string {
  switch (s.key) {
    case "payout": return "Aap ki raqam kahan bheji jaye - abhi tak nahi di gayi.";
    case "photos": {
      const n = Number(c.products_without_photo || 0);
      return n > 0 ? `Har product ki tasveer - ${n.toLocaleString("en-US")} products ki tasveer nahi hai.`
        : "Products - abhi koi product nahi hai.";
    }
    case "products": return `Kam az kam ${MIN_PRODUCTS} products - abhi ${Number(c.products || 0)} hain.`;
    case "place": return s.note && /pin/i.test(s.note) ? "Map ka pin - abhi nahi laga."
      : "Dukan ka pata - abhi nahi likha.";
    case "details": return "Dukan ka phone number - abhi nahi diya.";
    case "hours": return "Dukan khulne aur band hone ka waqt - abhi nahi diya.";
    case "logo": return "Dukan ka logo - abhi nahi lagaya.";
    default: return `${s.label}.`;
  }
}

/** The WhatsApp message for a LIVE shop - the same shape as the Review
 *  page's Roman Urdu send-back (shop_review.whatsapp_text_roman, live=True). */
export function liveMessage(ownerName: string | null | undefined, shopName: string | null | undefined,
                            check: LiveCheck): string {
  const first = String(ownerName || "").trim().split(/\s+/)[0] || "";
  const missing = (check?.steps || []).filter((s) => !s.done);
  const n = missing.length;
  const lines = [`Assalam o Alaikum${first ? " " + first : ""},`, "",
    `Takal ne aap ki dukan "${String(shopName || "").trim() || "aap ki dukan"}" check ki hai. Meherbani kar ke Takal `
      + `Partners app mein ${n === 1 ? "yeh cheez" : `yeh ${n} cheezen`} theek kar dein:`, ""];
  missing.forEach((s, i) => { lines.push(`${i + 1}. ${romanLine(s, check)}`); });
  lines.push("", "Theek karne ke baad isi message ka jawab de dein.", "", "Shukriya,", "Takal Team");
  return lines.join("\n");
}
