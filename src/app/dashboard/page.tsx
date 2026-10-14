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

/** Who sees the System Health box (2 October 2026). It asked for "settings" -
 *  the WHOLE Settings tab. The old permission word "settings" never turns into
 *  that key (it means the options inside), and a sub-admin given only
 *  Settings -> General does not hold it either, so both had a Settings page
 *  and no System Health. Now: the whole tab, or its General option. */
function maySeeHealth(): boolean {
  return canAccess("settings") || canAccess("settings.general");
}

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
  // A FAILED READ MUST NOT BECOME A FACT ABOUT THE MONEY.
  // The revenue call was allowed to fail quietly, and the chart then said
  // "No revenue data yet" - which on the first screen of the panel reads as
  // "you sold nothing". TRUE means the figures were never read.
  const [revenueFailed, setRevenueFailed] = useState(false);
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
      const base = process.env.NEXT_PUBLIC_API_URL || "https://api.takalapp.com";

      // Fire all three independent requests at once instead of waiting for each
      // in turn — cuts this page's load time to roughly a single request.
      // Don't even ASK for what this account may not have. The server would
      // refuse anyway, but an avoidable 403 on every dashboard load fills the
      // log with noise that looks like an attack when it is just a store clerk
      // opening the panel.
      const [dash, rev, h] = await Promise.all([
        apiClient.getDashboard().catch(() => null),
        // "reports.sales", not "analytics" (item 10, 2 Oct 2026): "analytics" is
        // an OLD word that the permission reader turns into "earnings" and
        // "reports.sales", so asking for it matched no sub-admin at all and the
        // chart was never loaded for any of them. The chart's address
        // (/admin/analytics) is the Reports -> Sales screen's.
        canAccess("reports.sales")
          ? apiClient.getRevenueAnalytics(days, "day").catch(() => "failed" as const)
          : Promise.resolve(null),
        maySeeHealth()
          ? fetch(`${base}/health`).then((r) => r.json()).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (dash) setData(dash as any);
      else setError("Error loading dashboard");

      setRevenueFailed(rev === "failed");
      const breakdown =
        rev === "failed" ? {} : ((rev as any)?.data?.daily_breakdown || {});
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
  // The daily chart is its own screen's data (Reports -> Sales). Somebody
  // given only Earnings sees the money figures, but no empty chart that
  // could only ever say "No sales yet" (item 10, 2 Oct 2026).
  const showChart = showMoney && canAccess("reports.sales");
  const showShops = has("approved_restaurants");
  const showRiders = has("online_riders");
  // System Health is the only exception: it comes from the public /health
  // endpoint, which carries no business data (it reports whether the API is up
  // and whether a key is configured - nothing about orders, money or people).
  // There is nothing to leak, so hiding it is a tidiness choice and it is fine
  // for that choice to live in the browser.
  const showHealth = maySeeHealth();
  const showNothing = !showOrders && !showMoney && !showShops && !showRiders;
  const showQuick = showOrders || showMoney || showShops || showRiders;

  // `href` turns a figure into a way in. A number you cannot open is a number
  // you cannot check, and "Takal earned" is exactly the figure somebody will
  // want to break down the moment they read it.
  const KPICard = ({ title, value, icon: Icon, color, href }: any) => {
    const inner = (
      // Mock 191 (Sana, 14 Oct 2026): a small tile - icon on the left, the
      // number and its name beside it - so six fit in one row.
      <div className="bg-white rounded-xl border border-takal-line px-3 py-2.5 hover:shadow-md transition h-full">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${color}`}>
            {/* WHITE ICON ON TAKAL YELLOW WAS UNREADABLE.
                The old test was `color.includes("primary")` - no card has ever
                been given a colour called "primary", so every card, yellow
                ones included, got a white icon. White on #FFFF00 has a
                contrast of 1.07:1; the Brand Kit's one unbreakable rule is
                that anything on yellow is pure black. */}
            <Icon className={`w-5 h-5 ${String(color).includes("takal-yellow") ? "text-takal-ink" : "text-white"}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-bold leading-tight text-takal-ink whitespace-nowrap">{value}</h3>
            <p className="text-takal-ink-soft text-[12.5px] leading-tight">{title}</p>
            {href && (
              <p className="text-[11px] text-takal-ink-soft">See the breakdown →</p>
            )}
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

  // REALLY WAITING (Stores page fix 1, 12 Oct 2026): the server now counts
  // shops that are not approved AND not rejected. "total - approved" counted a
  // rejected shop as waiting. An older server without the figure: as before.
  const pendingRestaurants =
    typeof data.waiting_restaurants === "number" && data.waiting_restaurants >= 0
      ? data.waiting_restaurants
      : (data.total_restaurants || 0) - (data.approved_restaurants || 0);
  const pendingRiders = (data.total_riders || 0) - (data.approved_riders || 0);
  const pendingOrders = Number(data.orders_by_status?.pending || 0);
  // Each row of "Needs your attention" belongs to the section that owns it, so
  // a store clerk is not told how many riders are waiting. The box itself only
  // appears if at least one row survived - never as an empty amber panel.
  const attnShops = showShops && pendingRestaurants > 0;
  const attnRiders = showRiders && pendingRiders > 0;
  const attnOrders = showOrders && pendingOrders > 0;
  const needsAttention = attnShops || attnRiders || attnOrders;

  // One item of the System Health LINE (Mock 191): a dot, the name, the state.
  const HealthRow = ({ label, ok, okText, badText }: any) => (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-600" : "bg-red-500"}`}></span>
      <span className="text-takal-ink-soft">{label}</span>
      <span className={`font-semibold ${ok ? "text-green-600" : "text-red-500"}`}>
        {ok ? okText : badText}
      </span>
    </span>
  );

  // "Needs your attention" - each one a small amber tile in the SAME row as
  // the numbers (Mock 191; it was a box of its own under them).
  const AttentionTile = ({ href, count, words }: { href: string; count: number; words: string }) => (
    <Link href={href} className="block rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 hover:shadow-sm transition h-full">
      <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-amber-900">⚡ Needs your attention</p>
      <p className="text-xl font-bold leading-tight text-amber-700">{count}</p>
      <p className="text-[12.5px] leading-tight text-takal-ink-soft">{words} ›</p>
    </Link>
  );

  return (
    <div className="space-y-2.5">
      {/* Header - ONE line (Mock 191, Sana 14 Oct 2026: "re arrange the
          content. do not remove any content ... make it the compacted as much
          as you can"). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-takal-ink">Dashboard</h1>
        <p className="text-sm text-takal-ink-soft">Welcome back! Here&apos;s your live overview.</p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-auto px-3 py-1.5 bg-white border border-takal-line rounded-lg outline-none text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI tiles (real values, no fake growth %) and, in the SAME row, the
          "Needs your attention" tiles. */}
      {showNothing ? (
        <div className="bg-white border border-takal-line rounded-xl p-8 text-center max-w-md mx-auto">
          <h2 className="text-lg font-bold text-takal-ink mb-2">Nothing to show here yet</h2>
          <p className="text-sm text-takal-ink-soft">
            Your account has no sections switched on. Ask the Main Admin to give
            you the ones you need for your job.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
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
        {/* Needs your attention: each row belongs to the section that owns it
            (see attnShops / attnRiders / attnOrders). */}
        {attnShops && (
          <AttentionTile href="/dashboard/stores?status=pending" count={pendingRestaurants} words="Stores awaiting approval" />
        )}
        {attnRiders && (
          <AttentionTile href="/dashboard/riders" count={pendingRiders} words="Riders awaiting approval" />
        )}
        {attnOrders && (
          <AttentionTile href="/dashboard/orders" count={pendingOrders} words="Pending orders" />
        )}
      </div>
      )}
      {/* The "Needs your attention" box is gone as a box - its rows are the
          amber tiles above. `needsAttention` still says whether any exists. */}
      {needsAttention && <span className="sr-only">Needs your attention</span>}

      {/* Charts (real data). Each chart belongs to a permission: the revenue
          line is money (analytics), the status ring is order data (orders).
          The grid widens to one column when only one of them survives, so a
          lone chart is not left stranded in half the page. */}
      {/* THREE COLUMNS (Mock 191): the money chart, the status ring with its
          list beside it, and Quick Stats - each only for whom may see it. */}
      {(showChart || showOrders || showQuick) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {showChart && (
        <div className="bg-white rounded-xl border border-takal-line px-4 py-3">
          {/* NOT "Revenue" (item 9, 2 Oct 2026): this is what customers paid,
              almost all of it the shops' - the same figure as the headline. */}
          <h3 className="font-semibold text-takal-ink">Money customers paid — last {days} days</h3>
          <p className="mb-2 text-xs text-takal-ink-soft">
            Mostly the shops&apos; money. What Takal earned is on the{" "}
            <Link href="/dashboard/earnings" className="underline">Earnings</Link> page.
          </p>
          {revenueFailed ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-takal-ink-soft">
                The sales figures could not be read, so this chart is empty for
                that reason — not because there were no sales.
              </p>
              <button
                onClick={fetchAll}
                className="px-4 py-2 rounded-lg border border-takal-line text-sm font-medium text-takal-ink hover:bg-takal-page"
              >
                Try again
              </button>
            </div>
          ) : revenueSeries.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-takal-disabled-text text-sm">
              No sales yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="date" stroke={CHART.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={CHART.axis} tick={{ fontSize: 11 }} width={48} />
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
                  name="Customers paid"
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
        <div className="bg-white rounded-xl border border-takal-line px-4 py-3">
          <h3 className="font-semibold text-takal-ink mb-2">Order Status Distribution</h3>
          {/* read-safe: a failed dashboard read returns early above, so
              reaching this line means the counts really were read. */}
          {statusData.length === 0 ? (
            <div className="h-[210px] flex items-center justify-center text-takal-disabled-text text-sm">
              No orders yet
            </div>
          ) : (
            // The list BESIDE the ring, not under it (Mock 191).
            <div className="flex items-center gap-4">
              <div className="w-[170px] shrink-0">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
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
            </div>
          )}
        </div>
        )}

        {/* Quick Stats (real) - a tidy list, label left, figure right. */}
        {showQuick && (
        <div className="bg-white rounded-xl border border-takal-line px-4 py-3">
          <h3 className="font-semibold text-takal-ink mb-1">Quick Stats</h3>
          <div>
            {showOrders && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Today&apos;s Orders</span>
              <span className="whitespace-nowrap text-[15px] font-bold text-takal-ink">{data.today_orders || 0}</span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Commission earned</span>
              <span className="whitespace-nowrap text-[15px] font-bold text-green-600">{money(data.commission_earnings || 0)}</span>
            </div>
            )}
            {/* The two income streams that appeared on NO screen at all before
                2 September 2026. */}
            {showMoney && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Menu markup earned</span>
              <span className="whitespace-nowrap text-[15px] font-bold text-green-600">{money(data.markup_earnings || 0)}</span>
            </div>
            )}
            {/* FIXED-PRICE STORES (Step 5d, 8 Oct 2026): selling less buying -
                part of "Takal earned", so it is shown beside the markup, and a
                loss shows as a minus. Drawn once a fixed-price order exists. */}
            {showMoney && Number(data.price_difference_earnings || 0) !== 0 && (
            <div className="flex items-center justify-between gap-3 py-1.5 px-1 -mx-1 border-b border-[#F0F0F0] text-sm bg-takal-yellow-soft rounded">
              <span className="text-takal-ink-soft">Price difference <span className="text-xs">(fixed-price stores)</span></span>
              <span className={`whitespace-nowrap text-[15px] font-bold ${Number(data.price_difference_earnings) < 0 ? "text-takal-red" : "text-green-600"}`}>
                {money(data.price_difference_earnings)}
              </span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Delivery kept</span>
              <span className={`whitespace-nowrap text-[15px] font-bold ${
                (data.delivery_margin || 0) + (data.parcel_shipping_earnings || 0) < 0
                  ? "text-takal-red" : "text-green-600"}`}>
                {money((data.delivery_margin || 0) + (data.parcel_shipping_earnings || 0))}
              </span>
            </div>
            )}
            {showMoney && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">
                Money customers paid <span className="text-xs">(GMV — mostly the shops&apos;)</span>
              </span>
              <span className="whitespace-nowrap text-[15px] font-bold text-takal-ink">{money(data.gmv || 0)}</span>
            </div>
            )}
            {showShops && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Stores waiting for approval</span>
              <span className="whitespace-nowrap text-[15px] font-bold text-takal-ink">{pendingRestaurants}</span>
            </div>
            )}
            {showRiders && (
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F0F0F0] last:border-b-0 text-sm">
              <span className="text-takal-ink-soft">Pending Riders</span>
              <span className="whitespace-nowrap text-[15px] font-bold text-takal-ink">{pendingRiders}</span>
            </div>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {/* System Health - ONE line of dots (Mock 191). A reason still shows
          in full, on its own line under it. */}
      {showHealth && (
        <div className="bg-white rounded-xl border border-takal-line px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          <h3 className="font-semibold text-takal-ink text-sm">System Health</h3>
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
              <p className="basis-full text-xs text-red-500">{health.database_reason}</p>
            )}
            <HealthRow label="Push (Firebase)" ok={health?.firebase_ready === true} okText="Active" badText="Off" />
            {health?.push_reason && (
              <p className="basis-full text-xs text-amber-600">{health.push_reason}</p>
            )}
            <HealthRow
              label="Sign-up (OTP)"
              ok={health?.otp === "sms" || health?.otp === "in-app"}
              okText={health?.otp === "sms"
                ? (health?.otp_carrier ? `SMS \u2014 ${health.otp_carrier}` : "SMS")
                : "Shown in app"}
              badText="Nobody can register"
            />
            {health?.otp === "BROKEN" && health?.otp_reason && (
              <p className="basis-full text-xs text-red-500">{health.otp_reason}</p>
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
                  <p className="basis-full text-xs text-amber-600">
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
                  <p className="basis-full text-xs text-amber-600">{health.old_rider_apps_note}</p>
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}
