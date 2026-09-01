"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/format";
import { ErrorState } from "@/components/ui";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getAuditLogs(30)) as any;
      setLogs(res?.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const when = (log: any) => {
    const t = log.created_at || log.timestamp || log.time;
    return fmtDateTime(t);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* The "Back to Settings" link is gone: the audit log is not a
              setting and no longer lives under Settings. The Reports tabs
              above are the way back. */}
          <h2 className="text-xl font-bold text-takal-ink">Audit Log</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">Who did what, and when. Last 30 days.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <ErrorState message={error} onRetry={fetchLogs} />
      )}

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">When</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Event</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Action</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-takal-ink-soft">Loading...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-takal-ink-soft">No audit logs found</td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-6 py-4 text-sm text-takal-ink-soft whitespace-nowrap">{when(log)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-takal-ink">{log.event_type || log.event || "—"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{log.action || log.detail || log.description || "—"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{log.admin_id || log.user_id || log.actor || "—"}</td>
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
