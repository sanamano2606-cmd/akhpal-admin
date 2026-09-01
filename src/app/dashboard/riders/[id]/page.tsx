"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money, fmtDate } from "@/lib/format";
import { ErrorState } from "@/components/ui";

export default function RiderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const d = (await apiClient.getRiderDetail(id)) as any;
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rider");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-takal-ink-soft">Loading...</div>;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <div className="text-takal-ink-soft">Not found</div>;

  const r = data.rider || {};
  const owner = data.owner || {};
  const stats = data.stats || {};
  const orders = data.recent_orders || [];

  const Stat = ({ label, value }: any) => (
    <div className="bg-white rounded-lg border border-takal-line p-4">
      <p className="text-xs text-takal-ink-soft">{label}</p>
      <p className="text-xl font-bold text-takal-ink mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/riders")} className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
        <ChevronLeft className="w-4 h-4" /> Back to Riders
      </button>

      <div>
        <h2 className="text-2xl font-bold text-takal-ink">{r.full_name || owner.full_name || "Rider"}</h2>
        <p className="text-takal-ink-soft mt-1">{r.phone || owner.phone || "—"} {stats.is_online ? "• online" : "• offline"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Deliveries" value={stats.total_deliveries ?? 0} />
        <Stat label="Total Earnings" value={money(stats.total_earnings)} />
        <Stat label="Paid" value={money(stats.paid)} />
        <Stat label="Pending (online)" value={money(stats.pending)} />
      </div>

      <div className="bg-white rounded-lg border border-takal-line p-6">
        <h3 className="font-semibold text-takal-ink mb-3">Profile</h3>
        <dl className="text-sm space-y-2 max-w-md">
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Phone</dt><dd className="font-medium">{r.phone || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Email</dt><dd className="font-medium">{owner.email || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Vehicle</dt><dd className="font-medium">{r.vehicle_type || "—"} {r.vehicle_number ? `(${r.vehicle_number})` : ""}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Rating</dt><dd className="font-medium">{stats.rating || 0}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Approved</dt><dd className="font-medium">{r.is_approved ? "Yes" : "No"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Suspended</dt><dd className="font-medium">{r.is_suspended ? "Yes" : "No"}</dd></div>
        </dl>
      </div>

      {r.latitude && r.longitude && (
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-1">Last Known Location</h3>
          <p className="text-xs text-takal-ink-soft mb-3">Updates when the rider&apos;s app reports its position.</p>
          <iframe
            title="Rider location"
            className="w-full h-72 rounded-lg border border-takal-line"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(r.longitude) - 0.01}%2C${Number(r.latitude) - 0.01}%2C${Number(r.longitude) + 0.01}%2C${Number(r.latitude) + 0.01}&layer=mapnik&marker=${r.latitude}%2C${r.longitude}`}
          />
          <a
            href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=16/${r.latitude}/${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-takal-ink hover:underline mt-2 inline-block"
          >
            Open in full map →
          </a>
        </div>
      )}

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="px-6 py-4 border-b border-takal-line"><h3 className="font-semibold text-takal-ink">Recent Orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Fee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-6 text-center text-takal-ink-soft">No orders</td></tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-takal-line">
                    <td className="px-6 py-3 text-sm font-medium text-takal-ink">#{o.id}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{money(o.total_amount)}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{money(o.delivery_fee)}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{fmtDate(o.created_at)}</td>
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
