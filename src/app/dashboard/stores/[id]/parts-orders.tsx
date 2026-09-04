// ─────────────────────────────────────────────────────────────────────────────
// The shop's live orders card - what is happening in this shop right now.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";
import { AskDialog } from "../../orders/parcels/parts-ask-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// This store's live orders.
//
// So you can keep an order moving when the vendor is slow or unreachable —
// the customer and rider are waiting on the same statuses either way. Actions
// go through PUT /orders/{id}/status, exactly as the vendor app does.
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_STATUSES = ["pending", "accepted", "preparing", "ready"];

export function StoreOrdersCard({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // A FAILED READ MUST NOT BECOME A FACT ABOUT THE SHOP.
  // "No orders waiting on this store right now" told the operator the shop
  // was idle whenever the read failed - so a shop sitting on five late
  // orders looked quiet, and nobody went and chased it.
  const [loadError, setLoadError] = useState<ReadFailure>(null);

  const load = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      // ASKED FOR 50 AND THEN THREW MOST OF THEM AWAY.
      // This page keeps only the live ones, so a live order sitting behind 50
      // newer ones for the same shop was invisible - and the heading said
      // "Live orders (0)" with complete confidence. 200 covers every shop on
      // the system today, and the note under the heading says what happens if
      // a shop ever passes it.
      const d = (await apiClient.getOrders(1, 200, { restaurant_id: restaurantId })) as any;
      const all = d?.orders ?? d ?? [];
      setOrders(Array.isArray(all) ? all : []);
    } catch (err) {
      setLoadError(readFailure(err, "this shop's orders"));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (restaurantId) load();
    // `load` is deliberately not a dependency: it is rebuilt on every render,
    // so watching it would re-read this shop's orders on every keystroke
    // anywhere on the page. The bare disable that used to be here silenced
    // EVERY rule on this line, including any real fault added later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const move = async (o: any, status: string, label: string) => {
    try {
      setBusyId(String(o.id));
      await apiClient.setOrderStatus(String(o.id), status);
      toast(`Order ${label}`, "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the order", "error");
    } finally {
      setBusyId(null);
    }
  };

  // THE REASON THE CUSTOMER READS WAS TYPED INTO THE BROWSER'S GREY BOX.
  // It could not say which order, could not be styled, and on some browsers
  // does not appear at all - in which case the Cancel button silently did
  // nothing. It is now the same window the Parcels desk uses.
  const [cancelling, setCancelling] = useState<any | null>(null);

  const doCancel = async (o: any, reason: string) => {
    try {
      setBusyId(String(o.id));
      await apiClient.cancelOrder(String(o.id), reason.trim());
      setCancelling(null);
      toast("Order cancelled", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cancel", "error");
    } finally {
      setBusyId(null);
    }
  };

  const live = orders.filter((o) => LIVE_STATUSES.includes(String(o.status)));

  return (
    <div className="bg-white rounded-lg border border-takal-line p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-takal-ink">Live orders ({live.length})</h3>
          <p className="text-xs text-takal-ink-soft mt-0.5">
            Move an order along if the vendor is not responding. The customer
            and rider see it immediately. The 200 most recent orders for this
            shop are read; a live order older than that would not appear here.
          </p>
        </div>
        <button onClick={load} className="text-sm text-takal-ink-soft hover:text-takal-ink">Refresh</button>
      </div>

      {loading ? (
        <p className="text-sm text-takal-ink-soft">Loading…</p>
      ) : loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : live.length === 0 ? (
        <p className="text-sm text-takal-ink-soft">No orders waiting on this store right now.</p>
      ) : (
        <div className="space-y-2">
          {live.map((o) => {
            const s = String(o.status);
            const busy = busyId === String(o.id);
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 border border-takal-line rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-takal-ink-soft">
                  #{String(o.id).slice(0, 8).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-takal-ink">{money(o.total_amount)}</span>
                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-takal-ink capitalize">
                  {s.replace(/_/g, " ")}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {s === "pending" && (
                    <button disabled={busy} onClick={() => move(o, "accepted", "accepted")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink transition disabled:opacity-50">
                      Accept
                    </button>
                  )}
                  {(s === "accepted" || s === "preparing") && (
                    <button disabled={busy} onClick={() => move(o, "ready", "marked ready")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50">
                      Mark ready
                    </button>
                  )}
                  <button disabled={busy} onClick={() => setCancelling(o)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AskDialog
        open={cancelling !== null}
        busy={busyId === String(cancelling?.id)}
        title={`Cancel order #${String(cancelling?.id ?? "").slice(0, 8)}?`}
        hint="The shop and the customer both see this straight away."
        label="Why is this order being cancelled?"
        placeholder="The shop has run out of the main item"
        required
        danger
        warning="The customer reads these words. Write them for the customer, not for the office."
        confirmLabel="Cancel this order"
        onClose={() => setCancelling(null)}
        onDone={(reason) => cancelling && doCancel(cancelling, reason)}
      />
    </div>
  );
}
