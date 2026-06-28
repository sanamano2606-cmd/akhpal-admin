"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const recon = (await apiClient.getRestaurantPayoutReconciliation(30)) as any;
      setRows(recon?.restaurants || []);
      try {
        const hist = (await apiClient.getPayoutHistory()) as any;
        setHistory(hist?.history || []);
      } catch {
        setHistory([]);
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
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = rows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (Number(r.paid) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-600 mt-1">Restaurant settlements (last 30 days)</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Outstanding to Restaurants</p>
          <h3 className="text-3xl font-bold text-red-600 mt-2">{money(totalOutstanding)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Already Paid (30 days)</p>
          <h3 className="text-3xl font-bold text-green-600 mt-2">{money(totalPaid)}</h3>
        </div>
      </div>

      {/* Reconciliation table */}
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
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-600">No restaurant activity in this period</td></tr>
              ) : (
                rows.map((r) => (
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

      {/* Payout history */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Recent Payouts</h3>
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
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">No payouts recorded yet</td></tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {h.paid_at ? new Date(h.paid_at).toLocaleDateString() : "—"}
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
    </div>
  );
}
