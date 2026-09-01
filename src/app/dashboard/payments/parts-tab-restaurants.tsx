"use client";

// Lifted out of page.tsx so that page stays readable. It is the same
// table, drawn from the same figures - it is simply handed what it
// needs instead of reading it from the page around it.
import { SkeletonRows } from "@/components/Skeletons";
import { money } from "./money";

/// The Restaurant Balances table.
export function RestaurantBalancesTab({
  fRows,
  incomplete,
  loading,
  openPay,
}: {
  fRows: any[];
  incomplete: string[];
  loading: boolean;
  openPay: (r: any) => void;
}) {
  return (
      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="px-6 py-4 border-b border-takal-line">
          <h3 className="font-semibold text-takal-ink">Restaurant Balances</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Restaurant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Orders</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Food Sales</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Commission</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Payout Due</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Paid</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Outstanding</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={8} />
              ) : fRows.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-takal-ink-soft">No restaurant activity in this period</td></tr>
              ) : (
                fRows.map((r) => (
                  <tr key={r.restaurant_id} className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">{r.name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{r.orders || 0}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{money(r.food_sales)}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{money(r.commission)}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{money(r.payout_due)}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{money(r.paid)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">{money(r.outstanding)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        disabled={incomplete.length > 0}
                        title={incomplete.length > 0
                          ? "Some figures could not be read — refresh before paying"
                          : undefined}
                        onClick={() => openPay(r)}
                        className="px-3 py-1.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
  );
}
