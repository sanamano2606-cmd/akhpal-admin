"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, Bike, RefreshCw, AlertTriangle, Wallet, Percent } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";

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
  // What this shop is owed ALL-TIME - every order it has ever delivered, less
  // every payment ever made to it. `to_pay` above is this period only. A shop
  // can be square for this week and still owed for last month; without this
  // column that debt shows on no screen at all.
  balance_all_time?: number;
}

interface RiderRow {
  rider_id: string; rider_name: string; phone?: string | null;
  is_suspended?: boolean; suspended_reason?: string | null;
  deliveries: number; earned: number;
  cash_collected: number; cash_orders: number; cash_earned: number;
  online_orders: number; online_earned: number;
  platform_subsidy: number; already_paid: number; to_pay: number;
  cash_still_held: number; wallet_balance: number;
  // All-time WAGES less all-time payouts. Cash they are holding is deliberately
  // NOT netted off - that has its own column.
  balance_all_time?: number;
}

// One rule for how money is written, shared by every screen - see
// lib/format.ts. This page used to carry its own copy.
const rs = money;

/** A balance can be negative, and "Rs -400" does not say what that means.
 *  Show the size and name the direction instead. */
function Balance({ value }: { value?: number | null }) {
  const v = Number(value) || 0;
  // Under a rupee is rounding dust, not a debt. Earnings carry paisa and a
  // payment is a whole-rupee handover, so a shop paid in full lands on
  // Rs 0.25 - and "Rs 0 overpaid" is not a sentence anyone should read on a
  // pay run. Checked against the live books on 1 September 2026: Khan
  // Restaurant sits on Rs 0.25 and SANA ULLAH on Rs -0.15, both settled.
  if (Math.abs(v) < 1) return <span className="text-takal-disabled-text">settled</span>;
  if (v < 0)
    return <span className="text-sky-700">{rs(Math.abs(v))} overpaid</span>;
  return <span className="text-amber-700 font-medium">{rs(v)}</span>;
}

const sum = <T,>(rows: T[], pick: (r: T) => number | undefined | null) =>
  rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);

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
          <h2 className="text-xl font-bold text-takal-ink">By Pay Period</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            <strong>Answers: what do I hand over today, and is anything still
            owed underneath it?</strong>{" "}
            Every row shows both. The button to record the payment is on the{" "}
            <strong>Balances &amp; Payments</strong> tab.
          </p>
          <ul className="text-takal-ink-soft mt-2 text-sm list-disc list-inside space-y-0.5">
            <li>
              <strong>TO PAY THIS PERIOD</strong> — earned on the dates chosen
              below, less what you have already paid <em>for those dates</em>.
              This is the amount to hand over. It changes when you change the
              dates.
            </li>
            <li>
              <strong>OWED ALL-TIME</strong> — everything ever earned, less
              everything ever paid. This is the balance. It does{" "}
              <strong>not</strong> change when you change the dates, and it is
              the same figure the <strong>Balances &amp; Payments</strong> tab
              shows.
            </li>
            <li>
              The <strong>TOTAL</strong> row at the foot of each table adds up
              every column above it.
            </li>
          </ul>
        </div>
        <button onClick={load} className="px-3 py-2 border border-takal-line rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Period picker */}
      <div className="border border-takal-line rounded-xl p-4 bg-white space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            className="px-3 py-2 border border-takal-line rounded-lg text-sm outline-none"
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
                className="px-3 py-2 border border-takal-line rounded-lg text-sm" />
              <span className="text-takal-disabled-text text-sm">to</span>
              <input type="date" value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="px-3 py-2 border border-takal-line rounded-lg text-sm" />
              <button onClick={load} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm">
                Show
              </button>
            </>
          )}
        </div>
        {(w.from || w.to) && (
          <p className="text-xs text-takal-ink-soft">
            Showing deliveries from <strong>{w.from}</strong> to <strong>{w.to}</strong>.
          </p>
        )}
      </div>

      {/* Headline totals */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Both figures, on the card as well as in the table. The big number
              is what to hand over for the dates chosen; the line under it is
              the whole outstanding balance, which does not move when you
              change the dates. */}
          <Card
            title="Pay to Stores"
            value={rs(stores?.totals?.to_pay ?? 0)}
            icon={<Store className="w-5 h-5" />}
            note={`All-time balance ${rs(stores?.totals?.balance_all_time ?? 0)}`}
          />
          <Card
            title="Pay to Riders"
            value={rs(riders?.totals?.to_pay ?? 0)}
            icon={<Bike className="w-5 h-5" />}
            note={`All-time balance ${rs(riders?.totals?.balance_all_time ?? 0)}`}
          />
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
      <div className="flex gap-2 border-b border-takal-line">
        {([["stores", "Stores"], ["riders", "Riders"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k ? "border-slate-900 text-takal-ink" : "border-transparent text-takal-ink-soft"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-takal-ink-soft">Loading…</p>
      ) : tab === "stores" ? (
        <Table
          empty="No store sales in this period."
          head={["Store", "Orders", "Customer paid", "Shop's price", "Your markup",
                 "Your commission", "Already paid", "TO PAY THIS PERIOD",
                 "OWED ALL-TIME"]}
          rows={(stores?.stores ?? []).map((s) => [
            <span key="n" className="font-medium text-takal-ink">
              {s.store_name}
              {/* A shop with no orders in these dates is only on the run
                  because it is still owed from an earlier one. Say so, or the
                  empty columns read as a loading fault. */}
              {s.orders === 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-takal-page text-takal-ink-soft border border-takal-line">
                  NO ORDERS THIS PERIOD
                </span>
              )}
            </span>,
            String(s.orders),
            // Older orders predate the split and report the two as one figure;
            // showing "-" is honester than printing a markup of Rs 0 that was
            // never actually calculated.
            s.customer_paid == null ? "—" : rs(s.customer_paid),
            rs(s.sold),
            <span key="m" className={(s.markup_kept ?? 0) > 0 ? "text-emerald-700 font-medium" : "text-takal-disabled-text"}>
              {s.markup_kept == null ? "—" : rs(s.markup_kept)}
            </span>,
            rs(s.commission), rs(s.already_paid),
            <strong key="p" className="text-takal-ink">{rs(s.to_pay)}</strong>,
            <Balance key="b" value={s.balance_all_time} />,
          ])}
          foot={(() => {
            const rows = stores?.stores ?? [];
            return [
              "TOTAL", String(sum(rows, (r) => r.orders)),
              rs(sum(rows, (r) => r.customer_paid)), rs(sum(rows, (r) => r.sold)),
              rs(sum(rows, (r) => r.markup_kept)), rs(sum(rows, (r) => r.commission)),
              rs(sum(rows, (r) => r.already_paid)),
              rs(sum(rows, (r) => r.to_pay)),
              <Balance key="bt" value={sum(rows, (r) => r.balance_all_time)} />,
            ];
          })()}
        />
      ) : (
        <Table
          empty="No deliveries in this period."
          head={["Rider", "Deliveries", "Cash orders", "Online orders", "Earned",
                 "Cash still held", "Already paid", "TO PAY THIS PERIOD",
                 "OWED ALL-TIME"]}
          rows={(riders?.riders ?? []).map((r) => [
            <span key="n" className="font-medium text-takal-ink">
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
            <strong key="p" className="text-takal-ink">{rs(r.to_pay)}</strong>,
            <Balance key="b" value={r.balance_all_time} />,
          ])}
          foot={(() => {
            const rows = riders?.riders ?? [];
            return [
              "TOTAL", String(sum(rows, (r) => r.deliveries)),
              `${sum(rows, (r) => r.cash_orders)} · ${rs(sum(rows, (r) => r.cash_earned))}`,
              `${sum(rows, (r) => r.online_orders)} · ${rs(sum(rows, (r) => r.online_earned))}`,
              rs(sum(rows, (r) => r.earned)),
              rs(sum(rows, (r) => r.cash_still_held)),
              rs(sum(rows, (r) => r.already_paid)),
              rs(sum(rows, (r) => r.to_pay)),
              <Balance key="bt" value={sum(rows, (r) => r.balance_all_time)} />,
            ];
          })()}
        />
      )}

      <p className="text-xs text-takal-ink-soft">
        Record the actual payment on the <strong>Balances &amp; Payments</strong>{" "}
        tab — one tab to the left, not a different page any more. Payments are
        stamped with the period, so paying last week never changes this
        week&apos;s figure — which is also why the two columns can differ.
        A row marked <strong>NO ORDERS THIS PERIOD</strong> is on the run only
        because it is still owed from an earlier one; paying this period costs
        you nothing there.
      </p>
    </div>
  );
}

function Card({ title, value, icon, warn, note }:
  { title: string; value: string; icon: React.ReactNode; warn?: boolean; note?: string }) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${warn ? "border-amber-300" : "border-takal-line"}`}>
      <div className="flex items-center gap-2 text-takal-ink-soft text-sm">{icon}{title}</div>
      <p className="text-2xl font-bold text-takal-ink mt-1">{value}</p>
      {note && <p className="text-xs text-takal-ink-soft mt-1">{note}</p>}
    </div>
  );
}

function Table({ head, rows, empty, foot }:
  { head: string[]; rows: React.ReactNode[][]; empty: string; foot?: React.ReactNode[] }) {
  if (rows.length === 0) return <p className="text-takal-disabled-text text-sm border border-dashed border-takal-line rounded-lg p-6 text-center">{empty}</p>;
  return (
    <div className="border border-takal-line rounded-xl bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-takal-ink-soft border-b border-takal-line">
            {head.map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-takal-line last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-3 whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
        {/* The TOTAL row. It has exactly as many cells as there are headings,
            because both come from lists the same length - a totals row typed
            out separately is one that ends up under the wrong heading. */}
        {foot && (
          <tfoot>
            <tr className="bg-takal-page border-t-2 border-takal-line font-bold text-takal-ink">
              {foot.map((c, j) => (
                <td key={j} className="px-4 py-3 whitespace-nowrap">{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
