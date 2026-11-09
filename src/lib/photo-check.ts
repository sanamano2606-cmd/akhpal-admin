/**
 * STORES › PRODUCT SORTING › PHOTO CHECK - the screen's own rules, with no
 * screen attached. (Mock 236, approved by Sana 9 November 2026.)
 *
 * Products whose photo does not match their name, store by store. What is
 * done to a product (rename, new photo, it is correct, undo) is always the
 * server's job (backend photo_checks.py); this file only decides what the
 * screen SHOWS: the groups, the order, the pictures, the words on the tags.
 *
 * Checked in tests/mock-236-photo-check.test.ts.
 */

export type PhotoShow = "open" | "fixed" | "all";
export type PhotoFix = "renamed" | "photo_changed" | "photo_added" | "photo_taken_off" | "switched_off" | "marked_correct";

export interface PhotoCheckItem {
  id: string;
  product_id: string;
  shop_id: string;
  shop: string;
  problem: "mismatch" | "no_photo";
  state: "open" | "fixed" | "correct";
  why: string;
  fix: PhotoFix | null;
  name: string;
  photo: string | null;
  on_sale: boolean;
  old_name: string | null;
  new_name: string | null;
  old_photo: string | null;
  new_photo: string | null;
  found_by: string | null;
  found_at: string | null;
  fixed_by: string | null;
  fixed_at: string | null;
  can_undo: boolean;
}

export interface PhotoCheckList {
  items: PhotoCheckItem[];
  counts: { open: number; fixed: number; all: number };
  stores: { id: string; name: string; open: number; all: number }[];
  last_weekly: string | null;
}

export interface PhotoSuggestion { product_id: string; name: string; photo: string; shop: string }

export const SHOW_CHIPS: { key: PhotoShow; label: (c: PhotoCheckList["counts"]) => string; tone: string }[] = [
  { key: "open", label: (c) => `${c.open} Need work`, tone: "text-takal-red" },
  { key: "fixed", label: (c) => `${c.fixed} Fixed`, tone: "text-takal-green" },
  { key: "all", label: (c) => `All ${c.all}`, tone: "text-takal-ink" },
];

export const FIX_WORDS: Record<PhotoFix, string> = {
  renamed: "Renamed to match the photo",
  photo_changed: "Right photo put on",
  photo_added: "Photo added",
  photo_taken_off: "Wrong photo taken off",
  switched_off: "Switched off",
  marked_correct: "Marked correct",
};

export const isOpen = (i: PhotoCheckItem) => i.state === "open";

/** The red or green tag under the name. */
export function tagFor(i: PhotoCheckItem): { text: string; tone: "red" | "green" } {
  if (isOpen(i)) {
    return i.problem === "no_photo"
      ? { text: "No photo · needs a real one", tone: "red" }
      : { text: "Photo and name do not match", tone: "red" };
  }
  const how = i.fix ? FIX_WORDS[i.fix] : "Fixed";
  const when = shortDay(i.fixed_at);
  return { text: `Fixed${when ? " " + when : ""} · ${how}`, tone: "green" };
}

/** Which pictures a row shows, left to right.
 *  - open, no photo:    the removed wrong photo (marked "removed") -> "No photo"
 *  - open, mismatch:    the photo it shows now
 *  - fixed with a photo change: old (red edge) -> new
 *  - renamed / correct: the photo it shows now */
export function picsFor(i: PhotoCheckItem): { old: string | null; now: string | null; arrow: boolean; removed: boolean } {
  if (isOpen(i) && i.problem === "no_photo") {
    return { old: i.old_photo, now: null, arrow: true, removed: true };
  }
  if (isOpen(i)) return { old: null, now: i.photo, arrow: false, removed: false };
  if (i.fix === "photo_changed" || i.fix === "photo_added") {
    return { old: i.old_photo, now: i.new_photo || i.photo, arrow: true, removed: false };
  }
  return { old: null, now: i.photo, arrow: false, removed: false };
}

/** The crossed-out old name, only when it really changed. */
export function wasName(i: PhotoCheckItem): string | null {
  return i.old_name && i.old_name !== i.name ? i.old_name : null;
}

/** Buttons on a row, in the order of the picture. */
export function actionsFor(i: PhotoCheckItem): ("add_photo" | "rename" | "change_photo" | "correct" | "undo")[] {
  if (!isOpen(i)) return i.can_undo ? ["undo"] : [];
  return i.problem === "no_photo" ? ["add_photo", "rename"] : ["rename", "change_photo", "correct"];
}

/** Store cards: the stores with the most work first, then A to Z; inside a
 *  store, open rows first, then A to Z. */
export function byStore(items: PhotoCheckItem[]) {
  const map = new Map<string, { id: string; name: string; items: PhotoCheckItem[] }>();
  for (const i of items) {
    if (!map.has(i.shop_id)) map.set(i.shop_id, { id: i.shop_id, name: i.shop, items: [] });
    map.get(i.shop_id)!.items.push(i);
  }
  const cards = [...map.values()].map((c) => ({
    ...c,
    open: c.items.filter(isOpen).length,
    fixed: c.items.filter((x) => !isOpen(x)).length,
    items: [...c.items].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || a.name.localeCompare(b.name)),
  }));
  return cards.sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/** Pakistan date, short: "9 Nov". */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" }).format(d);
}

/** "Mon 16 Nov, 9:47 am" for the yellow note; empty when never run. */
export function weeklyWords(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" })
    .format(d).toLowerCase().replace(/\s/g, " ");
  return `${day.replace(",", "")}, ${time}`;
}

/** A name the server will take: 2 to 150 letters after tidying spaces. */
export function nameProblem(name: string): string | null {
  const n = name.split(/\s+/).filter(Boolean).join(" ");
  if (n.length < 2) return "Please type a name of at least 2 letters.";
  if (n.length > 150) return "A name can be at most 150 letters.";
  return null;
}
