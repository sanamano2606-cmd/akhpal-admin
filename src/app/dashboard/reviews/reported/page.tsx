"use client";

/**
 * REPORTED REVIEWS  (Mock 208-2, approved by Sana 26 October 2026)
 *
 * Apple guideline 1.2: an app where customers write things other customers
 * read must let anybody REPORT a review, and the office must act on a report
 * within 24 hours. A customer taps "Report" in the app; the report lands here,
 * oldest first, with a clock that turns red after 20 hours.
 *
 * Three answers, and the server does each one (routers/review_reports.py):
 *   Hide review    - gone for everybody, the stars are counted again
 *   Keep it        - stays up for everybody else (the person who reported it
 *                    still does not see it)
 *   Suspend writer - the normal account suspension, and every review that
 *                    person wrote comes down. Needs the Customers permission
 *                    too - the server says so in words if it is missing.
 * Every open report on the same review closes with the same answer.
 */

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { REPORTS_CHANGED, waitingWords, isLate } from "@/lib/review-reports";

type Report = {
  id: string; kind: "shop" | "product"; review_id: string; review_gone: boolean;
  review_status?: string | null; comment: string; photos: string[]; stars?: number | null;
  where: string; writer_id?: string | null; writer_name: string; reporter_name: string;
  reason: string; reason_words: string; note: string; state: string;
  created_at: string; hours_waiting: number | null;
};

const FILTERS = [
  { key: "open", label: "Waiting for you" },
  { key: "hidden", label: "Hidden" },
  { key: "kept", label: "Kept" },
  { key: "suspended", label: "Writer suspended" },
  { key: "all", label: "Everything" },
] as const;

const STATE_WORDS: Record<string, { label: string; tone: string }> = {
  hidden: { label: "Hidden", tone: "bg-takal-red-soft text-takal-red" },
  kept: { label: "Kept", tone: "bg-takal-green-soft text-takal-green" },
  suspended: { label: "Writer suspended", tone: "bg-black text-takal-yellow" },
};

export default function ReportedReviewsPage() {
  const [rows, setRows] = useState<Report[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [switchedOn, setSwitchedOn] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [askSuspend, setAskSuspend] = useState<Report | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getReviewReports({ state: filter })) as any;
      setRows(res?.reports || []);
      setSwitchedOn(res?.switched_on !== false);
    } catch (err) {
      setError(readFailure(err, "the reported reviews"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const decide = async (r: Report, action: "hide" | "keep" | "suspend") => {
    try {
      setBusyId(r.id);
      const res = (await apiClient.decideReviewReport(r.id, action)) as any;
      toast(
        action === "hide" ? "Hidden - nobody sees this review now"
          : action === "keep" ? "Kept - the review stays up"
          : `${r.writer_name} is suspended${res?.reviews_hidden ? ` and ${res.reviews_hidden} review${res.reviews_hidden === 1 ? "" : "s"} hidden` : ""}`,
        "success",
      );
      setAskSuspend(null);
      try { window.dispatchEvent(new Event(REPORTS_CHANGED)); } catch { /* the number refreshes on the next visit */ }
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not do that just now", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="shrink-0 text-lg font-bold text-takal-ink">Reported reviews</h2>
        <p className="min-w-0 flex-1 text-sm text-takal-ink-soft">
          Apple needs every report handled within <b className="text-takal-ink">24 hours</b>. Oldest first. The clock turns red after 20 hours.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition ${
                filter === f.key ? "border-takal-yellow-dark bg-takal-yellow text-takal-ink"
                  : "border-takal-line bg-white text-takal-ink-soft hover:border-takal-ink-soft"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={load}
          className="rounded-lg bg-takal-yellow px-3 py-1.5 text-sm font-semibold text-takal-ink transition hover:bg-takal-yellow-dark">
          Refresh
        </button>
      </div>

      {!switchedOn && (
        <div className="rounded-xl border-l-4 border-takal-orange bg-takal-orange-soft px-4 py-3 text-[13px] text-takal-ink">
          Reporting is not switched on yet - database update 148 has not been run. Customers cannot report a review until it is.
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={load} denied={error.denied} />}

      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : error ? null : rows.length === 0 ? (
        <div className="rounded-lg border border-takal-line bg-white p-8 text-center text-takal-ink-soft">
          {filter === "open" ? "Nothing reported. When a customer reports a review, it comes here and the office is told." : "Nothing here."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-takal-line bg-white">
          {/* the header line - laptop only; on a phone every report is a card */}
          <div className="hidden grid-cols-[1.2fr_1.6fr_1fr_0.7fr_auto] gap-3 border-b border-takal-line bg-takal-page px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-takal-ink-soft lg:grid">
            <span>Writer · where</span><span>Review</span><span>Reason</span><span>Waiting</span><span className="w-[300px]">Decide</span>
          </div>
          {rows.map((r) => {
            const late = r.state === "open" && isLate(r.hours_waiting);
            const done = STATE_WORDS[r.state];
            return (
              <div key={r.id} data-report={r.id}
                className="grid gap-2 border-b border-[#EFEFEF] px-4 py-3 last:border-b-0 lg:grid-cols-[1.2fr_1.6fr_1fr_0.7fr_auto] lg:items-start lg:gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-takal-ink">{r.writer_name}</div>
                  <div className="truncate text-[12px] text-takal-ink-soft" title={r.where}>{r.where}</div>
                </div>
                <div className="min-w-0 text-[13px] text-takal-ink">
                  {r.stars != null && (
                    <span className="mb-0.5 flex items-center gap-0.5 text-takal-orange">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={12} className={i < Number(r.stars) ? "fill-current" : "opacity-30"} />
                      ))}
                    </span>
                  )}
                  {r.review_gone ? <i className="text-takal-ink-soft">This review was deleted.</i>
                    : r.comment ? <span className="break-words">{r.comment}</span>
                    : <i className="text-takal-ink-soft">Stars only - no words.</i>}
                  {r.photos?.length > 0 && (
                    <span className="mt-1 flex gap-1">
                      {r.photos.slice(0, 4).map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={p} href={p} target="_blank" rel="noopener noreferrer"><img src={p} alt="" className="h-10 w-10 rounded-md object-cover" /></a>
                      ))}
                    </span>
                  )}
                </div>
                <div className="text-[13px]">
                  <b className="text-takal-red">{r.reason_words}</b>
                  <div className="text-[12px] text-takal-ink-soft">by {r.reporter_name}</div>
                  {r.note && <div className="mt-0.5 text-[12px] italic text-takal-ink">&ldquo;{r.note}&rdquo;</div>}
                </div>
                <div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-bold ${late ? "bg-takal-red text-white" : "bg-[#EFEFEF] text-takal-ink"}`}>
                    ⏱ {waitingWords(r.hours_waiting)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 lg:w-[300px] lg:justify-end">
                  {r.state === "open" ? (
                    <>
                      <button type="button" disabled={busyId === r.id || r.review_gone} onClick={() => decide(r, "hide")}
                        className="rounded-lg border-[1.5px] border-black bg-takal-yellow px-3 py-1 text-[12.5px] font-bold text-black hover:bg-takal-yellow-dark disabled:opacity-50">
                        Hide review
                      </button>
                      <button type="button" disabled={busyId === r.id} onClick={() => decide(r, "keep")}
                        className="rounded-lg border-[1.5px] border-black bg-white px-3 py-1 text-[12.5px] font-bold text-black hover:bg-takal-page disabled:opacity-50">
                        Keep it
                      </button>
                      <button type="button" disabled={busyId === r.id || !r.writer_id} onClick={() => setAskSuspend(r)}
                        className="rounded-lg border-[1.5px] border-takal-red bg-white px-3 py-1 text-[12.5px] font-bold text-takal-red hover:bg-takal-red-soft disabled:opacity-50">
                        Suspend writer
                      </button>
                    </>
                  ) : done ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${done.tone}`}>{done.label}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-takal-ink-soft">
        <b>Hide review</b> = gone for everybody, stars counted again. <b>Keep it</b> = the review stays up for everybody else
        (it stays hidden only for the customer who reported it). <b>Suspend writer</b> = the normal account suspension, and all their reviews are hidden.
      </p>

      <ConfirmDialog open={!!askSuspend} busy={busyId === askSuspend?.id} danger
        onCancel={() => setAskSuspend(null)}
        onConfirm={() => askSuspend && decide(askSuspend, "suspend")}
        title={`Suspend ${askSuspend?.writer_name || "this customer"}?`}
        confirmLabel="Suspend writer"
        message={<>
          Their account is switched off - the same suspension as on the Customers page - and
          <b> every review they wrote is hidden</b>. You can switch the account back on from Customers.
        </>}
      />
    </div>
  );
}
