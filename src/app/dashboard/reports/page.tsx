"use client";

import { useState, useEffect } from "react";
import { Download, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { fmtDate } from "@/lib/format";
import { ErrorState, Button } from "@/components/ui";

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
        { name: "Revenue Report", type: "revenue", generatedAt: fmtDate(new Date()) },
        { name: "Audit Log Export", type: "audit", count: logs?.count || logs?.total || 0 },
      ]);
      setAuditLogs(logs?.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // This page used to carry its OWN copy of the CSV writer, and the copy left
  // out the guard that stops a cell beginning with "=" running as a formula in
  // Excel. Audit-log rows are full of text people typed, so that was the single
  // worst export to have unprotected. It now uses the shared writer, like every
  // other export in the panel.

  const handleDownload = async (report: any) => {
    try {
      if (report.type === "audit") {
        if (!downloadCsv("audit-logs.csv", auditLogs)) {
          toast("No audit logs to download yet.", "error");
        }
      } else if (report.type === "revenue") {
        const rev = (await apiClient.getRevenueReport({ days: "30" })) as any;
        downloadJson("revenue-report.json", rev);
      } else {
        downloadJson("executive-summary.json", report.data || {});
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Downloads</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            Save a report to your computer.
          </p>
        </div>
        <Button onClick={fetchReports} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="text-center py-12">Loading reports...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reports.map((report: any, i: number) => (
              <div key={i} className="bg-white rounded-lg border border-takal-line p-6">
                <div className="flex items-start gap-4">
                  <FileText className="w-10 h-10 text-takal-ink" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-takal-ink">{report.name}</h3>
                    <p className="text-sm text-takal-ink-soft mt-1">
                      Generated {report.generatedAt || "today"}
                    </p>
                    {report.count && <p className="text-sm text-takal-ink-soft">{report.count} entries</p>}
                    <button
                      onClick={() => handleDownload(report)}
                      className="mt-4 flex items-center gap-2 text-takal-ink hover:text-takal-ink font-medium text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-takal-line p-6">
            <h3 className="font-semibold text-takal-ink mb-4">Recent Audit Logs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.slice(0, 10).map((log: any, i: number) => (
                <div key={i} className="text-sm p-3 border border-takal-line rounded-lg">
                  <p className="font-medium text-takal-ink">{log.event_type}</p>
                  <p className="text-xs text-takal-ink-soft">{log.action}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
