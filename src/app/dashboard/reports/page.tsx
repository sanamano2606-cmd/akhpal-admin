"use client";

import { useState, useEffect } from "react";
import { Download, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { fmtDate } from "@/lib/format";
import { ErrorState, Button } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      // THE RED BANNER USED TO STAY FOR THE REST OF THE SESSION.
      // Nothing ever cleared it, so one failed read left the page shouting
      // even after Refresh had worked.
      setError(null);
      const summary = await apiClient.getExecutiveSummary() as any;
      const logs = await apiClient.getAuditLogs(30) as any;
      setReports([
        { name: "Executive Summary", type: "summary", data: summary },
        { name: "Revenue Report", type: "revenue", generatedAt: fmtDate(new Date()) },
        { name: "Audit Log Export", type: "audit", count: logs?.count || logs?.total || 0 },
      ]);
      setAuditLogs(logs?.logs || []);
    } catch (err) {
      setError(readFailure(err, "the reports"));
      setReports([]);
      setAuditLogs([]);
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

      {error && (
        <ErrorState message={error.message} onRetry={fetchReports} denied={error.denied} />
      )}

      {loading ? (
        <div className="text-center py-12">Loading reports…</div>
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
                    {/* A BARE "0" USED TO APPEAR ON THE PAGE.
                        `{count && <p>…</p>}` renders the number itself when it
                        is 0, because 0 is not `false` to React - it is a
                        thing to draw. */}
                    {report.type === "audit" && (
                      <p className="text-sm text-takal-ink-soft">
                        {report.count > 0
                          ? `${report.count} entries in the last 30 days`
                          : "Nothing recorded in the last 30 days"}
                      </p>
                    )}
                    {report.type === "audit" && report.count > auditLogs.length && (
                      // THE CARD ADVERTISED N AND THE BUTTON WROTE 30.
                      <p className="mt-1 text-xs text-[#C8410F]">
                        The download holds the most recent {auditLogs.length},
                        not all {report.count}.
                      </p>
                    )}
                    <button
                      onClick={() => handleDownload(report)}
                      className="mt-4 flex items-center gap-2 text-takal-ink hover:text-takal-ink font-medium text-sm"
                    >
                      <Download className="w-4 h-4" />
                      {report.type === "audit"
                        ? "Download (.csv, opens in Excel)"
                        : "Download (.json, for a developer)"}
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
