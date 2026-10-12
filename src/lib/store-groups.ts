// MALL STORES GROUPED UNDER THEIR MALL (Stores page fix 5, Sana 12 Oct 2026:
// "OK fix 5". Audit S5, Mock 182 picture 2.)
//
// WAS: a mall's stores were mixed in with every other shop, each with the long
// name "Wakeel Shopping Mall — Baby, Kids & Toys", so the list wrapped and you
// could not see at a glance which stores belong to which mall.
//
// NOW: one yellow mall row ("🛍 Wakeel Shopping Mall · MALL · 4 stores"), and
// its stores indented underneath under their short names ("Baby, Kids & Toys").
// The mall row sits where its first store would have been in the chosen sort,
// and it only appears when at least one of its stores is in the list you are
// looking at - so search, type and the Live/Waiting/... boxes still decide.
// The server sends `mall_id` and `mall_name` with every shop
// (routers/restaurants_admin.py admin_list_restaurants).

export type MallRow = {
  kind: "mall";
  mallId: string;
  mallName: string;
  owner: string;
  total: number;      // every store of this mall, whatever list you are in
  live: number;
  suspended: number;
  shown: number;      // how many of them are in the list you are looking at
};
export type StoreRow = { kind: "store"; r: any; inMall: boolean };
export type ListRow = MallRow | StoreRow;

/** "Wakeel Shopping Mall — Fashion" -> "Fashion". Any other name is kept whole. */
export function shortStoreName(name: string | null | undefined, mallName: string | null | undefined): string {
  const n = (name || "").trim();
  const m = (mallName || "").trim();
  if (!n || !m) return n;
  if (n.toLowerCase().startsWith(m.toLowerCase())) {
    const rest = n.slice(m.length).replace(/^\s*[—–\-:·|]\s*/, "").trim();
    if (rest && rest !== n.slice(m.length)) return rest;
  }
  return n;
}

/**
 * Turn the sorted, filtered list into rows: mall headings with their stores
 * under them, other shops as they were. `all` is every shop (for the counts),
 * `closed` the malls folded away with the ▾ arrow.
 */
export function groupByMall(
  shown: any[],
  all: any[],
  statusOf: (r: any) => string,
  closed: Set<string> = new Set(),
): ListRow[] {
  const mallOf = (r: any) => (r && r.mall_id ? String(r.mall_id) : "");
  const membersShown = new Map<string, any[]>();
  for (const r of shown) {
    const id = mallOf(r);
    if (!id) continue;
    if (!membersShown.has(id)) membersShown.set(id, []);
    membersShown.get(id)!.push(r);
  }
  const rows: ListRow[] = [];
  const done = new Set<string>();
  for (const r of shown) {
    const id = mallOf(r);
    if (!id) { rows.push({ kind: "store", r, inMall: false }); continue; }
    if (done.has(id)) continue;
    done.add(id);
    const everyStore = all.filter((x) => mallOf(x) === id);
    const mine = membersShown.get(id) || [];
    const named = everyStore.find((x) => x.mall_name) || r;
    rows.push({
      kind: "mall",
      mallId: id,
      mallName: named.mall_name || "Mall",
      owner: named.owner_name || named.email || "",
      total: everyStore.length,
      live: everyStore.filter((x) => statusOf(x) === "approved").length,
      suspended: everyStore.filter((x) => statusOf(x) === "suspended").length,
      shown: mine.length,
    });
    if (!closed.has(id)) {
      for (const m of mine) rows.push({ kind: "store", r: m, inMall: true });
    }
  }
  return rows;
}
