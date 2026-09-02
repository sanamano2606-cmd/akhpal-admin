"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { money, fmtDateTime } from "@/lib/format";
import { ErrorState, Button, StatusBadge } from "@/components/ui";
import { ReturnDialog } from "./parts-return-dialog";

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

  const [deciding, setDeciding] = useState<ReturnRow | null>(null);

  // WHY THESE NO LONGER ASK window.prompt().
  //
  // The browser's grey box cannot show the order - no items, no amount, not
  // even the full reason the customer gave - so the person deciding could not
  // see what they were deciding. It cannot be styled, and some browsers switch
  // it off entirely, in which case the button silently did nothing at all.
  //
  // And approving ALWAYS refunded the whole order. On a return where only the
  // goods go back, that gave away a delivery fee that was genuinely earned -
  // the rider rode, the parcel arrived - by default, with no choice offered.
  const approve = async (amount: number, note: string) => {
    if (!deciding) return;
    try {
      setActing(deciding.id);
      await apiClient.approveReturn(deciding.id, note || undefined, amount);
      toast(`Return approved — ${money(amount)} recorded as owed`, "success");
      setDeciding(null);
      await fetchReturns();
    } catch (err) {
      toast(errorMessage(err, "the return"), "error");
    } finally {
      setActing(null);
    }
  };

  const reject = async (note: string) => {
    if (!deciding) return;
    try {
      setActing(deciding.id);
      await apiClient.rejectReturn(deciding.id, note || undefined);
      toast("Return rejected", "success");
      setDeciding(null);
      await fetchReturns();
    } catch (err) {
      toast(errorMessage(err, "the return"), "error");
    } finally {
      setActing(null);
    }
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
        <Button onClick={fetchReturns}>Refresh</Button>
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
                    <td className="px-6 py-4 text-sm text-takal-ink-soft max-w-md whitespace-normal break-words">
                      {/* NOT truncated. The reason is the one thing needed to
                          judge a return, and it was the one thing the column
                          would not show. */}
                      {r.return_reason || "—"}
                      {r.return_admin_note ? (
                        <span className="block text-xs text-takal-disabled-text mt-1">Note: {r.return_admin_note}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{r.return_requested_at ? fmtDateTime(r.return_requested_at) : "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.return_status} /></td>
                    <td className="px-6 py-4 text-sm">
                      {r.return_status === "requested" ? (
                        <Button size="sm" onClick={() => setDeciding(r)} disabled={acting === r.id}>
                          Decide
                        </Button>
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
      <ReturnDialog
        row={deciding}
        onClose={() => setDeciding(null)}
        onApprove={approve}
        onReject={reject}
      />
    </div>
  );
}
