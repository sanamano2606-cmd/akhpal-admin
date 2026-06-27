"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, TrendingUp, Building2, Bike, RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { apiClient } from "@/lib/api-client";

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

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [revenueSeries, setRevenueSeries] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      const dash = (await apiClient.getDashboard()) as any;
      setData(dash);

      // Real revenue trend (last 30 days)
      try {
        const rev = (await apiClient.getRevenueAnalytics(30, "day")) as any;
        const breakdown = rev?.data?.daily_breakdown || {};
        const series = Object.keys(breakdown)
          .sort()
          .map((d) => ({ date: d.slice(5), revenue: Math.round(breakdown[d]) }));
        setRevenueSeries(series);
      } catch {
        setRevenueSeries([]);
      }

      // Real system health
      try {
        const base = localStorage.getItem("api_url") || "https://swat-delivery-api.onrender.com";
        const h = await fetch(`${base}/health`).then((r) => r.json());
        setHealth(h);
      } catch {
        setHealth(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-primary-600 rounded-full"></div>
          </div>
          <p className="text-slate-600">Loading dashboard...</p>
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

  const KPICard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-600 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
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
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards (real values, no fake growth %) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Orders" value={data.total_orders || 0} icon={ShoppingCart} color="bg-blue-600" />
        <KPICard title="Revenue (GMV)" value={money(data.gmv || 0)} icon={TrendingUp} color="bg-green-600" />
        <KPICard title="Approved Restaurants" value={data.approved_restaurants || 0} icon={Building2} color="bg-purple-600" />
        <KPICard title="Online Riders" value={data.online_riders || 0} icon={Bike} color="bg-orange-600" />
      </div>

      {/* Charts (real data) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend (Last 30 Days)</h3>
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
      </div>

      {/* Quick Stats + System Health (real) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Today&apos;s Orders</span>
              <span className="text-2xl font-bold text-slate-900">{data.today_orders || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Commission Earned</span>
              <span className="text-2xl font-bold text-green-600">{money(data.commission_earnings || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Pending Restaurants</span>
              <span className="text-2xl font-bold text-slate-900">{pendingRestaurants}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
              <span className="text-slate-600">Pending Riders</span>
              <span className="text-2xl font-bold text-slate-900">{pendingRiders}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">System Health</h3>
          <div className="space-y-3">
            <HealthRow label="API" ok={!!health} okText="Operational" badText="Unreachable" />
            <HealthRow label="Database" ok={health?.supabase_key_set === true} okText="Connected" badText="Not configured" />
            <HealthRow label="Push (Firebase)" ok={health?.firebase_ready === true} okText="Active" badText="Off" />
          </div>
        </div>
      </div>
    </div>
  );
}
