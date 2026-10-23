"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ADD A MISSING SHELF WITHOUT LEAVING THE PRODUCT.  (Audit 23 October 2026.)
//
// "Lot of categories are missing." Until now a missing shelf meant: close the
// product (losing what was typed), go to Stores › Categories, add the shelf,
// come back and start again - so people put the product on the nearest wrong
// shelf instead. The picker now offers "+ Add “…” as a new shelf"; this box
// asks only WHERE it goes (the shop's own department first) and adds it.
//
// The server still decides who may do this (/admin/categories needs the
// Categories permission); a refusal is shown, nothing is half-saved.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { ShelfHome } from "@/lib/shelves";

export function AddShelfDialog({
  name: typed, homes, onAdded, onClose,
}: {
  name: string;
  homes: ShelfHome[];
  /** Told the name and home once the server has the new shelf. */
  onAdded: (name: string, homeLabel: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(typed);
  const [home, setHome] = useState(homes.find((h) => h.own)?.id || homes[0]?.id || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) { toast("Type the shelf's name", "error"); return; }
    if (!home) { toast("Choose where the shelf goes", "error"); return; }
    setSaving(true);
    try {
      await apiClient.createCategory({
        // "v2" = the one live catalogue, as Stores › Categories sends it.
        name: n, parent_id: home, is_active: true, display_order: 999, taxonomy_version: "v2",
      });
      toast(`Shelf “${n}” added`, "success");
      onAdded(n, homes.find((h) => h.id === home)?.label || "");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add the shelf", "error");
    } finally {
      setSaving(false);
    }
  };

  const own = homes.filter((h) => h.own);
  const other = homes.filter((h) => !h.own);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Add a new shelf" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-takal-ink">Add a new shelf</h2>
        <p className="mt-1 text-sm text-takal-ink-soft">
          Every shop can use it. Customers see it as soon as a product is on it.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-takal-ink">Shelf name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
            className="mt-1 w-full rounded-lg border border-takal-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-takal-yellow" />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-takal-ink">Goes under</span>
          <select value={home} onChange={(e) => setHome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-takal-line bg-white px-3 py-2 text-sm">
            {own.length > 0 && (
              <optgroup label="This shop's department">
                {own.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </optgroup>
            )}
            {other.length > 0 && (
              <optgroup label="Other departments">
                {other.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-takal-line px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={save}
            className="rounded-lg border-2 border-black bg-takal-yellow px-4 py-2 text-sm font-extrabold text-black disabled:opacity-60">
            {saving ? "Adding…" : "Add shelf"}
          </button>
        </div>
      </div>
    </div>
  );
}
