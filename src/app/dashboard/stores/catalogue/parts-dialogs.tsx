// ─────────────────────────────────────────────────────────────────────────────
// The two pop-up windows: which shop types a category serves, and delete.
//
// DELETE IS THE DANGEROUS ONE. It takes everything underneath with it and
// there is no undo. The server refuses the first time and says exactly what
// would be lost; this window shows that sentence and asks again. Do NOT add a
// shortcut that sends force=true on the first click.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import {
  AlertTriangle, } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDialogKeys } from "@/components/ui";

import { ShopType, Node } from "./parts-types";

/** Choose which kinds of shop may sell in one department.
 *
 *  WHY THIS SCREEN EXISTS
 *  The old list tied one department to exactly ONE kind of shop. That broke the
 *  moment a grocery shop wanted to sell bread, or a pharmacy wanted to sell
 *  baby soap: there was nowhere to put the product. Here a department can be
 *  opened to as many kinds of shop as it really needs.
 */
export function ShopTypeDialog({
  node,
  shopTypes,
  onClose,
  onSaved,
}: {
  node: Node;
  shopTypes: ShopType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(node.shop_types || []);
  const [saving, setSaving] = useState(false);

  useDialogKeys(true, onClose, saving);

  const flip = (code: string) =>
    setPicked((p) =>
      p.includes(code) ? p.filter((c) => c !== code) : [...p, code]
    );

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.setCategoryShopTypes(node.id, picked);
      toast("Saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const group = (speed: string) => shopTypes.filter((t) => t.speed === speed);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">
            Who can sell in {node.name}?
          </h2>
          <p className="text-sm text-takal-ink-soft mt-1">
            A vendor only ever sees the departments their kind of shop is
            allowed to sell in. Tick as many as really apply.
          </p>
        </div>

        {(["instant", "standard"] as const).map((speed) =>
          group(speed).length ? (
            <div key={speed}>
              <div className="text-xs font-bold uppercase tracking-wide text-takal-disabled-text mb-2">
                {speed === "instant"
                  ? "Fast delivery (bike)"
                  : "Normal delivery (parcel)"}
              </div>
              <div className="flex flex-wrap gap-2">
                {group(speed).map((t) => (
                  <button
                    key={t.code}
                    onClick={() => flip(t.code)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      picked.includes(t.code)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-takal-ink-soft border-takal-line hover:bg-takal-page"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        )}

        {picked.length === 0 && (
          <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
            With none ticked, no vendor can put anything in this department.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-takal-line text-takal-ink-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
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
export function DeleteDialog({
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

  useDialogKeys(true, onClose, busy);

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
        className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-takal-ink mb-2">
          Delete “{node.name}”?
        </h2>

        {warning ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-900 mb-4">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        ) : (
          <p className="text-takal-ink-soft text-sm mb-4">
            This cannot be undone.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page"
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
