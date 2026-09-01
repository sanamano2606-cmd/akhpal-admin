"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";

// This page was 724 lines. The three "record a payment" windows were lifted out
// on 2026-08-30; the page keeps its address and its default export.
import { PayStoreDialog } from "./parts-store-dialog";
import { PayRiderDialog } from "./parts-rider-dialog";
import { CashHandoverDialog } from "./parts-cash-dialog";
import { RestaurantBalancesTab } from "./parts-tab-restaurants";
import { RiderPayoutsTab } from "./parts-tab-riders";
import { CashInHandTab } from "./parts-tab-cash";
import { PaymentHistoryTab } from "./parts-tab-history";
import { money, signed, signedTone } from "./money";


export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Warnings the SERVER sends when part of a money figure could not be read.
  // A payouts page whose "already paid" column failed to load shows the FULL
  // amount as still owing — which is how a vendor or rider gets paid twice.
  // The server now says so; this is where we show it.
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [tab, setTab] = useState<"restaurants" | "riders" | "cash" | "history">("restaurants");
  const [period, setPeriod] = useState<number | "all">(30);
  const [q, setQ] = useState("");
  // Real pay periods (this week / last week / your 10-day cycle), read from
  // the payout settings so this dropdown always matches how you actually pay.
  const [payPeriods, setPayPeriods] = useState<
    { label: string; from: string; to: string }[]
  >([]);
  const [payPeriodIdx, setPayPeriodIdx] = useState<number | null>(null);

  // Record-payment modal
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  // Rider payouts
  const [riderRows, setRiderRows] = useState<any[]>([]);
  const [rTarget, setRTarget] = useState<any | null>(null);
  const [rAmount, setRAmount] = useState("");
  const [rMethod, setRMethod] = useState("cash");
  const [rSaving, setRSaving] = useState(false);

  // Cash reconciliation (COD)
  const [cashRows, setCashRows] = useState<any[]>([]);
  const [hTarget, setHTarget] = useState<any | null>(null);
  const [hAmount, setHAmount] = useState("");
  const [hSaving, setHSaving] = useState(false);

  const openHandover = (r: any) => {
    setHTarget(r);
    setHAmount(String(Math.max(0, Math.round(Number(r.cash_outstanding) || 0))));
  };

  const submitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hTarget) return;
    try {
      setHSaving(true);
      await apiClient.recordCashHandover({ rider_id: hTarget.rider_id, amount: Number(hAmount), method: "cash" });
      setHTarget(null);
      toast("Cash handover recorded", "success");
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record handover", "error");
    } finally {
      setHSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const p = (await apiClient.getSettlementPeriods()) as any;
        setPayPeriods(p?.periods ?? []);
      } catch {
        /* pay periods are a convenience; the rolling windows still work */
      }
    })();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, payPeriodIdx]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const dParam = period === "all" ? undefined : period;
      const gaps: string[] = [];
      const noteGaps = (r: any) => {
        if (r?.incomplete && r?.incomplete_warning) gaps.push(r.incomplete_warning);
      };
      const recon = (await apiClient.getRestaurantPayoutReconciliation(dParam)) as any;
      noteGaps(recon);
      setRows(recon?.restaurants || []);
      try {
        const hist = (await apiClient.getPayoutHistory()) as any;
        setHistory(hist?.history || []);
      } catch {
        setHistory([]);
      }
      try {
        const rp = (await apiClient.getRiderPayoutsReport()) as any;
        noteGaps(rp);
        setRiderRows(rp?.payouts || []);
      } catch {
        setRiderRows([]);
      }
      try {
        // Was called with no arguments, so the Cash (COD) tab ignored the
        // period dropdown completely and always showed all-time figures.
        const pp = payPeriodIdx !== null ? payPeriods[payPeriodIdx] : null;
        const cash = (await apiClient.getRiderCashReconciliation(
          pp ? undefined : dParam,
          pp?.from,
          pp?.to,
        )) as any;
        noteGaps(cash);
        setCashRows(cash?.riders || []);
      } catch {
        setCashRows([]);
      }
      setIncomplete(Array.from(new Set(gaps)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const openPay = (r: any) => {
    setPayTarget(r);
    setAmount(String(Math.max(0, Math.round(Number(r.outstanding) || 0))));
    setMethod("cash");
    setReference("");
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setSaving(true);
      await apiClient.recordRestaurantPayout({
        restaurant_id: payTarget.restaurant_id,
        amount: Number(amount),
        method,
        reference: reference || undefined,
      });
      setPayTarget(null);
      toast("Payment recorded", "success");
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const openRiderPay = (r: any) => {
    setRTarget(r);
    setRAmount(String(Math.max(0, Math.round(Number(r.outstanding) || 0))));
    setRMethod("cash");
  };

  const submitRiderPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rTarget) return;
    try {
      setRSaving(true);
      await apiClient.recordRiderPayout(rTarget.rider_id, Number(rAmount), rMethod);
      setRTarget(null);
      toast("Rider payout recorded", "success");
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record payout", "error");
    } finally {
      setRSaving(false);
    }
  };

  const totalOutstanding = rows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const riderOutstanding = riderRows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
  const commissionEarned = rows.reduce((s, r) => s + (Number(r.commission) || 0), 0);
  const cashOutstanding = cashRows.reduce((s, r) => s + (Number(r.cash_outstanding) || 0), 0);

  // Search filters (per active tab) + payment-method breakdown
  const lc = q.toLowerCase();
  const fRows = rows.filter((r) => (r.name || "").toLowerCase().includes(lc));
  const fRiderRows = riderRows.filter((r) => (r.name || "").toLowerCase().includes(lc) || (r.phone || "").includes(q));
  const fCashRows = cashRows.filter((r) => (r.name || "").toLowerCase().includes(lc) || (r.phone || "").includes(q));
  const fHistory = history.filter((h) => (h.restaurant_name || "").toLowerCase().includes(lc) || (h.method || "").toLowerCase().includes(lc));
  const methodTotals = history.reduce((acc: Record<string, number>, h) => {
    const m = h.method || "other";
    acc[m] = (acc[m] || 0) + (Number(h.amount) || 0);
    return acc;
  }, {});

  const exportCurrent = () => {
    if (tab === "riders")
      downloadCsv("rider-payouts.csv", fRiderRows, [
        { key: "name", label: "Rider" }, { key: "phone", label: "Phone" },
        { key: "owed", label: "Owed" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
    else if (tab === "cash")
      downloadCsv("cash-reconciliation.csv", fCashRows, [
        { key: "name", label: "Rider" }, { key: "deliveries", label: "Deliveries" },
        { key: "cash_collected", label: "Cash Collected" }, { key: "handed_over", label: "Handed Over" },
        { key: "cash_outstanding", label: "Cash Owed" },
      ]);
    else if (tab === "history")
      downloadCsv("payout-history.csv", fHistory, [
        { key: "paid_at", label: "Date" }, { key: "restaurant_name", label: "Restaurant" },
        { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "reference", label: "Reference" },
      ]);
    else
      downloadCsv("restaurant-balances.csv", fRows, [
        { key: "name", label: "Restaurant" }, { key: "orders", label: "Orders" },
        { key: "food_sales", label: "Food Sales" }, { key: "commission", label: "Commission" },
        { key: "payout_due", label: "Payout Due" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Named "Payouts" in the sidebar: this page is money going OUT to
              stores and riders, not payments coming in from customers. */}
          <h1 className="text-3xl font-bold text-slate-900">Payouts</h1>
          <p className="text-slate-600 mt-1">
            What you owe stores and riders, and what you have already paid.
            Balances are all-time; the filter below changes the activity shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCurrent}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      {/* Part of the figures below could not be read. Say so before anyone
          pays from them, and take the pay buttons away until it is refreshed —
          a warning nobody has to act on is a warning people learn to skip. */}
      {incomplete.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 px-4 py-3 rounded-lg">
          <p className="font-semibold">⚠️ These figures are incomplete — do not pay from them yet</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {incomplete.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Colour means something here: amber = you owe it and must pay out,
            green = money you earned, red = your money still out with riders.
            These were all red before, which read as if every figure was an
            error. */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">You owe Stores</p>
          <h3 className={`text-2xl font-bold mt-1 ${signedTone(totalOutstanding, "text-amber-600")}`}>
            {signed(totalOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">You owe Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${signedTone(riderOutstanding, "text-amber-600")}`}>
            {signed(riderOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Commission you earned</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">{money(commissionEarned)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Cash still with Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${signedTone(cashOutstanding, "text-red-600")}`}>
            {signed(cashOutstanding)}
          </h3>
        </div>
        {/* This figure was already being worked out on every page load and then
            thrown away - the card that was meant to show it was never added.
            Slate, not amber or red: it is settled money, nothing to act on. */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Already paid to Stores</p>
          <h3 className="text-2xl font-bold text-slate-700 mt-1">{money(totalPaid)}</h3>
        </div>
      </div>

      {/* Toolbar: search + period */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
        />
        <select
          value={payPeriodIdx !== null ? `pp:${payPeriodIdx}` : String(period)}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("pp:")) {
              setPayPeriodIdx(Number(v.slice(3)));
            } else {
              setPayPeriodIdx(null);
              setPeriod(v === "all" ? "all" : Number(v));
            }
          }}
          className="px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
        >
          {payPeriods.length > 0 && (
            <optgroup label="Pay periods">
              {payPeriods.map((p, i) => (
                <option key={`pp-${i}`} value={`pp:${i}`}>
                  {p.label} ({p.from} to {p.to})
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Rolling windows">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value="all">All time</option>
          </optgroup>
        </select>
      </div>
      {payPeriodIdx !== null && (
        <p className="text-xs text-slate-500 -mt-1">
          Showing the pay period {payPeriods[payPeriodIdx]?.from} to{" "}
          {payPeriods[payPeriodIdx]?.to}. Balances owed are always all-time — a
          debt does not disappear because you changed the date filter.
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          ["restaurants", "Store Payouts"],
          ["riders", "Rider Payouts"],
          ["cash", "Cash (COD)"],
          ["history", "History"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? "border-primary-600 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Restaurant payouts tab */}
      {tab === "restaurants" && (
        <RestaurantBalancesTab
          fRows={fRows}
          incomplete={incomplete}
          loading={loading}
          openPay={openPay}
        />
      )}

      {/* Rider payouts tab */}
      {tab === "riders" && (
        <RiderPayoutsTab
          fRiderRows={fRiderRows}
          incomplete={incomplete}
          loading={loading}
          openRiderPay={openRiderPay}
        />
      )}

      {/* Cash reconciliation tab */}
      {tab === "cash" && (
        <CashInHandTab
          fCashRows={fCashRows}
          incomplete={incomplete}
          loading={loading}
          openHandover={openHandover}
        />
      )}

      {/* Payout history tab */}
      {tab === "history" && (
        <PaymentHistoryTab
          fHistory={fHistory}
          methodTotals={methodTotals}
        />
      )}

      {/* Record payment modal */}
      <PayStoreDialog
        amount={amount}
        method={method}
        money={money}
        payTarget={payTarget}
        reference={reference}
        saving={saving}
        setAmount={setAmount}
        setMethod={setMethod}
        setPayTarget={setPayTarget}
        setReference={setReference}
        submitPay={submitPay}
      />

      {/* Record rider payout modal */}
      <PayRiderDialog
        money={money}
        rAmount={rAmount}
        rMethod={rMethod}
        rSaving={rSaving}
        rTarget={rTarget}
        setRAmount={setRAmount}
        setRMethod={setRMethod}
        setRTarget={setRTarget}
        submitRiderPay={submitRiderPay}
      />

      {/* Record cash handover modal */}
      <CashHandoverDialog
        hAmount={hAmount}
        hSaving={hSaving}
        hTarget={hTarget}
        money={money}
        setHAmount={setHAmount}
        setHTarget={setHTarget}
        submitHandover={submitHandover}
      />
    </div>
  );
}
