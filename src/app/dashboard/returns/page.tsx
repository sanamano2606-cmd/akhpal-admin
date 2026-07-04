"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money, fmtDateTime } from "@/lib/format";

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
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[s] || "bg-slate-100 text-slate-700"}`}>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  const pending = rows.filter((r) => r.return_status === "requested").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary-600" /> Returns
          </h1>
          <p className="text-slate-600 mt-1">
            Customer return requests — approve to record a refund, or reject
          </p>
        </div>
        <button
          onClick={fetchReturns}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{pending}</span> awaiting review
        </span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
        >
          <option value="requested">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Reason</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Requested</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-600">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-600">
                    No returns to show.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50 align-top">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">#{r.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{r.customer_name || "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{money(r.total_amount ?? 0)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">
                      {r.return_reason || "—"}
                      {r.return_admin_note ? (
                        <span className="block text-xs text-slate-400 mt-1">Note: {r.return_admin_note}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.return_requested_at ? fmtDateTime(r.return_requested_at) : "—"}</td>
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
                        <span className="text-slate-400 text-xs">Resolved</span>
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
