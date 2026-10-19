/**
 * EVERY PRODUCT ON ITS RIGHT SHELF - the panel's own rules, with no screen
 * attached. (Mock 201, approved by Sana 19 October 2026: "Approved. Please
 * build exactly the same".)
 *
 *   board 4, picture 1  Stores › Categories - the shelf manager
 *   board 4, picture 2  Add a whole catalogue - "Check the shelves"
 *   board 4, picture 3  Stores › Shelf check - wrong-shelf groups, with undo
 *
 * WHAT IS NOT HERE: which shelf a product belongs on. That is the SERVER's
 * (backend shelf suggester), the same answer the Partners app gets, so the two
 * can never disagree. This file only orders, counts, filters and labels what
 * the server sends. Every new field is OPTIONAL: an older server simply does
 * not send it, and the screens then look exactly as they did before.
 *
 * Checked in tests/mock-201-shelves.test.ts.
 */

import type { CategoryOption } from "./category-search.ts";

// ── Department colours ──────────────────────────────────────────────────────
//
// The customer app's own colours (customer_app/lib/theme/type_marks.dart,
// kTypeRings), the same ones board 1 of Mock 201 used. One department, one
// colour, in every app.

export const DEPT_COLOURS: Record<string, [deep: string, bright: string]> = {
  "food-and-drinks": ["#D25105", "#FF9A33"],
  "grocery-and-fresh": ["#067A25", "#A0CE3E"],
  "health-and-pharmacy": ["#00707A", "#19B8C4"],
  "beauty-and-personal-care": ["#C2185B", "#F06292"],
  "fashion": ["#4527A0", "#7E57C2"],
  "electronics-and-mobiles": ["#0F3391", "#5C72E4"],
  "home-and-living": ["#8D5524", "#D9A066"],
  "baby-kids-and-toys": ["#0277BD", "#4FC3F7"],
  "sports-and-outdoors": ["#D84315", "#FF8A65"],
  "books-stationery-and-hobbies": ["#6D4C41", "#A1887F"],
  "pets": ["#689F38", "#C5E1A5"],
  "flowers-and-gifts": ["#8E24AA", "#CE93D8"],
  "automotive": ["#37474F", "#90A4AE"],
};

/** A department nobody has given a colour yet: quiet grey, never missing. */
export const NO_COLOUR: [string, string] = ["#8A8A8A", "#C9C9C9"];

export function deptColour(slug?: string | null): [string, string] {
  return (slug && DEPT_COLOURS[slug]) || NO_COLOUR;
}

// ── The tree the server sends ───────────────────────────────────────────────

export interface ShelfNode {
  id: string;
  parent_id?: string | null;
  name: string;
  name_ur?: string | null;
  slug?: string | null;
  display_order?: number;
  is_active?: boolean;
  needs_prescription?: boolean;
  is_new?: boolean;
  own?: boolean;
  product_count?: number;
  product_count_total?: number;
  total?: number;
  shop_types?: string[];
  children?: ShelfNode[];
}

/** Own department(s) first, then the order the office set. The server already
 *  sends them in this order; doing it again here means a cached or older
 *  answer can never put another department above the shop's own. */
export function ownFirst<T extends ShelfNode>(roots: T[], ownSlugs: string[] = []): T[] {
  const own = new Set(ownSlugs);
  const isOwn = (n: T) => n.own === true || (!!n.slug && own.has(n.slug));
  return roots
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (Number(isOwn(b.n)) - Number(isOwn(a.n))) || (a.i - b.i))
    .map((x) => x.n);
}

/** True when the server answered with every department (the new picker).
 *  An older server answers with the shop's own department only. */
export function hasAllDepartments(res: { own_slugs?: unknown; tree?: ShelfNode[] } | null | undefined): boolean {
  return !!res && Array.isArray(res.own_slugs);
}

export interface ShelfOption extends CategoryOption {
  /** The heading this line sits under in the picker: "YOUR SHOP" / "OTHER DEPARTMENTS". */
  section?: string;
  rx?: boolean;
  isNew?: boolean;
  dept?: string;
}

export const YOUR_SHOP = "YOUR SHOP";
export const OTHER_DEPARTMENTS = "OTHER DEPARTMENTS";

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" › ");

/**
 * The picker's lines: the shelves (leaves) only, own department first, then
 * "Other departments". The department is in every label, so typing "laundry"
 * or "grocery" finds the shelf by its department too.
 *
 * With an older server (one department only) the labels are exactly as
 * before - "Medicines › Over the Counter" - and there are no headings.
 */
export function shelfOptions(res: { tree?: ShelfNode[]; own_slugs?: string[] } | null | undefined): ShelfOption[] {
  const tree = (res?.tree || []) as ShelfNode[];
  const all = hasAllDepartments(res);
  const roots = all ? ownFirst(tree, res?.own_slugs || []) : tree;
  const out: ShelfOption[] = [];
  for (const top of roots) {
    const section = all ? ((top.own || (res?.own_slugs || []).includes(top.slug || "")) ? YOUR_SHOP : OTHER_DEPARTMENTS) : undefined;
    const push = (n: ShelfNode, path: string[]) => {
      const kids = n.children || [];
      if (kids.length) {
        for (const k of kids) push(k, [...path, n.name]);
        return;
      }
      out.push({
        id: String(n.id),
        label: join([...path, n.name]),
        section,
        rx: !!n.needs_prescription,
        isNew: !!n.is_new,
        dept: top.slug || "",
      });
    };
    const kids = top.children || [];
    if (!kids.length) { push(top, []); continue; }
    // With every department, the department name leads the label; with the
    // old answer it never did, so it stays off.
    for (const k of kids) push(k, all ? [top.name] : []);
  }
  return out;
}

export interface LeafInfo {
  id: string;
  name: string;
  name_ur?: string | null;
  dept: string;
  deptName: string;
  path: string;
  rx: boolean;
}

/** shelf id -> where it sits, for the department colour dot and the Rx tag. */
export function leafIndex(tree: ShelfNode[] | null | undefined): Map<string, LeafInfo> {
  const out = new Map<string, LeafInfo>();
  for (const top of tree || []) {
    const walk = (n: ShelfNode, path: string[]) => {
      const kids = n.children || [];
      if (kids.length) { for (const k of kids) walk(k, [...path, n.name]); return; }
      out.set(String(n.id), {
        id: String(n.id), name: n.name, name_ur: n.name_ur, dept: top.slug || "",
        deptName: top.name, path: join(path), rx: !!n.needs_prescription,
      });
    };
    walk(top, []);
  }
  return out;
}

// ── Picture 1: the shelf manager ────────────────────────────────────────────

export interface DeptSummary {
  id: string;
  name: string;
  slug: string;
  shelves: number;
  newShelves: number;
  products: number;
}

/** A leaf is a shelf; a node with children is a department or a group. */
export function countLeaves(n: ShelfNode): { shelves: number; fresh: number } {
  const kids = n.children || [];
  if (!kids.length) return { shelves: 1, fresh: n.is_new ? 1 : 0 };
  return kids.map(countLeaves).reduce((a, b) => ({ shelves: a.shelves + b.shelves, fresh: a.fresh + b.fresh }),
    { shelves: 0, fresh: 0 });
}

export function departmentsSummary(roots: ShelfNode[]): DeptSummary[] {
  return roots.map((d) => {
    const c = (d.children || []).length ? countLeaves(d) : { shelves: 0, fresh: 0 };
    return {
      id: String(d.id), name: d.name, slug: d.slug || "",
      shelves: c.shelves, newShelves: c.fresh,
      products: Number(d.total ?? d.product_count_total ?? d.product_count ?? 0),
    };
  });
}

/** "13 departments · 305 shelves". */
export function headline(roots: ShelfNode[]): string {
  const s = departmentsSummary(roots).reduce((n, d) => n + d.shelves, 0);
  return `${roots.length} department${roots.length === 1 ? "" : "s"} · ${s.toLocaleString()} shel${s === 1 ? "f" : "ves"}`;
}

export type ShelfRow =
  | { kind: "section"; key: string; title: string; titleUr?: string | null; group?: ShelfNode }
  | { kind: "shelf"; key: string; node: ShelfNode; siblings: ShelfNode[] };

/**
 * The rows of one department, as picture 1 draws them: the shelves that sit
 * straight under the department under the heading "Shelves" first, then each
 * group with its own heading. A shelf's arrows move it among its REAL
 * brothers and sisters (`siblings`), in the order the office set - so a move
 * never renumbers a level it cannot see.
 */
export function shelfRows(dept: ShelfNode): ShelfRow[] {
  const kids = dept.children || [];
  const direct = kids.filter((k) => !(k.children || []).length);
  const groups = kids.filter((k) => (k.children || []).length);
  const out: ShelfRow[] = [];
  if (direct.length) {
    out.push({ kind: "section", key: `${dept.id}:shelves`, title: "Shelves" });
    for (const s of direct) out.push({ kind: "shelf", key: String(s.id), node: s, siblings: kids });
  }
  for (const g of groups) {
    out.push({ kind: "section", key: String(g.id), title: g.name, titleUr: g.name_ur, group: g });
    const leaves: ShelfNode[] = [];
    const walk = (n: ShelfNode) => {
      for (const c of n.children || []) {
        if ((c.children || []).length) walk(c); else leaves.push(c);
      }
    };
    walk(g);
    for (const s of leaves) out.push({ kind: "shelf", key: String(s.id), node: s, siblings: g.children || [] });
  }
  return out;
}

/** What the Rx switch asks before it changes anything (products move with it). */
export function rxConfirmText(shelf: string, products: number, on: boolean): string {
  const n = products.toLocaleString();
  return on
    ? `Mark “${shelf}” as needing a prescription? Its ${n} product${products === 1 ? "" : "s"} will show the Rx mark, and customers are asked for the prescription photo.`
    : `Take the prescription mark off “${shelf}”? Its ${n} product${products === 1 ? " is" : "s are"} checked again by the medicine rule - a medicine that is not on the safe list keeps its Rx mark.`;
}

/** The answer after the switch, in words. */
export function rxDoneText(on: boolean, changed: number | null | undefined): string {
  const head = on ? "Needs a prescription now" : "Prescription mark taken off";
  if (typeof changed !== "number") return head;
  return `${head} · ${changed.toLocaleString()} product${changed === 1 ? "" : "s"} changed`;
}

/** Which kinds of shop call this department their own, in words. */
export function mainDepartmentOf(codes: string[] | undefined, names: { code: string; name: string }[]): string {
  const list = (codes || []).map((c) => names.find((t) => t.code === c)?.name || c);
  return list.length ? list.join(" · ") : "no kind of shop yet";
}

// ── Picture 2: Add a whole catalogue - "Check the shelves" ───────────────────

export type ShelfSure = "sure" | "not_sure";

export interface ShelfProduct {
  name: string;
  rows?: number[];
  category_id?: string;
  image_url?: string;
  rx?: boolean;
  needs_prescription?: boolean;
  shelf_sure?: ShelfSure | string;
  sheet_said?: string;
  shelf_why?: string;
  [k: string]: unknown;
}

export interface BigShelf { category_id: string; shelf: string; count: number }

export interface ShelfCheckResult {
  products: ShelfProduct[];
  shelf_counts?: { sure: number; not_sure: number; rx: number };
  big_shelves?: BigShelf[];
}

/** A server that chooses a shelf for every product (Mock 201). An older one
 *  answers with the word-by-word step 3 of Mock 184 instead. */
export function perProduct(r: ShelfCheckResult | null | undefined): boolean {
  if (!r) return false;
  return !!r.shelf_counts || (r.products || []).some((p) => typeof p.shelf_sure === "string");
}

export type Overrides = Record<number, string>;

/** The shelf a product goes on now: the person's own choice wins. */
export const shelfOf = (p: ShelfProduct, i: number, o: Overrides) => (i in o ? o[i] : p.category_id || "");

/** Sure = the server was sure, or a person chose the shelf. */
export function isSure(p: ShelfProduct, i: number, o: Overrides): boolean {
  if (i in o) return !!o[i];
  return p.shelf_sure === "sure" && !!p.category_id;
}

export function isRx(p: ShelfProduct, i: number, o: Overrides, leaves?: Map<string, LeafInfo>): boolean {
  if (i in o) return !!leaves?.get(o[i])?.rx || !!p.needs_prescription;
  return !!(p.rx || p.needs_prescription);
}

export interface ShelfTotals { sheet: number; sure: number; notSure: number; rx: number; changed: number }

/** The four tiles. Worked out from the products themselves, so a person's
 *  changes move the numbers at once; the server's own counts are used only
 *  before anything was changed (they cover rows this page never drew). */
export function shelfTotals(r: ShelfCheckResult, o: Overrides, leaves?: Map<string, LeafInfo>): ShelfTotals {
  const ps = r.products || [];
  const changed = Object.keys(o).length;
  if (!changed && r.shelf_counts) {
    return { sheet: ps.length, sure: r.shelf_counts.sure, notSure: r.shelf_counts.not_sure,
      rx: r.shelf_counts.rx, changed: 0 };
  }
  let sure = 0, rx = 0;
  ps.forEach((p, i) => { if (isSure(p, i, o)) sure++; if (isRx(p, i, o, leaves)) rx++; });
  return { sheet: ps.length, sure, notSure: ps.length - sure, rx, changed };
}

export const BIG_SHELF = 100;

/** Shelves getting more than 100 products - "No shelf gets more than 100
 *  products without you seeing it". The server's list, or counted here. */
export function bigShelves(r: ShelfCheckResult, o: Overrides, leaves?: Map<string, LeafInfo>): BigShelf[] {
  const by: Record<string, number> = {};
  (r.products || []).forEach((p, i) => {
    const id = shelfOf(p, i, o);
    if (id) by[id] = (by[id] || 0) + 1;
  });
  const counted = Object.entries(by)
    .filter(([, n]) => n > BIG_SHELF)
    .map(([id, n]) => ({ category_id: id, shelf: leaves?.get(id)?.name
      || r.big_shelves?.find((b) => b.category_id === id)?.shelf || "a shelf", count: n }));
  const list = counted.length || !r.big_shelves ? counted : r.big_shelves.filter((b) => b.count > BIG_SHELF);
  return list.sort((a, b) => b.count - a.count);
}

/** "Over the Counter 612 · Pain & Fever 418 · Shampoo & Conditioner 205". */
export function bigShelvesLine(list: BigShelf[], most = 3): string {
  return list.slice(0, most).map((b) => `${b.shelf} ${b.count.toLocaleString()}`).join(" · ");
}

export type ShelfFilter = "all" | "not_sure" | "rx" | "changed" | `shelf:${string}`;

/** The rows a filter chip shows, as indexes into products. */
export function shelfFilter(r: ShelfCheckResult, f: ShelfFilter, o: Overrides,
                            leaves?: Map<string, LeafInfo>, search = ""): number[] {
  const q = search.trim().toLowerCase();
  const out: number[] = [];
  (r.products || []).forEach((p, i) => {
    if (q && !String(p.name || "").toLowerCase().includes(q)) return;
    if (f === "not_sure" && isSure(p, i, o)) return;
    if (f === "rx" && !isRx(p, i, o, leaves)) return;
    if (f === "changed" && !(i in o)) return;
    if (f.startsWith("shelf:") && shelfOf(p, i, o) !== f.slice(6)) return;
    out.push(i);
  });
  return out;
}

/** The green button: "Save 5,610 sure · then check 815". */
export function saveLabel(t: ShelfTotals): string {
  if (!t.notSure) return `Save all ${t.sure.toLocaleString()}`;
  return `Save ${t.sure.toLocaleString()} sure · then check ${t.notSure.toLocaleString()}`;
}

/**
 * The check result with the person's choices put in, ready for the check
 * step and the save. A chosen shelf is a SURE shelf; its prescription mark
 * follows the shelf (a medicine already marked keeps its mark).
 */
export function withChoices<T extends ShelfCheckResult>(r: T, o: Overrides, leaves?: Map<string, LeafInfo>): T {
  if (!Object.keys(o).length) return r;
  const products = (r.products || []).map((p, i) => {
    if (!(i in o) || !o[i]) return p;
    const rx = !!leaves?.get(o[i])?.rx || !!p.needs_prescription;
    return { ...p, category_id: o[i], shelf_sure: "sure", rx, needs_prescription: rx || undefined };
  });
  return { ...r, products };
}

// ── Picture 3: Shelf check ──────────────────────────────────────────────────

export type GroupKind = "rx" | "medicine" | "household" | "beauty" | "food" | "baby" | "health"
  | "small" | "unsure" | "other" | "medicine_unknown";

export interface ShelfGroup {
  key: string;
  kind: GroupKind | string;
  title: string;
  reason?: string;
  from?: string;
  to?: string;
  count: number;
  examples?: string[];
  /** "move" = Move all + Look one by one; "look" = a person looks at each
   *  (not sure, small shops); "pharmacist" = Upload pharmacist list. */
  action?: "move" | "look" | "pharmacist" | string;
  done?: boolean;
}

export type CheckShow = "to_check" | "medicines" | "household" | "beauty" | "small" | "done";

export const SHOW_CHIPS: [CheckShow, string][] = [
  ["to_check", "To check"],
  ["medicines", "Medicines"],
  ["household", "Household & food"],
  ["beauty", "Beauty & care"],
  ["small", "Small shops"],
  ["done", "Done"],
];

const SHOW_KINDS: Record<Exclude<CheckShow, "to_check" | "done">, string[]> = {
  medicines: ["rx", "medicine", "medicine_unknown"],
  household: ["household", "food"],
  beauty: ["beauty", "baby"],
  small: ["small"],
};

/** The groups a chip shows. The server filters too (`?show=`); filtering here
 *  as well means a chip pressed before the answer arrives is never wrong. */
export function groupsFor(groups: ShelfGroup[], show: CheckShow): ShelfGroup[] {
  if (show === "done") return groups.filter((g) => g.done);
  const open = groups.filter((g) => !g.done);
  if (show === "to_check") return open;
  const kinds = SHOW_KINDS[show];
  return open.filter((g) => kinds.includes(String(g.kind)));
}

/** The square on the left of a card. */
export function kindLook(kind: string): { bg: string; fg: string; icon: string } {
  switch (kind) {
    case "rx": return { bg: "#FDECEC", fg: "#D62839", icon: "Rx" };
    case "medicine": return { bg: "#E0F4F5", fg: "#00707A", icon: "✚" };
    case "health": return { bg: "#E0F4F5", fg: "#00707A", icon: "✚" };
    case "unsure": return { bg: "#F6F4EC", fg: "#555555", icon: "?" };
    case "household": return { bg: "#E8F5E9", fg: "#1F6F4A", icon: "⌂" };
    case "food": return { bg: "#FFF1E6", fg: "#D25105", icon: "◉" };
    case "beauty": return { bg: "#FCE4EC", fg: "#C2185B", icon: "✿" };
    case "baby": return { bg: "#E1F5FE", fg: "#0277BD", icon: "☺" };
    case "small": return { bg: "#E6EEF4", fg: "#004E89", icon: "▣" };
    case "medicine_unknown": return { bg: "#FFF4E5", fg: "#C25E00", icon: "?" };
    default: return { bg: "#F6F4EC", fg: "#555555", icon: "•" };
  }
}

export type MoveState = { phase: "idle" } | { phase: "moving" } | { phase: "moved"; moved: number; batch: string };

/** The green button's words in each state (board 5: normal / pressed / Moving… / ✓ N moved). */
export function moveLabel(g: ShelfGroup, s: MoveState): string {
  if (s.phase === "moving") return "Moving…";
  if (s.phase === "moved") return `✓ ${s.moved.toLocaleString()} moved`;
  return `Move all ${g.count.toLocaleString()}`;
}

/** A pasted or uploaded pharmacist list -> clean names. One per line, or
 *  separated by commas or tabs; the first column of a CSV; a heading row
 *  ("name", "medicine") is dropped; nothing twice; at most 5,000. */
export function pharmacistWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (text || "").split(/\r?\n/)) {
    for (const cell of raw.split(/[,\t;]/)) {
      const w = cell.replace(/^["']|["']$/g, "").trim().replace(/\s+/g, " ");
      if (!w) continue;
      const k = w.toLowerCase();
      if (["name", "names", "medicine", "medicines", "product", "products", "safe", "safe list"].includes(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(w);
      if (out.length >= 5000) return out;
    }
  }
  return out;
}

/** "18 Oct, 9:41 pm" - the undo list. */
export function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let h = d.getHours();
  const am = h < 12 ? "am" : "pm";
  h = h % 12 || 12;
  return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${am}`;
}
