"use client";

import { useState, useEffect } from "react";
import { Download, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const summary = await apiClient.getExecutiveSummary() as any;
      const logs = await apiClient.getAuditLogs(30) as any;
      setReports([
        { name: "Executive Summary", type: "summary", data: summary },
        { name: "Revenue Report", type: "revenue", generatedAt: new Date().toLocaleDateString() },
        { name: "Audit Log Export", type: "audit", count: logs?.count || logs?.total || 0 },
      ]);
      setAuditLogs(logs?.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toCsv = (rows: any[]) => {
    if (!rows || rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  };

  const handleDownload = async (report: any) => {
    try {
      if (report.type === "audit") {
        const csv = toCsv(auditLogs);
        if (!csv) {
          alert("No audit logs to download yet.");
          return;
        }
        downloadFile("audit-logs.csv", csv, "text/csv");
      } else if (report.type === "revenue") {
        const rev = (await apiClient.getRevenueReport({ days: "30" })) as any;
        downloadFile("revenue-report.json", JSON.stringify(rev, null, 2), "application/json");
      } else {
        downloadFile("executive-summary.json", JSON.stringify(report.data || {}, null, 2), "application/json");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-600 mt-1">Generate and view business reports</p>
        </div>
        <button
          onClick={fetchReports}
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

      {loading ? (
        <div className="text-center py-12">Loading reports...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reports.map((report: any, i: number) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <FileText className="w-10 h-10 text-primary-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{report.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Generated {report.generatedAt || "today"}
                    </p>
                    {report.count && <p className="text-sm text-slate-600">{report.count} entries</p>}
                    <button
                      onClick={() => handleDownload(report)}
                      className="mt-4 flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Recent Audit Logs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.slice(0, 10).map((log: any, i: number) => (
                <div key={i} className="text-sm p-3 border border-slate-200 rounded-lg">
                  <p className="font-medium text-slate-900">{log.event_type}</p>
                  <p className="text-xs text-slate-600">{log.action}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
