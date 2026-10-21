// ─────────────────────────────────────────────────────────────────────────────
// "SELL ±" FOR A STANDARD STORE  (MOCK 203 v2, approved by Sana 20 Oct 2026).
//
// Its own file on purpose: parts-products-prices.tsx is the FIXED-PRICE
// store's prices, and every one of those goes through the one prices door. A
// standard store's selling price is the shop's own price, saved through the
// product itself - so it never sits beside that door.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { Modal } from "@/components/ui";
import { commissionOf, customerPays, movePrice, takalEarns, type PriceDirection, type PriceHow } from "@/lib/fixed-prices";

// ── MOCK 203 v2: "Sell ±" for a STANDARD store ──────────────────────────────
// A standard store's selling price is the shop's own price (menu_items.price),
// so it is not sent through the prices door (which refuses it - fixed_prices.py)
// but through each product's own save, one after another. The same before ->
// after table first, rounding to whole rupees or the nearest Rs 10, and a
// warning when anything would sell below its buying price. A product sold in
// sizes is left out - its prices are per size, in Edit.
export function StandardSellDialog({ open, products, buyingOf, commission = null, onClose, onDone }: {
  open: boolean;
  products: { id: string; name: string; price: number | null; discount_percent: number; sized: boolean }[];
  buyingOf: (id: string) => number | null;
  /** An ordinary standard store's commission % (21 Oct 2026): the last column
   *  is Takal's commission on the new price, not a margin over a buying price. */
  commission?: number | null;
  onClose: () => void;
  /** After saving: how many were saved, and the new prices. */
  onDone: (saved: { id: string; price: number }[]) => void;
}) {
  const [dir, setDir] = useState<PriceDirection>("up");
  const [how, setHow] = useState<PriceHow>("pct");
  const [amount, setAmount] = useState("10");
  const [step, setStep] = useState(10);
  const [busy, setBusy] = useState(false);
  const [failedNames, setFailedNames] = useState<string[]>([]);
  useEffect(() => { if (open) { setBusy(false); setFailedNames([]); } }, [open]);
  const n = Number(amount);
  const ok = /^\d+(\.\d+)?$/.test(amount.trim()) && n > 0 && (how === "rs" ? Number.isInteger(n) : n <= 100 || dir === "up");
  const lines = useMemo(() => products.filter((p) => !p.sized && p.price !== null).map((p) => {
    const after = ok ? movePrice(Number(p.price), dir, how, n, step) : Number(p.price);
    const buy = buyingOf(p.id);
    const makes = takalEarns(customerPays(after, p.discount_percent), buy);
    const takes = commission != null ? commissionOf(customerPays(after, p.discount_percent), commission) : null;
    return { id: p.id, name: p.name, before: Number(p.price), after, makes, takes };
  }), [products, ok, dir, how, n, step, buyingOf, commission]);
  const changed = lines.filter((l) => l.after !== l.before);
  const losses = lines.filter((l) => l.makes !== null && l.makes < 0);
  const left = products.length - lines.length;
  const pill = (on: boolean) => `px-3 py-1.5 text-sm font-bold ${on ? "bg-takal-yellow text-black" : "bg-white text-takal-ink hover:bg-takal-page"}`;
  const group = "inline-flex overflow-hidden rounded-xl border-2 border-takal-ink";
  const go = async () => {
    if (!changed.length || busy) return;
    setBusy(true);
    const saved: { id: string; price: number }[] = [];
    const failed: string[] = [];
    for (const l of changed) {
      try { await apiClient.updateMenuItem(l.id, { price: l.after }); saved.push({ id: l.id, price: l.after }); }
      catch { failed.push(l.name); }
    }
    setBusy(false);
    onDone(saved);
    if (!failed.length) onClose();
    else setFailedNames(failed);
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} size="lg" lockClose={busy}
      title={`Change the selling price of ${products.length} product${products.length === 1 ? "" : "s"}`}
      hint="See every new price first - nothing saves until you press the yellow button."
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
          <button onClick={go} disabled={busy || changed.length === 0}
            className="rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
            {busy ? "Saving…" : `Apply to ${changed.length}`}
          </button>
        </div>
      }>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className={group} role="group" aria-label="Up or down">
          {(["up", "down"] as PriceDirection[]).map((d) => (
            <button key={d} type="button" onClick={() => setDir(d)} className={pill(dir === d)} aria-pressed={dir === d}>{d === "up" ? "＋" : "−"}</button>
          ))}
        </div>
        <div className={group} role="group" aria-label="By percent or by rupees">
          {(["pct", "rs"] as PriceHow[]).map((h) => (
            <button key={h} type="button" onClick={() => setHow(h)} className={pill(how === h)} aria-pressed={how === h}>{h === "pct" ? "%" : "Rs"}</button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1 rounded-xl border-2 border-takal-ink px-2 py-1 shadow-[0_0_0_3px_#FFFF00]">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="How much"
            className="w-14 bg-transparent text-sm font-bold outline-none" />
          <b className="text-sm">{how === "pct" ? "%" : "Rs"}</b>
        </label>
        <label className="inline-flex items-center gap-1.5 text-[13px] text-takal-ink-soft">
          round to
          <select value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Round the new prices"
            className="rounded-lg border border-takal-line bg-white px-2 py-1 text-[13px] font-bold text-takal-ink">
            <option value={1}>whole rupees</option>
            <option value={10}>the nearest Rs 10</option>
          </select>
        </label>
      </div>
      {!ok && <p className="mt-3 text-sm font-bold text-takal-red">Type {how === "pct" ? "a percent above 0" : "a whole number of rupees above 0"}.</p>}
      <div className="mt-3 max-h-[46vh] overflow-auto rounded-xl border border-takal-line">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
            <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Selling price</th><th className="px-3 py-2">{commission != null ? `Takal ${commission}%` : "Makes"}</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className={`border-t border-[#F0F0F0] ${l.makes !== null && l.makes < 0 ? "bg-[#FFF1F2]" : ""}`}>
                <td className="px-3 py-1.5">{l.name}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{money(l.before)} → <b>{money(l.after)}</b></td>
                <td className="px-3 py-1.5 whitespace-nowrap font-bold">
                  {commission != null ? <span className="text-takal-green">{l.takes === null ? "—" : money(l.takes)}</span>
                    : l.makes === null ? <span className="font-normal text-takal-ink-soft">no buying price</span>
                    : l.makes < 0 ? <span className="text-takal-red">LOSS {money(-l.makes)}</span>
                      : <span className="text-takal-green">+{money(l.makes)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {losses.length > 0 && (
        <p className="mt-2 rounded-lg bg-takal-red-soft px-3 py-2 text-[13px] font-bold text-takal-red">
          ⚠ {losses.length} would sell below the buying price.
        </p>
      )}
      {left > 0 && <p className="mt-2 text-[12.5px] text-takal-ink-soft">{left} sold in sizes - their prices are changed size by size, in Edit.</p>}
      {failedNames.length > 0 && (
        <p role="alert" className="mt-2 text-[13px] font-bold text-takal-red">Not saved: {failedNames.join(", ")} - try again.</p>
      )}
    </Modal>
  );
}
