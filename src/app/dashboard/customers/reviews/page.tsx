"use client";

import { useState, useEffect } from "react";
import { Star, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

function Stars({ value }: { value: number }) {
  const n = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= n ? "text-amber-400 fill-amber-400" : "text-takal-disabled-text"}`} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getReviews()) as any;
      setReviews(res?.reviews || res?.data || []);
    } catch (err) {
      setError(readFailure(err, "the reviews"));
    } finally {
      setLoading(false);
    }
  };

  // "Remove this review?" in the browser's grey box did not say WHOSE review,
  // about WHICH shop, or that it goes for good. It does now, and the button
  // shows that it is working instead of freezing.
  const [pending, setPending] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  const doRemove = async (r: any) => {
    try {
      setRemoving(true);
      await apiClient.deleteReview(String(r.id));
      toast("Review removed", "success");
      setPending(null);
      await fetchReviews();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove review", "error");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Reviews</h2>
          <p className="text-takal-ink-soft mt-1">Recent customer reviews — remove abusive or fake ones.</p>
        </div>
        <button onClick={fetchReviews} className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition">
          Refresh
        </button>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchReviews} denied={error.denied} />
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-takal-ink-soft">Loading…</div>
        ) : error ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            The reviews could not be read, so none can be listed here.
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">No reviews yet</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-takal-line p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-takal-ink">{r.customer_name || "Customer"}</span>
                  <span className="text-sm text-takal-ink-soft">on {r.restaurant_name || "—"}</span>
                  {r.restaurant_rating != null && <Stars value={r.restaurant_rating} />}
                  <span className="text-xs text-takal-disabled-text">{fmtDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="text-sm text-takal-ink mt-2">{r.comment}</p>}
                {r.rider_rating != null && <p className="text-xs text-takal-ink-soft mt-1">Rider rating: {r.rider_rating}/5</p>}
              </div>
              <button onClick={() => setPending(r)} className="text-takal-red hover:opacity-80 shrink-0 disabled:opacity-50" title="Remove review">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={removing}
        onCancel={() => setPending(null)}
        title="Remove this review?"
        confirmLabel="Yes, remove it"
        message={
          <>
            {pending?.customer_name || "A customer"}&rsquo;s review of{" "}
            <b>{pending?.restaurant_name || "this shop"}</b> will be taken off
            the app for good, and the shop&rsquo;s star rating will be worked
            out again without it. This cannot be undone.
          </>
        }
        onConfirm={() => pending && doRemove(pending)}
      />
    </div>
  );
}
