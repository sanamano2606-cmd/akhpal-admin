"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { CHART, ErrorState } from "@/components/ui";
import { isAccessDenied, errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { SkeletonChart } from "@/components/Skeletons";

export default function AnalyticsPage() {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [riderData, setRiderData] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // NOTHING AT ALL WAS SHOWN WHILE THIS PAGE LOADED.
  // Every block was written as {!loading && ...}, so for the whole wait -
  // and on the free server that can be a cold start - the page was a blank
  // white area under a heading, which reads as "there is no data".
  const [error, setError] = useState<ReadFailure>(null);
  const [partErrors, setPartErrors] = useState<string[]>([]);
  // Whether any of those part-failures was a refusal. Worked out from the
  // real error, not by searching its wording for the word "permission".
  const [partDenied, setPartDenied] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchAnalytics = async () => {
    // Which sections failed on their own. Kept apart from `error`, which
    // means the whole page failed.
    const partial: string[] = [];
    let denied = false;
    try {
      setLoading(true);
      setPartErrors([]);
      setPartDenied(false);
      setError(null);
      // Asked one after the other, so on a sleeping free server this waited
      // through TWO cold starts instead of one.
      const [revenue, riders] = (await Promise.all([
        apiClient.getRevenueAnalytics(days, "day"),
        apiClient.getRiderAnalytics(days),
      ])) as any[];
      // The API wraps results as { success, data: {...} }. daily_breakdown is an
      // object { "2026-06-01": 1234, ... }, so convert it to a sorted array for the chart.
      const breakdown = revenue?.data?.daily_breakdown || {};
      setRevenueData(
        Object.keys(breakdown)
          .sort()
          .map((d) => ({ date: d.slice(5), revenue: Math.round(breakdown[d]) }))
      );
      // top_performers comes back as an object keyed by rider id, not an array.
      setRiderData(Object.values(riders?.data?.top_performers || {}));

      // The extra reports can each be "insufficient data" — load them independently
      // so one empty section never blanks the whole page.
      try {
        const cust = (await apiClient.getCustomerAnalytics(90)) as any;
        setCustomerStats(cust?.data && !cust.data.error ? cust.data : null);
      } catch (err) { setCustomerStats(null); partial.push(errorMessage(err, "customer figures")); denied ||= isAccessDenied(err); }
      try {
        const fc = (await apiClient.getForecastAnalytics(7)) as any;
        setForecast(fc?.data && !fc.data.error ? fc.data : null);
      } catch (err) { setForecast(null); partial.push(errorMessage(err, "the demand forecast")); denied ||= isAccessDenied(err); }
      try {
        const cat = (await apiClient.getCategoryAnalytics(days)) as any;
        const byCat = cat?.data?.by_category || {};
        setCategories(Object.entries(byCat).map(([name, v]: any) => ({ name, ...v })));
      } catch (err) { setCategories([]); partial.push(errorMessage(err, "top categories")); denied ||= isAccessDenied(err); }
      setPartErrors(partial);
      setPartDenied(denied);
    } catch (err) {
      setError(readFailure(err, "the analytics"));
      setRevenueData([]);
      setRiderData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {partErrors.length > 0 && (
        // Each of these panels used to just disappear when it failed, which
        // reads as "there is no data" rather than "this did not load".
        <ErrorState
          message={
            <>
              <strong>Some sections did not load.</strong>{" "}
              {partErrors.join(" ")}
            </>
          }
          denied={partDenied}
          onRetry={fetchAnalytics}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Sales &amp; Analytics</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">How the business is doing — revenue, riders, customers and demand.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchAnalytics} denied={error.denied} />
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-takal-line p-6">
            <h3 className="font-semibold text-takal-ink mb-4">Revenue Trend (Last {days} Days)</h3>
            {/* The SAME chart as the one on the Dashboard, drawn the same way.
                They used to be different colours, so the identical revenue
                line looked like two different figures. */}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="analyticsRevenueWash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.fill} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART.fill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="date" stroke={CHART.axis} />
                <YAxis stroke={CHART.axis} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART.line}
                  strokeWidth={2}
                  fill="url(#analyticsRevenueWash)"
                  dot={{ fill: CHART.line, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-takal-line p-6">
            <h3 className="font-semibold text-takal-ink mb-4">Top Riders</h3>
            <div className="space-y-3">
              {riderData.slice(0, 5).map((rider: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
                  <div>
                    <p className="font-semibold text-takal-ink">{i + 1}. {rider.name || "Rider"}</p>
                    <p className="text-xs text-takal-ink-soft">{rider.total_deliveries || 0} deliveries</p>
                  </div>
                  <p className="font-semibold text-green-600">{money(rider.total_earnings)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && customerStats && (
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-4">Customer Insights (last 90 days)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-takal-line rounded-lg">
              <p className="text-xs text-takal-ink-soft">Active customers</p>
              <p className="text-2xl font-bold text-takal-ink">{customerStats.total_customers ?? 0}</p>
            </div>
            <div className="p-4 border border-takal-line rounded-lg">
              <p className="text-xs text-takal-ink-soft">Avg. lifetime value</p>
              <p className="text-2xl font-bold text-green-600">{money(customerStats.average_clv)}</p>
            </div>
            <div className="p-4 border border-takal-line rounded-lg">
              <p className="text-xs text-takal-ink-soft">High-value customers</p>
              <p className="text-2xl font-bold text-takal-ink">{customerStats.high_value_customers ?? 0}</p>
            </div>
            <div className="p-4 border border-takal-line rounded-lg">
              <p className="text-xs text-takal-ink-soft">At-risk (no order 14+ days)</p>
              <p className="text-2xl font-bold text-amber-600">{customerStats.at_risk_customers ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!loading && forecast && (
          <div className="bg-white rounded-lg border border-takal-line p-6">
            <h3 className="font-semibold text-takal-ink mb-1">Demand Forecast</h3>
            <p className="text-sm text-takal-ink-soft mb-4">Trend: <span className="font-medium capitalize">{forecast.recent_trend || "stable"}</span></p>
            <div className="space-y-2">
              {Object.entries(forecast.forecast_next_days || {}).map(([k, v]: any) => (
                <div key={k} className="flex justify-between text-sm border-b border-takal-line py-1.5">
                  <span className="text-takal-ink-soft">In {k.replace("+", "").replace("_days", "")} day(s)</span>
                  <span className="font-semibold text-takal-ink">~{v} orders</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && categories.length > 0 && (
          <div className="bg-white rounded-lg border border-takal-line p-6">
            <h3 className="font-semibold text-takal-ink mb-4">Top Categories by Revenue</h3>
            <div className="space-y-2">
              {[...categories].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 8).map((c) => (
                <div key={c.name} className="flex justify-between text-sm border-b border-takal-line py-1.5">
                  <span className="text-takal-ink capitalize">{c.name}</span>
                  <span className="font-semibold text-takal-ink">{money(c.revenue)} · {c.quantity || 0} sold</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
