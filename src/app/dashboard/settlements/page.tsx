"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, Bike, RefreshCw, AlertTriangle, Wallet, Percent } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Pay Out — run one pay cycle.
//
// Pick a period, see exactly what each store and each rider is owed for it, pay
// it. The old reports only offered "last 30 days" counting back from today, so
// you could never see "1 to 7 November" and pay that.
// ─────────────────────────────────────────────────────────────────────────────

interface Period { label: string; from: string; to: string; days: number }

interface StoreRow {
  store_id: string; store_name: string; phone?: string | null;
  orders: number; sold: number; commission: number;
  earned: number; already_paid: number; to_pay: number;
  // `sold` is what the SHOP sold at the shop's own prices. `customer_paid` is
  // the marked-up figure the customer was actually charged, and `markup_kept`
  // is the difference - the platform margin set in
  // Settings -> Commission -> "Menu Markup (%)".
  //
  // Until August 2026 only the marked-up figure was stored on an order, and the
  // payout was worked out from it, so the shop was handed the margin as well.
  // Both numbers are shown here now so that money is visible rather than being
  // arithmetic nobody performs.
  customer_paid?: number; markup_kept?: number;
}

interface RiderRow {
  rider_id: string; rider_name: string; phone?: string | null;
  is_suspended?: boolean; suspended_reason?: string | null;
  deliveries: number; earned: number;
  cash_collected: number; cash_orders: number; cash_earned: number;
  online_orders: number; online_earned: number;
  platform_subsidy: number; already_paid: number; to_pay: number;
  cash_still_held: number; wallet_balance: number;
}

const rs = (n: number) => `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export default function SettlementsPage() {
  const [tab, setTab] = useState<"stores" | "riders">("stores");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [sel, setSel] = useState<number>(1); // default: last period — the one you pay
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [stores, setStores] = useState<{ stores: StoreRow[]; totals: Record<string, number> } | null>(null);
  const [riders, setRiders] = useState<{ riders: RiderRow[]; totals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  const window = useCallback(() => {
    if (sel === -1) return { from: custom.from || undefined, to: custom.to || undefined };
    const p = periods[sel];
    return p ? { from: p.from, to: p.to } : {};
  }, [sel, custom, periods]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const w = window();
      const [s, r] = await Promise.all([
        apiClient.getStoreSettlements(w) as Promise<typeof stores>,
        apiClient.getRiderSettlements(w) as Promise<typeof riders>,
      ]);
      setStores(s);
      setRiders(r);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load", "error");
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    (async () => {
      try {
        const p = (await apiClient.getSettlementPeriods()) as { periods: Period[] };
        setPeriods(p?.periods ?? []);
      } catch {
        /* period list is a convenience; custom dates still work */
      }
    })();
  }, []);

  useEffect(() => {
    if (periods.length || sel === -1) load();
  }, [periods, sel, load]);

  const w = window();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pay Out</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Pick a period, see what each store and rider is owed, and pay it.
          </p>
        </div>
        <button onClick={load} className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Period picker */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
          >
            {periods.map((p, i) => (
              <option key={i} value={i}>
                {p.label} ({p.from} to {p.to})
              </option>
            ))}
            <option value={-1}>Choose my own dates…</option>
          </select>
          {sel === -1 && (
            <>
              <input type="date" value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button onClick={load} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm">
                Show
              </button>
            </>
          )}
        </div>
        {(w.from || w.to) && (
          <p className="text-xs text-slate-500">
            Showing deliveries from <strong>{w.from}</strong> to <strong>{w.to}</strong>.
          </p>
        )}
      </div>

      {/* Headline totals */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Pay to Stores" value={rs(stores?.totals?.to_pay ?? 0)} icon={<Store className="w-5 h-5" />} />
          <Card title="Pay to Riders" value={rs(riders?.totals?.to_pay ?? 0)} icon={<Bike className="w-5 h-5" />} />
          <Card
            title="Your markup kept"
            value={rs(stores?.totals?.markup_kept ?? 0)}
            icon={<Percent className="w-5 h-5" />}
          />
          <Card
            title="Cash riders still hold"
            value={rs(riders?.totals?.cash_still_held ?? 0)}
            icon={<Wallet className="w-5 h-5" />}
            warn={(riders?.totals?.cash_still_held ?? 0) > 0}
          />
        </div>
      )}

      {(riders?.totals?.platform_subsidy ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <strong>Free delivery cost you {rs(riders!.totals.platform_subsidy)}</strong> this
            period. Riders were paid in full; customers were not charged.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([["stores", "Stores"], ["riders", "Riders"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : tab === "stores" ? (
        <Table
          empty="No store sales in this period."
          head={["Store", "Orders", "Customer paid", "Shop's price", "Your markup",
                 "Your commission", "Already paid", "PAY NOW"]}
          rows={(stores?.stores ?? []).map((s) => [
            <span key="n" className="font-medium text-slate-900">{s.store_name}</span>,
            String(s.orders),
            // Older orders predate the split and report the two as one figure;
            // showing "-" is honester than printing a markup of Rs 0 that was
            // never actually calculated.
            s.customer_paid == null ? "—" : rs(s.customer_paid),
            rs(s.sold),
            <span key="m" className={(s.markup_kept ?? 0) > 0 ? "text-emerald-700 font-medium" : "text-slate-400"}>
              {s.markup_kept == null ? "—" : rs(s.markup_kept)}
            </span>,
            rs(s.commission), rs(s.already_paid),
            <strong key="p" className="text-slate-900">{rs(s.to_pay)}</strong>,
          ])}
        />
      ) : (
        <Table
          empty="No deliveries in this period."
          head={["Rider", "Deliveries", "Cash orders", "Online orders", "Earned", "Cash still held", "Already paid", "PAY NOW"]}
          rows={(riders?.riders ?? []).map((r) => [
            <span key="n" className="font-medium text-slate-900">
              {r.rider_name}
              {r.is_suspended && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">BLOCKED</span>
              )}
            </span>,
            String(r.deliveries),
            `${r.cash_orders} · ${rs(r.cash_earned)}`,
            `${r.online_orders} · ${rs(r.online_earned)}`,
            rs(r.earned),
            <span key="c" className={r.cash_still_held > 0 ? "text-amber-700 font-medium" : ""}>
              {rs(r.cash_still_held)}
            </span>,
            rs(r.already_paid),
            <strong key="p" className="text-slate-900">{rs(r.to_pay)}</strong>,
          ])}
        />
      )}

      <p className="text-xs text-slate-500">
        Record the actual payment on the <strong>Payouts</strong> page. Payments are
        stamped with the period, so paying last week never changes this week&apos;s figure.
      </p>
    </div>
  );
}

function Card({ title, value, icon, warn }: { title: string; value: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${warn ? "border-amber-300" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 text-slate-500 text-sm">{icon}{title}</div>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg p-6 text-center">{empty}</p>;
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            {head.map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-3 whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
