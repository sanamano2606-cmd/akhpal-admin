"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";

export default function RestaurantDetailPage() {
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
      const d = (await apiClient.getRestaurantDetail(id)) as any;
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-600">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>;
  if (!data) return <div className="text-slate-600">Not found</div>;

  const r = data.restaurant || {};
  const owner = data.owner || {};
  const stats = data.stats || {};
  const orders = data.recent_orders || [];
  const menu = data.menu || [];

  const Stat = ({ label, value }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/restaurants")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Back to Restaurants
      </button>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{r.name || "Restaurant"}</h1>
        <p className="text-slate-600 mt-1">{r.address || "—"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Delivered Orders" value={stats.total_delivered ?? 0} />
        <Stat label="Earned" value={money(stats.earned)} />
        <Stat label="Paid" value={money(stats.paid)} />
        <Stat label="Outstanding" value={money(stats.outstanding)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Profile</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Owner</dt><dd className="font-medium">{owner.full_name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Owner phone</dt><dd className="font-medium">{owner.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Owner email</dt><dd className="font-medium">{owner.email || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Commission</dt><dd className="font-medium">{r.commission_percent ?? 0}%</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium">{r.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Approved</dt><dd className="font-medium">{r.is_approved ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Open now</dt><dd className="font-medium">{r.is_open ? "Yes" : "No"}</dd></div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Menu ({menu.length})</h3>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {menu.length === 0 ? (
              <p className="text-sm text-slate-500">No menu items</p>
            ) : (
              menu.map((m: any) => (
                <div key={m.id} className="flex justify-between text-sm border-b border-slate-100 py-1.5">
                  <span className={m.is_available === false ? "text-slate-400 line-through" : ""}>{m.name}</span>
                  <span>{money(m.price)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200"><h3 className="font-semibold text-slate-900">Recent Orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-600">No orders</td></tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-200">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">#{o.id}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{money(o.total_amount)}</td>
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
