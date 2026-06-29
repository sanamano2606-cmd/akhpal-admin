"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";

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

  if (loading) return <div className="text-slate-600">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>;
  if (!data) return <div className="text-slate-600">Not found</div>;

  const r = data.rider || {};
  const owner = data.owner || {};
  const stats = data.stats || {};
  const orders = data.recent_orders || [];

  const Stat = ({ label, value }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/riders")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Back to Riders
      </button>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{r.full_name || owner.full_name || "Rider"}</h1>
        <p className="text-slate-600 mt-1">{r.phone || owner.phone || "—"} {stats.is_online ? "• online" : "• offline"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Deliveries" value={stats.total_deliveries ?? 0} />
        <Stat label="Total Earnings" value={money(stats.total_earnings)} />
        <Stat label="Paid" value={money(stats.paid)} />
        <Stat label="Pending (online)" value={money(stats.pending)} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-3">Profile</h3>
        <dl className="text-sm space-y-2 max-w-md">
          <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium">{r.phone || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{owner.email || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Vehicle</dt><dd className="font-medium">{r.vehicle_type || "—"} {r.vehicle_number ? `(${r.vehicle_number})` : ""}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Rating</dt><dd className="font-medium">{stats.rating || 0}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Approved</dt><dd className="font-medium">{r.is_approved ? "Yes" : "No"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Suspended</dt><dd className="font-medium">{r.is_suspended ? "Yes" : "No"}</dd></div>
        </dl>
      </div>

      {r.latitude && r.longitude && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Last Known Location</h3>
          <p className="text-xs text-slate-500 mb-3">Updates when the rider's app reports its position.</p>
          <iframe
            title="Rider location"
            className="w-full h-72 rounded-lg border border-slate-200"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(r.longitude) - 0.01}%2C${Number(r.latitude) - 0.01}%2C${Number(r.longitude) + 0.01}%2C${Number(r.latitude) + 0.01}&layer=mapnik&marker=${r.latitude}%2C${r.longitude}`}
          />
          <a
            href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=16/${r.latitude}/${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:underline mt-2 inline-block"
          >
            Open in full map →
          </a>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200"><h3 className="font-semibold text-slate-900">Recent Orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Fee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-6 text-center text-slate-600">No orders</td></tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-200">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">#{o.id}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{money(o.total_amount)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{money(o.delivery_fee)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
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
