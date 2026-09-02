"use client";

/**
 * DECIDING A RETURN.
 *
 * WHAT THIS REPLACES. `window.prompt()` — the browser's own grey box — asking
 * for "an optional note", and then refunding THE WHOLE ORDER. There was no way
 * to refund the item and keep the delivery fee, no way to see what was in the
 * order, and the reason the customer gave was cut off in the table column, so
 * the one thing needed to judge the return was the one thing not shown.
 *
 * WHY THE PART-REFUND MATTERS. On a Rs 1,500 return where only the item goes
 * back, refunding everything gives away the Rs 100 delivery fee that was
 * genuinely earned — the rider rode, the parcel arrived, the customer changed
 * their mind. That was happening by default, silently, because the button
 * offered no choice.
 *
 * THE SERVER HAS ALWAYS ACCEPTED A PART AMOUNT. Only this screen never asked.
 *
 * Approved by Sana on 2 September 2026, mock-up 14.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";

export function ReturnDialog({
  row,
  onClose,
  onApprove,
  onReject,
}: {
  row: any | null;
  onClose: () => void;
  onApprove: (amount: number, note: string) => Promise<void>;
  onReject: (note: string) => Promise<void>;
}) {
  const [full, setFull] = useState<any>(null);
  const [choice, setChoice] = useState<"all" | "item" | "some">("item");
  const [some, setSome] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");

  const total = Number(row?.total_amount || 0);
  const fee = Number(full?.order?.delivery_fee ?? row?.delivery_fee ?? 0);
  const goodsOnly = Math.max(0, total - fee);

  useEffect(() => {
    setChoice("item");
    setSome("");
    setNote("");
    setFull(null);
    if (!row?.id) return;
    let alive = true;
    (async () => {
      try {
        const res = (await apiClient.getOrderFull(row.id)) as any;
        if (alive) setFull(res);
      } catch {
        // The items are extra help, not the point. Deciding the return must
        // still be possible if this read fails.
      }
    })();
    return () => {
      alive = false;
    };
  }, [row?.id]);

  const amount =
    choice === "all" ? total : choice === "item" ? goodsOnly : Number(some || 0);

  const tooMuch = amount > total;

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      size="xl"
      lockClose={!!busy}
      title={`Return on #${String(row?.id ?? "").slice(0, 8)} — ${
        row?.customer_name || "customer not named"
      }`}
      hint="Recording only. You still pay the customer back yourself."
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={async () => {
              setBusy("reject");
              try {
                await onReject(note.trim());
              } finally {
                setBusy("");
              }
            }}
            loading={busy === "reject"}
          >
            Reject the return
          </Button>
          <Button
            loading={busy === "approve"}
            disabled={!!busy || tooMuch || amount < 0}
            onClick={async () => {
              setBusy("approve");
              try {
                await onApprove(amount, note.trim());
              } finally {
                setBusy("");
              }
            }}
          >
            Approve · {money(amount)}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-takal-ink-soft">
            What the customer said, in full
          </p>
          <div className="mb-5 rounded-lg border-2 border-takal-line px-4 py-3 text-sm leading-relaxed">
            {row?.return_reason || (
              <span className="text-takal-ink-soft">No reason was given.</span>
            )}
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-takal-ink-soft">
            What was in the order
          </p>
          <div className="overflow-hidden rounded-lg border-2 border-takal-line">
            {(full?.items || []).length === 0 ? (
              <div className="px-4 py-3 text-sm text-takal-ink-soft">
                {full ? "No lines recorded on this order." : "Reading the order…"}
              </div>
            ) : (
              full.items.map((it: any, i: number) => (
                <div
                  key={it.id ?? i}
                  className="flex items-center justify-between border-b border-takal-line px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span>
                    <span className="mr-2 rounded-md bg-takal-ink px-1.5 py-0.5 text-[11px] font-black text-takal-yellow">
                      {it.quantity ?? 1}×
                    </span>
                    {it.item_name || "Item"}
                  </span>
                  <span className="font-bold">{money(it.price ?? it.total ?? 0)}</span>
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t-2 border-takal-ink bg-takal-page px-4 py-2.5 text-sm font-black">
              <span>Delivery</span>
              <span>{money(fee)}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-takal-ink-soft">
            How much goes back
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["all", `Everything · ${money(total)}`],
                ["item", `Just the goods · ${money(goodsOnly)}`],
                ["some", "Some of it…"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setChoice(k)}
                className={`rounded-lg border-2 px-3 py-2 text-sm transition ${
                  choice === k
                    ? "border-takal-ink bg-takal-yellow font-bold text-takal-ink"
                    : "border-takal-line bg-white text-takal-ink-soft hover:bg-takal-page"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {choice === "some" && (
            <input
              autoFocus
              type="number"
              min={0}
              max={total}
              value={some}
              onChange={(e) => setSome(e.target.value)}
              placeholder="Amount in rupees"
              className="mb-3 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
            />
          )}
          {tooMuch && (
            <p className="mb-3 rounded-lg bg-takal-red-soft px-3 py-2 text-sm text-takal-red">
              This order came to {money(total)}. You cannot refund {money(amount)}.
            </p>
          )}

          <div className="mb-4 rounded-lg bg-takal-page px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-takal-ink-soft">Customer gets back</span>
              <span className="font-bold">{money(amount)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-takal-ink-soft">Delivery fee kept</span>
              <span className="font-bold">
                {money(Math.max(0, Math.min(fee, total - amount)))}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between border-t-2 border-takal-ink pt-2 font-black">
              <span>Order value left standing</span>
              <span>{money(Math.max(0, total - amount))}</span>
            </div>
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-takal-ink-soft">
            Note for the record
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shirt back at the office, tagged, going to the shop on Thursday"
            className="mb-4 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          />
          <div className="rounded-r-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm leading-relaxed">
            <b>No money moves when you press this.</b> It records what you owe
            the customer. You still pay them back yourself.
          </div>
        </div>
      </div>
    </Modal>
  );
}
