// ─────────────────────────────────────────────────────────────────────────────
// SORT THE STORE LIST  (Mock 178, approved by Sana 10 October 2026)
//
// Sana: "I want The sort by button fully functional and the default is by A-Z".
// Stores -> All Stores gets a "Sort by" box. It only puts the stores the other
// boxes (search, status, type) already chose IN ORDER - it never hides one.
//
// The rules, the same for every choice:
//   * A-Z the human way: capital and small letters count the same, numbers in
//     order ("Shop 2" before "Shop 10"), spaces at the start ignored.
//   * A tie is broken by the name A-Z, then by the id - so the order never
//     jumps about between two refreshes.
//   * Something unknown (no name, no date, no owner) goes LAST, whichever way
//     round - it is never mistaken for "the first" or "the newest".
//
// Pure on purpose (no "@/" imports): the panel's tests run this file directly.
// ─────────────────────────────────────────────────────────────────────────────

export const STORE_SORTS = [
  { value: "name_az", label: "Name A–Z" },
  { value: "name_za", label: "Name Z–A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "type", label: "Store type A–Z" },
  { value: "owner", label: "Owner A–Z" },
  { value: "status", label: "Status (Pending first)" },
  { value: "open", label: "Open now first" },
] as const;

export type StoreSort = (typeof STORE_SORTS)[number]["value"];

/** What the page opens with (Sana: "the default is by A-Z"). */
export const DEFAULT_STORE_SORT: StoreSort = "name_az";

/** The address may carry ?sort=... - anything that is not one of the eight
 *  (typed by hand, an old link) is simply the default, never an error. */
export function readStoreSort(raw: unknown): StoreSort {
  const v = typeof raw === "string" ? raw.trim() : "";
  return (STORE_SORTS.some((s) => s.value === v) ? v : DEFAULT_STORE_SORT) as StoreSort;
}

/** Pending first, then live, then turned down, then on hold. */
export const STATUS_ORDER: Record<string, number> = {
  pending: 0, approved: 1, rejected: 2, suspended: 3,
};

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** a before b by text; blank text always last. */
function byText(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b);
}

function when(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** a before b by time; an unknown time always last. */
function byTime(a: number | null, b: number | null, newestFirst: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return newestFirst ? b - a : a - b;
}

export type StoreSortHelp = {
  /** "pending" | "approved" | "rejected" | "suspended" - the page's own badge rule. */
  statusOf: (store: any) => string;
  /** The store type as the page shows it ("Food & Drinks", "Fashion" ...). */
  typeLabelOf: (store: any) => string;
};

/** A NEW list in the chosen order; the one given is not changed. */
export function sortStores<T extends Record<string, any>>(
  stores: readonly T[], sort: StoreSort, help: StoreSortHelp,
): T[] {
  const name = (s: T) => text(s?.name);
  const tie = (a: T, b: T) =>
    byText(name(a), name(b)) || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));

  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "name_za": {
        const an = name(a), bn = name(b);
        if (!an || !bn) return byText(an, bn) || tie(a, b);   // blank stays last
        return collator.compare(bn, an) || tie(a, b);
      }
      case "newest":
        return byTime(when(a?.created_at), when(b?.created_at), true) || tie(a, b);
      case "oldest":
        return byTime(when(a?.created_at), when(b?.created_at), false) || tie(a, b);
      case "type":
        return byText(text(help.typeLabelOf(a)), text(help.typeLabelOf(b))) || tie(a, b);
      case "owner":
        return byText(text(a?.owner_name), text(b?.owner_name)) || tie(a, b);
      case "status": {
        const ra = STATUS_ORDER[help.statusOf(a)] ?? 9;
        const rb = STATUS_ORDER[help.statusOf(b)] ?? 9;
        return ra - rb || tie(a, b);
      }
      case "open":
        return (b?.open_now === true ? 1 : 0) - (a?.open_now === true ? 1 : 0) || tie(a, b);
      case "name_az":
      default:
        return tie(a, b);
    }
  };
  return [...stores].sort(compare);
}
