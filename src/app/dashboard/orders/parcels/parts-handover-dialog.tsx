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

import { X, AlertTriangle } from "lucide-react";
import { ErrorState, useDialogKeys } from "@/components/ui";

export function HandOverDialog(props: any) {
  const { busyId, confirmHandOver, handOverFor, pickedStaff, setHandOverFor, setPickedStaff, staff, staffError, staffLoading } = props;
  useDialogKeys(!!handOverFor, () => setHandOverFor(null), busyId === handOverFor?.id);

  // Nothing to show unless a parcel is picked.
  if (!handOverFor) return null;

  return (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          // THE ONLY WAY OUT OF THIS WINDOW WAS A 24px X IN THE CORNER.
          // No Escape, no click outside. Both work now, unless the hand-over
          // is already being recorded.
          onClick={() => { if (busyId !== handOverFor.id) setHandOverFor(null); }}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-takal-ink">
                Hand over parcel #{handOverFor.id.slice(0, 8)}
              </h2>
              <button
                onClick={() => setHandOverFor(null)}
                className="p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100 hover:text-takal-ink"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-takal-ink-soft mb-4">
              Who is taking this parcel out right now?
            </p>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Careful.</span> Whoever you pick
                becomes responsible for this parcel. The time is recorded and
                cannot be edited later.
              </p>
            </div>

            {staffLoading ? (
              <p className="text-sm text-takal-ink-soft py-6 text-center">
                Loading staff…
              </p>
            ) : staffError ? (
              // A FAILED READ MUST NOT BECOME A FACT ABOUT THE STAFF.
              // This used to fall through to "Nobody can be given parcels yet",
              // which sends the clerk to the Admin Users page to fix a
              // permission that was never broken.
              <div className="mb-4">
                <ErrorState message={staffError.message} denied={staffError.denied} />
              </div>
            ) : staff.length === 0 ? (
              <div className="text-sm text-takal-ink-soft border border-dashed border-takal-line rounded-lg p-4">
                <p className="font-semibold text-takal-ink mb-1">
                  Nobody can be given parcels yet.
                </p>
                <p>
                  Give a staff account the <b>Delivery</b> permission on the
                  Admin Users page, then come back.
                </p>
              </div>
            ) : (
              <div className="border border-takal-line rounded-xl overflow-hidden mb-4">
                {staff.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setPickedStaff(m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-takal-line last:border-b-0 transition ${
                      pickedStaff === m.id ? "bg-takal-yellow" : "hover:bg-takal-page"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${
                        pickedStaff === m.id
                          ? "bg-takal-yellow text-takal-ink"
                          : "bg-slate-200 text-takal-ink-soft"
                      }`}
                    >
                      {m.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-takal-ink truncate">
                        {m.name}
                      </span>
                      {/* The load, in words. "3" beside a name is ambiguous;
                          the clerk should not have to guess what it counts. */}
                      <span className="block text-xs text-takal-ink-soft">
                        {m.carrying === 0
                          ? "Free — carrying nothing"
                          : m.carrying === 1
                          ? "Carrying 1 parcel now"
                          : `Carrying ${m.carrying} parcels now`}
                      </span>
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                        pickedStaff === m.id
                          ? "border-slate-900 bg-takal-yellow"
                          : "border-takal-line"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={confirmHandOver}
              disabled={!pickedStaff || busyId === handOverFor.id}
              className="w-full py-3.5 bg-takal-yellow text-takal-ink font-bold rounded-lg hover:bg-takal-yellow-dark transition disabled:opacity-50"
            >
              {busyId === handOverFor.id ? "Please wait…" : "Hand over"}
            </button>
            <button
              onClick={() => setHandOverFor(null)}
              className="w-full mt-3 py-2 text-sm text-takal-ink-soft hover:text-takal-ink"
            >
              Cancel
            </button>
          </div>
        </div>
  );

}
