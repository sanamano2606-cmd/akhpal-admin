"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  TrendingUp,
  Building2,
  Bike,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apiUrl = typeof window !== "undefined" ? localStorage.getItem("api_url") : "";
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : "";

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch dashboard data");

      const data = await response.json();
      setDashboardData(data);
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
          onClick={fetchDashboardData}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-center py-12">No data available</div>;
  }

  const KPICard = ({
    title,
    value,
    change,
    trend,
    icon: Icon,
    color,
  }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-600 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
          <p className={`text-sm mt-2 flex items-center gap-1 ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
            {trend === "up" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            {change}% {trend === "up" ? "increase" : "decrease"}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  // Sample data for charts
  const revenueData = [
    { date: "Jun 20", revenue: 42000 },
    { date: "Jun 21", revenue: 38000 },
    { date: "Jun 22", revenue: 52000 },
    { date: "Jun 23", revenue: 45000 },
    { date: "Jun 24", revenue: 61000 },
    { date: "Jun 25", revenue: 55000 },
    { date: "Jun 26", revenue: 67000 },
  ];

  const ordersData = [
    { date: "Jun 20", orders: 124 },
    { date: "Jun 21", orders: 98 },
    { date: "Jun 22", orders: 156 },
    { date: "Jun 23", orders: 134 },
    { date: "Jun 24", orders: 189 },
    { date: "Jun 25", orders: 167 },
    { date: "Jun 26", orders: 201 },
  ];

  const statusData = [
    { name: "Delivered", value: 540, color: "#10b981" },
    { name: "Cooking", value: 120, color: "#f59e0b" },
    { name: "Pending", value: 85, color: "#3b82f6" },
    { name: "Cancelled", value: 23, color: "#ef4444" },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here's your overview.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Orders"
          value={dashboardData.total_orders || 0}
          change="12"
          trend="up"
          icon={ShoppingCart}
          color="bg-blue-600"
        />
        <KPICard
          title="Revenue (GMV)"
          value={`₹${(dashboardData.gmv || 0).toLocaleString()}`}
          change="8"
          trend="up"
          icon={TrendingUp}
          color="bg-green-600"
        />
        <KPICard
          title="Restaurants"
          value={dashboardData.approved_restaurants || 0}
          change="3"
          trend="up"
          icon={Building2}
          color="bg-purple-600"
        />
        <KPICard
          title="Active Riders"
          value={dashboardData.online_riders || 0}
          change="5"
          trend="up"
          icon={Bike}
          color="bg-orange-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                }}
                cursor={{ stroke: "#7c3aed", strokeWidth: 2 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ fill: "#7c3aed", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders Trend */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Orders Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="orders" fill="#7c3aed" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Distribution & Top Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Order Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-6 space-y-2">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Today's Orders</span>
                <span className="text-2xl font-bold text-slate-900">{dashboardData.today_orders || 0}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-600">Commission Earned</span>
                <span className="text-2xl font-bold text-green-600">
                  ₹{(dashboardData.commission_earnings || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-600">Pending Restaurants</span>
                <span className="text-2xl font-bold text-slate-900">
                  {dashboardData.total_restaurants - dashboardData.approved_restaurants}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-600">Pending Riders</span>
                <span className="text-2xl font-bold text-slate-900">
                  {dashboardData.total_riders - dashboardData.approved_riders}
                </span>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">System Health</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-sm">API Status</span>
                <span className="inline-flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">Operational</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-sm">Database</span>
                <span className="inline-flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-sm">Cache (Redis)</span>
                <span className="inline-flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
