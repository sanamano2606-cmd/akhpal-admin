// ─────────────────────────────────────────────────────────────────────────────
// "BILL FOR TAKAL" - one bill-price order's bill, on the order panel.
// Mock 231 pictures 2 and 3, approved by Sana on 8 November 2026.
//
// Shows the shop's own total (never the customer's price), the bill the shop
// typed, what Takal earns on the items and what the shop gets, who typed it,
// and - for someone with "Balances" - "Correct bill total": the paper-bill
// figure and a reason (required). The shop is told the new figure and the
// reason. Once Takal has paid the shop for the order the bill is locked and
// the button is gone. Reading this needs "All Orders"; the server decides.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { OrderBill } from "@/lib/api-orders";
import { canAccess } from "@/lib/perms";
import { money, fmtDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/ui";
import { billDiscount, billProblem } from "@/lib/bill-price";

export function OrderBillBox({ orderId, onChanged }: { orderId: string; onChanged?: () => void }) {
  const [bill, setBill] = useState<OrderBill | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const mayCorrect = canAccess("payments.balances");

  const load = async () => {
    try {
      setBill(await apiClient.getOrderBill(orderId));
      setFailed(null);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "The bill could not be read");
    }
  };
  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const listed = bill?.listed_total ?? null;
  const problem = billProblem(typed, listed);
  const preview = !problem && listed ? billDiscount(listed, Number(typed.replace(/,/g, ""))) : null;
  const reasonOk = reason.trim().length >= 3;

  const save = async () => {
    if (problem || !reasonOk) return;
    setBusy(true);
    setRefused(null);
    try {
      await apiClient.correctOrderBill(orderId, Number(typed.replace(/,/g, "")), reason.trim());
      toast("Bill corrected - the shop has been told", "success");
      setAsking(false);
      await load();
      onChanged?.();
    } catch (err) {
      setRefused(err instanceof Error ? err.message : "Nothing was saved - try again");
    } finally {
      setBusy(false);
    }
  };

  const who = (b: OrderBill) => b.typed_by === "admin" ? "the Takal office" : "the shop (Partners app)";

  return (
    <div data-order-bill className="rounded-xl border-2 border-takal-ink bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-takal-ink">Bill for Takal</h3>
        <span className="rounded-full bg-takal-blue-soft px-2.5 py-0.5 text-[12px] font-bold text-takal-blue">Bill-price store</span>
        {bill?.low && (
          <span data-bill-low className="rounded-full border border-[#b8b800] bg-takal-yellow-soft px-2.5 py-0.5 text-[12px] font-bold text-[#5c5c00]">
            Low discount
          </span>
        )}
      </div>
      {failed && <p className="rounded-lg bg-takal-red-soft px-3 py-2 text-sm text-takal-red">{failed}</p>}
      {!bill && !failed && <Loader2 className="h-5 w-5 animate-spin text-takal-ink-soft" />}
      {bill && (
        <>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt>Listed total (the shop&apos;s own prices)</dt><dd className="font-bold">{listed == null ? "—" : money(listed)}</dd></div>
            <div className="flex justify-between gap-3">
              <dt>Bill total</dt>
              <dd className="font-bold">
                {bill.typed ? money(bill.bill_total) : <span data-bill-missing className="text-[#B23E10]">Not typed yet</span>}
              </dd>
            </div>
            {bill.typed && (
              <div className="flex justify-between gap-3">
                <dt>Takal earns on the items</dt>
                <dd className="font-bold text-takal-green">{money(bill.discount)} ({bill.discount_percent}%)</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-takal-line pt-2 text-base font-bold">
              <dt>Shop gets</dt><dd>{bill.shop_gets == null ? "—" : money(bill.shop_gets)}</dd>
            </div>
          </dl>
          {!bill.typed && (
            <p className="mt-2 rounded-lg bg-takal-orange-soft px-3 py-2 text-[13px] text-[#B23E10]">
              Until the bill is typed, the shop is paid its full listed total and Takal earns nothing on the items.
            </p>
          )}
          {bill.typed && (
            <p className="mt-2 text-[12.5px] text-takal-ink-soft">
              Typed by {who(bill)}{bill.typed_at ? `, ${fmtDateTime(bill.typed_at)}` : ""}.
              {bill.office_reason ? ` Reason: “${bill.office_reason}”` : ""}
            </p>
          )}
          {bill.locked === true && (
            <p data-bill-locked className="mt-2 text-[12.5px] font-semibold text-takal-ink-soft">
              Locked: Takal has already paid the shop for this order.
            </p>
          )}
          {bill.lock_checked === false && (
            <p className="mt-2 text-[12.5px] text-takal-red">Could not check whether the shop was already paid for this order.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {mayCorrect && bill.locked === false && (
              <button data-correct-bill onClick={() => { setTyped(bill.typed ? String(bill.bill_total) : ""); setReason(""); setRefused(null); setAsking(true); }}
                className="rounded-lg bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark">
                {bill.typed ? "Correct bill total" : "Type bill total"}
              </button>
            )}
            {(bill.history?.length ?? 0) > 0 && (
              <button onClick={() => setShowHistory((v) => !v)}
                className="rounded-lg border border-takal-ink bg-white px-4 py-2 text-sm font-bold text-takal-ink hover:bg-takal-page">
                {showHistory ? "Hide bill history" : "See bill history"}
              </button>
            )}
          </div>
          {showHistory && (
            <ul data-bill-history className="mt-3 space-y-1.5 border-t border-takal-line pt-2 text-[12.5px] text-takal-ink-soft">
              {bill.history!.map((h, i) => (
                <li key={i}>
                  <b className="text-takal-ink">{money(h.new_bill)}</b>
                  {h.old_bill != null ? ` (was ${money(h.old_bill)})` : ""} by{" "}
                  {h.changed_by_role === "admin" ? `${h.changed_by_name || "the office"}` : "the shop"}, {fmtDateTime(h.created_at)}
                  {h.reason ? ` - “${h.reason}”` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal open={asking} onClose={() => { if (!busy) setAsking(false); }} lockClose={busy}
        title={bill?.typed ? "Correct bill total" : "Type bill total"}
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setAsking(false)} disabled={busy}
              className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
            <button data-save-bill onClick={save} disabled={busy || !!problem || !reasonOk}
              className="rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
              {busy ? "Saving…" : "Save correction"}
            </button>
          </div>
        }>
        <p className="mb-3 text-sm text-takal-ink-soft">
          Listed total {listed == null ? "—" : money(listed)}
          {bill?.typed ? ` · the shop typed ${money(bill.bill_total)}` : " · no bill typed yet"}
        </p>
        <label className="block text-[13px] font-medium text-takal-ink-soft">Bill total from the paper bill</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-takal-ink px-3 py-2">
          <span className="font-bold text-takal-ink-soft">Rs</span>
          <input data-bill-input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)}
            className="w-full text-xl font-bold outline-none" placeholder="1850" />
        </div>
        {typed && problem && <p data-bill-problem className="mt-1 text-[13px] font-bold text-takal-red">{problem}</p>}
        <label className="mt-3 block text-[13px] font-medium text-takal-ink-soft">Reason (required)</label>
        <textarea data-bill-reason value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300}
          className="mt-1 w-full rounded-xl border border-takal-line px-3 py-2 text-sm" placeholder="Paper bill says Rs 1,850" />
        {preview && (
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Shop gets</dt><dd className="font-bold">{money(Number(typed.replace(/,/g, "")))}</dd></div>
            <div className="flex justify-between"><dt>Takal earns on the items</dt><dd className="font-bold text-takal-green">{money(preview.rupees)} ({preview.percent}%)</dd></div>
          </dl>
        )}
        <p className="mt-2 text-[12.5px] text-takal-ink-soft">The shop sees the change and the reason in the Partners app.</p>
        {refused && <p className="mt-2 rounded-lg bg-takal-red-soft px-3 py-2 text-sm font-bold text-takal-red">✕ {refused}</p>}
      </Modal>
    </div>
  );
}
