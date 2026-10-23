// ─────────────────────────────────────────────────────────────────────────────
// THE WAITING SHOPS, MADE EASY TO WORK THROUGH.  (Audit 23 October 2026.)
//
// "New vendors are registering their shops and I am facing difficulties in
// managing them." What the audit found:
//   * nothing on the menu said shops were waiting - only a Dashboard tile;
//   * the Waiting list opened A-Z, so the shop waiting longest was anywhere;
//   * no way to see only the shops that are READY to approve;
//   * the only way to tell a vendor what to fix was to REJECT the shop.
// The rules for the answers are here, with no screen attached, so they can be
// tested on their own (tests/vendor-queue.test.ts).
//
// Pure on purpose (no "@/" imports): the panel's tests run this file directly.
// ─────────────────────────────────────────────────────────────────────────────

export type WaitingCheck = {
  ready: boolean;
  days_waiting: number | null;
  what_is_left: string[];
};

export type ReadyFilter = "all" | "ready" | "missing";

export const READY_FILTERS: { key: ReadyFilter; label: string }[] = [
  { key: "all", label: "All waiting" },
  { key: "ready", label: "Ready to approve" },
  { key: "missing", label: "Still missing something" },
];

/** Does a waiting shop pass the filter? A shop whose checklist could not be
 *  read is never hidden by "ready" being unknown - it shows under "All" and
 *  "Still missing", where a person will look at it. */
export function passesReady(check: WaitingCheck | undefined, f: ReadyFilter): boolean {
  if (f === "all") return true;
  if (f === "ready") return !!check?.ready;
  return !check?.ready;
}

/**
 * The Waiting list in the order to work it: READY shops first (one click
 * each), then the ones waiting longest. A shop with no checklist goes last.
 * Ties keep the order they came in (A-Z), so the list never jumps about.
 */
export function waitingOrder<T extends { id?: unknown }>(
  stores: readonly T[], checks: Record<string, WaitingCheck | undefined>,
): T[] {
  const rank = (s: T) => {
    const c = checks[String(s.id)];
    if (!c) return [2, 0];
    return [c.ready ? 0 : 1, -(c.days_waiting ?? -1)];
  };
  return stores
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.s);
}

/** A Pakistani mobile in the form WhatsApp wants: 923XXXXXXXXX. "" = not one.
 *  0092.., 92.., 3.. and 03.. are all accepted, Urdu and Arabic digits too. */
export function waNumber(phone: unknown): string {
  if (typeof phone !== "string") return "";
  let d = phone
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("03")) d = "92" + d.slice(1);
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d.length === 12 && d.startsWith("923") ? d : "";
}

/** The message that tells a vendor what is left - instead of rejecting the
 *  shop to say it. */
export function whatIsLeftMessage(shop: string, left: string[]): string {
  const name = (shop || "your shop").trim();
  if (!left.length) {
    return `Assalam o Alaikum! ${name} is ready on Takal - we are approving it now. Thank you.`;
  }
  return [
    `Assalam o Alaikum! Thank you for registering ${name} on Takal.`,
    "Before we can open it for customers, please finish these in the Takal Partners app:",
    ...left.map((x, i) => `${i + 1}. ${x}`),
    "Reply here if you need help.",
  ].join("\n");
}

/** A wa.me link with the message filled in, or "" when there is no usable number. */
export function whatsappLink(phone: unknown, message: string): string {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : "";
}

/** The phone a shop can be reached on, from whichever field the list carries. */
export function shopPhone(r: Record<string, any> | null | undefined): string {
  if (!r) return "";
  for (const v of [r.phone, r.owner_phone, r.owner?.phone, r.contact_phone]) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
