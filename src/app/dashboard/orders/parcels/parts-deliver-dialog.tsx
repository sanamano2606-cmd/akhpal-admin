// ─────────────────────────────────────────────────────────────────────────────
// The two pop-ups on the parcel desk.
//
//   HandOverDialog  - giving a parcel to a delivery person: who is taking it,
//                     and the record of that hand-over.
//   DeliverDialog   - closing a parcel at the customer's door with the code
//                     they read out, or overriding it with a written reason
//                     when the customer genuinely cannot produce it.
//
// WHY THE CODE MATTERS
// The delivery code is the only proof the parcel reached the right person. An
// override is allowed, but it must carry a reason and it is recorded - that is
// the difference between a documented exception and a hole.
//
// Split out of page.tsx on 2026-08-30. Not one line of the pop-ups changed;
// everything they use is handed in, and TypeScript refuses the page if one is
// missing.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { X } from "lucide-react";

export function DeliverDialog(props: any) {
  // `askOverride` opens the reason window. It used to be `overrideDelivery`,
  // which fired the browser's grey prompt box from inside this pop-up.
  const { code, confirmDelivery, deliverFor, askOverride, saving, setCode, setDeliverFor } = props;
  // Nothing to show unless a parcel is picked.
  if (!deliverFor) return null;

  return (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !saving && setDeliverFor(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-takal-line">
              <div className="min-w-0">
                <p className="font-mono text-xs text-takal-ink-soft">
                  #{deliverFor.id.slice(0, 8)}
                </p>
                <p className="font-bold text-takal-ink truncate">
                  {deliverFor.vendor_name ?? "Parcel"}
                </p>
                {deliverFor.delivery_address && (
                  <p className="text-xs text-takal-ink-soft truncate">
                    {deliverFor.delivery_address}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDeliverFor(null)}
                aria-label="Close"
                className="p-1.5 text-takal-disabled-text hover:text-takal-ink hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-takal-ink font-semibold text-center">
                Ask the customer for their 4-digit code
              </p>
              <p className="text-xs text-takal-ink-soft text-center mt-1">
                It is on their order screen.
              </p>
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
                inputMode="numeric"
                autoFocus
                placeholder="0000"
                className="mt-4 w-full text-center tracking-[0.6em] text-3xl font-bold py-3 border-2 border-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-takal-yellow"
              />
              <p className="text-xs text-takal-ink-soft text-center mt-3 leading-relaxed">
                The parcel is only marked delivered when the code matches.
              </p>
              <button
                onClick={askOverride}
                disabled={saving}
                className="mt-4 w-full text-xs font-semibold text-blue-700 underline disabled:opacity-50"
              >
                The customer cannot give me the code
              </button>
            </div>

            <div className="px-5 py-4 bg-takal-page border-t border-takal-line flex gap-2">
              <button
                onClick={confirmDelivery}
                disabled={saving || code.length !== 4}
                className="flex-1 px-4 py-2.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm delivery"}
              </button>
              <button
                onClick={() => setDeliverFor(null)}
                disabled={saving}
                className="px-4 py-2.5 border border-takal-line bg-white rounded-lg hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
  );
}
