// ─────────────────────────────────────────────────────────────────────────────
// The add / rename panel.
//
// Sends ONLY the fields that changed. A key present with the value null really
// does clear that column - that is how a sub-category is moved back to the top
// level - while a key left out is untouched.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS } from "@/lib/verticals";

import { Cat, input } from "./parts-types";

export function Editor({
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
          // A new row joins whichever list the screen is showing. Without this
          // a new department would silently land in the old list.
          taxonomy_version: f.taxonomy_version || null,
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
        <h2 className="text-xl font-bold text-takal-ink mb-4">
          {isEdit ? "Edit category" : "Add category"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-takal-ink-soft">Name</label>
            <input
              autoFocus
              value={f.name || ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Women"
              className={input}
            />
          </div>

          <div>
            <label className="text-sm text-takal-ink-soft">Sits inside</label>
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
              <label className="text-sm text-takal-ink-soft">Store type</label>
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
              <p className="text-xs text-takal-disabled-text mt-1">
                Only top-level categories carry a store type. The ones inside
                them inherit it.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-takal-ink-soft">Icon</label>
              <input
                value={f.icon || ""}
                onChange={(e) => set("icon", e.target.value)}
                placeholder="👗"
                className={input}
              />
            </div>
            <div>
              <label className="text-sm text-takal-ink-soft">Order</label>
              <input
                type="number"
                value={f.display_order ?? 999}
                onChange={(e) => set("display_order", e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-takal-ink-soft">Web name</label>
            <input
              value={f.slug || ""}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="left empty = made from the name"
              className={input}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-takal-ink">
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
            className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg"
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
