// ─────────────────────────────────────────────────────────────────────────────
// A FIXED-PRICE STORE'S PRICES, IN THE PRODUCTS LIST.  (Plan Steps 5b + 5c.)
//
// Sana, 8 October 2026: Option 2, Mock 171 APPROVED, "Do all what you suggest".
//   Mock 171-1  Buying | Selling | Discount | Takal earns, typed in the row;
//               "Loss Rs 50 each" worked out AS YOU TYPE; "Save at a loss?"
//               asked before a loss is saved; "Add buying price" in red.
//   Mock 171-4  change many prices at once - before -> after, shown first.
//   Mock 171-5  a product's price history.
// Every price goes through ONE door, PUT /admin/restaurants/{id}/set-prices,
// which writes the price history and checks for a loss (rules R6, R12). The
// rules and the arithmetic are in src/lib/fixed-prices.ts.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money, fmtDate } from "@/lib/format";
import { Modal } from "@/components/ui";
import { checkDiscount } from "@/lib/edit-in-the-list";
import { parseCsv } from "@/lib/sheet-reader";
import {
  changesFor, checkFixedPrice, customerPays, earnPercent, earnTone, groupHistory, matchSheet,
  planPriceChange, pricesIn, takalEarns,
  type HistoryLine, type PriceDirection, type PriceHow, type PriceItem, type PriceOption,
  type PriceTarget, type SheetMatch, type StorePrices,
} from "@/lib/fixed-prices";
import { EditBox } from "./parts-products-edit";

export type PriceChange = {
  product_id: string; variant_id?: string | null; buying_price?: number;
  selling_price?: number; discount_percent?: number;
};

// ── Reading the prices ──────────────────────────────────────────────────────

export function useStorePrices(restaurantId: string, on: boolean) {
  const [prices, setPrices] = useState<StorePrices | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const asked = useRef(0);
  const reload = useCallback(async () => {
    if (!on) return;
    const mine = ++asked.current;
    try {
      const p = await apiClient.getStorePrices(restaurantId);
      if (mine === asked.current) { setPrices(p); setFailed(null); }
    } catch (err) {
      if (mine === asked.current) setFailed(err instanceof Error ? err.message : "The prices could not be read");
    }
  }, [restaurantId, on]);
  useEffect(() => { if (on) reload(); else setPrices(null); }, [on, reload]);
  const byId = useMemo(() => new Map((prices?.items || []).map((i) => [i.id, i])), [prices]);
  return { prices, byId, failed, reload };
}

/** Header figures: how many cannot be ordered, how many are sold at a loss,
 *  and Takal's average share of what customers pay (Mock 171-1). */
export function priceSummary(items: PriceItem[]): { missing: number; loss: number; avgPercent: number | null } {
  let earned = 0;
  let paid = 0;
  for (const it of items) {
    if (!it.is_available) continue;
    const sizes = it.options.filter((o) => o.kind === "size" && o.is_available);
    const lines = sizes.length
      ? sizes.map((o) => ({ e: o.takal_earns, p: o.customer_pays }))
      : [{ e: it.takal_earns, p: it.customer_pays }];
    for (const l of lines) {
      if (l.e === null || l.p === null) continue;
      earned += l.e;
      paid += l.p;
    }
  }
  return {
    missing: items.filter((i) => i.missing).length,
    loss: items.filter((i) => i.loss).length,
    avgPercent: paid > 0 ? Math.round((earned / paid) * 100) : null,
  };
}

// ── "Takal earns" - one cell ────────────────────────────────────────────────

export function EarnsText({ earns, pays, discount, compact = false }: {
  earns: number | null; pays: number | null; discount?: number; compact?: boolean;
}) {
  const tone = earnTone(earns, pays);
  if (tone === "missing") return <span className="font-bold text-takal-red">–</span>;
  const pct = earnPercent(earns, pays);
  if (tone === "loss") {
    return (
      <span className="font-bold text-takal-red">
        <span className="whitespace-nowrap">Loss {money(-(earns as number))}</span>
        {!compact && <span className="block text-[11px] font-normal">each</span>}
      </span>
    );
  }
  return (
    <span className={`font-bold ${tone === "good" ? "text-takal-green" : "text-[#C8410F]"}`}>
      <span className="whitespace-nowrap">{money(earns)}</span> <span className="text-[11px] font-semibold">{pct !== null ? `${pct}%` : ""}</span>
      {tone === "low" && !compact && (
        <span className="block text-[11px] font-normal">
          low{discount ? " - the discount is Takal's" : ""}
        </span>
      )}
    </span>
  );
}

// ── One product's Buying / Selling / Discount / Takal earns ─────────────────

type FixedField = "buying" | "selling" | "discount";

/** The four cells of a product row in a fixed-price store. `prepare` = a
 *  STANDARD store filling buying prices ahead of the switch: only the Buying
 *  cell is drawn (Mock 171-3, "Fill buying prices first"). */
export function FixedPriceCells({
  item, save, prepare = false, onOpenSizes,
}: {
  item: PriceItem | undefined;
  save: (changes: PriceChange[]) => Promise<boolean>;
  prepare?: boolean;
  onOpenSizes: () => void;
}) {
  const [edit, setEdit] = useState<{ field: FixedField; val: string; bad?: string } | null>(null);
  const [busy, setBusy] = useState<FixedField | null>(null);
  const cell = "px-3 py-2 border-b border-[#F0F0F0]";
  if (!item) {
    return prepare
      ? <td className={cell}><span className="text-takal-ink-soft">…</span></td>
      : <>{[0, 1, 2, 3].map((i) => <td key={i} className={cell}><span className="text-takal-ink-soft">…</span></td>)}</>;
  }
  const sizes = item.options.filter((o) => o.kind === "size");
  const bySizes = sizes.length > 0 && sizes.every((o) => o.has_own_price);
  const kind = "product" as const;

  // As you type: what the customer would pay and what Takal would earn.
  const typed = (f: FixedField) => (edit?.field === f ? edit.val : null);
  const sellNow = typed("selling") !== null && /^\d+$/.test(typed("selling")!.trim()) ? Number(typed("selling")) : item.selling_price;
  const discNow = typed("discount") !== null && /^\d{1,3}$/.test(typed("discount")!.trim()) ? Number(typed("discount")) : item.discount_percent;
  const buyNow = typed("buying") !== null && /^\d+$/.test(typed("buying")!.trim()) ? Number(typed("buying")) : item.buying_price;
  const paysNow = customerPays(sellNow, discNow);
  const earnNow = takalEarns(paysNow, buyNow);

  const open = (f: FixedField) => setEdit({
    field: f,
    val: f === "buying" ? (item.buying_price === null ? "" : String(item.buying_price))
      : f === "selling" ? String(item.selling_price) : (item.discount_percent ? String(item.discount_percent) : ""),
  });
  const order: FixedField[] = prepare ? ["buying"] : ["buying", "selling", "discount"];
  const commit = async (then?: { back: boolean }) => {
    if (!edit) return;
    const f = edit.field;
    const before = f === "buying" ? (item.buying_price === null ? "" : String(item.buying_price))
      : f === "selling" ? String(item.selling_price) : (item.discount_percent ? String(item.discount_percent) : "");
    const move = () => {
      const i = order.indexOf(f) + (then ? (then.back ? -1 : 1) : 99);
      if (then && i >= 0 && i < order.length) open(order[i]); else setEdit(null);
    };
    if (edit.val.trim() === before.trim()) { move(); return; }
    let change: PriceChange;
    if (f === "discount") {
      const c = checkDiscount(edit.val);
      if (!c.ok) { setEdit({ ...edit, bad: c.reason }); return; }
      change = { product_id: item.id, discount_percent: c.value as number };
    } else {
      const c = checkFixedPrice(edit.val, f, kind);
      if (!c.ok) { setEdit({ ...edit, bad: c.reason }); return; }
      change = f === "buying" ? { product_id: item.id, buying_price: c.value } : { product_id: item.id, selling_price: c.value };
    }
    move();
    setBusy(f);
    await save([change]);
    setBusy(null);
  };

  const box = (f: FixedField, label: string) => (
    <EditBox
      numeric prefix={f === "discount" ? undefined : "Rs"}
      value={edit!.val}
      bad={!!edit!.bad}
      label={`${label} of ${item.name}`}
      onChange={(val) => setEdit({ field: f, val })}
      onSave={() => commit()}
      onCancel={() => setEdit(null)}
      onTab={(back) => commit({ back })}
    />
  );
  const bad = edit?.bad ? <div className="mt-1 max-w-[180px] text-[11.5px] font-bold text-takal-red">✕ Not saved - {edit.bad}</div> : null;

  const buyingCell = (
    <td className={cell}>
      {edit?.field === "buying" ? <>{box("buying", "Buying price")}{bad}</>
        : bySizes ? (
          <button type="button" onClick={onOpenSizes} className="max-w-[120px] text-left text-[13px] leading-tight text-takal-ink-soft hover:underline"
            title="Each size has its own buying and selling price - open them under ▾">
            Each size has its own prices ▾
          </button>
        ) : item.buying_price === null ? (
          <button type="button" onClick={() => open("buying")}
            className="max-w-[112px] text-left leading-tight rounded-lg border-[1.5px] border-dashed border-takal-red px-2 py-1 text-sm font-bold text-takal-red hover:bg-white"
            title="Customers cannot order it until it has a buying price">
            {busy === "buying" ? "Saving…" : "Add buying price"}
          </button>
        ) : (
          <button type="button" onClick={() => open("buying")}
            className="whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-line px-2 py-1 text-sm font-bold text-takal-ink hover:border-takal-ink-soft hover:bg-white"
            title="What the vendor is paid - click to change">
            {busy === "buying" ? "Saving…" : money(item.buying_price)}
          </button>
        )}
    </td>
  );
  if (prepare) return buyingCell;

  return (
    <>
      {buyingCell}
      <td className={cell}>
        {edit?.field === "selling" ? <>{box("selling", "Selling price")}{bad}</>
          : bySizes ? <span className="text-takal-ink-soft">–</span>
            : (
              <button type="button" onClick={() => open("selling")}
                className="whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-line px-2 py-1 text-sm font-bold text-takal-ink hover:border-takal-ink-soft hover:bg-white"
                title="What the customer pays, before the discount - click to change">
                {busy === "selling" ? "Saving…" : money(item.selling_price)}
              </button>
            )}
        {!bySizes && discNow > 0 && edit?.field !== "selling" && (
          <div className="mt-0.5 px-2 text-[11.5px] leading-4 text-takal-ink-soft max-w-[120px]">
            after {discNow}% off: <b className="text-takal-ink whitespace-nowrap">{money(paysNow)}</b>
          </div>
        )}
      </td>
      <td className={cell}>
        {edit?.field === "discount" ? <>{box("discount", "Discount")}{bad}</> : (
          <button type="button" onClick={() => open("discount")}
            title="A discount comes off the selling price only - Takal pays it, the vendor still gets the buying price"
            className={`rounded-lg px-2 py-1 text-sm ${item.discount_percent > 0
              ? "bg-takal-red-soft font-bold text-takal-red"
              : "text-takal-ink-soft hover:bg-white hover:outline hover:outline-1 hover:outline-takal-line"}`}>
            {busy === "discount" ? "Saving…" : item.discount_percent > 0 ? `−${item.discount_percent}%` : "—"}
          </button>
        )}
      </td>
      <td className={cell}>
        <div className="max-w-[120px] leading-tight">
        {bySizes ? (
          <SizesRange item={item} />
        ) : (
          <>
            <EarnsText earns={earnNow} pays={paysNow} discount={discNow} />
            {edit && earnNow !== null && earnNow < 0 && (
              <span className="block text-[11px] text-takal-red">as you type - Enter asks first</span>
            )}
          </>
        )}
        </div>
      </td>
    </>
  );
}

/** "Rs 150 – 300" for a product sold in sizes. */
function SizesRange({ item }: { item: PriceItem }) {
  const e = item.options.filter((o) => o.kind === "size" && o.takal_earns !== null).map((o) => o.takal_earns as number);
  if (!e.length) return <span className="font-bold text-takal-red">–</span>;
  const lo = Math.min(...e);
  const hi = Math.max(...e);
  return (
    <span className={`font-bold ${lo < 0 ? "text-takal-red" : "text-takal-green"}`}>
      {lo === hi ? money(lo) : `${money(lo)} – ${money(hi).replace("Rs ", "")}`}
    </span>
  );
}

// ── One size's / extra's Buying / Selling / (Discount) / Takal earns ────────

export function FixedOptionCells({
  item, option, save, prepare = false,
}: {
  item: PriceItem | undefined;
  option: PriceOption | undefined;
  save: (changes: PriceChange[]) => Promise<boolean>;
  prepare?: boolean;
}) {
  const [edit, setEdit] = useState<{ field: "buying" | "selling"; val: string; bad?: string } | null>(null);
  const [busy, setBusy] = useState<"buying" | "selling" | null>(null);
  const cell = "px-3 py-2 border-b border-[#EFEFEA]";
  if (!item || !option) {
    return prepare ? <td className={cell} /> : <><td className={cell} /><td className={cell} /><td className={cell} /><td className={cell} /></>;
  }
  const extra = option.kind === "extra";
  const plus = extra ? "+ " : "";
  const typed = (f: "buying" | "selling") => (edit?.field === f && /^\d+$/.test(edit.val.trim()) ? Number(edit.val) : null);
  const sell = typed("selling") ?? option.selling_price;
  const buy = typed("buying") ?? option.uses_buying_price;
  const pays = customerPays(sell, item.discount_percent);
  const earn = takalEarns(pays, buy);
  const open = (f: "buying" | "selling") => setEdit({
    field: f,
    val: f === "buying" ? (option.buying_price === null ? "" : String(option.buying_price)) : String(option.selling_price),
  });
  const commit = async (then?: { back: boolean }) => {
    if (!edit) return;
    const f = edit.field;
    const before = f === "buying" ? (option.buying_price === null ? "" : String(option.buying_price)) : String(option.selling_price);
    const move = () => {
      const order: ("buying" | "selling")[] = prepare ? ["buying"] : ["buying", "selling"];
      const i = order.indexOf(f) + (then ? (then.back ? -1 : 1) : 99);
      if (then && i >= 0 && i < order.length) open(order[i]); else setEdit(null);
    };
    if (edit.val.trim() === before.trim()) { move(); return; }
    const c = checkFixedPrice(edit.val, f, option.kind);
    if (!c.ok) { setEdit({ ...edit, bad: c.reason }); return; }
    move();
    setBusy(f);
    await save([f === "buying"
      ? { product_id: item.id, variant_id: option.id, buying_price: c.value }
      : { product_id: item.id, variant_id: option.id, selling_price: c.value }]);
    setBusy(null);
  };
  const box = (f: "buying" | "selling") => (
    <>
      <EditBox
        numeric prefix={extra ? "+ Rs" : "Rs"}
        value={edit!.val}
        bad={!!edit!.bad}
        label={`${f === "buying" ? "Buying" : "Selling"} price of ${item.name} - ${option.label}`}
        onChange={(val) => setEdit({ field: f, val })}
        onSave={() => commit()}
        onCancel={() => setEdit(null)}
        onTab={(back) => commit({ back })}
      />
      {edit?.bad && <div className="mt-1 max-w-[180px] text-[11.5px] font-bold text-takal-red">✕ Not saved - {edit.bad}</div>}
    </>
  );
  const buyingCell = (
    <td className={cell}>
      {edit?.field === "buying" ? box("buying") : option.buying_price === null && !(option.kind === "size" && !option.has_own_price && option.uses_buying_price !== null) && option.missing ? (
        <button type="button" onClick={() => open("buying")}
          className="whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-red px-2 py-1 text-sm font-bold text-takal-red hover:bg-white">
          {busy === "buying" ? "Saving…" : "Add buying price"}
        </button>
      ) : (
        <button type="button" onClick={() => open("buying")}
          title={option.buying_price === null ? "Uses the product's buying price - click to give it its own" : "What the vendor is paid - click to change"}
          className={`whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-line px-2 py-1 text-sm font-bold hover:border-takal-ink-soft hover:bg-white ${
            option.buying_price === null ? "text-takal-ink-soft" : "text-takal-ink"}`}>
          {/* A size with no buying price of its own uses the product's: shown
              in grey, the title says so. */}
          {busy === "buying" ? "Saving…" : `${plus}${money(option.uses_buying_price ?? 0)}`}
        </button>
      )}
    </td>
  );
  if (prepare) return buyingCell;
  return (
    <>
      {buyingCell}
      <td className={cell}>
        {edit?.field === "selling" ? box("selling") : (
          <button type="button" onClick={() => open("selling")}
            className={`whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-line px-2 py-1 text-sm font-bold hover:border-takal-ink-soft hover:bg-white ${
              option.has_own_price || extra ? "text-takal-ink" : "text-takal-ink-soft"}`}
            title={option.has_own_price || extra ? "What the customer pays - click to change" : "Uses the product's selling price - click to give it its own"}>
            {busy === "selling" ? "Saving…" : `${plus}${money(option.selling_price)}`}
          </button>
        )}
      </td>
      <td className={cell} />
      <td className={cell}><EarnsText earns={earn} pays={pays} compact /></td>
    </>
  );
}

// ── "Save at a loss?" ───────────────────────────────────────────────────────

export type LossLine = { name: string; buying_price: number | null; customer_pays: number; loss_each: number };

export function LossDialog({ losses, busy, onCancel, onConfirm }: {
  losses: LossLine[] | null; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open={!!losses} onClose={() => { if (!busy) onCancel(); }} size="md" lockClose={busy}
      title={losses && losses.length === 1 ? `Keep selling ${losses[0].name} at a loss?` : "Sell these at a loss?"}
      hint="The customer would pay less than the vendor is paid. Takal pays the difference on every one sold."
      footer={
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">No, change it</button>
          <button onClick={onConfirm} disabled={busy}
            className="flex-1 rounded-lg bg-takal-red px-4 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : "Yes, save at a loss"}
          </button>
        </div>
      }>
      <ul className="space-y-1.5 text-sm">
        {(losses || []).map((l) => (
          <li key={l.name} className="rounded-lg bg-takal-red-soft px-3 py-2">
            <b>{l.name}</b>: customer pays {money(l.customer_pays)}, vendor gets {money(l.buying_price)} -{" "}
            <b className="text-takal-red">Loss {money(l.loss_each)} each</b>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ── Change many prices at once (Mock 171-4) ─────────────────────────────────

export function ChangePricesDialog({ open, items, onClose, save }: {
  open: boolean;
  items: PriceItem[];
  onClose: () => void;
  save: (changes: PriceChange[]) => Promise<boolean>;
}) {
  const [target, setTarget] = useState<PriceTarget>("both");
  const [dir, setDir] = useState<PriceDirection>("up");
  const [how, setHow] = useState<PriceHow>("pct");
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setBusy(false); } }, [open]);
  const n = Number(amount);
  const ok = /^\d+(\.\d+)?$/.test(amount.trim()) && n > 0 && (how === "rs" ? Number.isInteger(n) : n <= 100 || dir === "up");
  const plan = useMemo(() => (ok ? planPriceChange(items, target, dir, how, n) : []), [ok, items, target, dir, how, n]);
  const changes = useMemo(() => changesFor(plan, items), [plan, items]);
  const shown = plan.filter((l) => !l.hidden);
  const losses = shown.filter((l) => l.earnAfter !== null && l.earnAfter < 0);
  const count = pricesIn(changes);
  const pill = (on: boolean) => `px-3.5 py-2 text-sm font-bold ${on ? "bg-takal-yellow text-black" : "bg-white text-takal-ink hover:bg-takal-page"}`;
  const group = "inline-flex overflow-hidden rounded-xl border-2 border-takal-ink";
  const arrow = (a: number | null, b: number | null, plus = "") =>
    a === b ? <span>{a === null ? "–" : `${plus}${a.toLocaleString()}`}</span>
      : <span>{a === null ? "–" : `${plus}${a.toLocaleString()}`} → <b>{b === null ? "–" : `${plus}${b.toLocaleString()}`}</b></span>;
  const earn = (e: number | null) => (e === null ? "–" : e < 0 ? `Loss ${(-e).toLocaleString()}` : e.toLocaleString());
  const go = async () => {
    if (!changes.length || busy) return;
    setBusy(true);
    const done = await save(changes);
    setBusy(false);
    if (done) onClose();
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} size="xl" lockClose={busy}
      title={`Change prices - ${items.length} product${items.length === 1 ? "" : "s"} ticked (with their sizes and extras)`}
      hint="Wholesale prices move often. Change many at once, see every new price first - nothing saves until you press the yellow button."
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
          <button onClick={go} disabled={busy || count === 0}
            className="rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
            {busy ? "Saving…" : `Save ${count} new price${count === 1 ? "" : "s"}`}
          </button>
        </div>
      }>
      <div className="flex flex-wrap items-center gap-3">
        <div className={group} role="group" aria-label="Which price">
          {(["buying", "selling", "both"] as PriceTarget[]).map((t) => (
            <button key={t} type="button" onClick={() => setTarget(t)} className={pill(target === t)} aria-pressed={target === t}>
              {t === "buying" ? "Buying" : t === "selling" ? "Selling" : "Both"}
            </button>
          ))}
        </div>
        <div className={group} role="group" aria-label="Up or down">
          {(["up", "down"] as PriceDirection[]).map((d) => (
            <button key={d} type="button" onClick={() => setDir(d)} className={pill(dir === d)} aria-pressed={dir === d}>
              {d === "up" ? "Up" : "Down"}
            </button>
          ))}
        </div>
        <div className={group} role="group" aria-label="By percent or by rupees">
          {(["pct", "rs"] as PriceHow[]).map((h) => (
            <button key={h} type="button" onClick={() => setHow(h)} className={pill(how === h)} aria-pressed={how === h}>
              {h === "pct" ? "by %" : "by Rs"}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1 rounded-xl border-2 border-takal-ink px-2 py-1.5 shadow-[0_0_0_3px_#FFFF00]">
          {how === "rs" && <b className="text-sm">Rs</b>}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            aria-label={how === "pct" ? "Percent" : "Rupees"} className="w-16 bg-transparent text-sm font-bold outline-none" />
          {how === "pct" && <b className="text-sm">%</b>}
        </label>
        <span className="text-[13px] text-takal-ink-soft">rounded to whole rupees</span>
      </div>
      {!ok && <p className="mt-3 text-sm font-bold text-takal-red">Type {how === "pct" ? "a percent above 0" : "a whole number of rupees above 0"}.</p>}
      <div className="mt-4 max-h-[46vh] overflow-auto rounded-xl border border-takal-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Buying<span className="block normal-case tracking-normal font-normal">before → after</span></th>
              <th className="px-3 py-2">Selling<span className="block normal-case tracking-normal font-normal">before → after</span></th>
              <th className="px-3 py-2">Takal earns<span className="block normal-case tracking-normal font-normal">before → after</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const loss = l.earnAfter !== null && l.earnAfter < 0;
              const plus = l.kind === "extra" ? "+" : "";
              return (
                <tr key={l.key} className={loss ? "bg-[#FFF1F2] shadow-[inset_4px_0_0_#D62839]" : ""}>
                  <td className="border-t border-[#F0F0F0] px-3 py-2 font-semibold">
                    {l.label}{l.kind === "extra" && <span className="font-normal text-takal-ink-soft"> extra</span>}
                    {l.discount > 0 && <span className="ml-1.5 rounded bg-takal-red-soft px-1.5 text-[11px] font-bold text-takal-red">−{l.discount}%</span>}
                  </td>
                  <td className="border-t border-[#F0F0F0] px-3 py-2">{arrow(l.buyingBefore, l.buyingAfter, plus)}</td>
                  <td className="border-t border-[#F0F0F0] px-3 py-2">
                    {arrow(l.sellingBefore, l.sellingAfter, plus)}
                    {l.discount > 0 && l.kind !== "extra" && (
                      <span className="block text-[11.5px] text-takal-ink-soft">customer pays {arrow(l.paysBefore, l.paysAfter)}</span>
                    )}
                  </td>
                  <td className={`border-t border-[#F0F0F0] px-3 py-2 font-bold ${loss ? "text-takal-red" : earnTone(l.earnAfter, l.paysAfter) === "good" ? "text-takal-green" : "text-[#C8410F]"}`}>
                    {earn(l.earnBefore)} → {earn(l.earnAfter)}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-takal-ink-soft">Nothing to change.</td></tr>}
          </tbody>
        </table>
      </div>
      {losses.length > 0 && (
        <p className="mt-3 rounded-xl border-[1.5px] border-[#F5B5BC] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">
          ⚠ {losses.slice(0, 3).map((l) => l.label).join(", ")}{losses.length > 3 ? ` and ${losses.length - 3} more` : ""}{" "}
          {losses.length === 1 ? "is" : "are"} still sold at a loss after this change. Saving will ask &ldquo;Save at a loss?&rdquo;
        </p>
      )}
      <p className="mt-3 rounded-xl border-[1.5px] border-[#BBD3E8] bg-takal-blue-soft px-3 py-2 text-sm text-takal-blue">
        Every change is written to the price history: who, when, old → new. Orders already placed keep their old prices.
      </p>
    </Modal>
  );
}

// ── Price history of one product (Mock 171-5) ───────────────────────────────

export function PriceHistoryDialog({ restaurantId, product, onClose }: {
  restaurantId: string; product: { id: string; name: string } | null; onClose: () => void;
}) {
  const [lines, setLines] = useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!product) return;
    let alive = true;
    setLines(null);
    setFailed(null);
    (async () => {
      try {
        const res = await apiClient.getPriceHistory(restaurantId, product.id);
        if (alive) setLines(groupHistory(res.changes || []));
      } catch (err) {
        if (alive) setFailed(err instanceof Error ? err.message : "The price history could not be read");
      }
    })();
    return () => { alive = false; };
  }, [restaurantId, product]);
  const pair = (p: { old: number | null; new: number | null } | null, pct = false) => {
    if (!p) return <span className="text-takal-ink-soft">–</span>;
    const f = (v: number | null) => (v === null ? "—" : pct ? `${v}%` : v.toLocaleString());
    return <span>{f(p.old)} → <b>{f(p.new)}</b></span>;
  };
  return (
    <Modal open={!!product} onClose={onClose} size="xl" title={`Price history - ${product?.name ?? ""}`}
      hint="Every buying price, selling price and discount change: who, when, old → new. For a disagreement with a vendor: “on 3 Nov your buying price was Rs 520”.">
      {failed ? <p className="text-sm text-takal-red">✕ {failed}</p>
        : !lines ? <p className="text-sm text-takal-ink-soft"><Loader2 className="inline w-4 h-4 animate-spin mr-1" />Reading…</p>
          : lines.length === 0 ? <p className="text-sm text-takal-ink-soft">No price has been changed yet.</p>
            : (
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-takal-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                    <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Buying</th><th className="px-3 py-2">Selling</th><th className="px-3 py-2">Discount</th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="border-t border-[#F0F0F0] px-3 py-2 whitespace-nowrap">{fmtDate(l.when)}</td>
                        <td className="border-t border-[#F0F0F0] px-3 py-2">{l.who}</td>
                        <td className="border-t border-[#F0F0F0] px-3 py-2">{l.item}</td>
                        <td className="border-t border-[#F0F0F0] px-3 py-2">{pair(l.buying)}</td>
                        <td className="border-t border-[#F0F0F0] px-3 py-2">{pair(l.selling)}</td>
                        <td className="border-t border-[#F0F0F0] px-3 py-2">{pair(l.discount, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </Modal>
  );
}

// ── A prices sheet (5c) ─────────────────────────────────────────────────────

/** A sheet's rows, header first. Excel is read by the server's own reader (the
 *  same door as "Whole catalogue"); a .csv is read here. */
async function readSheet(file: File, restaurantId: string): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const out = await apiClient.readSheetFile(file, restaurantId);
    return [out.columns, ...out.rows];
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const s = parseCsv(await file.text());
    return [s.columns, ...s.rows];
  }
  throw new Error("Choose an Excel (.xlsx) or a .csv file.");
}

export function PricesSheetDialog({ open, restaurantId, items, onClose, save }: {
  open: boolean;
  restaurantId: string;
  items: PriceItem[];
  onClose: () => void;
  save: (changes: PriceChange[]) => Promise<boolean>;
}) {
  const [matches, setMatches] = useState<SheetMatch[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setMatches(null); setFileName(""); setProblem(null); setBusy(false); } }, [open]);
  const read = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setProblem(null);
    try {
      const rows = await readSheet(f, restaurantId);
      const m = matchSheet(rows, items);
      if (!m.length) {
        setProblem("No rows were read. The first row must name the columns: Product, Size (optional), Buying price, Selling price.");
        setMatches(null);
      } else setMatches(m);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That file could not be read");
    }
  };
  const good = (matches || []).filter((m) => !m.problem);
  const changes: PriceChange[] = good.map((m) => {
    const c: PriceChange = { product_id: m.item!.id };
    if (m.option) c.variant_id = m.option.id;
    if (m.buying !== null) c.buying_price = m.buying;
    if (m.selling !== null) c.selling_price = m.selling;
    return c;
  });
  const go = async () => {
    if (!changes.length || busy) return;
    setBusy(true);
    const ok = await save(changes);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} size="xl" lockClose={busy} title="Prices sheet"
      hint="Upload a sheet (Excel or .csv) with the columns Product, Size (optional), Buying price, Selling price. Only products already in this store are changed - nothing new is added."
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
          <button onClick={go} disabled={busy || changes.length === 0}
            className="rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
            {busy ? "Saving…" : `Save ${pricesIn(changes)} price${pricesIn(changes) === 1 ? "" : "s"}`}
          </button>
        </div>
      }>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; read(f); }} />
      <button type="button" onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-[#C9C600] bg-takal-yellow-soft px-4 py-3 text-sm font-bold text-takal-ink hover:bg-takal-yellow">
        <Upload className="w-4 h-4" /> {fileName ? `Choose another file (now: ${fileName})` : "Choose the prices sheet"}
      </button>
      {problem && <p className="mt-3 text-sm font-bold text-takal-red">✕ {problem}</p>}
      {matches && (
        <>
          <p className="mt-3 text-sm">
            <FileSpreadsheet className="inline w-4 h-4 mr-1" />
            <b>{good.length}</b> row{good.length === 1 ? "" : "s"} will be saved
            {matches.length - good.length > 0 && <> · <b className="text-takal-red">{matches.length - good.length}</b> cannot be used (shown in red)</>}
          </p>
          <div className="mt-2 max-h-[46vh] overflow-auto rounded-xl border border-takal-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Buying<span className="block normal-case tracking-normal font-normal">now → sheet</span></th>
                  <th className="px-3 py-2">Selling<span className="block normal-case tracking-normal font-normal">now → sheet</span></th>
                  <th className="px-3 py-2">Takal earns</th></tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const nowBuy = m.option ? m.option.uses_buying_price : m.item?.buying_price ?? null;
                  const nowSell = m.option ? m.option.selling_price : m.item?.selling_price ?? null;
                  const sell = m.selling ?? nowSell;
                  const pays = m.item ? customerPays(sell, m.item.discount_percent) : null;
                  const earn = takalEarns(pays, m.buying ?? nowBuy);
                  return (
                    <tr key={m.row} className={m.problem ? "bg-[#FFF1F2]" : ""}>
                      <td className="border-t border-[#F0F0F0] px-3 py-2 text-takal-ink-soft">{m.row}</td>
                      <td className="border-t border-[#F0F0F0] px-3 py-2 font-semibold">
                        {m.name}
                        {m.problem && <span className="block text-xs font-bold text-takal-red">✕ {m.problem}</span>}
                      </td>
                      <td className="border-t border-[#F0F0F0] px-3 py-2">{nowBuy ?? "–"}{m.buying !== null && <> → <b>{m.buying}</b></>}</td>
                      <td className="border-t border-[#F0F0F0] px-3 py-2">{nowSell ?? "–"}{m.selling !== null && <> → <b>{m.selling}</b></>}</td>
                      <td className="border-t border-[#F0F0F0] px-3 py-2">{m.problem ? "–" : <EarnsText earns={earn} pays={pays} compact />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
