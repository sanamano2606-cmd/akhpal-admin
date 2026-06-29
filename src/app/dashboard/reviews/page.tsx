"use client";

import { useState, useEffect } from "react";
import { Star, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";

function Stars({ value }: { value: number }) {
  const n = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= n ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getReviews()) as any;
      setReviews(res?.reviews || res?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (r: any) => {
    if (!window.confirm("Remove this review?")) return;
    try {
      await apiClient.deleteReview(String(r.id));
      toast("Review removed", "success");
      await fetchReviews();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove review", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reviews</h1>
          <p className="text-slate-600 mt-1">Recent customer reviews — remove abusive or fake ones.</p>
        </div>
        <button onClick={fetchReviews} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>}

      <div className="space-y-3">
        {loading ? (
          <div className="text-slate-600">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-600">No reviews yet</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-slate-900">{r.customer_name || "Customer"}</span>
                  <span className="text-sm text-slate-500">on {r.restaurant_name || "—"}</span>
                  {r.restaurant_rating != null && <Stars value={r.restaurant_rating} />}
                  <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="text-sm text-slate-700 mt-2">{r.comment}</p>}
                {r.rider_rating != null && <p className="text-xs text-slate-500 mt-1">Rider rating: {r.rider_rating}/5</p>}
              </div>
              <button onClick={() => remove(r)} className="text-red-600 hover:text-red-700 shrink-0" title="Remove review">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
