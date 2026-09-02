"use client";

/**
 * EARNINGS — what Takal itself made.
 *
 * WHY THIS PAGE EXISTS
 * Sana, 2 September 2026: "The Dashboard, what it says is not what is really
 * going on. There is no sidebar button, no other option where I can see all
 * Takal earnings on delivery, markup and commission."
 *
 * She was right on both counts.
 *
 *   1. Takal earns FOUR ways and only two were on any screen. Rider delivery
 *      margin and parcel shipping appeared NOWHERE in the whole panel.
 *   2. The Dashboard's headline, labelled "Revenue", is GMV - the money
 *      CUSTOMERS paid, almost all of which belongs to the shops. Measured on
 *      the live database that day it read Rs 48,392 while Takal had actually
 *      earned Rs 2,615. Eighteen times too big, in the largest type on the page.
 *
 * So this page starts with the one number that was missing, and shows the four
 * lines it is made of - each one a thing you can change.
 */

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Download, Percent, Tag, Bike, Package, Undo2, Gift,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";
import {
  Button, Card, CardHeader, Table, ErrorState, EmptyState, type Column,
} from "@/components/ui";

type Row = any;

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
];

export default function EarningsPage() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await apiClient.getEarnings(range ? { days: range } : {}));
    } catch (err) {
      setData(null);
      setError(errorMessage(err, "what Takal earned"));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const p = data?.period ?? {};
  const a = data?.all_time ?? {};
  const shops: Row[] = data?.by_shop ?? [];
  const blocked = Boolean(data?.incomplete);
  const rangeLabel = RANGES.find((r) => r.days === range)?.label ?? "";

  // Both figures, always — Sana, 1 September 2026: "Both Period and All time."
  const Pair = ({ icon, title, why, value, all, tone }: {
    icon: React.ReactNode; title: string; why: string;
    value: number; all: number; tone?: "good" | "bad";
  }) => (
    <div className="bg-white rounded-lg border border-takal-line p-5">
      <p className="text-takal-ink-soft text-xs font-medium flex items-center gap-1.5">
        {icon} {title}
      </p>
      <h3 className={`text-2xl font-bold mt-1 ${
        tone === "bad" || value < 0 ? "text-takal-red"
          : tone === "good" ? "text-takal-green" : "text-takal-ink"}`}>
        {money(value)}
      </h3>
      <p className="text-xs text-takal-ink-soft mt-1">
        All-time {money(all)}
      </p>
      <p className="text-[11px] text-takal-disabled-text mt-1.5 leading-snug">{why}</p>
    </div>
  );

  const shopColumns: Column<Row>[] = [
    { key: "name", header: "Shop", cell: (r) => <span className="font-bold">{r.name}</span>,
      total: () => "TOTAL" },
    { key: "orders", header: "Orders", numeric: true, cell: (r) => r.orders ?? 0,
      total: (rs) => rs.reduce((t, r) => t + (Number(r.orders) || 0), 0) },
    { key: "paid", header: "Customers paid", numeric: true, hideOnSmall: true,
      cell: (r) => money(r.customers_paid),
      total: (rs) => money(rs.reduce((t, r) => t + (Number(r.customers_paid) || 0), 0)) },
    { key: "comm", header: "Commission", numeric: true, cell: (r) => money(r.commission),
      total: (rs) => money(rs.reduce((t, r) => t + (Number(r.commission) || 0), 0)) },
    { key: "markup", header: "Markup", numeric: true, cell: (r) => money(r.markup),
      total: (rs) => money(rs.reduce((t, r) => t + (Number(r.markup) || 0), 0)) },
    { key: "earned", header: "You earned", numeric: true,
      cell: (r) => <strong>{money(r.earned)}</strong>,
      total: (rs) => money(rs.reduce((t, r) => t + (Number(r.earned) || 0), 0)) },
    { key: "rate", header: "Take rate", numeric: true,
      cell: (r) => <span className="text-takal-ink-soft">{(r.take_rate ?? 0).toFixed(1)}%</span> },
  ];

  const exportCsv = () => {
    const ok = downloadCsv(`takal-earnings-${range || "all"}.csv`, shops, [
      { key: "name", label: "Shop" }, { key: "orders", label: "Orders" },
      { key: "customers_paid", label: "Customers paid" },
      { key: "commission", label: "Commission" }, { key: "markup", label: "Markup" },
      { key: "earned", label: "You earned" }, { key: "take_rate", label: "Take rate %" },
    ]);
    if (!ok) toast("Nothing to export for these dates.", "info");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Earnings</h2>
          <p className="text-takal-ink-soft mt-1 text-sm max-w-3xl">
            <strong>Answers: what did Takal itself make?</strong>{" "}
            Not what customers paid — almost all of that belongs to the shops.
            This is the four ways Takal earns, what it gives back, and what is
            left.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
            onClick={exportCsv}>Export CSV</Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}
            onClick={load} loading={loading}>Refresh</Button>
        </div>
      </div>

      {error && <ErrorState message={error} denied={error.includes("permission")} onRetry={load} />}

      {blocked && (
        <div className="bg-takal-orange-soft border-2 border-[#FFD2BF] text-[#C8410F] px-4 py-3 rounded-lg">
          <p className="font-bold">⚠️ These figures are incomplete</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {(data?.incomplete_parts ?? []).map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
          <Button variant="danger" size="sm" className="mt-2" onClick={load}>Try again</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.days} onClick={() => setRange(r.days)}
            className={`px-3 py-2 rounded-lg text-sm border transition ${
              range === r.days
                ? "bg-takal-yellow border-takal-yellow-dark text-takal-ink font-bold"
                : "bg-white border-takal-line text-takal-ink-soft hover:bg-takal-page"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* ── THE ONE NUMBER ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-takal-ink text-white rounded-lg p-6">
          <p className="text-xs font-medium opacity-70">
            WHAT TAKAL EARNED · {rangeLabel.toUpperCase()}
          </p>
          <h3 className="text-4xl font-bold mt-1 text-takal-yellow">
            {money(p.earned)}
          </h3>
          <p className="text-sm opacity-80 mt-2">
            All-time <strong>{money(a.earned)}</strong> · after refunds Takal
            carried, <strong>{money(p.net)}</strong> is kept
          </p>
          <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="opacity-70 text-xs">Customers paid</p>
              <p className="font-bold text-lg">{money(p.customers_paid)}</p>
              <p className="opacity-60 text-[11px]">
                Almost all of this is the shops&rsquo; money
              </p>
            </div>
            <div>
              <p className="opacity-70 text-xs">Your take rate</p>
              <p className="font-bold text-lg">{(p.take_rate ?? 0).toFixed(1)}%</p>
              <p className="opacity-60 text-[11px]">
                Of every Rs 100 a customer spends, Takal keeps Rs{" "}
                {(p.take_rate ?? 0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-takal-line p-5 flex flex-col">
          <p className="text-takal-ink-soft text-xs font-medium">What you gave back</p>
          <div className="mt-3 space-y-3 text-sm flex-1">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-takal-ink-soft">
                <Undo2 className="w-3.5 h-3.5" /> Refunds you carried
              </span>
              <span className="font-bold text-takal-red">{money(p.refund_takal_carried)}</span>
            </div>
            <p className="text-[11px] text-takal-disabled-text -mt-2">
              Of {money(p.refunds_total)} refunded, the shops carried{" "}
              {money(p.refund_shop_carried)}
            </p>
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-takal-ink-soft">
                <Gift className="w-3.5 h-3.5" /> Free delivery given
              </span>
              <span className="font-bold text-takal-orange">{money(p.free_delivery_given)}</span>
            </div>
            <p className="text-[11px] text-takal-disabled-text -mt-2">
              Delivery the customer was not charged for and the rider was paid
              for in full. Already inside the delivery line below.
            </p>
          </div>
          <div className="border-t border-takal-line pt-3 mt-3 flex items-center justify-between">
            <span className="text-sm font-bold">Net kept</span>
            <span className="text-xl font-bold text-takal-green">{money(p.net)}</span>
          </div>
        </div>
      </div>

      {/* ── THE FOUR WAYS IN ───────────────────────────────────────────── */}
      <div>
        <h3 className="font-bold text-takal-ink mb-1">The four ways Takal earns</h3>
        <p className="text-xs text-takal-ink-soft mb-3">
          Every one of these is a number you can change in Settings. The big
          figure is {rangeLabel.toLowerCase()}; the line under it is all-time.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Pair icon={<Percent className="w-3.5 h-3.5" />} title="Commission"
            why="Your cut of what each shop sells. Settings → Commission."
            value={p.commission} all={a.commission} tone="good" />
          <Pair icon={<Tag className="w-3.5 h-3.5" />} title="Menu markup"
            why="Added on top of the shop's own price. Settings → Commission."
            value={p.markup} all={a.markup} tone="good" />
          <Pair icon={<Bike className="w-3.5 h-3.5" />} title="Rider delivery"
            why="Delivery charged, less what the rider was paid. Settings → Delivery Fees."
            value={p.rider_margin} all={a.rider_margin} />
          <Pair icon={<Package className="w-3.5 h-3.5" />} title="Parcel shipping"
            why="The flat parcel fee. No rider to pay, so Takal keeps it all."
            value={p.parcel_shipping} all={a.parcel_shipping} tone="good" />
        </div>
      </div>

      {/* A blank markup column looked like a fault. Say what it really is. */}
      {(a.markup_not_recorded ?? 0) > 0 && (
        <div className="bg-takal-blue-soft border border-[#C8DCEA] text-[#003D6B] px-4 py-3 rounded-lg text-sm">
          <p className="font-bold">
            Why the markup looks missing on older orders
          </p>
          <p className="mt-1">
            <strong>{a.markup_not_recorded}</strong> delivered orders were placed
            before <strong>{data?.markup_known_from}</strong>, the day Takal
            started recording each shop&rsquo;s own price separately. On those
            orders the markup cannot be worked out — so it is left out rather
            than guessed at.
          </p>
          <p className="mt-1">
            <strong>No money was lost.</strong> Checking those orders&rsquo; own
            lines, customers were charged <em>below</em> the shop&rsquo;s menu
            price, so no markup was ever charged and handed to the shops. It was
            simply not being earned yet. It is not a category rule — every shop
            is on the same 5%.
          </p>
        </div>
      )}

      {/* ── WHO ACTUALLY MAKES YOU MONEY ───────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader
          title={`Which shops earn you the most — ${rangeLabel.toLowerCase()}`}
          hint="Commission plus markup, per shop. The take rate is what Takal keeps out of every Rs 100 that shop's customers spend."
        />
        <Table
          columns={shopColumns}
          rows={shops}
          rowKey={(r) => String(r.restaurant_id)}
          loading={loading}
          empty={<EmptyState
            title="No delivered orders in these dates"
            message="Pick a longer period, or All time." />}
        />
      </Card>

      <p className="text-xs text-takal-ink-soft">
        Only <strong>delivered</strong> orders count. A refunded order is not
        income — the shop carries the refund up to its own price and anything
        past that is Takal&rsquo;s own loss, which is the &ldquo;refunds you
        carried&rdquo; figure above. Every number here comes from the same one
        place as the pay run, so the two screens cannot disagree.
      </p>
    </div>
  );
}
