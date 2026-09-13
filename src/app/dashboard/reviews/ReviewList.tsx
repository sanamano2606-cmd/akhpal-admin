"use client";

/**
 * ONE LIST OF REVIEWS, USED BY FOUR TABS.
 *
 * Shops, Riders, Takal and Hidden are the same screen pointed at a different
 * part of the same row: one delivered order carries three separate opinions
 * (the shop's, the rider's, Takal's), each with its own stars and its own
 * words. Writing it four times would mean four places to fix the day the
 * Approve button changes.
 *
 * WHAT EVERY CARD MUST SHOW, and why:
 *
 *   · the WORDS. The old screen showed stars only, so "is this abusive?" could
 *     not be answered without opening the database by hand.
 *   · WHO wrote it, and about WHAT. A review with no name on it cannot be
 *     judged and cannot be followed up.
 *   · the ORDER it came from, so a complaint can be checked against what
 *     actually happened rather than taken on trust.
 */

import { useCallback, useEffect, useState } from "react";
import { Star, Check, EyeOff, Trash2, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

export type ReviewKind = "shop" | "rider" | "takal";

export function Stars({ value }: { value: number | null | undefined }) {
  const n = Math.round(Number(value) || 0);
  if (!n) return <span className="text-xs text-takal-disabled-text">no stars given</span>;
  return (
    <span className="inline-flex" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= n ? "text-amber-400 fill-amber-400" : "text-takal-disabled-text"}`}
        />
      ))}
    </span>
  );
}

/** The three words on the card, so nobody has to remember what a status means. */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    waiting: "bg-takal-yellow text-takal-ink",
    published: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    hidden: "bg-takal-disabled-bg text-takal-ink-soft",
  };
  const label: Record<string, string> = {
    waiting: "Waiting for you",
    published: "Showing in the app",
    hidden: "Hidden",
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${map[status] || map.hidden}`}>
      {label[status] || status}
    </span>
  );
}

type Props = {
  kind: ReviewKind;
  /** What this tab is looking at. "hidden" is its own tab; the rest default
   *  to the waiting queue, because that is the work. */
  status?: "waiting" | "published" | "hidden" | "all";
  title: string;
  subtitle: string;
  emptyLine: string;
};

export default function ReviewList({ kind, status = "all", title, subtitle, emptyLine }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [filter, setFilter] = useState<string>(status);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getReviews({ kind, status: filter })) as any;
      setRows(res?.reviews || []);
    } catch (err) {
      setError(readFailure(err, "the reviews"));
    } finally {
      setLoading(false);
    }
  }, [kind, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (r: any, next: "published" | "hidden" | "waiting") => {
    try {
      setBusyId(String(r.id));
      await apiClient.setReviewStatus(String(r.id), next);
      toast(
        next === "published"
          ? "Approved — it is now showing in the app"
          : next === "hidden"
          ? "Hidden — customers can no longer see it"
          : "Put back in the waiting list",
        "success",
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change this review", "error");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (r: any) => {
    try {
      setDeleting(true);
      await apiClient.deleteReview(String(r.id));
      toast("Review deleted", "success");
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete this review", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Which part of the row this tab is about.
  const starsOf = (r: any) =>
    kind === "shop" ? r.restaurant_rating : kind === "rider" ? r.rider_rating : r.takal_rating;
  const wordsOf = (r: any) =>
    kind === "shop" ? r.comment : kind === "rider" ? r.rider_comment : r.takal_comment;
  const aboutOf = (r: any) =>
    kind === "shop"
      ? r.restaurant_name || "—"
      : kind === "rider"
      ? r.rider_name || "—"
      : "Takal";

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "waiting", label: "Waiting for you" },
    { key: "published", label: "Showing in the app" },
    { key: "hidden", label: "Hidden" },
    { key: "all", label: "Everything" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">{title}</h2>
          <p className="text-takal-ink-soft mt-1">{subtitle}</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
              filter === f.key
                ? "bg-takal-yellow border-takal-yellow-dark text-takal-ink"
                : "bg-white border-takal-line text-takal-ink-soft hover:border-takal-ink-soft"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error.message} onRetry={load} denied={error.denied} />}

      <div className="space-y-3">
        {loading ? (
          <div className="text-takal-ink-soft">Loading…</div>
        ) : error ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            The reviews could not be read, so none can be listed here.
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            {emptyLine}
          </div>
        ) : (
          rows.map((r) => {
            const words = wordsOf(r);
            const busy = busyId === String(r.id);
            return (
              <div key={r.id} className="bg-white rounded-lg border border-takal-line p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-takal-ink">{r.customer_name || "Customer"}</span>
                  <span className="text-sm text-takal-ink-soft">on {aboutOf(r)}</span>
                  <Stars value={starsOf(r)} />
                  <StatusChip status={String(r.status || "published")} />
                  <span className="text-xs text-takal-disabled-text ml-auto">{fmtDate(r.created_at)}</span>
                </div>

                {words ? (
                  <p className="text-sm text-takal-ink mt-2 whitespace-pre-wrap">{words}</p>
                ) : (
                  <p className="text-sm text-takal-disabled-text mt-2 italic">
                    Stars only — nothing was written.
                  </p>
                )}

                <p className="text-xs text-takal-ink-soft mt-2">
                  Order #{String(r.order_id || "—").slice(0, 8)}
                  {kind !== "shop" && r.restaurant_name ? ` · from ${r.restaurant_name}` : ""}
                  {kind !== "rider" && r.rider_name && r.rider_name !== "—"
                    ? ` · rider ${r.rider_name}`
                    : ""}
                </p>

                <div className="flex gap-2 mt-3 flex-wrap">
                  {r.status !== "published" && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(r, "published")}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  )}
                  {r.status !== "hidden" && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(r, "hidden")}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-takal-line text-takal-ink-soft hover:border-takal-ink-soft disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <EyeOff className="w-4 h-4" /> Hide
                    </button>
                  )}
                  {r.status === "hidden" && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(r, "waiting")}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-takal-line text-takal-ink-soft hover:border-takal-ink-soft disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" /> Put back
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => setPendingDelete(r)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-red-200 text-takal-red hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        title="Delete this review for good?"
        confirmLabel="Yes, delete it"
        message={
          <>
            {pendingDelete?.customer_name || "A customer"}&rsquo;s review will be
            removed from the database completely and cannot be brought back.
            <br />
            <br />
            <b>Hide is usually the better choice.</b> Hiding takes it off the
            app straight away and still keeps the record of what was said and
            who said it.
          </>
        }
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
      />
    </div>
  );
}
