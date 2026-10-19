// ─────────────────────────────────────────────────────────────────────────────
// THE SHELF MANAGER - Stores › Categories.  (Mock 201, board 4, picture 1.
// Sana, 19 October 2026: "Approved. Please Build exactly the same".)
//
//   left   the 13 departments, each with its colour, how many shelves it has
//          and a yellow "+N" for the shelves added in the last 30 days;
//   right  the chosen department: its Urdu name, which kinds of shop call it
//          their own ("every shop may use it" - decision D1), "+ Add shelf",
//          and every shelf with its Urdu name, products, the prescription
//          switch and its order / rename buttons. New shelves are yellow.
//
// Nothing here decides anything new: the rows, the counts and the switch are
// the same /admin/categories list the old tree drew. Hide, add-inside and
// delete are still on every row - they show when the mouse is over it, so the
// table reads the way the picture does.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deptColour, departmentsSummary, headline, mainDepartmentOf, shelfRows,
  type ShelfNode,
} from "@/lib/shelves";
import type { Cat, Node, ShopType } from "./parts-types";
import { urduFont } from "./urdu-font";

const URDU = { fontFamily: `${urduFont.style.fontFamily}, 'Noto Nastaliq Urdu', serif` };

export function DepartmentList({
  roots, chosen, onChoose, onAddDepartment, onMove, filtering,
}: {
  roots: Node[];
  chosen: string;
  onChoose: (id: string) => void;
  onAddDepartment: () => void;
  onMove: (n: Node, siblings: Node[], dir: -1 | 1) => void;
  filtering: boolean;
}) {
  const sums = departmentsSummary(roots as unknown as ShelfNode[]);
  return (
    <div className="w-full flex-none rounded-2xl border border-takal-line bg-white p-2.5 shadow-[0_4px_14px_rgba(0,0,0,.04)] lg:w-[300px]">
      <p className="px-2.5 pb-2 pt-1 text-[12px] font-extrabold uppercase tracking-wide text-takal-ink-soft">
        {headline(roots as unknown as ShelfNode[])}
      </p>
      {roots.map((d, i) => {
        const s = sums[i];
        const [deep, bright] = deptColour(d.slug);
        const on = d.id === chosen;
        return (
          <div key={d.id} className="group relative">
            <button type="button" onClick={() => onChoose(d.id)} data-testid={`dept-${d.slug || d.id}`}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] font-semibold ${
                on ? "bg-takal-yellow-soft outline outline-2 outline-black" : "hover:bg-takal-page"}`}>
              <span className="h-[26px] w-[26px] flex-none rounded-lg"
                style={{ background: `linear-gradient(135deg, ${deep}, ${bright})` }} />
              <span className={`min-w-0 flex-1 truncate ${d.is_active === false ? "text-takal-disabled-text line-through" : "text-takal-ink"}`}>
                {d.name}
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-takal-ink-soft">
                {s.shelves}
                {s.newShelves > 0 && (
                  <span className="rounded-md border border-black bg-takal-yellow px-1.5 text-[10px] font-extrabold text-black">
                    +{s.newShelves}
                  </span>
                )}
              </span>
            </button>
            {/* The department's own order - shown on hover, as the shelf rows. */}
            <span className="absolute right-[74px] top-1/2 hidden -translate-y-1/2 gap-0.5 rounded-md bg-white/90 px-0.5 shadow-sm group-hover:flex">
              <button type="button" onClick={() => onMove(d, roots, -1)} disabled={filtering || i === 0}
                title={filtering ? "Clear the search to reorder" : "Move up"}
                className="rounded p-0.5 text-takal-ink-soft hover:bg-slate-200 disabled:opacity-25"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => onMove(d, roots, 1)} disabled={filtering || i === roots.length - 1}
                title={filtering ? "Clear the search to reorder" : "Move down"}
                className="rounded p-0.5 text-takal-ink-soft hover:bg-slate-200 disabled:opacity-25"><ArrowDown size={13} /></button>
            </span>
          </div>
        );
      })}
      <div className="p-2.5">
        <button type="button" onClick={onAddDepartment}
          className="inline-flex h-8 items-center gap-1 rounded-lg border-2 border-black bg-white px-2.5 text-[12.5px] font-bold">
          + Add department
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onClick}
      className={`relative inline-block h-[22px] w-[38px] rounded-full transition-colors ${on ? "bg-takal-red" : "bg-[#DDDDDD]"}`}>
      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

const iconBtn = "inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg border-[1.5px] border-[#DDDDDD] bg-white text-[#555555] hover:border-black disabled:opacity-30";

export function DepartmentPanel({
  dept, shopTypes, filtering, matches,
  onAddShelf, onEdit, onDelete, onToggleActive, onMove, onLinkShops, onRx,
}: {
  dept: Node;
  shopTypes: ShopType[];
  filtering: boolean;
  /** While searching: the rows that match (and the headings above them). */
  matches: ((n: Node) => boolean) | null;
  onAddShelf: (parentId: string) => void;
  onEdit: (c: Partial<Cat>) => void;
  onDelete: (n: Node) => void;
  onToggleActive: (n: Node) => void;
  onMove: (n: Node, siblings: Node[], dir: -1 | 1) => void;
  onLinkShops: (n: Node) => void;
  onRx: (n: Node) => void;
}) {
  const [deep, bright] = deptColour(dept.slug);
  let rows = shelfRows(dept as unknown as ShelfNode);
  if (matches) {
    // A heading stays when anything under it matches.
    const keep = new Set<string>();
    let head = "";
    for (const r of rows) {
      if (r.kind === "section") head = r.key;
      else if (matches(r.node as unknown as Node)) { keep.add(r.key); if (head) keep.add(head); }
    }
    rows = rows.filter((r) => keep.has(r.key));
  }
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-takal-line bg-white px-[18px] py-4 shadow-[0_4px_14px_rgba(0,0,0,.04)]">
      <div className="flex items-start gap-3">
        <span className="h-[42px] w-[42px] flex-none rounded-xl" style={{ background: `linear-gradient(135deg, ${deep}, ${bright})` }} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-baseline gap-2 text-[21px] font-extrabold text-takal-ink">
            <span className={dept.is_active === false ? "line-through text-takal-disabled-text" : ""}>{dept.name}</span>
            {dept.name_ur && <span dir="rtl" className="text-[17px] font-normal text-[#444444]" style={URDU}>{dept.name_ur}</span>}
            {dept.is_active === false && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Hidden</span>
            )}
          </h2>
          <p className="text-[12.5px] text-[#555555]">
            Main department of:{" "}
            {/* A span, not a button: a button never breaks across lines, and a
                long list of shop types pushed the whole line down. */}
            <span role="button" tabIndex={0} onClick={() => onLinkShops(dept)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLinkShops(dept); } }}
              title="Choose which kinds of shop call this department their own"
              className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-takal-ink">
              {mainDepartmentOf(dept.shop_types, shopTypes)}
            </span>
            {" "}— <b className="text-takal-ink">every shop may use it</b>
          </p>
        </div>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <button type="button" onClick={() => onEdit(dept)} title="Rename this department" className={iconBtn}><Pencil size={13} /></button>
          <button type="button" onClick={() => onToggleActive(dept)} className={iconBtn}
            title={dept.is_active ? "Hide this department from customers" : "Show it to customers again"}>
            {dept.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button type="button" onClick={() => onDelete(dept)} title="Delete" className={`${iconBtn} !text-takal-red`}><Trash2 size={13} /></button>
          <button type="button" onClick={() => onAddShelf(dept.id)} data-testid="add-shelf"
            className="ml-1 inline-flex h-[38px] items-center gap-1 rounded-[11px] border-2 border-black bg-takal-yellow px-3.5 text-[13.5px] font-bold text-black shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000]">
            + Add shelf
          </button>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[11.5px] font-bold uppercase tracking-wide text-[#666666]">
              <th className="whitespace-nowrap border-b border-[#EEEEEE] px-2 py-2">Shelf</th>
              <th className="whitespace-nowrap border-b border-[#EEEEEE] px-2 py-2 text-right">Urdu name</th>
              <th className="whitespace-nowrap border-b border-[#EEEEEE] px-2 py-2">Products</th>
              <th className="whitespace-nowrap border-b border-[#EEEEEE] px-2 py-2">Needs prescription</th>
              <th className="whitespace-nowrap border-b border-[#EEEEEE] px-2 py-2">Order · Rename</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-2.5 py-6 text-center text-takal-ink-soft">
                {matches ? "No shelf here matches the search." : "No shelves yet. Press “+ Add shelf”."}
              </td></tr>
            )}
            {rows.map((r) => {
              if (r.kind === "section") {
                const g = r.group as unknown as Node | undefined;
                const gi = g ? (dept.children || []).findIndex((c) => c.id === g.id) : -1;
                return (
                  <tr key={r.key} className="group">
                    <td colSpan={5} className="bg-[#F6F4EC] px-2.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[.4px]"
                      style={{ color: deep }}>
                      <span className="flex items-center gap-2">
                        <span className={g?.is_active === false ? "line-through opacity-60" : ""}>{r.title}</span>
                        {g?.is_active === false && <span className="rounded-full bg-amber-100 px-2 text-[10px] text-amber-700">Hidden</span>}
                        {g && (
                          <span className="ml-auto hidden items-center gap-1 normal-case group-hover:flex">
                            <button type="button" onClick={() => onMove(g, dept.children || [], -1)} disabled={filtering || gi <= 0}
                              title="Move this group up" className={iconBtn}><ArrowUp size={12} /></button>
                            <button type="button" onClick={() => onMove(g, dept.children || [], 1)}
                              disabled={filtering || gi < 0 || gi >= (dept.children || []).length - 1}
                              title="Move this group down" className={iconBtn}><ArrowDown size={12} /></button>
                            <button type="button" onClick={() => onAddShelf(g.id)} title="Add a shelf in this group" className={iconBtn}><Plus size={12} /></button>
                            <button type="button" onClick={() => onEdit(g)} title="Rename this group" className={iconBtn}><Pencil size={12} /></button>
                            <button type="button" onClick={() => onToggleActive(g)} title={g.is_active ? "Hide" : "Show"} className={iconBtn}>
                              {g.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <button type="button" onClick={() => onDelete(g)} title="Delete" className={`${iconBtn} !text-takal-red`}><Trash2 size={12} /></button>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              }
              const n = r.node as unknown as Node;
              const sibs = r.siblings as unknown as Node[];
              const i = sibs.findIndex((s) => s.id === n.id);
              const fresh = !!n.is_new;
              const products = Number(n.total || 0);
              return (
                <tr key={r.key} data-testid={`shelf-${n.slug || n.id}`} className={`group ${fresh ? "bg-takal-yellow-soft" : ""}`}>
                  <td className="border-b border-[#F2F2EE] px-2 py-2">
                    <b className={n.is_active === false ? "text-takal-disabled-text line-through" : "text-takal-ink"}>{n.name}</b>
                    {fresh && (
                      <span className="ml-1.5 rounded-md bg-black px-1.5 py-px text-[10px] font-extrabold text-takal-yellow">NEW</span>
                    )}
                    {n.is_active === false && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-2 text-[10px] font-semibold text-amber-700">Hidden</span>
                    )}
                  </td>
                  <td dir="rtl" className="whitespace-nowrap border-b border-[#F2F2EE] px-2 py-2 text-right text-[14px] text-[#333333]" style={URDU}>
                    {n.name_ur || <span className="text-[12px] text-takal-disabled-text" style={{ fontFamily: "inherit" }}>—</span>}
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2 py-2">
                    {products ? <span className="font-bold">{products.toLocaleString()}</span>
                      : <span className="text-[#999999]">0</span>}
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2 py-2">
                    <Toggle on={!!n.needs_prescription} onClick={() => onRx(n)}
                      label={n.needs_prescription ? `${n.name} needs a prescription - press to take the mark off` : `Mark ${n.name} as needing a prescription`} />
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2 py-2">
                    <span className="flex items-center gap-1.5 text-[12px] text-[#555555]">
                      <button type="button" onClick={() => onMove(n, sibs, -1)} disabled={filtering || i <= 0}
                        title={filtering ? "Clear the search to reorder" : "Move up"} className={iconBtn}>↑</button>
                      <button type="button" onClick={() => onMove(n, sibs, 1)} disabled={filtering || i < 0 || i >= sibs.length - 1}
                        title={filtering ? "Clear the search to reorder" : "Move down"} className={iconBtn}>↓</button>
                      <button type="button" onClick={() => onEdit(n)} title="Rename, Urdu name, web name" className={iconBtn}>✎</button>
                      <span className="hidden items-center gap-1.5 group-hover:inline-flex">
                        <button type="button" onClick={() => onToggleActive(n)} className={iconBtn}
                          title={n.is_active ? "Hide from customers" : "Show to customers"}>
                          {n.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button type="button" onClick={() => onDelete(n)} title="Delete" className={`${iconBtn} !text-takal-red`}><Trash2 size={12} /></button>
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-xl border-[1.5px] border-[#A5D6A7] bg-[#E8F5E9] px-3 py-2 text-[12.5px] text-[#114B31]">
        <Check size={14} className="flex-none" />
        Counts are before the big move. New shelves start empty and fill up when products are moved — empty shelves stay hidden from customers.
      </div>
    </div>
  );
}
