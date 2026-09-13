"use client";

/**
 * PRODUCTS — the tab that matters most, and the one that did not exist.
 *
 * A customer can review a single product AND ATTACH PHOTOGRAPHS. Until
 * 13 September 2026 those went straight onto the public product page and no
 * screen in this panel could see one - not the picture, not the words, not who
 * sent it. That is the single biggest thing found while filling in the Google
 * and Apple privacy forms.
 *
 * The photos are shown BIG here on purpose. A thumbnail you have to squint at
 * is a check nobody really does.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, EyeOff, Trash2, RotateCcw, Image as ImageIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { Stars } from "../ReviewList";

export default function ProductReviewsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [filter, setFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getProductReviews({ status: filter })) as any;
      setRows(res?.reviews || []);
    } catch (err) {
      setError(readFailure(err, "the product reviews"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (r: any, next: "published" | "hidden" | "waiting") => {
    try {
      setBusyId(String(r.id));
      await apiClient.setProductReviewStatus(String(r.id), next);
      toast(
        next === "published"
          ? "Approved — it is now showing on the product"
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
      await apiClient.deleteProductReview(String(r.id));
      toast("Review deleted", "success");
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete this review", "error");
    } finally {
      setDeleting(false);
    }
  };

  const FILTERS = [
    { key: "waiting", label: "Waiting for you" },
    { key: "published", label: "Showing in the app" },
    { key: "hidden", label: "Hidden" },
    { key: "all", label: "Everything" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Reviews of products</h2>
          <p className="text-takal-ink-soft mt-1">
            These are the only reviews that can carry <b>photographs</b>. Look at
            the picture before you approve it.
          </p>
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
            The product reviews could not be read, so none can be listed here.
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            No product reviews here.
          </div>
        ) : (
          rows.map((r) => {
            const busy = busyId === String(r.id);
            const photos: string[] = Array.isArray(r.photos) ? r.photos : [];
            return (
              <div key={r.id} className="bg-white rounded-lg border border-takal-line p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-takal-ink">{r.customer_name || "Customer"}</span>
                  <span className="text-sm text-takal-ink-soft">on {r.product_name || "—"}</span>
                  <Stars value={r.rating} />
                  {photos.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-takal-yellow text-takal-ink inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {photos.length} photo{photos.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-xs text-takal-disabled-text ml-auto">{fmtDate(r.created_at)}</span>
                </div>

                {r.comment ? (
                  <p className="text-sm text-takal-ink mt-2 whitespace-pre-wrap">{r.comment}</p>
                ) : (
                  <p className="text-sm text-takal-disabled-text mt-2 italic">
                    Stars only — nothing was written.
                  </p>
                )}

                {photos.length > 0 && (
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {photos.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`Picture ${i + 1} sent with this review`}
                        className="w-40 h-40 object-cover rounded-lg border border-takal-line bg-takal-disabled-bg"
                      />
                    ))}
                  </div>
                )}

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
        title="Delete this product review for good?"
        confirmLabel="Yes, delete it"
        message={
          <>
            The words <b>and the pictures</b> will be removed from the database
            completely and cannot be brought back.
            <br />
            <br />
            <b>Hide is usually the better choice.</b> It takes the review off the
            product page straight away and keeps the record of what was sent.
          </>
        }
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
      />
    </div>
  );
}
