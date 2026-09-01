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

export function HandOverDialog(props: any) {
  const { busyId, confirmHandOver, handOverFor, pickedStaff, setHandOverFor, setPickedStaff, staff, staffLoading } = props;
  // Nothing to show unless a parcel is picked.
  if (!handOverFor) return null;

  return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-slate-900">
                Hand over parcel #{handOverFor.id.slice(0, 8)}
              </h2>
              <button
                onClick={() => setHandOverFor(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
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
              <p className="text-sm text-slate-500 py-6 text-center">
                Loading staff…
              </p>
            ) : staff.length === 0 ? (
              <div className="text-sm text-slate-600 border border-dashed border-slate-300 rounded-lg p-4">
                <p className="font-semibold text-slate-900 mb-1">
                  Nobody can be given parcels yet.
                </p>
                <p>
                  Give a staff account the <b>Delivery</b> permission on the
                  Admin Users page, then come back.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                {staff.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setPickedStaff(m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-slate-100 last:border-b-0 transition ${
                      pickedStaff === m.id ? "bg-primary-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${
                        pickedStaff === m.id
                          ? "bg-primary-600 text-slate-900"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {m.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 truncate">
                        {m.name}
                      </span>
                      {/* The load, in words. "3" beside a name is ambiguous;
                          the clerk should not have to guess what it counts. */}
                      <span className="block text-xs text-slate-500">
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
                          ? "border-slate-900 bg-primary-600"
                          : "border-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={confirmHandOver}
              disabled={!pickedStaff || busyId === handOverFor.id}
              className="w-full py-3.5 bg-primary-600 text-slate-900 font-bold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {busyId === handOverFor.id ? "Please wait…" : "Hand over"}
            </button>
            <button
              onClick={() => setHandOverFor(null)}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
  );

}
