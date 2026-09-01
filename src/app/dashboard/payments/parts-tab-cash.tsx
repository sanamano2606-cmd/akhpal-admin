"use client";

// Lifted out of page.tsx so that page stays readable. It is the same
// table, drawn from the same figures - it is simply handed what it
// needs instead of reading it from the page around it.
import { money } from "./money";

/// The Cash In Hand table.
export function CashInHandTab({
  fCashRows,
  incomplete,
  loading,
  openHandover,
}: {
  fCashRows: any[];
  incomplete: string[];
  loading: boolean;
  openHandover: (r: any) => void;
}) {
  return (
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
                      <button
                        disabled={incomplete.length > 0}
                        title={incomplete.length > 0
                          ? "Some figures could not be read — refresh before recording anything"
                          : undefined}
                        onClick={() => openHandover(r)}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
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
  );
}
