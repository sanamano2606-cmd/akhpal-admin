"use client";

import { useState, useEffect, useCallback } from "react";
import { Truck, RefreshCw, Phone, CheckCircle2, X } from "lucide-react";
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
  receiver_name?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  created_at?: string;
}

const rs = (n: unknown) =>
  "Rs " + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const shortId = (id: string) => "#" + String(id).replace(/-/g, "").slice(0, 6).toUpperCase();

export default function MyDeliveriesPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Parcel | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const p = (await apiClient.getHubParcels({ status: "on_the_way" })) as {
        parcels: Parcel[];
      };
      setParcels(p?.parcels ?? []);
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
            Parcels that are out for delivery right now.
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
            No parcels out at the moment
          </h2>
          <p className="text-sm text-slate-600">
            When the office sends a parcel out, it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {parcels.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 tracking-wide">{shortId(p.id)}</p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {p.receiver_name || p.customer_name || "Customer"}
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {p.delivery_address || "No address on this order"}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Cash to collect:{" "}
                  <span className="font-bold text-slate-900">
                    {p.payment_status === "paid" ? "Rs 0" : rs(p.total_amount)}
                  </span>
                  {p.payment_status === "paid" && " — already paid"}
                </p>
              </div>

              {p.customer_phone && (
                <a
                  href={`tel:${p.customer_phone}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              )}

              <button
                onClick={() => openFor(p)}
                className="px-6 py-3 bg-primary-600 text-slate-900 font-bold rounded-lg hover:bg-primary-700 transition whitespace-nowrap"
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
