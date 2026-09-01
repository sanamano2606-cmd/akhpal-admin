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

  const load = async () => {
    try {
      setLoading(true);
      const d = (await apiClient.getOrders(1, 50, { restaurant_id: restaurantId })) as any;
      const all = d?.orders ?? d ?? [];
      setOrders(Array.isArray(all) ? all : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (restaurantId) load(); /* eslint-disable-next-line */ }, [restaurantId]);

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

  const cancel = async (o: any) => {
    const reason = window.prompt("Why is this order being cancelled? The customer sees this.");
    if (reason === null) return;
    if (!reason.trim()) { toast("A reason is required", "error"); return; }
    try {
      setBusyId(String(o.id));
      await apiClient.cancelOrder(String(o.id), reason.trim());
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
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">Live orders ({live.length})</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Move an order along if the vendor is not responding. The customer and rider see it immediately.
          </p>
        </div>
        <button onClick={load} className="text-sm text-slate-500 hover:text-slate-800">Refresh</button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : live.length === 0 ? (
        <p className="text-sm text-slate-500">No orders waiting on this store right now.</p>
      ) : (
        <div className="space-y-2">
          {live.map((o) => {
            const s = String(o.status);
            const busy = busyId === String(o.id);
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 border border-slate-200 rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-slate-500">
                  #{String(o.id).slice(0, 8).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-slate-800">{money(o.total_amount)}</span>
                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                  {s.replace(/_/g, " ")}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {s === "pending" && (
                    <button disabled={busy} onClick={() => move(o, "accepted", "accepted")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FFFF00] text-black border border-yellow-400 hover:brightness-95 disabled:opacity-50">
                      Accept
                    </button>
                  )}
                  {(s === "accepted" || s === "preparing") && (
                    <button disabled={busy} onClick={() => move(o, "ready", "marked ready")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50">
                      Mark ready
                    </button>
                  )}
                  <button disabled={busy} onClick={() => cancel(o)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
