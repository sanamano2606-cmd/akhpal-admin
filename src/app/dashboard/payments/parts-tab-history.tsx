"use client";

// Lifted out of page.tsx so that page stays readable. It is the same
// table, drawn from the same figures - it is simply handed what it
// needs instead of reading it from the page around it.
import { money } from "./money";
import { fmtDate } from "@/lib/format";
import { isCancelled, cancelReason } from "@/lib/money-void";

/// The Payment History table, and the totals by method above it.
export function PaymentHistoryTab({
  fHistory,
  methodTotals,
  /** Main Admin only. Un-recording money is not an order-desk job: whoever can
   *  do it can make a payment that really happened look like it never did. */
  canCancel = false,
  onCancel,
}: {
  fHistory: any[];
  methodTotals: Record<string, number>;
  canCancel?: boolean;
  onCancel?: (row: any) => void;
}) {
  return (
      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="px-6 py-4 border-b border-takal-line">
          <h3 className="font-semibold text-takal-ink">Recent Payouts</h3>
          {Object.keys(methodTotals).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(methodTotals).map(([m, amt]) => (
                <span key={m} className="text-xs bg-slate-100 text-takal-ink px-2 py-1 rounded-full capitalize">{m}: {money(amt)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Restaurant</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Method</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Reference</th>
                {canCancel && (
                  <th className="px-6 py-3 text-right text-sm font-semibold text-takal-ink">
                    Put it right
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {fHistory.length === 0 ? (
                <tr><td colSpan={canCancel ? 6 : 5} className="px-6 py-8 text-center text-takal-ink-soft">No payouts recorded yet</td></tr>
              ) : (
                fHistory.map((h, i) => {
                  // A CANCELLED PAYMENT STAYS ON THIS LIST, crossed out, with
                  // the reason under it. Hiding it would make the mistake -
                  // and whoever made it - disappear, which is the one thing a
                  // payments list must never do. Money audit M3.
                  const dead = isCancelled(h);
                  return (
                  <tr key={h.id || i}
                      className={`border-b border-takal-line hover:bg-takal-page ${dead ? "bg-slate-50" : ""}`}>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft whitespace-nowrap">
                      {fmtDate(h.paid_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink">
                      {h.restaurant_name || "—"}
                      {dead && (
                        <div className="mt-1">
                          <span className="inline-block text-[11px] font-semibold uppercase tracking-wide
                                           bg-takal-red-soft text-takal-red px-2 py-0.5 rounded-full">
                            Cancelled
                          </span>
                          <div className="text-xs text-takal-ink-soft mt-1">
                            {cancelReason(h) || "no reason recorded"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm font-semibold ${dead ? "line-through text-takal-ink-soft" : "text-takal-ink"}`}>
                      {money(h.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{h.method || "—"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{h.reference || "—"}</td>
                    {canCancel && (
                      <td className="px-6 py-4 text-sm text-right">
                        {dead ? (
                          <span className="text-xs text-takal-ink-soft">already cancelled</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCancel?.(h)}
                            className="text-xs font-semibold text-takal-red hover:underline"
                          >
                            Cancel this payment
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}
