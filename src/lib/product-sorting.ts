/**
 * STORES › PRODUCT SORTING - the screen's own rules, with no screen attached.
 * (Mock 210-3 / 210-4 / 210-5, approved by Sana 27 October 2026.)
 *
 * Which shelf a product belongs on is never decided here: a person chooses it.
 * This file only builds the search the server is asked, the words on the
 * buttons, and the address the Overview's "Sort now" opens.
 *
 * Checked in tests/mock-210-product-sorting.test.ts.
 */

export const SORTING_TABS = [
  { label: "Overview", href: "/dashboard/stores/sorting" },
  { label: "Find & move", href: "/dashboard/stores/sorting/find" },
  { label: "Sorting list", href: "/dashboard/stores/sorting/list" },
  { label: "Shelf check", href: "/dashboard/stores/sorting/shelf-check" },
] as const;

export type Quick = "piles" | "rx" | "no_picture" | "moved_by_takal";

/** The quick buttons under the search, in the order of the picture. */
export const QUICK_CHIPS: { key: Quick; label: string }[] = [
  { key: "piles", label: "In catch-all piles only" },
  { key: "rx", label: "Needs prescription" },
  { key: "no_picture", label: "No picture" },
  { key: "moved_by_takal", label: "Moved by Takal this week" },
];

export interface FindState {
  q: string;
  dept: string;
  shelf: string;
  shop: string;
  quick: Quick[];
}

export const EMPTY_FIND: FindState = { q: "", dept: "", shelf: "", shop: "", quick: [] };

const QUICK_KEYS = new Set<string>(QUICK_CHIPS.map((c) => c.key));

/** The question for the server. Empty parts are left out; quick buttons keep
 *  the picture's order whatever order they were pressed in. */
export function findQuery(s: FindState, offset = 0): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.dept) p.set("dept", s.dept);
  if (s.shelf) p.set("shelf", s.shelf);
  if (s.shop) p.set("shop", s.shop);
  const quick = QUICK_CHIPS.map((c) => c.key).filter((k) => s.quick.includes(k));
  if (quick.length) p.set("quick", quick.join(","));
  if (offset > 0) p.set("offset", String(offset));
  return p.toString();
}

/** The page's own address read back (a link from the Overview's "Sort now",
 *  or a refresh). Anything unknown is dropped, never sent on. */
export function readFindAddress(search: string): FindState {
  const p = new URLSearchParams(search || "");
  const quick = (p.get("quick") || "").split(",").map((x) => x.trim())
    .filter((x): x is Quick => QUICK_KEYS.has(x));
  return {
    q: (p.get("q") || "").slice(0, 120),
    dept: (p.get("dept") || "").slice(0, 120),
    shelf: (p.get("shelf") || "").slice(0, 64),
    shop: (p.get("shop") || "").slice(0, 64),
    quick: Array.from(new Set(quick)),
  };
}

/** "Sort now" on a department; "Open in Find & move" on a shop. */
export function sortNowHref(by: { dept?: string; shop?: string }): string {
  const q = findQuery({ ...EMPTY_FIND, dept: by.dept || "", shop: by.shop || "", quick: ["piles"] });
  return `/dashboard/stores/sorting/find?${q}`;
}

export type RxChoice = "keep" | "yes" | "no";

export const RX_CHOICES: { key: RxChoice; label: string }[] = [
  { key: "keep", label: "Keep as it is" },
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

/** The words after a move: "✓ 9 moved to Asthma & Breathing". */
export function movedWords(out: { moved: number; skipped?: number; gone?: number; shelf: string }): string {
  const n = out.moved;
  let w = `✓ ${n.toLocaleString()} ${n === 1 ? "product" : "products"} moved to ${out.shelf}`;
  if (out.skipped) w += ` · ${out.skipped.toLocaleString()} already there`;
  if (out.gone) w += ` · ${out.gone.toLocaleString()} no longer on Takal`;
  return w;
}

/** A sorted share for a bar: never below 0, never above 100. */
export function barWidth(percent: number | null | undefined): number {
  const n = Number(percent);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/** "Today 4:05 pm" / "26 Oct, 2:12 am" - Pakistan time, as the office reads it. */
export function whenWords(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", ...o }).format(d);
  const day = (x: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const time = fmt({ hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", " ").toLowerCase();
  return day(d) === day(now) ? `Today ${time}` : `${fmt({ day: "numeric", month: "short" })}, ${time}`;
}
