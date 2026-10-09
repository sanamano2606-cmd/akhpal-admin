// ─────────────────────────────────────────────────────────────────────────────
// A MALL'S STAFF: ORDERS.  (Mock 172-5, approved by Sana 8 October 2026; Step 5.)
//
// A mall basket is ONE order to the customer and ONE parcel for Takal, even
// though each store packs its own part. So the staff see it as one card with
// each store's lines, and one press takes the whole order a step:
//   New        -> "Accept whole order"  (every part accepted)   or  "Reject"
//   Accepted   -> "Packed - ready for Takal" (every part ready)   or  "Cancel"
//   Ready      -> waiting for Takal to collect it                    "Cancel"
// Sending out and delivering are Takal's - the server refuses them for a
// staff login (routers/orders_status.py STAFF_STEPS), and refuses Reject or
// Cancel once the order has left the store.
//
// What staff see of the money: the store's OWN prices. Takal's commission,
// the rider's pay, the customer's phone and the doorstep code are taken off by
// the server before the order reaches this page (routers/orders_read.py).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShopOrder } from "@/lib/api-orders";
import { money, orderLabel } from "@/lib/format";
import { shortName } from "@/lib/malls";
import {
  actionsAt, partsFor, storePrices, wholeOrders, type StaffShop, type WholeAction, type WholeOrder,
} from "@/lib/mall-staff-window";
import { toast } from "@/lib/toast";
import { verticalEmoji } from "@/lib/verticals";
import { ErrorState } from "@/components/ui";
import { AskDialog } from "@/app/dashboard/orders/parcels/parts-ask-dialog";

/** New orders arrive while the page is open: it reads again on its own. */
const READ_AGAIN_MS = 30_000;

const STAGE: Record<WholeOrder["stage"], { label: string; cls: string }> = {
  new: { label: "NEW", cls: "bg-takal-red-soft text-takal-red" },
  accepted: { label: "Accepted", cls: "bg-takal-blue-soft text-takal-blue" },
  packing: { label: "Packing", cls: "bg-takal-blue-soft text-takal-blue" },
  ready: { label: "Ready - Takal collects", cls: "bg-takal-green-soft text-takal-green" },
};

export function ShopOrdersTab({ stores, mallName, onlyStore, onChanged }: {
  stores: StaffShop[];
  mallName: string;
  /** A store chosen at the top: only orders it has a part in. */
  onlyStore: string | null;
  onChanged?: () => void;
}) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [stopping, setStopping] = useState<{ o: WholeOrder; action: WholeAction } | null>(null);
  const alive = useRef(true);
  const names = new Map(stores.map((s) => [String(s.id), s]));
  const ids = stores.map((s) => String(s.id)).join(",");

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    const all: ShopOrder[] = [];
    const bad: string[] = [];
    await Promise.all(stores.map(async (s) => {
      try {
        const r = await apiClient.getShopOrders(String(s.id));
        all.push(...(Array.isArray(r?.orders) ? r.orders : []));
      } catch {
        bad.push(shortName(s.name, mallName));
      }
    }));
    if (!alive.current) return;
    setOrders(all);
    // A failed read must never look like "no orders" (honest states).
    setLoadError(bad.length ? `The orders of ${bad.join(", ")} could not be read.` : "");
    setLoading(false);
  };

  useEffect(() => {
    alive.current = true;
    load();
    const t = setInterval(() => load(true), READ_AGAIN_MS);
    return () => { alive.current = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const shown = wholeOrders(orders).filter((o) => !onlyStore || o.parts.some((p) => String(p.restaurant_id) === onlyStore));

  /** One press, every part: each part is moved on its own door; a part that
   *  fails is named, and pressing again finishes only what is left. */
  const run = async (o: WholeOrder, action: WholeAction, reason?: string) => {
    const steps = partsFor(o, action);
    if (!steps.length) return;
    setBusy(o.key);
    const failed: string[] = [];
    for (const st of steps) {
      try {
        await apiClient.setOrderStatus(st.id, st.to, reason);
      } catch (e) {
        const part = o.parts.find((p) => String(p.id) === st.id);
        const where = part ? shortName(names.get(String(part.restaurant_id))?.name || "", mallName) : "";
        failed.push(`${where || "A part"}: ${e instanceof Error ? e.message : "not saved"}`);
      }
    }
    setBusy(null);
    setStopping(null);
    if (failed.length) toast(`Not every part was changed - ${failed.join(" · ")}. Press again to finish.`, "error");
    else toast(action === "accept" ? "Order accepted" : action === "ready" ? "Marked ready - Takal will collect it"
      : action === "reject" ? "Order rejected" : "Order cancelled", "success");
    await load(true);
    onChanged?.();
  };

  const label: Record<WholeAction, (o: WholeOrder) => string> = {
    accept: (o) => (o.parts.length > 1 ? "✓ Accept whole order" : "✓ Accept"),
    ready: () => "Packed - ready for Takal",
    reject: () => "✕ Reject",
    cancel: () => "Cancel",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-takal-ink-soft">
          Orders still in the store. A mall order is one parcel: every store packs its part, Takal collects it once.
        </p>
        <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-takal-ink-soft hover:text-takal-ink">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loadError && <ErrorState message={loadError} onRetry={() => load()} />}

      {/* read-safe: "no orders" is said only when every store's orders were read (loadError above). */}
      {loading ? (
        <p className="py-6 text-center text-sm text-takal-ink-soft">Reading the orders…</p>
      ) : shown.length === 0 ? (
        !loadError && <p className="py-6 text-center text-sm text-takal-ink-soft">No order in the store right now.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((o) => {
            const st = STAGE[o.stage];
            const many = o.isMall && o.parts.length > 1;
            return (
              <div key={o.key} className={`rounded-2xl border-2 bg-white p-4 ${o.stage === "new" ? "border-[#111111]" : "border-takal-line"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-extrabold text-takal-ink">{orderLabel(o.parts[0])}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
                  {o.isMall && (
                    <span className="ml-auto rounded-full bg-takal-blue-soft px-2.5 py-0.5 text-xs font-bold text-takal-blue">
                      {many ? "One parcel" : "Mall order"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-takal-ink-soft">
                  {o.isMall && mallName ? `${mallName} · ${o.parts.length} store${o.parts.length === 1 ? "" : "s"}` : shortName(names.get(String(o.parts[0].restaurant_id))?.name || "", mallName)}
                  {" · "}{new Date(o.createdAt).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>

                <div className="mt-3 space-y-2">
                  {o.parts.map((p) => {
                    const s = names.get(String(p.restaurant_id));
                    return (
                      <div key={p.id}>
                        <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-takal-ink-soft">
                          <span aria-hidden>{verticalEmoji(s?.vendor_type)}</span> {shortName(s?.name || "Store", mallName)}
                          {p.status !== o.parts[0].status && <span className="ml-1.5 normal-case tracking-normal">· {String(p.status).replace(/_/g, " ")}</span>}
                        </p>
                        {(p.items || []).map((it, i) => (
                          <div key={it.id || i} className="mt-1.5 flex items-center gap-3">
                            {/* The product's picture (Sana, 9 Oct 2026), so the right
                                one is packed. Tap = the big picture in a new tab. */}
                            {it.item_image ? (
                              <a href={it.item_image} target="_blank" rel="noopener noreferrer"
                                title="Open the picture" className="shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={it.item_image} alt={it.item_name || "Product"} loading="lazy"
                                  className="h-14 w-14 rounded-xl border border-takal-line bg-[#F7F7F2] object-cover" />
                              </a>
                            ) : (
                              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-takal-line bg-[#FAFAF7] text-[10px] font-semibold text-takal-ink-soft">
                                <Package aria-hidden className="h-5 w-5" />
                                No picture
                              </span>
                            )}
                            <p className="min-w-0 text-[15px] text-takal-ink">
                              <b>{Number(it.quantity) || 1}×</b> {it.item_name || "Item"}
                            </p>
                          </div>
                        ))}
                        {p.vendor_subtotal != null && many && (
                          <p className="text-[13px] text-takal-ink-soft">This store’s prices: <b className="text-takal-ink">{money(p.vendor_subtotal)}</b></p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 flex justify-between border-t border-takal-line pt-2 text-[15px]">
                  <span>Your item prices</span><b>{money(storePrices(o))}</b>
                </p>
                {many ? (
                  <p className="mt-2 rounded-lg bg-takal-blue-soft px-3 py-2 text-[13px] font-semibold text-takal-blue">
                    Pack all {o.parts.length} stores’ items in <b>one parcel</b>. Takal collects it once.
                  </p>
                ) : o.isMall && (
                  <p className="mt-2 rounded-lg bg-takal-blue-soft px-3 py-2 text-[13px] font-semibold text-takal-blue">
                    Part of a mall order - the other stores pack theirs. Takal puts them in one parcel.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {o.stage === "ready" && (
                    <span className="mr-auto self-center text-[13px] text-takal-ink-soft">Waiting for Takal to collect it.</span>
                  )}
                  {actionsAt(o).map((a) => {
                    const stop = a === "reject" || a === "cancel";
                    return (
                      <button key={a} type="button" disabled={busy === o.key}
                        onClick={() => (stop ? setStopping({ o, action: a }) : run(o, a))}
                        className={stop
                          ? "rounded-xl border-2 border-takal-red bg-white px-4 py-2.5 text-[15px] font-bold text-takal-red hover:bg-takal-red-soft disabled:opacity-50"
                          : "rounded-xl bg-takal-yellow px-5 py-2.5 text-[15px] font-bold text-takal-ink shadow-[0_3px_0_#E6E600] hover:bg-takal-yellow-dark disabled:opacity-50"}>
                        {busy === o.key && !stop ? "Saving…" : label[a](o)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AskDialog
        open={stopping !== null}
        busy={busy === stopping?.o.key}
        title={stopping ? `${stopping.action === "reject" ? "Reject" : "Cancel"} order ${orderLabel(stopping.o.parts[0])}?` : ""}
        hint={stopping && stopping.o.parts.length > 1
          ? `The whole order stops - all ${stopping.o.parts.length} stores' parts. The customer is told straight away.`
          : "The customer is told straight away."}
        label="Why? (the customer reads this)"
        placeholder="This item is out of stock"
        required
        danger
        warning="Write it for the customer. Only while the order is still in the store - after that, call Takal."
        confirmLabel={stopping?.action === "reject" ? "Reject this order" : "Cancel this order"}
        onClose={() => setStopping(null)}
        onDone={(reason) => stopping && run(stopping.o, stopping.action, reason)}
      />
    </div>
  );
}
