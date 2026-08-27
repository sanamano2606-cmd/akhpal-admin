"use client";

import { useState, useEffect, useCallback } from "react";
import { Truck, RefreshCw, Phone, CheckCircle2, X, MapPin } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// MY DELIVERIES — the whole panel, for one job.
//
// This page exists because "Orders" was the smallest key we had, and it was far
// too big. Handing it to a delivery man opened the full Orders page with every
// customer's name, phone number and address, plus Returns and the office parcel
// desk, and let him rewrite the status of any order in the system. He needs one
// list and one button.
//
// So he gets the "delivery" permission instead, which unlocks this page and
// nothing else — not in the menu, and not by typing the address either: the
// server refuses every other /admin/ path for him, and refuses any order move
// except marking a Takal parcel delivered with the customer's code.
//
// Deliberately plain. No money totals, no charts, no filters, no counts of
// other people's work. A page used standing in the street with one hand full
// should ask one question and take one answer.
// ─────────────────────────────────────────────────────────────────────────────

interface Parcel {
  id: string;
  status: string;
  delivery_code?: string | null;
  total_amount?: number | string;
  payment_method?: string | null;
  payment_status?: string | null;
  // The account holder.
  customer_name?: string | null;
  customer_phone?: string | null;
  // "Ordering for someone else" — the person actually at the door. Kept apart
  // from the customer on purpose: hand the parcel to one, ring the other if
  // nobody answers.
  receiver_name?: string | null;
  receiver_phone?: string | null;
  delivery_address?: string | null;
  address_details?: string | null;   // flat number, floor, landmark
  address_type?: string | null;      // Home / Office / Other
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  notes?: string | null;             // what the customer typed at checkout
  is_pickup?: boolean;
  vendor_name?: string | null;
  created_at?: string;
}

const rs = (n: unknown) =>
  "Rs " + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const shortId = (id: string) => "#" + String(id).replace(/-/g, "").slice(0, 6).toUpperCase();

/** Where to send Google Maps for this parcel.
 *
 * The saved pin wins over the typed address, always. Addresses around here are
 * written as landmarks — "near Gul Kada Chowk", "behind the girls college" —
 * which a map search either guesses at or drops in the wrong town. The pin is
 * the point the customer actually placed on the map at checkout.
 *
 * Falls back to searching the words only when there is no pin. Returns null
 * when there is neither, so the card shows plain text instead of a link that
 * opens an empty map.
 */
const mapsLink = (p: Parcel): string | null => {
  const lat = Number(p.delivery_latitude);
  const lng = Number(p.delivery_longitude);
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const text = (p.delivery_address || "").trim();
  if (text) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  }
  return null;
};

/** The name to put at the top of the card: whoever will be standing at the
 *  door. On an "ordering for someone else" parcel that is not the customer. */
const doorName = (p: Parcel) =>
  (p.receiver_name || "").trim() || (p.customer_name || "").trim() || "Customer";

export default function MyDeliveriesPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Parcel | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      // mine: only the parcels handed to THIS person. The server decides that,
      // not this page — see the note on the `mine` filter in the backend.
      const p = (await apiClient.getHubParcels({
        status: "on_the_way",
        mine: true,
      })) as { parcels: Parcel[] };
      // A self-pickup parcel is not a delivery. The customer walks to the
      // office and collects it at the counter, so it belongs on the office
      // Parcels desk and nowhere near a man on a bike — his list must contain
      // only jobs he can actually go and do.
      setParcels((p?.parcels ?? []).filter((row) => !row.is_pickup));
    } catch {
      toast("Could not load your deliveries. Check your internet.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset the box every time it opens, so yesterday's digits are never sitting
  // in the field waiting to be sent for a different customer.
  const openFor = (p: Parcel) => {
    setCode("");
    setErr("");
    setOpen(p);
  };

  const confirm = async () => {
    if (!open) return;
    const c = code.trim();
    if (c.length !== 4) {
      setErr("The code is 4 digits. Ask the customer to read it out again.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await apiClient.deliverParcel(open.id, { code: c });
      toast("Delivered. Thank you.", "success");
      setOpen(null);
      setParcels((rows) => rows.filter((r) => r.id !== open.id));
    } catch (e: unknown) {
      // The server's words, not ours. It is the side that knows whether the
      // code was wrong, whether the order is locked after too many tries, and
      // how long the wait is — inventing a friendlier message here would only
      // hide which of those actually happened.
      setErr(e instanceof Error ? e.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Deliveries</h1>
          <p className="text-slate-600 mt-1">
            The parcels the office has handed to you.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* HIS OWN RUNNING TOTAL.
          He is the one who has to hand the cash back at the office, so he
          should be able to see what he owes without counting cards by eye.
          Only the parcels still in his bag — what he has already delivered is
          settled and would only confuse the figure he is checking. */}
      {!loading && parcels.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Parcels with you</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{parcels.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Cash to collect in total</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {rs(
                parcels.reduce(
                  (sum, p) =>
                    // Already paid online owes nothing. Adding it in would have
                    // him carrying a figure he can never hand back.
                    sum + (p.payment_status === "paid" ? 0 : Number(p.total_amount) || 0),
                  0
                )
              )}
            </p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4">
        <p className="text-sm text-amber-900">
          <span className="font-bold">Ask the customer for their 4-digit code</span>{" "}
          before you hand the parcel over. Type it in to close the job.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : parcels.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Truck className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            You have no parcels right now
          </h2>
          <p className="text-sm text-slate-600">
            When the office hands you a parcel, it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {parcels.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-400 tracking-wide">{shortId(p.id)}</p>
                  {p.address_type && (
                    <span className="text-[10px] font-bold tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 uppercase">
                      {p.address_type}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{doorName(p)}</h3>

                {/* The phone number, written out. A tap dials it; a glance
                    reads it out to somebody else. Hiding it behind an icon
                    would have meant the number could not be read aloud down a
                    second phone. */}
                {(p.receiver_phone || p.customer_phone) && (
                  <a
                    href={`tel:${p.receiver_phone || p.customer_phone}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 mt-1 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {p.receiver_phone || p.customer_phone}
                  </a>
                )}

                {/* Ordering for someone else: the account holder is a different
                    person, and is the one to ring when nobody comes to the
                    door. Shown only when the two really differ, so the ordinary
                    parcel is not cluttered with a repeat of the same name. */}
                {p.receiver_name && p.customer_name &&
                 p.receiver_name.trim() !== p.customer_name.trim() && (
                  <p className="text-xs text-slate-500 mt-1">
                    Ordered by {p.customer_name}
                    {p.customer_phone && p.customer_phone !== p.receiver_phone && (
                      <>
                        {" · "}
                        <a href={`tel:${p.customer_phone}`} className="underline">
                          {p.customer_phone}
                        </a>
                      </>
                    )}
                  </p>
                )}

                {/* THE ADDRESS, AND A WAY TO GET THERE.
                    Tapping it opens Google Maps on the saved pin. Typed
                    addresses here are landmarks rather than street numbers, so
                    reading them is not the same as finding them. */}
                <div className="mt-2.5">
                  {mapsLink(p) ? (
                    <a
                      href={mapsLink(p) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-2 text-sm text-slate-700 hover:text-slate-900"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 flex-none text-red-600" />
                      <span className="leading-relaxed underline decoration-slate-300 group-hover:decoration-slate-900">
                        {p.delivery_address || "Open the saved location"}
                        {p.address_details && (
                          <span className="block text-slate-500 no-underline">
                            {p.address_details}
                          </span>
                        )}
                        <span className="block text-xs text-slate-400 no-underline mt-0.5">
                          Tap to open in Google Maps
                        </span>
                      </span>
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500 leading-relaxed">
                      No address on this order — phone the customer.
                    </p>
                  )}
                </div>

                {/* What the customer typed at checkout: gate colour, which
                    floor, do not knock after 9. It is written for whoever
                    arrives, and he is the one who arrives. */}
                {p.notes && p.notes.trim() && (
                  <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">
                      NOTE FROM THE CUSTOMER
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">{p.notes}</p>
                  </div>
                )}

                <p className="text-sm text-slate-500 mt-2.5">
                  Cash to collect:{" "}
                  <span className="font-bold text-slate-900">
                    {p.payment_status === "paid" ? "Rs 0" : rs(p.total_amount)}
                  </span>
                  {p.payment_status === "paid" && " — already paid online"}
                </p>
              </div>

              <button
                onClick={() => openFor(p)}
                className="w-full sm:w-auto px-6 py-3.5 bg-primary-600 text-slate-900 font-bold rounded-lg hover:bg-primary-700 transition whitespace-nowrap"
              >
                Mark delivered
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-slate-900">Delivery code</h2>
              <button
                onClick={() => setOpen(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Ask <span className="font-semibold">{open.receiver_name || "the customer"}</span>{" "}
              for the 4-digit code shown in their app, then type it here.
            </p>

            <input
              value={code}
              onChange={(e) => {
                // Digits only. A stray space or dash from a phone keyboard would
                // be refused by the server and read to the man in the street as
                // "the customer gave me a wrong code".
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                setErr("");
              }}
              inputMode="numeric"
              autoFocus
              placeholder="0000"
              className="w-full text-center text-3xl font-bold tracking-[0.6em] indent-[0.6em] border-2 border-slate-900 rounded-xl py-4 outline-none"
            />

            {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

            <button
              onClick={confirm}
              disabled={busy}
              className="w-full mt-5 py-3.5 bg-primary-600 text-slate-900 font-bold rounded-lg hover:bg-primary-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {busy ? "Please wait…" : "Confirm delivery"}
            </button>

            <button
              onClick={() => setOpen(null)}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>

            {/* No override link here on purpose. A full admin at the office can
                close a parcel without a code and have it recorded against their
                name; the person carrying the parcel cannot excuse himself from
                the one check that exists to watch him. If the code truly cannot
                be given, he phones the office. */}
            <p className="text-xs text-slate-400 mt-4 text-center leading-relaxed">
              If the customer cannot give you the code, phone the office. Only
              the office can close a parcel without it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
