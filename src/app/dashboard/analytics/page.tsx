"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api-client";

export default function AnalyticsPage() {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [riderData, setRiderData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const revenue = await apiClient.getRevenueAnalytics(30, "day") as any;
      const riders = await apiClient.getRiderAnalytics(30) as any;
      // The API wraps results as { success, data: {...} }. daily_breakdown is an
      // object { "2026-06-01": 1234, ... }, so convert it to a sorted array for the chart.
      const breakdown = revenue?.data?.daily_breakdown || {};
      setRevenueData(
        Object.keys(breakdown)
          .sort()
          .map((d) => ({ date: d.slice(5), revenue: Math.round(breakdown[d]) }))
      );
      setRiderData(riders?.data?.top_performers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">Platform insights and performance metrics</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Top Riders</h3>
            <div className="space-y-3">
              {riderData.slice(0, 5).map((rider: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-900">{i + 1}. {rider.name || "Rider"}</p>
                    <p className="text-xs text-slate-600">{rider.total_deliveries || 0} deliveries</p>
                  </div>
                  <p className="font-semibold text-green-600">Rs {Math.round(rider.total_earnings || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
