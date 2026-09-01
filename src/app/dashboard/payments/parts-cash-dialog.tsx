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


export function CashHandoverDialog(props: any) {
  const { hAmount, hSaving, hTarget, money, setHAmount, setHTarget, submitHandover } = props;
  // Nothing to show unless a row is picked.
  if (!hTarget) return null;

  return (
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
                <button type="submit" disabled={hSaving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg transition disabled:opacity-50">
                  {hSaving ? "Saving..." : "Save Handover"}
                </button>
                <button type="button" onClick={() => setHTarget(null)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
  );
}
