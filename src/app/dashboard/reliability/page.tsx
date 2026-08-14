"use client";

/**
 * Store Reliability — how often each shop drops orders it had already accepted.
 *
 * WHY THIS PAGE EXISTS
 * The vendor terms tell shops: "We monitor how often each shop cancels after
 * accepting... a shop that cancels repeatedly may be shown lower in the app,
 * suspended, or removed." Nothing measured it, so that clause was a claim we
 * could not have backed up.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not suspend anybody. There is no automatic action anywhere in this
 * feature. The page shows a number, says plainly what the number counts, and
 * leaves the decision to a person — because suspending a shop on a measure this
 * new, in a town with a handful of good restaurants, is a mistake you cannot
 * take back.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RefreshCw, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";

type Vendor = {
  restaurant_id: string;
  name: string;
  vendor_type?: string;
  is_approved?: boolean;
  is_open?: boolean;
  accepted_and_delivered: number;
  dropped_after_accepting: number;
  declined_before_accepting: number;
  cancelled_by_someone_else: number;
  orders_judged: number;
  drop_rate_percent: number;
  verdict: "serious" | "watch" | "ok" | "not_enough_orders";
  avg_minutes_to_ready: number | null;
  late_to_ready: number;
  explanation: string;
};

const VERDICT: Record<string, { label: string; cls: string }> = {
  serious: { label: "Needs action", cls: "bg-red-100 text-red-800 border-red-200" },
  watch: { label: "Watch", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  ok: { label: "Reliable", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  not_enough_orders: { label: "Too few orders", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function ReliabilityPage() {
  const [rows, setRows] = useState<Vendor[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getVendorReliability()) as any;
      setRows(res?.vendors || []);
      setMeta(res || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reliability");
    } finally {
      setLoading(false);
    }
  };

  // Shops we cannot yet judge are hidden by default. Showing a brand-new shop
  // alongside a genuinely reliable one, both at "0%", makes the page lie by
  // omission — a blank record is not a clean record.
  const visible = showAll ? rows : rows.filter((r) => r.verdict !== "not_enough_orders");
  const hidden = rows.length - visible.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-slate-700" />
            Store Reliability
          </h1>
          <p className="text-slate-600 mt-1">
            How often each shop cancels an order it had already accepted.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg transition inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* What the number means. Written on the page rather than kept in
          somebody's head, because this number can end a shop's business here. */}
      {meta?.rules && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-700 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Info className="w-4 h-4" />
            What is counted
          </div>
          <p>
            <strong>Counted:</strong> {meta.rules.counted}
          </p>
          <p>
            <strong>Not counted:</strong> {meta.rules.not_counted}
          </p>
          <p>
            Last <strong>{meta.rules.window_days} days</strong>. A shop needs at least{" "}
            <strong>{meta.rules.min_orders_to_judge}</strong> finished orders before a
            percentage means anything. {meta.rules.watch_percent}% is a warning,{" "}
            {meta.rules.serious_percent}% needs action.
          </p>
          {meta.measured_from && (
            <p className="text-slate-500 pt-1">
              Tracking began {fmtDate(meta.measured_from)}. {meta.note}
            </p>
          )}
          <p className="text-slate-500">
            Nothing here happens automatically — no shop is hidden or suspended by this
            page. Use <Link href="/dashboard/restaurants" className="underline">Stores</Link>{" "}
            if you decide to act.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Store</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Dropped</th>
                <th className="text-right px-4 py-3">Of accepted</th>
                <th className="text-right px-4 py-3">Drop rate</th>
                <th className="text-right px-4 py-3">Avg mins to ready</th>
                <th className="text-right px-4 py-3">Late</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No shop has dropped an accepted order yet.
                  </td>
                </tr>
              )}
              {visible.map((r) => {
                const v = VERDICT[r.verdict] || VERDICT.ok;
                return (
                  <tr key={r.restaurant_id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/restaurants?q=${encodeURIComponent(r.name || "")}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {r.name || "—"}
                      </Link>
                      <div className="text-xs text-slate-500">{r.vendor_type || ""}</div>
                      <div className="text-xs text-slate-500 mt-1 max-w-md">{r.explanation}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full border text-xs font-medium ${v.cls}`}>
                        {v.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{r.dropped_after_accepting}</td>
                    <td className="px-4 py-3 text-right">{r.orders_judged}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.verdict === "not_enough_orders" ? "—" : `${r.drop_rate_percent}%`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.avg_minutes_to_ready == null ? "—" : r.avg_minutes_to_ready}
                    </td>
                    <td className="px-4 py-3 text-right">{r.late_to_ready}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hidden > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
              {hidden} store{hidden === 1 ? "" : "s"} with too few finished orders to judge.{" "}
              <button onClick={() => setShowAll(true)} className="underline">
                Show them
              </button>
            </div>
          )}
          {showAll && (
            <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
              <button onClick={() => setShowAll(false)} className="underline">
                Hide stores with too few orders
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
