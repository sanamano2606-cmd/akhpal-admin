"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money, fmtDateTime } from "@/lib/format";
import { ErrorState } from "@/components/ui";

interface ReturnRow {
  id: string;
  customer_name?: string | null;
  total_amount?: number | null;
  return_status: string;
  return_reason?: string | null;
  return_requested_at?: string | null;
  return_admin_note?: string | null;
}

export default function ReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("requested");
  const [acting, setActing] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getReturns(
        statusFilter === "all" ? undefined : statusFilter
      )) as any;
      setRows(res?.returns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const approve = async (r: ReturnRow) => {
    const note = window.prompt(
      `Approve return and record a refund of ${money(r.total_amount ?? 0)}?\nOptional note:`,
      ""
    );
    if (note === null) return; // cancelled
    try {
      setActing(r.id);
      await apiClient.approveReturn(r.id, note || undefined);
      toast("Return approved & refund recorded", "success");
      await fetchReturns();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    } finally {
      setActing(null);
    }
  };

  const reject = async (r: ReturnRow) => {
    const note = window.prompt("Reject this return. Optional reason:", "");
    if (note === null) return;
    try {
      setActing(r.id);
      await apiClient.rejectReturn(r.id, note || undefined);
      toast("Return rejected", "success");
      await fetchReturns();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reject", "error");
    } finally {
      setActing(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      requested: "bg-yellow-50 text-yellow-700",
      approved: "bg-green-50 text-green-700",
      rejected: "bg-red-50 text-red-700",
    };
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[s] || "bg-slate-100 text-takal-ink"}`}>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  const pending = rows.filter((r) => r.return_status === "requested").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-takal-ink" /> Returns &amp; Refunds
          </h2>
          <p className="text-takal-ink-soft mt-1">
            Customer return requests — approve to record a refund, or reject
          </p>
        </div>
        <button
          onClick={fetchReturns}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && <ErrorState message={error} />}

      <div className="bg-white rounded-lg border border-takal-line p-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-takal-ink-soft">
          <span className="font-semibold text-takal-ink">{pending}</span> awaiting review
        </span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
        >
          <option value="requested">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Reason</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Requested</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-takal-ink-soft">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-takal-ink-soft">
                    No returns to show.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-takal-line hover:bg-takal-page align-top">
                    <td className="px-6 py-4 text-sm font-mono text-takal-ink-soft">#{r.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink">{r.customer_name || "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">{money(r.total_amount ?? 0)}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft max-w-xs">
                      {r.return_reason || "—"}
                      {r.return_admin_note ? (
                        <span className="block text-xs text-takal-disabled-text mt-1">Note: {r.return_admin_note}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{r.return_requested_at ? fmtDateTime(r.return_requested_at) : "—"}</td>
                    <td className="px-6 py-4">{statusBadge(r.return_status)}</td>
                    <td className="px-6 py-4 text-sm">
                      {r.return_status === "requested" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(r)}
                            disabled={acting === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => reject(r)}
                            disabled={acting === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-takal-disabled-text text-xs">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
