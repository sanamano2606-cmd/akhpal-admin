"use client";

// Lifted out of page.tsx so that page stays readable. It is the same
// table, drawn from the same figures - it is simply handed what it
// needs instead of reading it from the page around it.
import { money } from "./money";
import { fmtDate } from "@/lib/format";

/// The Payment History table, and the totals by method above it.
export function PaymentHistoryTab({
  fHistory,
  methodTotals,
}: {
  fHistory: any[];
  methodTotals: Record<string, number>;
}) {
  return (
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
  );
}
