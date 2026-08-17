"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Categories — the shop-front menu customers browse.
//
// WHY THIS PAGE EXISTS
// There are 122 live categories and, until this page, no screen anywhere that
// could add, rename, reorder, hide or remove one. The endpoints had been on the
// server the whole time; nothing called them. Changing a category meant opening
// the database by hand.
//
// THE ONE THING TO KNOW BEFORE EDITING THIS FILE
// Deleting a category deletes everything underneath it, and there is no undo.
// The server refuses the first time and says what would be lost; this page then
// shows that sentence and asks again. Do NOT add a shortcut that sends
// force=true on the first click.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Search,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS, verticalLabel } from "@/lib/verticals";

type Cat = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string | null;
  icon: string | null;
  vendor_type: string | null;
  display_order: number;
  is_active: boolean;
  product_count?: number;
};

type Node = Cat & { children: Node[]; depth: number; total: number };

const input =
  "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm";

/** Flat rows -> nested tree, sorted the same way the customer app sorts it
 *  (display_order, then name). Anything whose parent is missing is treated as
 *  a top-level row so a broken link can never hide a category from this page. */
function buildTree(rows: Cat[]): Node[] {
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

export default function CategoriesPage() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [deleting, setDeleting] = useState<Node | null>(null);
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = (await apiClient.getAdminCategories()) as any;
      setRows(res?.flat || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load categories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tree = useMemo(() => buildTree(rows), [rows]);

  // Searching must reach INSIDE closed branches, otherwise a type three levels
  // down is invisible unless you already knew where it lived. A branch is kept
  // when it matches or when anything under it matches, and matching branches
  // are force-opened below.
  const term = search.trim().toLowerCase();
  const filtering = !!term || !!vertical;
  const visible = useMemo(() => {
    const keep = (n: Node): Node | null => {
      const kids = n.children.map(keep).filter(Boolean) as Node[];
      const meMatches =
        !term ||
        (n.name || "").toLowerCase().includes(term) ||
        (n.slug || "").toLowerCase().includes(term);
      const inVertical =
        !vertical || n.depth > 0 || (n.vendor_type || "") === vertical;
      if ((meMatches && inVertical) || kids.length) {
        return { ...n, children: kids };
      }
      return null;
    };
    return tree.map(keep).filter(Boolean) as Node[];
  }, [tree, term, vertical]);

  const isOpen = (id: string) => (term ? true : open[id] !== false);
  const toggle = (id: string) =>
    setOpen((p) => ({ ...p, [id]: p[id] === false ? true : false }));

  /**
   * Move a row one place up or down among its own brothers and sisters.
   *
   * NOT a swap of the two display_order values. Most rows arrive with the
   * table default of 999, so swapping 999 with 999 changes nothing and the row
   * springs back on the next refresh — the move would look like it worked and
   * then quietly undo itself. Instead the whole level is renumbered 1, 2, 3 …
   * in the new arrangement, and only the rows whose number actually changed are
   * saved. After the first move a level is numbered properly for ever.
   *
   * Reordering is switched off while a search or store-type filter is on,
   * because the list on screen is then only part of the level and renumbering
   * from it would scramble the rows that are hidden.
   */
  const move = async (node: Node, siblings: Node[], dir: -1 | 1) => {
    const i = siblings.findIndex((s) => s.id === node.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblings.length) return;

    const next = siblings.slice();
    next.splice(j, 0, next.splice(i, 1)[0]);

    const writes = next
      .map((s, idx) => ({ s, order: idx + 1 }))
      .filter(({ s, order }) => (s.display_order ?? 0) !== order);

    try {
      for (const w of writes) {
        await apiClient.updateCategory(w.s.id, { display_order: w.order });
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reorder", "error");
      await load();
    }
  };

  const toggleActive = async (node: Node) => {
    try {
      await apiClient.updateCategory(node.id, { is_active: !node.is_active });
      toast(node.is_active ? "Hidden from customers" : "Now visible", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  };

  const totalShown = rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-600 mt-1 max-w-2xl">
            The menu customers browse: store type → department → item type. A
            hidden category disappears from the apps but keeps its products.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({ parent_id: null, display_order: 999, is_active: true })
          }
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg font-medium inline-flex items-center gap-1"
        >
          <Plus size={18} /> Add category
        </button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all levels…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">All store types</option>
          {VERTICALS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.emoji} {v.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{totalShown} categories</span>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-slate-500 bg-white rounded-lg border border-slate-200 p-8 text-center">
          Nothing matches. Clear the search or pick another store type.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {visible.map((n) => (
            <Row
              key={n.id}
              node={n}
              siblings={visible}
              filtering={filtering}
              isOpen={isOpen}
              toggle={toggle}
              onEdit={setEditing}
              onDelete={setDeleting}
              onToggleActive={toggleActive}
              onMove={move}
            />
          ))}
        </div>
      )}

      {editing && (
        <Editor
          all={rows}
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          node={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Row({
  node,
  siblings,
  filtering,
  isOpen,
  toggle,
  onEdit,
  onDelete,
  onToggleActive,
  onMove,
}: {
  node: Node;
  siblings: Node[];
  filtering: boolean;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  onEdit: (c: Partial<Cat>) => void;
  onDelete: (n: Node) => void;
  onToggleActive: (n: Node) => void;
  onMove: (n: Node, siblings: Node[], dir: -1 | 1) => void;
}) {
  const hasKids = node.children.length > 0;
  const opened = isOpen(node.id);
  const i = siblings.findIndex((s) => s.id === node.id);

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50"
        style={{ paddingLeft: 12 + node.depth * 24 }}
      >
        <button
          onClick={() => hasKids && toggle(node.id)}
          className={`w-6 h-6 flex items-center justify-center rounded ${
            hasKids ? "text-slate-500 hover:bg-slate-200" : "opacity-0 cursor-default"
          }`}
          aria-label={opened ? "Collapse" : "Expand"}
        >
          {opened ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <span className="w-6 text-center">{node.icon || ""}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-medium ${
                node.is_active ? "text-slate-900" : "text-slate-400 line-through"
              }`}
            >
              {node.name}
            </span>
            {node.depth === 0 && node.vendor_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {verticalLabel(node.vendor_type)}
              </span>
            )}
            {!node.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Hidden
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {node.slug || "no web name"}
            {" · "}
            {node.total} product{node.total === 1 ? "" : "s"}
            {hasKids ? ` · ${node.children.length} inside` : ""}
          </div>
        </div>

        <button
          onClick={() => onMove(node, siblings, -1)}
          disabled={filtering || i <= 0}
          title={filtering ? "Clear the search to reorder" : "Move up"}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-25"
        >
          <ArrowUp size={15} />
        </button>
        <button
          onClick={() => onMove(node, siblings, 1)}
          disabled={filtering || i < 0 || i >= siblings.length - 1}
          title={filtering ? "Clear the search to reorder" : "Move down"}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-25"
        >
          <ArrowDown size={15} />
        </button>
        <button
          onClick={() => onToggleActive(node)}
          title={node.is_active ? "Hide from customers" : "Show to customers"}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          {node.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onClick={() =>
            onEdit({ parent_id: node.id, display_order: 999, is_active: true })
          }
          title="Add one inside this"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => onEdit(node)}
          title="Edit"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onDelete(node)}
          title="Delete"
          className="p-1.5 rounded hover:bg-red-50 text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {opened &&
        node.children.map((c) => (
          <Row
            key={c.id}
            node={c}
            siblings={node.children}
            filtering={filtering}
            isOpen={isOpen}
            toggle={toggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            onMove={onMove}
          />
        ))}
    </>
  );
}

function Editor({
  all,
  value,
  onClose,
  onSaved,
}: {
  all: Cat[];
  value: Partial<Cat>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!value.id;
  const [f, setF] = useState<Partial<Cat>>({ ...value });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Cat, v: any) => setF((p) => ({ ...p, [k]: v }));

  // A category may not be moved inside itself or inside anything below it —
  // that makes a loop and the whole branch vanishes from this screen. The
  // server refuses it too; hiding the options here means nobody has to find
  // that out from an error message.
  const forbidden = useMemo(() => {
    if (!value.id) return new Set<string>();
    const out = new Set<string>([String(value.id)]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of all) {
        const pid = r.parent_id ? String(r.parent_id) : "";
        if (pid && out.has(pid) && !out.has(String(r.id))) {
          out.add(String(r.id));
          grew = true;
        }
      }
    }
    return out;
  }, [all, value.id]);

  const parents = all
    .filter((r) => !forbidden.has(String(r.id)))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const isTopLevel = !f.parent_id;

  const save = async () => {
    const name = (f.name || "").trim();
    if (!name) {
      toast("Please type a category name.", "error");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        // Only what changed. Sending the whole row would rewrite columns the
        // admin never touched, and would overwrite anyone else's edit made
        // since this dialog was opened.
        const before = all.find((r) => String(r.id) === String(value.id)) || {};
        const next: Record<string, unknown> = {};
        const put = (k: keyof Cat, v: any) => {
          if ((before as any)[k] !== v) next[k] = v;
        };
        put("name", name);
        put("slug", (f.slug || "").trim() || null);
        put("icon", (f.icon || "").trim() || null);
        put("parent_id", f.parent_id || null);
        put("vendor_type", isTopLevel ? f.vendor_type || null : null);
        put("display_order", Number(f.display_order) || 0);
        put("is_active", !!f.is_active);
        if (Object.keys(next).length === 0) {
          toast("Nothing changed", "info");
          onSaved();
          return;
        }
        await apiClient.updateCategory(String(value.id), next);
        toast("Saved", "success");
      } else {
        await apiClient.createCategory({
          name,
          parent_id: f.parent_id || null,
          slug: (f.slug || "").trim() || null,
          icon: (f.icon || "").trim() || null,
          vendor_type: isTopLevel ? f.vendor_type || null : null,
          display_order: Number(f.display_order) || 999,
          is_active: f.is_active !== false,
        });
        toast("Category added", "success");
      }
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          {isEdit ? "Edit category" : "Add category"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Name</label>
            <input
              autoFocus
              value={f.name || ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Women"
              className={input}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Sits inside</label>
            <select
              value={f.parent_id || ""}
              onChange={(e) => set("parent_id", e.target.value || null)}
              className={input}
            >
              <option value="">Top level (a store type)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {isTopLevel && (
            <div>
              <label className="text-sm text-slate-600">Store type</label>
              <select
                value={f.vendor_type || ""}
                onChange={(e) => set("vendor_type", e.target.value || null)}
                className={input}
              >
                <option value="">— none —</option>
                {VERTICALS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Only top-level categories carry a store type. The ones inside
                them inherit it.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600">Icon</label>
              <input
                value={f.icon || ""}
                onChange={(e) => set("icon", e.target.value)}
                placeholder="👗"
                className={input}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Order</label>
              <input
                type="number"
                value={f.display_order ?? 999}
                onChange={(e) => set("display_order", e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">Web name</label>
            <input
              value={f.slug || ""}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="left empty = made from the name"
              className={input}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={f.is_active !== false}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            Show to customers
          </label>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-slate-900 rounded-lg"
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Delete is deliberately two steps.
 *
 * The first click sends no force flag. If anything would be affected the server
 * refuses with a plain-English sentence saying exactly what — that sentence is
 * what appears below. Only then does a second, clearly-labelled button send
 * force=true. Nothing here decides on the admin's behalf what is "safe enough".
 */
function DeleteDialog({
  node,
  onClose,
  onDone,
}: {
  node: Node;
  onClose: () => void;
  onDone: () => void;
}) {
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (force: boolean) => {
    setBusy(true);
    try {
      const res = (await apiClient.deleteCategory(node.id, force)) as any;
      const extra =
        res?.products_unlinked > 0
          ? ` ${res.products_unlinked} product(s) now have no category.`
          : "";
      toast(`Deleted.${extra}`, "success");
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete";
      // The server's refusal is the warning. Anything else is a real error.
      if (!force && /would also affect/i.test(msg)) setWarning(msg);
      else toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Delete “{node.name}”?
        </h2>

        {warning ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-900 mb-4">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        ) : (
          <p className="text-slate-600 text-sm mb-4">
            This cannot be undone.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          {warning ? (
            <button
              onClick={() => run(true)}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg"
            >
              {busy ? "Deleting…" : "Delete anyway"}
            </button>
          ) : (
            <button
              onClick={() => run(false)}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg"
            >
              {busy ? "Checking…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
