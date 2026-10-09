// ─────────────────────────────────────────────────────────────────────────────
// "MOVE TO ANOTHER STORE" - a product put in the wrong store of a mall goes to
// the right one. (Mock 172-5, approved by Sana 8 October 2026; Step 5.)
//
// Example (Wakeel): the Kemei trimmer was added to Fashion. Move -> Beauty &
// Personal Care, category "Hair removal". Its pictures, sizes, extras and
// stock go with it - they all hang on the product.
//
// Only the stores of the SAME mall are offered. The server checks it all
// again (routers/mall_pages.py): the same mall, the login's own stores, the
// same kind of pricing, not while the product is in an unfinished order.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { ShopProduct } from "@/lib/api-stores";
import { pathLabel } from "@/lib/category-search";
import { verticalEmoji } from "@/lib/verticals";
import { Button, Modal } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";

/** A store a product may be moved to: another store of the same mall. */
export type MoveTarget = { id: string; name: string; vendorType: string };

export function MoveProductDialog({
  product, fromStoreId, fromVendorType, mallName, targets, onClose, onMoved,
}: {
  product: ShopProduct;
  fromStoreId: string;
  fromVendorType: string;
  mallName: string;
  targets: MoveTarget[];
  onClose: () => void;
  onMoved: (message: string) => void;
}) {
  const [to, setTo] = useState<MoveTarget | null>(null);
  const [cats, setCats] = useState<{ id: string; label: string }[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // The categories of the NEW store's department (Takal's tree for its kind).
  useEffect(() => {
    if (!to) return;
    let alive = true;
    setCats(null);
    setCategoryId("");
    (async () => {
      try {
        const res = (await apiClient.getCategoryTree(to.vendorType)) as any;
        const out: { id: string; label: string }[] = [];
        const walk = (nodes: any[], path: string[]) => {
          for (const n of nodes || []) {
            const here = [...path, String(n.name)];
            out.push({ id: String(n.id), label: pathLabel(here) });
            if (Array.isArray(n.children)) walk(n.children, here);
          }
        };
        walk(res?.tree || [], []);
        if (alive) setCats(out);
      } catch {
        // Without the list the product keeps its category; the words say so.
        if (alive) setCats([]);
      }
    })();
    return () => { alive = false; };
  }, [to]);

  // Another kind of store has another department, so its category must be
  // chosen; the same kind keeps the product's own when none is chosen.
  const otherKind = !!to && to.vendorType !== fromVendorType;
  const needsCategory = otherKind && (cats?.length ?? 0) > 0 && !categoryId;

  const move = async () => {
    if (!to || needsCategory) return;
    setBusy(true);
    setProblem("");
    try {
      const r = await apiClient.moveProductToStore(fromStoreId, product.id, to.id, categoryId || null);
      onMoved(r?.message || `${product.name} is now in ${to.name}.`);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "It was not moved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} lockClose={busy} size="md"
      title={`Move “${product.name}” to another store?`}
      hint={`Only stores of ${mallName} are shown. Pictures, sizes, extras and stock move with it.`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={move} loading={busy} disabled={!to || needsCategory}>
          {to ? `Move to ${to.name}` : "Choose a store"}
        </Button>
      </>}>
      <div className="space-y-2" role="radiogroup" aria-label="Move to">
        {targets.map((t) => {
          const on = to?.id === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setTo(t)}
              className={`flex w-full items-center gap-2 rounded-xl border-[1.5px] px-4 py-3 text-left text-[15px] font-bold transition ${
                on ? "border-[#111111] bg-[#111111] text-takal-yellow"
                  : "border-takal-line bg-white text-takal-ink hover:border-[#DADA00] hover:bg-[#FFFEE0]"}`}>
              <span aria-hidden>{verticalEmoji(t.vendorType)}</span>
              <span className="flex-1">{t.name}</span>
              {on && <span aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>

      {to && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium text-takal-ink">
            Category in the new store{otherKind ? " *" : " (optional)"}
          </p>
          {cats === null ? (
            <p className="text-sm text-takal-ink-soft">Reading {to.name}’s categories…</p>
          ) : cats.length === 0 ? (
            <p className="text-sm text-takal-ink-soft">
              The categories could not be read - it keeps its own. You can change it later in the product.
            </p>
          ) : (
            <CategoryPicker options={cats} value={categoryId} onChange={setCategoryId}
              emptyLabel={otherKind ? "Choose a category…" : "Keep its category"}
              ariaLabel="Category in the new store" className="w-full" />
          )}
          {needsCategory && (
            <p className="mt-1 text-xs text-takal-ink-soft">
              {to.name} is another kind of store - choose where customers will find it.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 rounded-lg bg-takal-orange-soft px-3 py-2 text-[13px] font-semibold text-[#C8410F]">
        Not possible while the product is in an order that is not finished - you will be told which one.
      </p>
      {problem && <p role="alert" className="mt-3 text-sm text-takal-red">{problem}</p>}
    </Modal>
  );
}
