// ─────────────────────────────────────────────────────────────────────────────
// MOCK 225 - ADD A SHELF, A GROUP OR A DEPARTMENT FROM "CHOOSE A SHELF"
// (approved by Sana, 2 Nov 2026: "Approved" + "Add Group Button Too under
// Group").
//
// The window only ever gets a flat list of shelves (id + "Dept › Group ›
// Shelf"), never the ids of their department or group. So when something is
// added, the department and group open on screen are found again BY NAME in
// the category list (GET /admin/categories), and the new row is hung under
// them (POST /admin/categories - the same door Stores › Categories uses, so
// the server's own rules apply: three levels at most, the Categories
// permission).
//
// This file is the rules only - no screen, no server. Tests:
// tests/mock-225-add-shelf.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatNode {
  id: string; name: string; slug?: string; parent_id?: string | null;
  is_active?: boolean; children?: CatNode[];
}

export type AddKind = "shelf" | "group" | "department";

/** The department whose shelves may need a prescription (the Rx tick). */
export const HEALTH_SLUG = "health-and-pharmacy";
export const MAX_NAME = 60;

/** A name as it is saved: one space between words, trimmed. */
export function cleanName(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/** Why a name cannot be saved, in words - or "". */
export function nameProblem(s: string, what = "name"): string {
  const n = cleanName(s);
  if (!n) return `Type the ${what}.`;
  if (n.length > MAX_NAME) return `At most ${MAX_NAME} letters.`;
  if (!/[\p{L}\p{N}]/u.test(n)) return "A name needs letters.";
  return "";
}

const same = (a: string, b: string) => cleanName(a).toLowerCase() === cleanName(b).toLowerCase();

/** The department and the group open on screen, found again in the
 *  category tree by their names. group "" = shelves straight under the
 *  department ("Other shelves"). null when the department is not there. */
export function findHome(tree: CatNode[], dept: string, group: string):
  { deptId: string; groupId: string | null; deptSlug: string } | null {
  const d = (tree || []).find((n) => same(n.name, dept));
  if (!d) return null;
  if (!cleanName(group)) return { deptId: String(d.id), groupId: null, deptSlug: d.slug || "" };
  const g = (d.children || []).find((n) => same(n.name, group));
  return g ? { deptId: String(d.id), groupId: String(g.id), deptSlug: d.slug || "" } : null;
}

/** Already there (any case)? A second "Herbal" next to "herbal" is a mistake. */
export function nameTaken(names: string[], typed: string): boolean {
  return names.some((n) => same(n, typed));
}

// Words that say the same thing in a shelf name. A new "Unani Medicines"
// next to "Herbal & Homeopathic" is probably the same shelf (Mock 225-2).
const FAMILIES: string[][] = [
  ["herbal", "herb", "herbs", "unani", "homeopathic", "homoeopathic", "homeo", "tibbi", "tibb", "desi", "ayurvedic"],
  ["kid", "kids", "child", "children", "baby", "babies"],
  ["men", "mens", "gents", "male"],
  ["women", "womens", "ladies", "female"],
  ["phone", "phones", "mobile", "mobiles"],
];
// Words too common to make two shelves "similar".
const COMMON = new Set(["and", "the", "for", "of", "medicines", "medicine", "products", "items", "care",
  "other", "others", "accessories", "new", "all"]);

const words = (s: string) => cleanName(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")
  .split(" ").filter((w) => w.length >= 3 && !COMMON.has(w));
const family = (w: string) => FAMILIES.findIndex((f) => f.includes(w));

/** An existing shelf whose name means much the same as the typed one, or "".
 *  Only a hint - the person may still add it. */
export function similarName(names: string[], typed: string): string {
  const t = words(typed);
  if (!t.length) return "";
  for (const n of names) {
    if (same(n, typed)) continue;
    const w = words(n);
    if (t.some((x) => w.includes(x) || (family(x) >= 0 && w.some((y) => family(y) === family(x))))) return n;
  }
  return "";
}

/** The path label the window uses for the new shelf ("Dept › Group › Shelf",
 *  "Dept › Shelf" without a group) - so it sits in the right column at once. */
export function newLabel(dept: string, group: string, shelf: string): string {
  return [dept, group, shelf].map(cleanName).filter(Boolean).join(" › ");
}

/** The Rx tick is offered only inside Health & Pharmacy. */
export const rxOffered = (deptSlug: string) => deptSlug === HEALTH_SLUG;
