"use client";

/**
 * RIDERS — two things on one page, because they answer two different
 * questions.
 *
 *   · THE SCORE LIST. Most rider feedback is stars with nothing written, so
 *     the useful question is "which rider is going bad", and that is a count.
 *     It is at the top because it is the one you will look at every week.
 *
 *   · THE REVIEWS. From 13 September 2026 the customer app asks about the
 *     rider in its own box, so there are finally words to read here. Anything
 *     written BEFORE that date has stars only - the old app had one comment
 *     box and it belonged to the shop.
 */

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";
import ReviewList, { Stars } from "../ReviewList";

function RiderScores() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = (await apiClient.getRiderReviewScores()) as any;
        setRiders(res?.riders || []);
      } catch (err) {
        setError(readFailure(err, "the rider scores"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) return <ErrorState message={error.message} denied={error.denied} />;

  const worrying = riders.filter((r) => Number(r.reviews_low || 0) > 0);

  return (
    <div data-rider-scores className="bg-white rounded-lg border border-takal-line px-4 py-3">
      {/* Title and sentence on one line (Mock 195). */}
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-bold text-takal-ink">Rider scores</h3>
        <p className="text-xs text-takal-ink-soft">
          Every rider&rsquo;s star average, and how many times a customer gave
          them 1 or 2 stars. A rider going bad shows up here before anybody
          complains.
        </p>
      </div>

      {loading ? (
        <div className="text-takal-ink-soft mt-2">Loading…</div>
      ) : riders.length === 0 ? (
        <div className="text-takal-ink-soft mt-2">No riders yet.</div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-takal-ink-soft border-b border-takal-line">
                <th className="py-1.5 pr-4">Rider</th>
                <th className="py-1.5 pr-4">Average</th>
                <th className="py-1.5 pr-4">Ratings</th>
                <th className="py-1.5">1–2 star</th>
              </tr>
            </thead>
            <tbody>
              {riders.slice(0, 25).map((r) => (
                <tr key={r.id} className="border-b border-takal-line last:border-0">
                  <td className="py-1.5 pr-4 font-semibold text-takal-ink">{r.full_name || "—"}</td>
                  <td className="py-1.5 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-takal-ink-soft">{Number(r.rating || 0).toFixed(1)}</span>
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 text-takal-ink-soft">{r.reviews_total ?? 0}</td>
                  <td className="py-1.5">
                    {Number(r.reviews_low || 0) > 0 ? (
                      <span className="font-bold text-takal-red">{r.reviews_low}</span>
                    ) : (
                      <span className="text-takal-ink-soft">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {worrying.length === 0 && (
            <p className="text-xs text-takal-ink-soft mt-2">
              Nobody has a 1 or 2 star rating yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RiderReviewsPage() {
  return (
    <div className="space-y-3">
      <RiderScores />
      <ReviewList
        kind="rider"
        title="Reviews of riders"
        subtitle="What customers wrote about the rider who brought the order."
        emptyLine="No rider reviews yet. Reviews written before 13 September 2026 have stars only — the old app had one comment box and it belonged to the shop."
      />
    </div>
  );
}
