"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, TrendingUp, Building2, Bike, RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { SkeletonStatCards, SkeletonChart, Shimmer } from "@/components/Skeletons";
import { canAccess } from "@/lib/perms";

const STATUS_COLORS: Record<string, string> = {
  delivered: "#10b981",
  cooking: "#f59e0b",
  pending: "#3b82f6",
  confirmed: "#6366f1",
  ready: "#8b5cf6",
  delivering: "#06b6d4",
  cancelled: "#ef4444",
};

const money = (n: number) => "Rs " + (Number(n) || 0).toLocaleString();

// The Dashboard tiles, and the permission each one belongs to. Somebody who
// holds none of these has no Dashboard to look at.
const DASHBOARD_SECTIONS = ["orders", "analytics", "restaurants", "riders", "customers"];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [revenueSeries, setRevenueSeries] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);

  // A delivery man's home is his delivery list, not an empty Dashboard.
  //
  // He holds only "delivery", so every tile here belongs to a permission he
  // does not have — landing him on a blank page and asking him to find the
  // right link. The panel is the same for him whether he taps the logo, presses
  // Back, or opens an old bookmark, so the redirect lives here rather than only
  // on the login path.
  //
  // Guarded by "has delivery AND nothing else": an office admin who also has
  // delivery still gets the real Dashboard.
  useEffect(() => {
    if (canAccess("delivery") && !DASHBOARD_SECTIONS.some((s) => canAccess(s))) {
      router.replace("/dashboard/deliveries");
    }
  }, [router]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      // Build-time constant — never read the API origin from browser storage,
      // because this request carries the admin's bearer token.
      const base = process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";

      // Fire all three independent requests at once instead of waiting for each
      // in turn — cuts this page's load time to roughly a single request.
      // Don't even ASK for what this account may not have. The server would
      // refuse anyway, but an avoidable 403 on every dashboard load fills the
      // log with noise that looks like an attack when it is just a store clerk
      // opening the panel.
      const [dash, rev, h] = await Promise.all([
        apiClient.getDashboard().catch(() => null),
        canAccess("analytics")
          ? apiClient.getRevenueAnalytics(days, "day").catch(() => null)
          : Promise.resolve(null),
        canAccess("settings")
          ? fetch(`${base}/health`).then((r) => r.json()).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (dash) setData(dash as any);
      else setError("Error loading dashboard");

      const breakdown = (rev as any)?.data?.daily_breakdown || {};
      setRevenueSeries(
        Object.keys(breakdown)
          .sort()
          .map((d) => ({ date: d.slice(5), revenue: Math.round(breakdown[d]) }))
      );

      setHealth(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Shimmer className="h-7 w-56" />
        <SkeletonStatCards count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart className="lg:col-span-2" />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        <p className="font-semibold">Error</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchAll}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12">No data available</div>;

  // WHAT THIS ADMIN MAY SEE.
  //
  // Read from the REPLY, not from the browser. The server only puts a figure
  // in the response if the caller's permissions allow it (see admin_dashboard
  // in backend/routers/admin.py), so "did the key arrive?" is the same answer
  // the server already made. Checking localStorage here instead would be a
  // second copy of the rule, free to drift out of step with the first - and a
  // copy that anybody can edit in their own browser.
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
  const showOrders = has("total_orders");
  const showMoney = has("gmv");
  const showShops = has("approved_restaurants");
  const showRiders = has("online_riders");
  // System Health is the only exception: it comes from the public /health
  // endpoint, which carries no business data (it reports whether the API is up
  // and whether a key is configured - nothing about orders, money or people).
  // There is nothing to leak, so hiding it is a tidiness choice and it is fine
  // for that choice to live in the browser.
  const showHealth = canAccess("settings");
  const showNothing = !showOrders && !showMoney && !showShops && !showRiders;

  const KPICard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-600 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className={`w-6 h-6 ${String(color).includes("primary") ? "text-slate-900" : "text-white"}`} />
        </div>
      </div>
    </div>
  );

  // Real order-status distribution from the backend
  const statusData = Object.entries(data.orders_by_status || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Number(value),
    color: STATUS_COLORS[name] || "#94a3b8",
  }));

  const pendingRestaurants = (data.total_restaurants || 0) - (data.approved_restaurants || 0);
  const pendingRiders = (data.total_riders || 0) - (data.approved_riders || 0);
  const pendingOrders = Number(data.orders_by_status?.pending || 0);
  // Each row of "Needs your attention" belongs to the section that owns it, so
  // a store clerk is not told how many riders are waiting. The box itself only
  // appears if at least one row survived - never as an empty amber panel.
  const attnShops = showShops && pendingRestaurants > 0;
  const attnRiders = showRiders && pendingRiders > 0;
  const attnOrders = showOrders && pendingOrders > 0;
  const needsAttention = attnShops || attnRiders || attnOrders;

  const HealthRow = ({ label, ok, okText, badText }: any) => (
    <div className="flex items-center justify-between">
      <span className="text-slate-600 text-sm">{label}</span>
      <span className="inline-flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${ok ? "bg-green-600" : "bg-red-500"}`}></div>
        <span className={`text-sm font-medium ${ok ? "text-green-600" : "text-red-500"}`}>
          {ok ? okText : badText}
        </span>
      </span>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here&apos;s your live overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards (real values, no fake growth %) */}
      {showNothing ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Nothing to show here yet</h2>
          <p className="text-sm text-slate-600">
            Your account has no sections switched on. Ask the Main Admin to give
            you the ones you need for your job.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {showOrders && (
          <KPICard title="Total Orders" value={data.total_orders || 0} icon={ShoppingCart} color="bg-primary-600" />
        )}
        {showMoney && (
          <KPICard title="Revenue (GMV)" value={money(data.gmv || 0)} icon={TrendingUp} color="bg-green-600" />
        )}
        {showShops && (
          <KPICard title="Approved Stores" value={data.approved_restaurants || 0} icon={Building2} color="bg-primary-600" />
        )}
        {showRiders && (
          <KPICard title="Online Riders" value={data.online_riders || 0} icon={Bike} color="bg-orange-600" />
        )}
      </div>
      )}

      {/* Needs attention */}
      {needsAttention && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-3">⚡ Needs your attention</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {attnShops && (
              <Link href="/dashboard/restaurants" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingRestaurants}</p>
                <p className="text-sm text-slate-600">Stores awaiting approval</p>
              </Link>
            )}
            {attnRiders && (
              <Link href="/dashboard/riders" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingRiders}</p>
                <p className="text-sm text-slate-600">Riders awaiting approval</p>
              </Link>
            )}
            {attnOrders && (
              <Link href="/dashboard/orders" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingOrders}</p>
                <p className="text-sm text-slate-600">Pending orders</p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Charts (real data). Each chart belongs to a permission: the revenue
          line is money (analytics), the status ring is order data (orders).
          The grid widens to one column when only one of them survives, so a
          lone chart is not left stranded in half the page. */}
      {(showMoney || showOrders) && (
      <div className={`grid grid-cols-1 gap-6 ${showMoney && showOrders ? "lg:grid-cols-2" : ""}`}>
        {showMoney && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend (Last {days} Days)</h3>
          {revenueSeries.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(v: any) => money(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} dot={{ fill: "#7c3aed", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        )}

        {showOrders && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Order Status Distribution</h3>
          {statusData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
              No orders yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        )}
      </div>
      )}

      {/* Quick Stats + System Health (real) */}
      {(showOrders || showMoney || showShops || showRiders || showHealth) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(showOrders || showMoney || showShops || showRiders) && (
        <div className={`${showHealth ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-lg border border-slate-200 p-6`}>
          <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showOrders && (
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Today&apos;s Orders</span>
              <span className="text-2xl font-bold text-slate-900">{data.today_orders || 0}</span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Commission Earned</span>
              <span className="text-2xl font-bold text-green-600">{money(data.commission_earnings || 0)}</span>
            </div>
            )}
            {showShops && (
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Pending Stores</span>
              <span className="text-2xl font-bold text-slate-900">{pendingRestaurants}</span>
            </div>
            )}
            {showRiders && (
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Pending Riders</span>
              <span className="text-2xl font-bold text-slate-900">{pendingRiders}</span>
            </div>
            )}
          </div>
        </div>
        )}

        {showHealth && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">System Health</h3>
          <div className="space-y-3">
            <HealthRow label="API" ok={!!health} okText="Operational" badText="Unreachable" />
            <HealthRow label="Database" ok={health?.supabase_key_set === true} okText="Connected" badText="Not configured" />
            <HealthRow label="Push (Firebase)" ok={health?.firebase_ready === true} okText="Active" badText="Off" />
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
}
