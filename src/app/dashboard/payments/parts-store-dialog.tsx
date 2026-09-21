// ─────────────────────────────────────────────────────────────────────────────
// The three "record a payment" windows on the Payments page.
//
//   PayStoreDialog     - money paid out to a shop
//   PayRiderDialog     - money paid out to a rider
//   CashHandoverDialog - cash a rider hands back to the office
//
// All three RECORD a payment that has already been made by hand - none of them
// move any money. That is deliberate: the platform is cash-only today, and a
// record of a payment that did not happen is worse than no record at all.
//
// Split out of page.tsx on 2026-08-30. Not one line of the windows changed;
// everything they use is handed in, and TypeScript refuses the page if one is
// missing.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useDialogKeys } from "@/components/ui";


export function PayStoreDialog(props: any) {
  const { amount, method, money, payTarget, reference, saving, setAmount, setMethod, setPayTarget, setReference, submitPay,
          payPeriods = [], payPeriod = "", setPayPeriod = () => {},
          payWhy = null } = props;
  useDialogKeys(!!payTarget, () => setPayTarget(null), saving);

  // Nothing to show unless a row is picked.
  if (!payTarget) return null;

  return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayTarget(null)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-takal-ink mb-1">Record Payment</h3>
            <p className="text-sm text-takal-ink-soft mb-4">{payTarget.name} — outstanding {money(payTarget.outstanding)}</p>
            <form onSubmit={submitPay} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-takal-ink mb-1">Amount (Rs)</label>
                <input
                  type="number"
                  // ONE RUPEE, NOT ZERO.  (Mock 102, 21 September 2026.)
                  // `min={0}` let a payment of Rs 0 be recorded, and the server
                  // accepts it too (amount >= 0). A Rs 0 payment is not a
                  // payment - it is a row in the books that says nothing and
                  // has to be explained later. It also matters now that the box
                  // can open EMPTY on a week with nothing to pay: without this,
                  // typing a single 0 would record one.
                  min={1}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
                />
                {/* WHERE THIS AMOUNT CAME FROM.  (Mock 102.)
                    Red when the window's figure could not be read - the screen
                    must never quietly offer an all-time amount next to a week.
                    The all-time balance is named here in every case, so an old
                    debt sitting under a quiet month can never go invisible. */}
                {payWhy && (
                  <p className={`mt-1 text-xs ${payWhy.bad ? "text-takal-red font-medium" : "text-takal-ink-soft"}`}>
                    {payWhy.text}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-takal-ink mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {/* WHICH WEEK IS THIS PAYING FOR? (money audit M2, 19 Sep 2026)
                  Without it every payment fell back to the day it was typed,
                  so the Pay Out screen went on asking for money that had
                  already been handed over - and the NEXT week came out short
                  by the same amount.
                  It is chosen by the page, not here: it starts on the window
                  the amount above was built from, and on "not for one week"
                  whenever it was not. See openPay() in page.tsx. */}
              {payPeriods.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-takal-ink mb-1">
                    Which week is this for?
                  </label>
                  <select
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                    className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
                  >
                    {payPeriods.map((p: any, i: number) => (
                      <option key={`${p.from}-${p.to}`} value={String(i)}>
                        {p.label ? `${p.label} — ` : ""}{p.from} to {p.to}
                      </option>
                    ))}
                    <option value="">Not for one week (all-time)</option>
                  </select>
                  <p className="mt-1 text-xs text-takal-ink-soft">
                    A payment that names its week counts against that week and
                    no other, so that week stops asking for the money.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-takal-ink mb-1">Reference (optional)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction ID / note"
                  className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
