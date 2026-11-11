/**
 * MOCK 238 (Sana 11 Nov 2026: "Approved"): which lists sit on the All Stores
 * line and which go under "More ▾".
 *
 * Five on the line - the lists the office opens every day. The rest are
 * usually at 0, so they wait under More (a list chosen from More shows on the
 * line while it is open). My new shops and Cancellations left the tab bar;
 * More links to them - the pages, addresses and permissions are unchanged.
 * Example: "38 Live · 4 Something to tell · 0 Ready to show · 92 Hidden ·
 * 10 Suspended · More ▾".
 */
export const MAIN_VIEWS: string[] = ["live", "tell", "ready", "hidden", "suspended"];
export const MORE_VIEWS: string[] = ["pending", "rejected", "attention", "payout"];

export const MORE_PAGES: { href: string; label: string; was: string; icon: string; section: string }[] = [
  { href: "/dashboard/stores/onboarding", label: "Started by me", was: "My new shops", icon: "🧑‍💼", section: "stores.all" },
  { href: "/dashboard/stores/reliability", label: "Drop orders", was: "Cancellations", icon: "↩️", section: "stores.reliability" },
];

/** The word on the chip. "Hidden from customers" is "Hidden" on the line -
 *  the whole phrase stays on its hover text. */
export function chipLabel(key: string, label: string): string {
  return key === "hidden" ? "Hidden" : label;
}
