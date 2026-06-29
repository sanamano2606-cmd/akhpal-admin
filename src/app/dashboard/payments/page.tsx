"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import { fmtDate } from "@/lib/format";

const money = (n: any) => "Rs " + Math.round(Number(n) || 0).toLocaleString();

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const dParam = period === "all" ? undefined : period;
      const recon = (await apiClient.getRestaurantPayoutReconciliation(dParam)) as any;
      setRows(recon?.restaurants || []);
      try {
        const hist = (await apiClient.getPayoutHistory()) as any;
        setHistory(hist?.history || []);
      } catch {
        setHistory([]);
      }
      try {
        const rp = (await apiClient.getRiderPayoutsReport()) as any;
        setRiderRows(rp?.payouts || []);
      } catch {
        setRiderRows([]);
      }
      try {
        const cash = (await apiClient.getRiderCashReconciliation()) as any;
        setCashRows(cash?.riders || []);
      } catch {
        setCashRows([]);
      }
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

  const [tab, setTab] = useState<"restaurants" | "riders" | "cash" | "history">("restaurants");
  const [period, setPeriod] = useState<number | "all">(30);
  const [q, setQ] = useState("");

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
          <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-600 mt-1">Restaurant settlements (last 30 days)</p>
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

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Owed to Restaurants</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">{money(totalOutstanding)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Owed to Riders</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">{money(riderOutstanding)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Commission Earned (30d)</p>
          <h3 className="text-2xl font-bold text-primary-600 mt-1">{money(commissionEarned)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-600 text-xs font-medium">Cash Owed by Riders</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{money(cashOutstanding)}</h3>
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
          value={String(period)}
          onChange={(e) => setPeriod(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          ["restaurants", "Restaurant Payouts"],
          ["riders", "Rider Payouts"],
          ["cash", "Cash (COD)"],
          ["history", "History"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Restaurant payouts tab */}
      {tab === "restaurants" && (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Restaurant Balances</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Restaurant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Orders</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Food Sales</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Commission</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Payout Due</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Paid</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Outstanding</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : fRows.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-600">No restaurant activity in this period</td></tr>
              ) : (
                fRows.map((r) => (
                  <tr key={r.restaurant_id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{r.name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.orders || 0}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.food_sales)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.commission)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.payout_due)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.paid)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{money(r.outstanding)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => openPay(r)}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Rider payouts tab */}
      {tab === "riders" && (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Rider Payouts</h3>
          <p className="text-xs text-slate-500">Delivery fees owed on online-paid orders (cash orders are settled separately).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Rider</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Owed</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Paid</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Outstanding</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : fRiderRows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">No rider earnings to settle</td></tr>
              ) : (
                fRiderRows.map((r) => (
                  <tr key={r.rider_id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{r.name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.phone || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.owed)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.paid)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{money(r.outstanding)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => openRiderPay(r)} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium">
                        Record Payout
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Cash reconciliation tab */}
      {tab === "cash" && (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Cash on Delivery — Rider Reconciliation</h3>
          <p className="text-xs text-slate-500">Cash riders collected vs handed back. "Cash Owed" is what a rider still needs to hand to the platform.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Rider</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Deliveries</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Cash Collected</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Handed Over</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Cash Owed</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : fCashRows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">No cash activity</td></tr>
              ) : (
                fCashRows.map((r) => (
                  <tr key={r.rider_id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{r.name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.deliveries || 0}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.cash_collected)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{money(r.handed_over)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{money(r.cash_outstanding)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => openHandover(r)} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium">
                        Record Handover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Payout history tab */}
      {tab === "history" && (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Recent Payouts</h3>
          {Object.keys(methodTotals).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(methodTotals).map(([m, amt]) => (
                <span key={m} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full capitalize">{m}: {money(amt)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Restaurant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Method</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Reference</th>
              </tr>
            </thead>
            <tbody>
              {fHistory.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">No payouts recorded yet</td></tr>
              ) : (
                fHistory.map((h, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {fmtDate(h.paid_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{h.restaurant_name || "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{money(h.amount)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{h.method || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{h.reference || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Record payment modal */}
      {payTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayTarget(null)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Record Payment</h3>
            <p className="text-sm text-slate-500 mb-4">{payTarget.name} — outstanding {money(payTarget.outstanding)}</p>
            <form onSubmit={submitPay} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction ID / note"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record rider payout modal */}
      {rTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRTarget(null)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Record Rider Payout</h3>
            <p className="text-sm text-slate-500 mb-4">{rTarget.name} — outstanding {money(rTarget.outstanding)}</p>
            <form onSubmit={submitRiderPay} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs)</label>
                <input type="number" min={0} step="1" value={rAmount} onChange={(e) => setRAmount(e.target.value)} required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select value={rMethod} onChange={(e) => setRMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none">
                  <option value="cash">Cash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={rSaving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50">
                  {rSaving ? "Saving..." : "Save Payout"}
                </button>
                <button type="button" onClick={() => setRTarget(null)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record cash handover modal */}
      {hTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHTarget(null)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Record Cash Handover</h3>
            <p className="text-sm text-slate-500 mb-4">{hTarget.name} — owes {money(hTarget.cash_outstanding)} in cash</p>
            <form onSubmit={submitHandover} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cash received (Rs)</label>
                <input type="number" min={0} step="1" value={hAmount} onChange={(e) => setHAmount(e.target.value)} required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={hSaving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50">
                  {hSaving ? "Saving..." : "Save Handover"}
                </button>
                <button type="button" onClick={() => setHTarget(null)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
