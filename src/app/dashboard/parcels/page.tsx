"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package, Inbox, Truck, RefreshCw, Building2, AlertTriangle, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// The Takal office parcel desk.
//
// Standard (marketplace) orders — fashion, electronics, home goods — are never
// carried by a rider. The vendor packs the parcel and brings it to a Takal
// office; staff confirm receipt here, then send it out to the customer.
//
// Three columns mirror the physical reality of the office:
//   Awaiting drop-off : vendor has packed it, it is not here yet
//   In the office     : it is physically on our shelf
//   Sent out          : it has left for the customer
// ─────────────────────────────────────────────────────────────────────────────

interface Parcel {
  id: string;
  status: string;
  hub_received_at?: string | null;
  delivery_code?: string | null;
  total_amount?: number | string;
  created_at?: string;
  vendor_name?: string;
  vendor_phone?: string;
  receiver_name?: string;
  delivery_address?: string;
  hub_name?: string;
  hub_city?: string;
  hub_note?: string;
}

interface Hub {
  id: string;
  name: string;
  city?: string;
  address?: string;
  is_active?: boolean;
}

export default function ParcelsPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([
        apiClient.getHubParcels(hubFilter ? { hub_id: hubFilter } : {}) as Promise<{ parcels: Parcel[] }>,
        apiClient.getHubs() as Promise<{ hubs: Hub[] }>,
      ]);
      setParcels(p?.parcels ?? []);
      setHubs(h?.hubs ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load parcels", "error");
    } finally {
      setLoading(false);
    }
  }, [hubFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ── HANDING THE PARCEL OVER AT THE DOOR ───────────────────────────────────
  // The customer reads their 4-digit code out; staff type it here. The SERVER
  // checks it — see routers/orders.py. This box is not the guard, it is only
  // where the digits are typed, which is why a wrong code comes back as an
  // error from the server rather than being judged here.
  const [deliverFor, setDeliverFor] = useState<Parcel | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const confirmDelivery = async () => {
    if (!deliverFor) return;
    const digits = code.trim();
    if (digits.length !== 4) {
      toast("Enter the 4-digit code the customer reads out", "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.deliverParcel(deliverFor.id, { code: digits });
      toast("Parcel delivered", "success");
      setDeliverFor(null);
      setCode("");
      await load();
    } catch (err) {
      // A wrong code, or an order locked after repeated wrong codes, arrives
      // here as the server's own words. They are better than anything this
      // page could invent, so they are shown as they are.
      toast(err instanceof Error ? err.message : "Could not complete this parcel", "error");
    } finally {
      setSaving(false);
    }
  };

  const overrideDelivery = async () => {
    if (!deliverFor) return;
    const why = window.prompt(
      "The customer cannot give the code.\n\n" +
      "Why? (flat battery, lost phone, left with a neighbour…)\n\n" +
      "This is written onto the order with your name and cannot be removed.",
    );
    if (why === null) return;
    if (!why.trim()) {
      toast("A reason is required to close a parcel without the code", "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.deliverParcel(deliverFor.id, { bypassReason: why.trim() });
      toast("Parcel closed without the code — the reason is on the order", "success");
      setDeliverFor(null);
      setCode("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete this parcel", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetParcel = async (p: Parcel) => {
    const why = window.prompt(
      "Send this parcel back to \"Awaiting drop-off\"?\n\n" +
      "Use this for a parcel in a state nothing else can move.\n\n" +
      "Why?",
    );
    if (why === null) return;
    try {
      setBusyId(p.id);
      await apiClient.resetParcel(p.id, why.trim() || "No reason given");
      toast("Parcel sent back to Awaiting drop-off", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reset this parcel", "error");
    } finally {
      setBusyId(null);
    }
  };

  const receive = async (p: Parcel) => {
    const note = window.prompt(
      `Receiving parcel ${p.id.slice(0, 8)} from ${p.vendor_name ?? "vendor"}.\n\nShelf or rack reference (optional):`,
      p.hub_note ?? ""
    );
    if (note === null) return; // cancelled
    setBusyId(p.id);
    try {
      await apiClient.receiveParcel(p.id, {
        ...(hubFilter ? { hub_id: hubFilter } : {}),
        note,
      });
      toast("Parcel received", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not receive parcel", "error");
    } finally {
      setBusyId(null);
    }
  };

  const dispatch = async (p: Parcel) => {
    if (!window.confirm(`Send parcel ${p.id.slice(0, 8)} out to the customer?`)) return;
    setBusyId(p.id);
    try {
      await apiClient.dispatchParcel(p.id);
      toast("Parcel sent out", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send parcel out", "error");
    } finally {
      setBusyId(null);
    }
  };

  const byStatus = (s: string) => parcels.filter((p) => p.status === s);
  const awaiting = byStatus("ready");
  const inOffice = byStatus("at_hub");

  // ── WHAT COUNTS AS STUCK ──────────────────────────────────────────────────
  // Two shapes, both seen on real orders:
  //
  //   1. A rider-only status on a parcel. Riders are blocked from standard
  //      orders now, but two were claimed by testers before that guard existed
  //      and no button anywhere could touch them since.
  //   2. "On the way" with no record of ever arriving at an office. It was
  //      pushed past the desk, so the customer's tracking shows a step that
  //      never happened and nothing can close it.
  const isStuck = (p: Parcel) =>
    p.status === "on_the_way_to_restaurant" ||
    p.status === "picked_up" ||
    (p.status === "on_the_way" && !p.hub_received_at);

  const sentOut = parcels.filter((p) => p.status === "on_the_way" && !isStuck(p));
  const stuck = parcels.filter(isStuck);

  const card = (p: Parcel, action?: React.ReactNode) => (
    <div key={p.id} className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">#{p.id.slice(0, 8)}</p>
          <p className="font-semibold text-sm text-slate-900 truncate">
            {p.vendor_name ?? "Unknown vendor"}
          </p>
        </div>
        {p.hub_city && (
          <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {p.hub_city}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-slate-600">
        {p.vendor_phone && <p>Vendor: {p.vendor_phone}</p>}
        {p.receiver_name && <p>To: {p.receiver_name}</p>}
        {p.delivery_address && <p className="truncate">{p.delivery_address}</p>}
        {p.hub_note && <p className="text-slate-900">Shelf: {p.hub_note}</p>}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );

  const column = (
    title: string,
    icon: React.ReactNode,
    items: Parcel[],
    empty: string,
    action?: (p: Parcel) => React.ReactNode
  ) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">
            {empty}
          </p>
        ) : (
          items.map((p) => card(p, action?.(p)))
        )}
      </div>
    </div>
  );

  const btn = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Parcels</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Standard (marketplace) orders handled through a Takal office. Quick
            food orders go straight to a rider and never appear here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
          >
            <option value="">All offices</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {hubs.length === 0 && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">No Takal office is set up yet.</p>
            <p>
              Standard orders have nowhere to be routed. Add an office in
              Settings before taking marketplace orders.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading parcels…</p>
      ) : (
        <div className="flex gap-6 flex-col lg:flex-row">
          {column(
            "Awaiting drop-off",
            <Package className="w-5 h-5 text-amber-600" />,
            awaiting,
            "Nothing waiting to come in.",
            (p) => btn("Mark received", () => receive(p), busyId === p.id)
          )}
          {column(
            "In the office",
            <Inbox className="w-5 h-5 text-blue-600" />,
            inOffice,
            "No parcels on the shelf.",
            (p) => btn("Send out", () => dispatch(p), busyId === p.id)
          )}
          {column(
            "Sent out",
            <Truck className="w-5 h-5 text-green-600" />,
            sentOut,
            "Nothing out for delivery.",
            // THE BUTTON THAT WAS MISSING.
            // This column had no action at all, so a parcel that left the
            // office could never be completed: the customer's tracking never
            // reached "Delivered" and the sale never counted as finished.
            (p) => btn("Mark delivered", () => { setDeliverFor(p); setCode(""); },
                       busyId === p.id)
          )}
          {stuck.length > 0 &&
            column(
              "Stuck",
              <AlertTriangle className="w-5 h-5 text-amber-600" />,
              stuck,
              "",
              (p) => btn("Send back to Awaiting drop-off",
                         () => resetParcel(p), busyId === p.id)
            )}
        </div>
      )}

      {/* ── Handing the parcel over ─────────────────────────────────────── */}
      {deliverFor && (
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
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">
                  #{deliverFor.id.slice(0, 8)}
                </p>
                <p className="font-bold text-slate-900 truncate">
                  {deliverFor.vendor_name ?? "Parcel"}
                </p>
                {deliverFor.delivery_address && (
                  <p className="text-xs text-slate-500 truncate">
                    {deliverFor.delivery_address}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDeliverFor(null)}
                aria-label="Close"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-slate-900 font-semibold text-center">
                Ask the customer for their 4-digit code
              </p>
              <p className="text-xs text-slate-500 text-center mt-1">
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
                className="mt-4 w-full text-center tracking-[0.6em] text-3xl font-bold py-3 border-2 border-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-primary-600"
              />
              <p className="text-xs text-slate-500 text-center mt-3 leading-relaxed">
                The parcel is only marked delivered when the code matches.
              </p>
              <button
                onClick={overrideDelivery}
                disabled={saving}
                className="mt-4 w-full text-xs font-semibold text-blue-700 underline disabled:opacity-50"
              >
                The customer cannot give me the code
              </button>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={confirmDelivery}
                disabled={saving || code.length !== 4}
                className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-slate-900 font-semibold rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm delivery"}
              </button>
              <button
                onClick={() => setDeliverFor(null)}
                disabled={saving}
                className="px-4 py-2.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
