"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";

// This page was 724 lines. The three "record a payment" windows were lifted out
// on 2026-08-30; the page keeps its address and its default export.
import { PayStoreDialog } from "./parts-store-dialog";
import { RestaurantBalancesTab } from "./parts-tab-restaurants";
import { RiderMoney } from "@/domains/riders/RiderMoney";
import { PaymentHistoryTab } from "./parts-tab-history";
import { money, signed, signedTone } from "./money";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";


export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  // Warnings the SERVER sends when part of a money figure could not be read.
  // A payouts page whose "already paid" column failed to load shows the FULL
  // amount as still owing — which is how a vendor or rider gets paid twice.
  // The server now says so; this is where we show it.
  const [incomplete, setIncomplete] = useState<string[]>([]);
  // Parts of the page that failed on their own. Kept separate from `error`,
  // which means the whole page failed.
  const [partErrors, setPartErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<"restaurants" | "riders" | "history">("restaurants");
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

  // Rider figures are still LOADED here, because the summary cards at the top
  // ("You owe Riders", "Cash still with Riders") and the CSV export both need
  // them. What is gone is the second copy of the rider TABLES and the two
  // "record it" windows - those live in one shared component now, used by both
  // this page and the Riders section. See domains/riders/RiderMoney.tsx.
  const [riderRows, setRiderRows] = useState<any[]>([]);
  const [cashRows, setCashRows] = useState<any[]>([]);

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
      setError(null);
      const dParam = period === "all" ? undefined : period;
      const gaps: string[] = [];
      // Parts of this page can fail on their own without the whole page
      // failing. Collect those so the operator is told which figures are
      // missing, instead of reading a blank tab as "nothing to pay".
      const partFailures: string[] = [];
      const noteGaps = (r: any) => {
        if (r?.incomplete && r?.incomplete_warning) gaps.push(r.incomplete_warning);
      };
      const recon = (await apiClient.getRestaurantPayoutReconciliation(dParam)) as any;
      noteGaps(recon);
      setRows(recon?.restaurants || []);
      // These three used to turn ANY failure into an empty list. On the page
      // where somebody decides who gets paid, "no payouts recorded yet" and
      // "we could not load the payouts" must never look the same.
      try {
        const hist = (await apiClient.getPayoutHistory()) as any;
        setHistory(hist?.history || []);
      } catch (err) {
        setHistory([]);
        partFailures.push(errorMessage(err, "the payout history"));
      }
      try {
        const rp = (await apiClient.getRiderPayoutsReport()) as any;
        noteGaps(rp);
        setRiderRows(rp?.payouts || []);
      } catch (err) {
        setRiderRows([]);
        partFailures.push(errorMessage(err, "what riders are owed"));
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
      } catch (err) {
        setCashRows([]);
        partFailures.push(errorMessage(err, "rider cash"));
      }
      setIncomplete(Array.from(new Set(gaps)));
      setPartErrors(partFailures);
    } catch (err) {
      setError(readFailure(err, "the payment figures"));
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
    // downloadCsv returns false when the current tab has no rows. Say so out
    // loud - a button that appears to do nothing reads as a broken button.
    let done = false;
    if (tab === "riders") {
      // Rider payouts and rider cash are one tab now, so the export covers
      // both - it used to be two separate downloads for one conversation.
      const owedOk = downloadCsv("rider-payouts.csv", fRiderRows, [
        { key: "name", label: "Rider" }, { key: "phone", label: "Phone" },
        { key: "owed", label: "Owed" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
      const cashOk = downloadCsv("rider-cash.csv", fCashRows, [
        { key: "name", label: "Rider" }, { key: "deliveries", label: "Deliveries" },
        { key: "cash_collected", label: "Cash Collected" }, { key: "handed_over", label: "Handed Over" },
        { key: "cash_outstanding", label: "Cash Still Held" },
      ]);
      done = owedOk || cashOk;
    }
    else if (tab === "history")
      done = downloadCsv("payout-history.csv", fHistory, [
        { key: "paid_at", label: "Date" }, { key: "restaurant_name", label: "Restaurant" },
        { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "reference", label: "Reference" },
      ]);
    else
      done = downloadCsv("restaurant-balances.csv", fRows, [
        { key: "name", label: "Restaurant" }, { key: "orders", label: "Orders" },
        { key: "food_sales", label: "Food Sales" }, { key: "commission", label: "Commission" },
        { key: "payout_due", label: "Payout Due" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
    if (!done) toast("Nothing to export on this tab.", "info");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Named "Payouts" in the sidebar: this page is money going OUT to
              stores and riders, not payments coming in from customers. */}
          <h2 className="text-xl font-bold text-takal-ink">Balances &amp; Payments</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            <strong>Answers: what does this shop or rider owe, all-time?</strong>{" "}
            Use this to record a payment. For what a single pay period comes to,
            use the <strong>By Pay Period</strong> tab.
          </p>
          <p className="text-takal-ink-soft mt-1">
            What you owe stores and riders, and what you have already paid.
            Balances are all-time; the filter below changes the activity shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCurrent}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchData} denied={error.denied} />
      )}

      {/* Part of the figures below could not be read. Say so before anyone
          pays from them, and take the pay buttons away until it is refreshed —
          a warning nobody has to act on is a warning people learn to skip. */}
      {/* A tab that failed to load shows an empty table, which on THIS page
          reads as "nothing to pay". Say which figures are actually missing. */}
      {partErrors.length > 0 && (
        <div className="bg-takal-orange-soft border-2 border-[#FFD2BF] text-[#C8410F] px-4 py-3 rounded-lg">
          <p className="font-semibold">⚠️ Some figures on this page did not load</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {partErrors.map((m, i) => (<li key={i}>{m}</li>))}
          </ul>
          <p className="mt-1 text-sm">
            An empty tab below does <strong>not</strong> mean there is nothing to pay.
          </p>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-takal-red hover:brightness-110 text-white rounded text-sm font-bold"
          >
            Try again
          </button>
        </div>
      )}

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

      {/* Summary.
          FIVE CARDS THAT READ "Rs 0" AFTER A FAILED READ.
          Rs 0 next to "You owe Stores" is a decision, not a blank: it says the
          shops are square. When the figures could not be read the truth is
          "not known", and these now say so. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Colour means something here: amber = you owe it and must pay out,
            green = money you earned, red = your money still out with riders.
            These were all red before, which read as if every figure was an
            error. */}
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">You owe Stores</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(totalOutstanding, "text-amber-600")}`}>
            {error ? "not known" : signed(totalOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">You owe Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(riderOutstanding, "text-amber-600")}`}>
            {error ? "not known" : signed(riderOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Commission you earned</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : "text-emerald-600"}`}>{error ? "not known" : money(commissionEarned)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Cash still with Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(cashOutstanding, "text-red-600")}`}>
            {error ? "not known" : signed(cashOutstanding)}
          </h3>
        </div>
        {/* This figure was already being worked out on every page load and then
            thrown away - the card that was meant to show it was never added.
            Slate, not amber or red: it is settled money, nothing to act on. */}
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Already paid to Stores</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : "text-takal-ink"}`}>{error ? "not known" : money(totalPaid)}</h3>
        </div>
      </div>

      {/* Toolbar: search + period */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm"
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
          className="px-3 py-2 border border-takal-line rounded-lg outline-none text-sm"
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
        <p className="text-xs text-takal-ink-soft -mt-1">
          Showing the pay period {payPeriods[payPeriodIdx]?.from} to{" "}
          {payPeriods[payPeriodIdx]?.to}. Balances owed are always all-time — a
          debt does not disappear because you changed the date filter.
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-takal-line">
        {([
          ["restaurants", "Store Payouts"],
          // "Rider Payouts" and "Cash (COD)" used to be two separate tabs here,
          // each with its own copy of a table and a dialog. They are one tab
          // now, drawn by the SAME component the Riders section uses - so a
          // rider's figures cannot read one way here and another way there.
          ["riders", "Rider Payouts & Cash"],
          ["history", "History"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? "border-takal-yellow text-takal-ink"
                : "border-transparent text-takal-ink-soft hover:text-takal-ink"
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

      {/* Rider payouts AND cash, from the one shared component. It loads its
          own figures from the same two endpoints this page used to call, and
          carries its own two "record it" windows. */}
      {tab === "riders" && (
        <RiderMoney
          period={
            payPeriodIdx !== null && payPeriods[payPeriodIdx]
              ? { kind: "period", from: payPeriods[payPeriodIdx].from, to: payPeriods[payPeriodIdx].to }
              : { kind: "days", days: period }
          }
          search={q}
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

    </div>
  );
}
