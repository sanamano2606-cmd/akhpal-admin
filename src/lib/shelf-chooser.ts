/**
 * ONE SIMPLE SHELF CHOOSER - the rules, with no screen attached.
 * (Mock 210-1 / 210-2, approved by Sana 27 October 2026: "Approved. Searching
 * name of a shelf category or department is a good idea.")
 *
 * Sana, 27 Oct 2026: "the window ... start from the main store type name then
 * Department then category then shelf which is not easy to manage. reading all
 * then chose and most of them are hidden because the long track mention."
 *
 * So the long path is never the first thing anybody reads again:
 *   * the CLOSED box shows the shelf name first, and where it sits on a small
 *     second line ("Asthma & Breathing" / "Health & Pharmacy · Medicines");
 *   * the WINDOW walks in one step at a time: Department → Group → Shelf;
 *   * or the person types - a shelf, a group or a department name.
 *
 * Every screen already hands the picker a list of `CategoryOption`s whose
 * `label` is the whole path ("Health & Pharmacy › Medicines › Allergy"). This
 * file turns that flat list into the three columns, so NO caller had to
 * change what it sends. Lines from `shelfOptions` (lib/shelves.ts) also carry
 * `section` ("YOUR SHOP") and `dept` (the slug), which are used when present.
 *
 * Checked in tests/mock-210-shelf-chooser.test.ts.
 */

import type { CategoryOption } from "./category-search.ts";

export interface ChooserOption extends CategoryOption {
  /** The department's slug ("health-and-pharmacy"), when the caller knows it. */
  dept?: string;
}

export interface ShelfGroup {
  /** "" = shelves straight under the department ("Other shelves"). */
  name: string;
  /** What the screen prints: the group's name, or "Other shelves". */
  title: string;
  shelves: ChooserOption[];
  /** The group ITSELF, when the caller lets a group be chosen (a filter). */
  self?: ChooserOption;
}

export interface Department {
  name: string;
  slug: string;
  /** A department this shop sells in - shown first, under its own heading. */
  own: boolean;
  groups: ShelfGroup[];
  /** The department ITSELF, when the caller lets it be chosen (a filter). */
  self?: ChooserOption;
  /** How many shelves sit inside (every group). */
  count: number;
}

export const OTHER_SHELVES = "Other shelves";

/** "Health & Pharmacy › Medicines › Allergy" -> its parts. Both the new "›"
 *  and the older ">" are understood; empty parts are dropped. */
export function pathParts(label: string): string[] {
  return String(label || "").split(/\s*[›>]\s*/).map((p) => p.trim()).filter(Boolean);
}

/** "Baby, Kids & Toys" -> "baby-kids-and-toys": the same spelling the
 *  database gives its department slugs, so a caller that sends only the label
 *  still gets the department's own colour. */
export function slugOf(name: string): string {
  return String(name || "").toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Where an option sits, read from its label: department, group, shelf. A
 *  shelf straight under its department has no group (""). A one-part label is
 *  a department on its own. Deeper paths keep everything between the first
 *  and the last part as the group ("Fashion › Men › Shirts" -> group "Men"). */
export function placeOf(o: CategoryOption): { dept: string; group: string; shelf: string; depth: number } {
  const parts = pathParts(o.label);
  if (parts.length <= 1) return { dept: parts[0] || o.label || "", group: "", shelf: "", depth: 1 };
  const dept = parts[0];
  const shelf = parts[parts.length - 1];
  const group = parts.slice(1, -1).join(" › ");
  return { dept, group, shelf, depth: parts.length };
}

/**
 * The flat list as three columns. Keeps the order it was given (the server
 * already puts the shop's own department first). An option whose label is
 * a department or a group on its own becomes that column's `self` - a filter
 * may choose "everything in Medicines"; a product window never sends such
 * lines, so it never offers them.
 */
export function buildDepartments(options: ChooserOption[], ownSection = "YOUR SHOP"): Department[] {
  const out: Department[] = [];
  const byName = new Map<string, Department>();
  const dept = (name: string, o?: ChooserOption) => {
    let d = byName.get(name);
    if (!d) {
      d = { name, slug: (o?.dept) || slugOf(name), own: false, groups: [], count: 0 };
      byName.set(name, d);
      out.push(d);
    }
    if (o?.dept && !d.slug) d.slug = o.dept;
    return d;
  };
  const group = (d: Department, name: string) => {
    let g = d.groups.find((x) => x.name === name);
    if (!g) {
      g = { name, title: name || OTHER_SHELVES, shelves: [] };
      d.groups.push(g);
    }
    return g;
  };
  // Every option with a deeper path first marks which names are departments
  // and groups, so a lone "Medicines" line becomes the GROUP it is.
  const groupNames = new Set<string>();
  for (const o of options) {
    const p = placeOf(o);
    if (p.depth >= 3) groupNames.add(`${p.dept}\u0000${p.group}`);
  }
  for (const o of options) {
    if (!o.id) continue;
    const p = placeOf(o);
    const d = dept(p.dept, o);
    if (o.section === ownSection) d.own = true;
    if (p.depth === 1) { d.self = o; continue; }
    if (p.depth === 2 && groupNames.has(`${p.dept}\u0000${p.shelf}`)) {
      group(d, p.shelf).self = o;
      continue;
    }
    group(d, p.group).shelves.push(o);
    d.count += 1;
  }
  // A department with a "self" only and nothing inside still shows, so a
  // filter can choose it. Groups with neither shelves nor self are dropped.
  for (const d of out) d.groups = d.groups.filter((g) => g.shelves.length || g.self);
  // Groups with a name first, "Other shelves" last - it is the leftovers.
  for (const d of out) {
    d.groups.sort((a, b) => Number(a.name === "") - Number(b.name === ""));
  }
  // Own departments first, keeping their given order otherwise.
  return out.map((d, i) => ({ d, i }))
    .sort((a, b) => (Number(b.d.own) - Number(a.d.own)) || (a.i - b.i))
    .map((x) => x.d);
}

/** What the CLOSED box prints: the shelf, big - and where it sits, small.
 *  "Asthma & Breathing" / "Health & Pharmacy · Medicines". A department or a
 *  group chosen on its own prints "All of Medicines" / "Health & Pharmacy". */
export function boxWords(o: CategoryOption | undefined): { main: string; where: string } {
  if (!o) return { main: "", where: "" };
  const p = placeOf(o);
  if (p.depth === 1) return { main: `All of ${p.dept}`, where: "" };
  const where = [p.dept, p.group].filter(Boolean).join(" · ");
  return { main: p.shelf, where };
}

/**
 * Typed words: the best matches first. A shelf whose OWN name has every
 * word comes first ("baby" -> "Baby Clothing"), then one found by its group,
 * then one found only by its department ("Outdoor Toys" in "Baby, Kids &
 * Toys"). Inside each, the order the server gave is kept.
 */
export function rankFound<T extends CategoryOption>(found: T[], words: string[]): T[] {
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const tier = (o: T) => {
    const p = placeOf(o);
    if (has(p.depth === 1 ? p.dept : p.shelf)) return 0;
    if (has(`${p.group} ${p.shelf}`)) return 1;
    return 2;
  };
  return found.map((o, i) => ({ o, i, t: tier(o) }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i))
    .map((x) => x.o);
}

// ── "Used lately" ───────────────────────────────────────────────────────────
// The last three shelves this person chose, kept in THIS browser only. A
// per-viewer convenience: an empty or blocked storage simply shows no chips.

export const RECENT_KEY = "takal.shelfChooser.recent";
export const RECENT_MAX = 3;

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined;

export function readRecent(store: Store): string[] {
  try {
    const raw = store?.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string" && x).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** The new list, newest first, without repeats - also written to `store`. */
export function rememberRecent(store: Store, id: string): string[] {
  const now = [id, ...readRecent(store).filter((x) => x !== id)].filter(Boolean).slice(0, RECENT_MAX);
  try { store?.setItem(RECENT_KEY, JSON.stringify(now)); } catch { /* private window - just not kept */ }
  return now;
}
