"use client";

// Lifted out of page.tsx so that page stays readable. It is the same
// table, drawn from the same figures - it is simply handed what it
// needs instead of reading it from the page around it.
import { money } from "./money";

/// The Rider Payouts table.
export function RiderPayoutsTab({
  fRiderRows,
  incomplete,
  loading,
  openRiderPay,
}: {
  fRiderRows: any[];
  incomplete: string[];
  loading: boolean;
  openRiderPay: (r: any) => void;
}) {
  return (
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
                      <button
                        disabled={incomplete.length > 0}
                        title={incomplete.length > 0
                          ? "Some figures could not be read — refresh before paying"
                          : undefined}
                        onClick={() => openRiderPay(r)}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
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
  );
}
