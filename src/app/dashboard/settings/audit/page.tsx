"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";

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
    return t ? new Date(t).toLocaleString() : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-600 mt-1">Admin actions and system events (last 30 days)</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">When</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Event</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Action</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-600">Loading...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-600">No audit logs found</td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{when(log)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{log.event_type || log.event || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{log.action || log.detail || log.description || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{log.admin_id || log.user_id || log.actor || "—"}</td>
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
