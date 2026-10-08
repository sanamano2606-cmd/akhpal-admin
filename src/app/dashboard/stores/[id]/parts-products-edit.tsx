// ─────────────────────────────────────────────────────────────────────────────
// EDIT IN THE LIST - the typing box, and a product's sizes and extras opened
// INSIDE the list.  (Fixed-price stores plan, Step 5a. Mock 171-2, APPROVED by
// Sana 8 October 2026: "Make all the Stores products easily editable within
// the list, so every time no need to open edit products page.")
//
// The rules (what may be typed) are in src/lib/edit-in-the-list.ts, shared
// with the tests. Each size / extra is changed through its OWN door
// (PATCH /variants/{id}), so changing one never rewrites the others.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ProductOptionRow, ShopProduct } from "@/lib/api-stores";
import { money } from "@/lib/format";
import {
  checkOptionPrice, checkStock, dishPriceAfterSizeChange, fromPrice, optionKind,
  type OptionField,
} from "@/lib/edit-in-the-list";

// ── The typing box ───────────────────────────────────────────────────────────

export function EditBox({
  value, onChange, onSave, onCancel, onTab, label, bad = false, wide = false,
  numeric = false, prefix, hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Tab / Shift+Tab: save this box and move on. */
  onTab?: (back: boolean) => void;
  label: string;
  /** The value was refused - drawn red until it is changed or cancelled. */
  bad?: boolean;
  wide?: boolean;
  numeric?: boolean;
  prefix?: string;
  /** Small words under the box ("Name · Enter save · Esc cancel"). */
  hint?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1">
        {prefix && <span className="text-sm font-bold text-takal-ink">{prefix}</span>}
        <input
          ref={ref}
          type="text"
          inputMode={numeric ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onSave(); }
            else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            else if (e.key === "Tab" && onTab) { e.preventDefault(); onTab(e.shiftKey); }
          }}
          aria-label={label}
          aria-invalid={bad || undefined}
          className={[
            "rounded-lg border-[1.5px] px-2 py-1 text-sm font-bold outline-none",
            wide ? "w-full min-w-[160px] max-w-[320px]" : numeric ? "w-20" : "w-40",
            bad
              ? "border-takal-red bg-white text-takal-red shadow-[0_0_0_3px_#FFD6DA]"
              : "border-takal-ink bg-white shadow-[0_0_0_3px_#FFFF00]",
          ].join(" ")}
        />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onSave}
          className="text-takal-green" title="Save (Enter)"><Check className="w-4 h-4" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}
          className="text-takal-ink-soft" title="Cancel (Esc)"><X className="w-4 h-4" /></button>
      </span>
      {hint && (
        <span className="mt-1 text-[11px] text-takal-ink-soft">
          {label.split(" of ")[0]} · <Key>Enter</Key> save · <Key>Esc</Key> cancel · <Key>Tab</Key> next
        </span>
      )}
    </span>
  );
}

export function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-[1.5px] border-takal-ink bg-white px-1 py-px font-sans text-[10.5px] font-bold text-takal-ink">
      {children}
    </kbd>
  );
}

// ── A product's sizes and extras, inside the list ───────────────────────────

type OptNote = { saved?: string; failed?: string; busy?: OptionField | "switch" };

/** Choices first (cheapest first), then
 *  the extras in the order the shop made them - the way Mock 171-2 draws it. */
export function orderOptions(vs: ProductOptionRow[], productPrice?: number | null): ProductOptionRow[] {
  // A choice with no price of its own costs the product's price - it sorts
  // there (500 g at the product's Rs 1,250 comes before 1 kg at Rs 2,450).
  const own = (v: ProductOptionRow) =>
    v.price_override ?? (productPrice != null ? Number(productPrice) : Number.POSITIVE_INFINITY);
  const choices = vs
    .map((v, i) => ({ v, i }))
    .filter((x) => optionKind(x.v) !== "extra")
    .sort((a, b) => {
      const pa = own(a.v);
      const pb = own(b.v);
      return pa !== pb ? pa - pb : a.i - b.i;
    })
    .map((x) => x.v);
  return [...choices, ...vs.filter((v) => optionKind(v) === "extra")];
}

export function OptionRows({
  product, vendorType, columns, showPicture, showCategory, onProduct, priceMode = "plain", priceCells,
}: {
  product: ShopProduct;
  vendorType: string;
  /** How many columns the list has, for the "loading" line. */
  columns: number;
  showPicture: string;
  showCategory: string;
  /** Tell the product's own row what changed: its "from" price, and its own
   *  price when a restaurant's cheapest size moved. */
  onProduct: (change: Partial<ShopProduct>) => void;
  /** A fixed-price store (Step 5b): `priceCells` draws Buying | Selling |
   *  Discount | Takal earns INSTEAD of the price and discount cells. "prepare"
   *  = a standard store filling buying prices: the Buying cell comes first,
   *  and the ordinary price cells stay. */
  priceMode?: "plain" | "fixed" | "prepare";
  priceCells?: (v: ProductOptionRow) => React.ReactNode;
}) {
  const [rows, setRows] = useState<ProductOptionRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; field: OptionField; val: string; bad?: boolean } | null>(null);
  const [notes, setNotes] = useState<Record<string, OptNote>>({});
  const flipping = useRef<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(null);
    (async () => {
      try {
        const res = await apiClient.getProductVariants(product.id);
        if (alive) setRows(orderOptions(res?.variants || [], product.price));
      } catch (err) {
        if (alive) setFailed(err instanceof Error ? err.message : "The sizes and extras could not be read");
      }
    })();
    return () => { alive = false; };
    // product.price only orders the sizes when they arrive; a new price must
    // not read them all again (that would close a box being typed in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, reload]);

  const note = (id: string, n: OptNote) => {
    setNotes((all) => ({ ...all, [id]: n }));
    if (n.saved) {
      setTimeout(() => setNotes((all) => (all[id]?.saved === n.saved ? { ...all, [id]: {} } : all)), 3000);
    }
  };

  const cells = (
    <>
      <td className="border-b border-[#EFEFEA]" />
      <td className={`border-b border-[#EFEFEA] ${showPicture}`} />
    </>
  );

  if (failed) {
    return (
      <tr className="bg-[#FCFCF8]">
        <td colSpan={columns} className="border-b border-[#EFEFEA] px-12 py-2.5 text-[13px] text-takal-red">
          ✕ {failed}{" "}
          <button onClick={() => setReload((k) => k + 1)} className="ml-2 font-bold underline">Try again</button>
        </td>
      </tr>
    );
  }
  if (!rows) {
    return (
      <tr className="bg-[#FCFCF8]">
        <td colSpan={columns} className="border-b border-[#EFEFEA] px-12 py-2.5 text-[13px] text-takal-ink-soft">
          <Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Reading the sizes and extras…
        </td>
      </tr>
    );
  }
  if (rows.length === 0) {
    return (
      <tr className="bg-[#FCFCF8]">
        <td colSpan={columns} className="border-b border-[#EFEFEA] px-12 py-2.5 text-[13px] text-takal-ink-soft">
          No sizes or extras any more - add them with ✏️.
        </td>
      </tr>
    );
  }

  const ids = rows.map((r) => r.id);

  /** Where Tab goes from an option's box. */
  const tabFrom = (v: ProductOptionRow, field: OptionField, back: boolean) => {
    const order: OptionField[] = optionKind(v) === "extra" ? ["price"] : ["price", "stock"];
    const i = order.indexOf(field) + (back ? -1 : 1);
    if (i >= 0 && i < order.length) return { v, field: order[i] };
    const j = ids.indexOf(v.id) + (back ? -1 : 1);
    if (j < 0 || j >= rows.length) return null;
    const w = rows[j];
    const wOrder: OptionField[] = optionKind(w) === "extra" ? ["price"] : ["price", "stock"];
    return { v: w, field: back ? wOrder[wOrder.length - 1] : wOrder[0] };
  };

  const open = (v: ProductOptionRow, field: OptionField) =>
    setEdit({
      id: v.id, field,
      val: field === "price"
        ? (v.price_override == null ? "" : String(v.price_override))
        : (v.stock_quantity == null ? "" : String(v.stock_quantity)),
    });

  const save = async (v: ProductOptionRow, then?: { back: boolean }) => {
    if (!edit || edit.id !== v.id) return;
    const field = edit.field;
    const before = field === "price"
      ? (v.price_override == null ? "" : String(v.price_override))
      : (v.stock_quantity == null ? "" : String(v.stock_quantity));
    const moveOn = () => {
      const t = then ? tabFrom(v, field, then.back) : null;
      if (t) open(t.v, t.field); else setEdit(null);
    };
    if (edit.val.trim() === before.trim()) { moveOn(); return; }   // nothing changed
    const c = field === "price" ? checkOptionPrice(edit.val, optionKind(v)) : checkStock(edit.val);
    if (!c.ok) {
      setEdit({ ...edit, bad: true });
      note(v.id, { failed: `Not saved - ${c.reason}` });
      return;
    }
    const value = c.value as number;
    moveOn();
    note(v.id, { busy: field });
    try {
      const payload = field === "price" ? { price_override: value } : { stock_quantity: value };
      await apiClient.updateVariant(v.id, payload);
      const next = (rows || []).map((r) => (r.id === v.id ? { ...r, ...payload } : r));
      setRows(next);
      note(v.id, { saved: "Saved" });
      if (field === "price") {
        const change: Partial<ShopProduct> = { from_price: fromPrice(next) };
        // A restaurant's dish sold in sizes keeps its own price at the
        // cheapest size (Mock 162) - or every customer card says the wrong
        // "from" price.
        const dish = dishPriceAfterSizeChange(vendorType, next, product.price);
        if (dish !== null) {
          try {
            await apiClient.updateMenuItem(product.id, { price: dish });
            change.price = dish;
          } catch (err) {
            note(v.id, {
              failed: `Size saved, but the dish's "from" price was not (${
                err instanceof Error ? err.message : "try again"}) - open ✏️ and save`,
            });
          }
        }
        onProduct(change);
      }
    } catch (err) {
      note(v.id, { failed: err instanceof Error ? err.message : "Not saved - try again" });
    }
  };

  const flip = async (v: ProductOptionRow) => {
    if (flipping.current.has(v.id)) return;
    flipping.current.add(v.id);
    note(v.id, { busy: "switch" });
    try {
      const on = !v.is_available;
      const res = await apiClient.updateVariant(v.id, { is_available: on });
      const now = res?.variant?.is_available !== undefined ? res.variant.is_available === true : on;
      setRows((all) => (all || []).map((r) => (r.id === v.id ? { ...r, is_available: now } : r)));
      note(v.id, { saved: now ? "Turned ON" : "Turned OFF" });
    } catch (err) {
      note(v.id, { failed: err instanceof Error ? err.message : "Not changed - try again" });
    } finally {
      flipping.current.delete(v.id);
    }
  };

  return (
    <>
      {rows.map((v) => {
        const kind = optionKind(v);
        const n = notes[v.id] || {};
        const soldOut = !v.is_available || v.stock_quantity === 0;
        const editing = edit?.id === v.id ? edit : null;
        const priceText = kind === "extra"
          ? `+ ${money(v.price_override ?? 0)}`
          : v.price_override == null
            ? `uses ${money(product.price)}`
            : money(v.price_override);
        return (
          <tr key={v.id} className={n.failed ? "bg-[#FFF1F2]" : "bg-[#FCFCF8]"}>
            {cells}
            <td className={`border-b border-[#EFEFEA] py-2 pl-8 pr-3 ${n.failed ? "shadow-[inset_4px_0_0_#D62839]" : ""}`}>
              <div className="text-[13.5px] text-takal-ink">
                <span className="text-takal-ink-soft">↳ {kind === "extra" ? "Extra" : kind === "size" ? "Size" : (v.variant_type || "Option")}</span>{" "}
                <b className={soldOut ? "text-takal-ink-soft" : ""}>{v.variant_value}</b>
                {soldOut && (
                  <span className="ml-2 rounded-md bg-takal-red-soft px-1.5 py-px text-[11px] font-bold text-takal-red">Sold out</span>
                )}
                {n.saved && <span className="ml-2 text-xs font-bold text-takal-green">✓ {n.saved}</span>}
              </div>
              {n.failed && <div className="mt-0.5 text-xs font-bold text-takal-red">✕ {n.failed}</div>}
            </td>
            {priceMode !== "plain" && priceCells?.(v)}
            {priceMode !== "fixed" && (<>
            <td className="border-b border-[#EFEFEA] px-3 py-2 whitespace-nowrap">
              {editing?.field === "price" ? (
                <EditBox
                  numeric
                  prefix={kind === "extra" ? "+ Rs" : "Rs"}
                  value={editing.val}
                  bad={editing.bad}
                  label={`${kind === "extra" ? "What it adds" : "Price"} of ${v.variant_value}`}
                  onChange={(val) => setEdit({ ...editing, val, bad: false })}
                  onSave={() => save(v)}
                  onCancel={() => { setEdit(null); note(v.id, {}); }}
                  onTab={(back) => save(v, { back })}
                />
              ) : (
                <button
                  onClick={() => open(v, "price")}
                  disabled={n.busy === "price"}
                  title={kind === "extra" ? "Click to change what it adds" : "Click to change this price"}
                  className={`rounded-lg border-[1.5px] border-dashed px-2 py-1 text-sm font-bold hover:border-takal-ink-soft hover:bg-white ${
                    soldOut || v.price_override == null ? "border-takal-line text-takal-ink-soft" : "border-takal-line text-takal-ink"}`}
                >
                  {n.busy === "price" ? "Saving…" : priceText}
                </button>
              )}
            </td>
            <td className="border-b border-[#EFEFEA]" />
            </>)}
            <td className="border-b border-[#EFEFEA] px-3 py-2 whitespace-nowrap">
              {kind === "extra" ? (
                <span title="Extras are not counted" className="rounded-lg bg-[#EAF6EF] px-2 py-0.5 text-xs font-bold text-takal-green">∞</span>
              ) : editing?.field === "stock" ? (
                <EditBox
                  numeric
                  value={editing.val}
                  bad={editing.bad}
                  label={`Stock of ${v.variant_value}`}
                  onChange={(val) => setEdit({ ...editing, val, bad: false })}
                  onSave={() => save(v)}
                  onCancel={() => { setEdit(null); note(v.id, {}); }}
                  onTab={(back) => save(v, { back })}
                />
              ) : (
                <button
                  onClick={() => open(v, "stock")}
                  disabled={n.busy === "stock"}
                  title="Click to change the stock"
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    v.stock_quantity === 0 ? "bg-takal-red-soft text-takal-red"
                      : v.stock_quantity != null && v.stock_quantity <= 5 ? "bg-takal-orange-soft text-[#C8410F]"
                        : v.stock_quantity == null ? "bg-[#EAF6EF] text-takal-green" : "bg-[#F2F2F2] text-takal-ink"}`}
                >
                  {n.busy === "stock" ? "Saving…"
                    : v.stock_quantity == null ? "∞"
                      : v.stock_quantity === 0 ? "Out of stock"
                        : v.stock_quantity <= 5 ? `${v.stock_quantity} left` : v.stock_quantity.toLocaleString()}
                </button>
              )}
            </td>
            <td className={`border-b border-[#EFEFEA] ${showCategory}`} />
            <td className="border-b border-[#EFEFEA] px-3 py-2">
              <button
                role="switch" aria-checked={v.is_available}
                aria-label={`${v.variant_value} on or off`}
                onClick={() => flip(v)}
                disabled={n.busy === "switch"}
                title={v.is_available ? "On - customers can choose it. Click to turn off." : "Off - customers cannot choose it. Click to turn on."}
                className={`relative inline-block w-10 h-[22px] rounded-full transition disabled:opacity-50 ${v.is_available ? "bg-takal-green" : "bg-[#C9C9C9]"}`}
              >
                <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${v.is_available ? "right-[3px]" : "left-[3px]"}`} />
              </button>
            </td>
            <td className="border-b border-[#EFEFEA]" />
          </tr>
        );
      })}
    </>
  );
}
