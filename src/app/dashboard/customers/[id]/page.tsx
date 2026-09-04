"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money, fmtDate } from "@/lib/format";
import { ErrorState } from "@/components/ui";

export default function CustomerDetailPage() {
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
      const d = (await apiClient.getCustomerDetail(id)) as any;
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-takal-ink-soft">Loading…</div>;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <div className="text-takal-ink-soft">Not found</div>;

  const c = data.customer || {};
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
      <button onClick={() => router.push("/dashboard/customers")} className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
        <ChevronLeft className="w-4 h-4" /> Back to Customers
      </button>

      <div>
        <h2 className="text-2xl font-bold text-takal-ink">{c.full_name || "Customer"}</h2>
        <p className="text-takal-ink-soft mt-1">{c.phone || "—"} {c.email ? `• ${c.email}` : ""}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Total Orders" value={stats.total_orders ?? 0} />
        <Stat label="Delivered" value={stats.delivered ?? 0} />
        <Stat label="Lifetime Spend" value={money(stats.total_spent)} />
      </div>

      <div className="bg-white rounded-lg border border-takal-line p-6 max-w-md">
        <h3 className="font-semibold text-takal-ink mb-3">Profile</h3>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Phone</dt><dd className="font-medium">{c.phone || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Email</dt><dd className="font-medium">{c.email || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Status</dt><dd className="font-medium">{c.is_active === false ? "Blocked" : "Active"}</dd></div>
          <div className="flex justify-between"><dt className="text-takal-ink-soft">Joined</dt><dd className="font-medium">{fmtDate(c.created_at)}</dd></div>
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="px-6 py-4 border-b border-takal-line"><h3 className="font-semibold text-takal-ink">Order History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Restaurant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Amount</th>
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
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{o.restaurant_name || "—"}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{money(o.total_amount)}</td>
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
