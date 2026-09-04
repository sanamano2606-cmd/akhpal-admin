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
  Plus,
  Search,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS } from "@/lib/verticals";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

// This page was 1,032 lines. It was split on 2026-08-30 into the pieces below;
// the page itself keeps its address and its default export, so no link and no
// route changed.
import { Cat, ShopType, Node, buildTree } from "./parts-types";
import { Row } from "./parts-row";
import { Editor } from "./parts-editor";
import { ShopTypeDialog, DeleteDialog } from "./parts-dialogs";






export default function CategoriesPage() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [deleting, setDeleting] = useState<Node | null>(null);
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState("");
  // Which list is on screen. The new one is the default, because that is the
  // one being built; the old one is still here only until the switch-over.
  const [listVersion, setListVersion] = useState<"v2" | "v1">("v2");
  const [shopTypes, setShopTypes] = useState<ShopType[]>([]);
  const [linking, setLinking] = useState<Node | null>(null);
  const [hideEmpty, setHideEmpty] = useState<boolean | null>(null);
  // TRUE when the switch could not be read at all, as opposed to still
  // reading it. Both look like `hideEmpty === null`.
  const [switchFailed, setSwitchFailed] = useState(false);
  const [savingSwitch, setSavingSwitch] = useState(false);
  // A FAILED READ MUST NOT BECOME A FACT ABOUT THE CATALOGUE.
  // A dropped connection used to show a toast that disappears in seconds and
  // then "Nothing matches. Clear the search" - which sends the operator off
  // clearing filters that were never the problem, on a catalogue that is
  // still there.
  const [loadError, setLoadError] = useState<ReadFailure>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await apiClient.getAdminCategories(listVersion)) as any;
      setRows(res?.flat || []);
    } catch (e) {
      setLoadError(readFailure(e, "the categories"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  // The shop-type list and the one launch switch are read once.
  useEffect(() => {
    (async () => {
      try {
        const r = (await apiClient.getAdminShopTypes()) as any;
        setShopTypes(r?.shop_types || []);
      } catch {
        setShopTypes([]);
      }
      try {
        const cfg = (await apiClient.getSettings()) as any;
        setHideEmpty(!!cfg?.hide_empty_categories);
        setSwitchFailed(false);
      } catch {
        // TOLD APART FROM "STILL LOADING".
        //
        // null is also the starting value, so a failed read used to leave this
        // switch permanently disabled showing "..." with no explanation at all.
        setHideEmpty(null);
        setSwitchFailed(true);
      }
    })();
  }, []);

  const saveHideEmpty = async (next: boolean) => {
    setSavingSwitch(true);
    try {
      await apiClient.updateSettings({ hide_empty_categories: next });
      setHideEmpty(next);
      toast(
        next
          ? "Empty categories are now hidden from customers"
          : "Empty categories are visible to customers again",
        "success"
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the switch", "error");
    } finally {
      setSavingSwitch(false);
    }
  };

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
      // WHICH ROW BELONGS TO WHICH KIND OF SHOP
      // The old list wrote the shop type on the department row itself
      // (vendor_type). The new list keeps it in its own table, because one
      // department can be sold by several kinds of shop - so a new-list row
      // has vendor_type EMPTY. Reading vendor_type on a new-list row made the
      // filter hide every single category the moment a shop type was picked.
      const inVertical =
        !vertical ||
        n.depth > 0 ||
        (n.taxonomy_version === "v2"
          ? (n.shop_types || []).includes(vertical)
          : (n.vendor_type || "") === vertical);
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
          <h2 className="text-xl font-bold text-takal-ink">Catalogue</h2>
          <p className="text-takal-ink-soft mt-1 max-w-2xl">
            The menu customers browse: store type → department → item type. A
            hidden category disappears from the apps but keeps its products.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              parent_id: null,
              display_order: 999,
              is_active: true,
              taxonomy_version: listVersion === "v2" ? "v2" : null,
            })
          }
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg font-medium inline-flex items-center gap-1"
        >
          <Plus size={18} /> Add category
        </button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-takal-disabled-text" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all levels…"
            className="pl-9 pr-3 py-2 border border-takal-line rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-takal-yellow"
          />
        </div>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="px-3 py-2 border border-takal-line rounded-lg text-sm"
        >
          <option value="">All store types</option>
          {listVersion === "v2"
            ? shopTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.speed === "instant" ? "\u26A1 " : ""}
                  {t.name}
                </option>
              ))
            : VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.emoji} {v.label}
                </option>
              ))}
        </select>
        <span className="text-sm text-takal-ink-soft">{totalShown} categories</span>

        {/* Which list. The old one is kept only until the switch-over. */}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-takal-line overflow-hidden">
            <button
              onClick={() => {
                // A shop-type code from one list is meaningless in the other,
                // so a leftover filter would show an empty screen.
                setVertical("");
                setListVersion("v2");
              }}
              className={`px-3 py-2 text-sm font-medium ${
                listVersion === "v2"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-takal-ink-soft hover:bg-takal-page"
              }`}
            >
              New list
            </button>
            <button
              onClick={() => {
                setVertical("");
                setListVersion("v1");
              }}
              className={`px-3 py-2 text-sm font-medium ${
                listVersion === "v1"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-takal-ink-soft hover:bg-takal-page"
              }`}
            >
              Old list
            </button>
          </div>

          {/* The launch switch. OFF while the shop list is being filled. */}
          <button
            onClick={() => hideEmpty !== null && saveHideEmpty(!hideEmpty)}
            disabled={hideEmpty === null || savingSwitch}
            title={
              switchFailed
                ? "This setting could not be read, so it cannot be changed. Refresh the page to try again."
                : "When ON, a category with nothing to buy disappears from the customer app until a shop fills it."
            }
            className="inline-flex items-center gap-2 px-3 py-2 border border-takal-line rounded-lg text-sm disabled:opacity-50"
          >
            <span className="text-takal-ink-soft">Hide empty from customers</span>
            <span
              className={`inline-block w-9 h-5 rounded-full relative transition-colors ${
                hideEmpty ? "bg-slate-900" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  hideEmpty ? "left-4" : "left-0.5"
                }`}
              />
            </span>
            <span
              className={`font-bold ${
                hideEmpty === null
                  ? "text-[#C8410F]"
                  : hideEmpty
                    ? "text-takal-ink"
                    : "text-[#C8410F]"
              }`}
            >
              {/* "..." for ever was the old behaviour when the read failed.
                  A switch nobody can press must say why. */}
              {hideEmpty === null
                ? switchFailed
                  ? "can't read"
                  : "…"
                : hideEmpty
                  ? "ON"
                  : "OFF"}
            </span>
          </button>
        </div>
      </div>

      {listVersion === "v1" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm">
          This is the <b>old list</b>. It is on its way out. Add and rename
          nothing here - use the New list.
        </div>
      )}

      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : visible.length === 0 ? (
        <div className="text-takal-ink-soft bg-white rounded-lg border border-takal-line p-8 text-center">
          Nothing matches. Clear the search or pick another store type.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-takal-line divide-y divide-slate-100">
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
              onLinkShops={setLinking}
              shopTypes={shopTypes}
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

      {linking && (
        <ShopTypeDialog
          node={linking}
          shopTypes={shopTypes}
          onClose={() => setLinking(null)}
          onSaved={() => {
            setLinking(null);
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




