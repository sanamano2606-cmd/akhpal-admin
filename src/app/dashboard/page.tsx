"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, TrendingUp, Building2, Bike, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { SkeletonStatCards, SkeletonChart, Shimmer } from "@/components/Skeletons";
import { canAccess } from "@/lib/perms";
import { money } from "@/lib/format";
import { CHART, statusHex } from "@/components/ui";

// The seven hex codes that used to be here are gone. They were a SECOND
// opinion about what colour each status is - the tables on every other page
// had their own - so an order that was amber in a list was orange in the chart
// beside it. Both now come from one map: src/components/ui/theme.ts.

// One rule for how money is written, shared by every screen - see
// lib/format.ts. This page used to carry its own copy that worded
// amounts differently from the rest of the panel: it showed the
// decimals the others round away, so the same figure read "Rs 1,234.5"
// here and "Rs 1,235" on the next screen.

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
      router.replace("/dashboard/my-deliveries");
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
      <div className="bg-takal-red-soft border border-[#F3C2C7] text-takal-red px-6 py-4 rounded-lg">
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

  // `href` turns a figure into a way in. A number you cannot open is a number
  // you cannot check, and "Takal earned" is exactly the figure somebody will
  // want to break down the moment they read it.
  const KPICard = ({ title, value, icon: Icon, color, href }: any) => {
    const inner = (
      <div className="bg-white rounded-lg border border-takal-line p-6 hover:shadow-md transition h-full">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-takal-ink-soft text-sm font-medium">{title}</p>
            <h3 className="text-3xl font-bold text-takal-ink mt-2">{value}</h3>
            {href && (
              <p className="text-xs text-takal-ink-soft mt-1">See the breakdown →</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className={`w-6 h-6 ${String(color).includes("primary") ? "text-takal-ink" : "text-white"}`} />
          </div>
        </div>
      </div>
    );
    return href ? <Link href={href} className="block">{inner}</Link> : inner;
  };

  // Real order-status distribution from the backend
  const statusData = Object.entries(data.orders_by_status || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Number(value),
    color: statusHex(name),
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
      <span className="text-takal-ink-soft text-sm">{label}</span>
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
          <h1 className="text-3xl font-bold text-takal-ink">Dashboard</h1>
          <p className="text-takal-ink-soft mt-1">Welcome back! Here&apos;s your live overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-takal-line rounded-lg outline-none text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards (real values, no fake growth %) */}
      {showNothing ? (
        <div className="bg-white border border-takal-line rounded-xl p-8 text-center max-w-md mx-auto">
          <h2 className="text-lg font-bold text-takal-ink mb-2">Nothing to show here yet</h2>
          <p className="text-sm text-takal-ink-soft">
            Your account has no sections switched on. Ask the Main Admin to give
            you the ones you need for your job.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {showOrders && (
          <KPICard title="Total Orders" value={data.total_orders || 0} icon={ShoppingCart} color="bg-takal-yellow" />
        )}
        {/* THE HEADLINE USED TO BE GMV, LABELLED "REVENUE".
            Sana, 2 September 2026: "The Dashboard, what it says is not what is
            really going on." She was right. GMV is what CUSTOMERS paid - almost
            all of it the shops' money. On the live database it read Rs 48,392
            while Takal had actually earned Rs 2,615: eighteen times too big, in
            the largest type on the page. The two numbers have swapped places,
            and both are now labelled for what they really are. */}
        {showMoney && (
          <KPICard title="Takal earned (all-time)" value={money(data.takal_earned || 0)}
            icon={TrendingUp} color="bg-green-600"
            href="/dashboard/earnings" />
        )}
        {showShops && (
          <KPICard title="Approved Stores" value={data.approved_restaurants || 0} icon={Building2} color="bg-takal-yellow" />
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
              <Link href="/dashboard/stores" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingRestaurants}</p>
                <p className="text-sm text-takal-ink-soft">Stores awaiting approval</p>
              </Link>
            )}
            {attnRiders && (
              <Link href="/dashboard/riders" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingRiders}</p>
                <p className="text-sm text-takal-ink-soft">Riders awaiting approval</p>
              </Link>
            )}
            {attnOrders && (
              <Link href="/dashboard/orders" className="bg-white rounded-lg border border-amber-200 p-4 hover:shadow-sm transition">
                <p className="text-2xl font-bold text-amber-700">{pendingOrders}</p>
                <p className="text-sm text-takal-ink-soft">Pending orders</p>
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
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-4">Revenue Trend (Last {days} Days)</h3>
          {revenueSeries.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-takal-disabled-text text-sm">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="date" stroke={CHART.axis} />
                <YAxis stroke={CHART.axis} />
                <Tooltip formatter={(v: any) => money(v)} />
                {/* Takal yellow, darkened enough to be readable as a line, with
                    the pure brand yellow washed underneath it. It was purple. */}
                <defs>
                  <linearGradient id="revenueWash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.fill} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART.fill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART.line}
                  strokeWidth={2}
                  fill="url(#revenueWash)"
                  dot={{ fill: CHART.line, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        )}

        {showOrders && (
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-4">Order Status Distribution</h3>
          {statusData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-takal-disabled-text text-sm">
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
                      <span className="text-sm text-takal-ink-soft">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-takal-ink">{item.value}</span>
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
        <div className={`${showHealth ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-lg border border-takal-line p-6`}>
          <h3 className="font-semibold text-takal-ink mb-4">Quick Stats</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showOrders && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Today&apos;s Orders</span>
              <span className="text-2xl font-bold text-takal-ink">{data.today_orders || 0}</span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Commission earned</span>
              <span className="text-2xl font-bold text-green-600">{money(data.commission_earnings || 0)}</span>
            </div>
            )}
            {/* The two income streams that appeared on NO screen at all before
                2 September 2026. */}
            {showMoney && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Menu markup earned</span>
              <span className="text-2xl font-bold text-green-600">{money(data.markup_earnings || 0)}</span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Delivery kept</span>
              <span className={`text-2xl font-bold ${
                (data.delivery_margin || 0) + (data.parcel_shipping_earnings || 0) < 0
                  ? "text-takal-red" : "text-green-600"}`}>
                {money((data.delivery_margin || 0) + (data.parcel_shipping_earnings || 0))}
              </span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">
                Money customers paid <span className="text-xs">(GMV — mostly the shops&apos;)</span>
              </span>
              <span className="text-2xl font-bold text-takal-ink">{money(data.gmv || 0)}</span>
            </div>
            )}
            {showShops && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Pending Stores</span>
              <span className="text-2xl font-bold text-takal-ink">{pendingRestaurants}</span>
            </div>
            )}
            {showRiders && (
            <div className="flex items-center justify-between p-3 border border-takal-line rounded-lg">
              <span className="text-takal-ink-soft">Pending Riders</span>
              <span className="text-2xl font-bold text-takal-ink">{pendingRiders}</span>
            </div>
            )}
          </div>
        </div>
        )}

        {showHealth && (
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-4">System Health</h3>
          <div className="space-y-3">
            <HealthRow label="API" ok={!!health} okText="Operational" badText="Unreachable" />
            {/*
              THE DATABASE ROW USED TO READ `supabase_key_set` - which only says
              an environment variable is SET. It said "Connected" whether or not
              the database was there, so with Supabase asleep every order failed
              and this panel still showed green. The API now READS a row and
              reports what happened; this reads that answer, and shows the
              reason underneath when it is bad, because "Unreachable" on its own
              tells nobody what to do.
            */}
            <HealthRow
              label="Database"
              ok={health?.database === "up"}
              okText={health?.database_ms != null ? `Connected (${health.database_ms} ms)` : "Connected"}
              badText={health?.database === "not-configured" ? "Not configured" : "Unreachable"}
            />
            {health?.database_reason && (
              <p className="text-xs text-red-500 -mt-1">{health.database_reason}</p>
            )}
            <HealthRow label="Push (Firebase)" ok={health?.firebase_ready === true} okText="Active" badText="Off" />
            {health?.push_reason && (
              <p className="text-xs text-amber-600 -mt-1">{health.push_reason}</p>
            )}
            <HealthRow
              label="Sign-up (OTP)"
              ok={health?.otp === "sms" || health?.otp === "in-app"}
              okText={health?.otp === "sms" ? "SMS" : "Shown in app"}
              badText="Nobody can register"
            />
            {health?.otp === "BROKEN" && health?.otp_reason && (
              <p className="text-xs text-red-500 -mt-1">{health.otp_reason}</p>
            )}
            {/*
              Old rider apps. The 4-digit door code used to be sent inside the
              web address, where the hosting provider's request log records it.
              The new builds send it in the request body, which is not logged;
              the old way still works so riders who have not updated can still
              finish a delivery.

              This row exists so the question "is anyone still using the old
              way?" has an ANSWER. While the number rises, they are. When it
              stops, the old way can be removed.
            */}
            {/*
              The paid AI features. OFF by decision (Sana, 2026-08-31): no
              spending for now, but the system ready for it. This row exists so
              "is it spending money?" is a question with an answer on a screen,
              rather than something you find out from a bill weeks later.
            */}
            {health?.ai && typeof health.ai.switched_on === "boolean" && (
              <>
                <HealthRow
                  label="AI features (paid)"
                  ok={health.ai.switched_on !== true}
                  okText={health.ai.key_present ? "Off - not spending" : "Off - no key set"}
                  badText={`On - ${health.ai.calls_today ?? 0} of ${health.ai.daily_limit ?? 0} calls today`}
                />
                {health.ai.switched_on === true && (
                  <p className="text-xs text-amber-600 -mt-1">
                    The AI features are switched on and calling a paid service.
                    Turn them off in Settings if that is not intended.
                  </p>
                )}
              </>
            )}
            {typeof health?.old_rider_apps_sending_code_in_address === "number" &&
             health.old_rider_apps_sending_code_in_address >= 0 && (
              <>
                <HealthRow
                  label="Old rider apps"
                  ok={health.old_rider_apps_sending_code_in_address === 0}
                  okText="None - every rider has updated"
                  badText={`${health.old_rider_apps_sending_code_in_address} deliveries since restart`}
                />
                {health.old_rider_apps_sending_code_in_address > 0 &&
                 health?.old_rider_apps_note && (
                  <p className="text-xs text-amber-600 -mt-1">{health.old_rider_apps_note}</p>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
}
