// ─────────────────────────────────────────────────────────────────────────────
// The shapes a category has, and how a flat list becomes a tree.
//
// The server sends one flat list of rows, each knowing only its parent.
// `buildTree` turns that into the nested shape the screen draws, works out how
// deep each one sits, and adds up how many products are underneath it.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";


export type Cat = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string | null;
  icon: string | null;
  vendor_type: string | null;
  display_order: number;
  is_active: boolean;
  product_count?: number;
  // "v2" = the new list. Empty = the old one.
  taxonomy_version?: string | null;
  // Only a department carries these: the kinds of shop allowed to sell in it.
  shop_types?: string[];
};

export type ShopType = {
  code: string;
  name: string;
  speed: string;
  is_active: boolean;
};

export type Node = Cat & { children: Node[]; depth: number; total: number };

export const input =
  "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";

/** Flat rows -> nested tree, sorted the same way the customer app sorts it
 *  (display_order, then name). Anything whose parent is missing is treated as
 *  a top-level row so a broken link can never hide a category from this page. */
export function buildTree(rows: Cat[]): Node[] {
  const byId = new Map<string, Node>();
  rows.forEach((r) =>
    byId.set(String(r.id), { ...r, children: [], depth: 0, total: 0 })
  );
  const roots: Node[] = [];
  byId.forEach((n) => {
    const pid = n.parent_id ? String(n.parent_id) : "";
    const parent = pid ? byId.get(pid) : undefined;
    if (parent && parent.id !== n.id) parent.children.push(n);
    else roots.push(n);
  });
  const sortAndDepth = (nodes: Node[], depth: number): number => {
    nodes.sort(
      (a, b) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        (a.name || "").localeCompare(b.name || "")
    );
    let sum = 0;
    for (const n of nodes) {
      n.depth = depth;
      const below = sortAndDepth(n.children, depth + 1);
      n.total = (n.product_count || 0) + below;
      sum += n.total;
    }
    return sum;
  };
  sortAndDepth(roots, 0);
  return roots;
}
