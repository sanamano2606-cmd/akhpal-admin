"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package, Inbox, Truck, RefreshCw, Building2, AlertTriangle, Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// This page was 732 lines. The two pop-ups were lifted out on 2026-08-30; the
// page keeps its address and its default export, so no link changed.
import { HandOverDialog } from "./parts-handover-dialog";
import { DeliverDialog } from "./parts-deliver-dialog";
import { AskDialog } from "./parts-ask-dialog";
import { money } from "@/lib/format";

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

/** HOW LONG THIS PARCEL HAS BEEN SITTING, and with whom.
 *
 * The whole point of this desk. A parcel with Rs 3,400 of somebody's cash on
 * it, sitting with one person for twenty-six hours, should be impossible to
 * miss - and until 2 September 2026 nothing on this screen said how long
 * anything had been anywhere.
 *
 * The clock starts at whichever of these actually applies: sent out from the
 * office, received into the office, or placed. */
function heldFor(p: {
  status?: string;
  hub_dispatched_at?: string | null;
  hub_received_at?: string | null;
  created_at?: string;
}): { text: string; minutes: number; tooLong: boolean } | null {
  const since =
    p.status === "on_the_way"
      ? p.hub_dispatched_at
      : p.hub_received_at || p.created_at;
  if (!since) return null;
  const ms = Date.now() - new Date(since).getTime();
  if (!isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const text = h >= 24
    ? `${Math.floor(h / 24)} d ${h % 24} h`
    : h >= 1
    ? `${h} h ${minutes % 60} m`
    : `${minutes} m`;
  // A day is the line. An office holding a parcel overnight is normal; two
  // nights is somebody having forgotten it.
  return { text, minutes, tooLong: minutes > 24 * 60 };
}

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
  handed_to_id?: string | null;
  handed_to_name?: string | null;
  hub_dispatched_at?: string | null;
}

/** One member of staff, and their day.
 *
 *  value = what the parcels are worth. cash = what they should be walking back
 *  in with. They are different numbers: an order paid online is worth Rs 4,000
 *  and owes the till nothing, so a single "total" would have somebody signing
 *  for money they were never given. */
interface Staff {
  id: string;
  name: string;
  still_here: boolean;
  handed: number;
  handed_value: number;
  handed_cash: number;
  delivered: number;
  delivered_value: number;
  delivered_cash: number;
  carrying: number;
  carrying_value: number;
  carrying_cash: number;
}

// One rule for how money is written, shared by every screen - see
// lib/format.ts. This page used to carry its own copy.
const rs = money;

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
  // The hand-over dialog: which parcel is going out, who is available, and who
  // the clerk has picked.
  const [handOverFor, setHandOverFor] = useState<Parcel | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [pickedStaff, setPickedStaff] = useState<string>("");
  // The day sheet shown on the page itself, refreshed with the parcels.
  const [sheet, setSheet] = useState<Staff[]>([]);

  const load = useCallback(async () => {
    try {
      const [p, h, st] = await Promise.all([
        apiClient.getHubParcels(hubFilter ? { hub_id: hubFilter } : {}) as Promise<{ parcels: Parcel[] }>,
        apiClient.getHubs() as Promise<{ hubs: Hub[] }>,
        // The day sheet rides along with the same refresh. If it were fetched
        // separately the two halves of the screen could disagree — a parcel
        // showing as handed over in one place and not counted in the other.
        apiClient.getDeliveryStaff().catch(() => null) as Promise<{ staff: Staff[] } | null>,
      ]);
      setParcels(p?.parcels ?? []);
      setHubs(h?.hubs ?? []);
      setSheet(st?.staff ?? []);
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
  // The three windows that replaced the browser's grey prompt boxes.
  const [receiveFor, setReceiveFor] = useState<Parcel | null>(null);
  const [resetFor, setResetFor] = useState<Parcel | null>(null);
  const [askOverride, setAskOverride] = useState(false);
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

  // WHY THIS NO LONGER ASKS window.prompt().
  //
  // Closing a parcel WITHOUT the customer's code is the single most serious
  // thing anybody does on this screen - it is the protection that stops a
  // delivery being marked done from somebody's sofa. It was being authorised
  // in the browser's grey box, which cannot show which parcel it is, cannot be
  // styled, and on some browsers does not appear at all - in which case the
  // button silently did nothing.
  const overrideDelivery = async (why: string) => {
    if (!deliverFor) return;
    if (!why.trim()) {
      toast("A reason is required to close a parcel without the code", "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.deliverParcel(deliverFor.id, { bypassReason: why.trim() });
      toast("Parcel closed without the code — the reason is on the order", "success");
      setAskOverride(false);
      setDeliverFor(null);
      setCode("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete this parcel", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetParcel = async (why: string) => {
    const p = resetFor;
    if (!p) return;
    try {
      setBusyId(p.id);
      await apiClient.resetParcel(p.id, why.trim() || "No reason given");
      toast("Parcel sent back to Awaiting drop-off", "success");
      setResetFor(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reset this parcel", "error");
    } finally {
      setBusyId(null);
    }
  };

  const receive = async (note: string) => {
    const p = receiveFor;
    if (!p) return;
    setBusyId(p.id);
    try {
      await apiClient.receiveParcel(p.id, {
        ...(hubFilter ? { hub_id: hubFilter } : {}),
        note,
      });
      toast("Parcel received", "success");
      setReceiveFor(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not receive parcel", "error");
    } finally {
      setBusyId(null);
    }
  };


  // SENDING A PARCEL OUT NOW ASKS WHO IS TAKING IT.
  //
  // This used to be a plain "are you sure?" box. The parcel left, the time was
  // recorded, and the office had no idea who was carrying it — so a parcel that
  // went missing left a timestamp and a shrug. The question "who has it?" is
  // now answered on every parcel that is out.
  //
  // The staff list is fetched when the dialog opens rather than kept on the
  // page, because the "carrying" counts go stale the moment somebody else hands
  // a parcel over, and a stale count is worse than no count — it is the number
  // the clerk would decide by.
  const openHandOver = async (p: Parcel) => {
    setHandOverFor(p);
    setPickedStaff("");
    setStaffLoading(true);
    try {
      // Fetched fresh even though the page already holds a copy: the counts go
      // stale the moment somebody else hands a parcel over, and a stale count
      // is worse than none — it is the number the clerk decides by.
      const r = (await apiClient.getDeliveryStaff()) as { staff: Staff[] };
      setStaff((r?.staff ?? []).filter((m) => m.still_here));
    } catch {
      toast("Could not load the staff list", "error");
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const confirmHandOver = async () => {
    if (!handOverFor || !pickedStaff) return;
    setBusyId(handOverFor.id);
    try {
      await apiClient.dispatchParcel(handOverFor.id, pickedStaff);
      const who = staff.find((x) => x.id === pickedStaff)?.name ?? "staff";
      toast(`Handed to ${who}`, "success");
      setHandOverFor(null);
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
    <div key={p.id} className="border border-takal-line rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-takal-ink-soft">#{p.id.slice(0, 8)}</p>
          <p className="font-semibold text-sm text-takal-ink truncate">
            {p.vendor_name ?? "Unknown vendor"}
          </p>
        </div>
        {p.hub_city && (
          <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-takal-ink-soft">
            {p.hub_city}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-takal-ink-soft">
        {p.vendor_phone && <p>Vendor: {p.vendor_phone}</p>}
        {p.receiver_name && <p>To: {p.receiver_name}</p>}
        {p.delivery_address && <p className="truncate">{p.delivery_address}</p>}
        {p.hub_note && <p className="text-takal-ink">Shelf: {p.hub_note}</p>}
      </div>
      {/* WHO IS CARRYING IT.
          Shown as a badge rather than another grey line, because on a wall of
          look-alike cards this is the one thing being scanned for: "who has
          the Rahimabad parcel?" */}
      {/* HELD FOR, and what it is worth. The two numbers this desk is for. */}
      {(() => {
        const held = heldFor(p);
        const worth = Number(p.total_amount || 0);
        if (!held && !worth) return null;
        return (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-takal-page px-2.5 py-1.5">
            {held ? (
              <span className={`text-[11.5px] font-bold ${held.tooLong ? "text-takal-red" : "text-takal-ink-soft"}`}>
                {held.tooLong ? "Held too long · " : "Held "}
                {held.text}
              </span>
            ) : <span />}
            {worth ? (
              <span className="text-[11.5px] font-bold text-takal-ink">
                {rs(worth)}
              </span>
            ) : null}
          </div>
        );
      })()}
      {p.handed_to_name && (
        <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-100 rounded-full pl-1 pr-2.5 py-1">
          <span className="w-5 h-5 rounded-full bg-takal-yellow text-takal-ink text-[10px] font-bold flex items-center justify-center">
            {p.handed_to_name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="text-[11px] font-semibold text-takal-ink">
            With {p.handed_to_name}
          </span>
        </div>
      )}
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
        <h2 className="font-semibold text-takal-ink">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-takal-ink-soft">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-takal-disabled-text border border-dashed border-takal-line rounded-lg p-4 text-center">
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
          <h2 className="text-xl font-bold text-takal-ink">Parcels</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            Standard (marketplace) orders handled through a Takal office. Quick
            food orders go straight to a rider and never appear here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="px-3 py-2 border border-takal-line rounded-lg text-sm outline-none"
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
            className="px-3 py-2 border border-takal-line rounded-lg text-sm flex items-center gap-2"
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

      {/* ── TODAY'S DELIVERY STAFF ─────────────────────────────────────────
          The cash-up sheet. At close of business the question is not "how many
          parcels" but "how much money should be walking back through the
          door", and working that out by reading a list of orders is how cash
          goes missing quietly.

          Only people with something on today appear. A row per person who is
          simply available would bury the two who actually went out. */}
      {sheet.some((m) => m.handed || m.delivered || m.carrying) && (
        <div className="bg-white border border-takal-line rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-takal-ink-soft" />
            <h2 className="font-semibold text-takal-ink">Delivery staff today</h2>
          </div>
          <p className="text-xs text-takal-ink-soft mb-4">
            <b>Value</b> is what the parcels are worth. <b>Cash</b> is what they
            should hand back — orders already paid online owe the till nothing.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-takal-disabled-text border-b border-takal-line">
                  <th className="pb-2 pr-3 font-bold">STAFF</th>
                  <th className="pb-2 px-3 font-bold">HANDED TODAY</th>
                  <th className="pb-2 px-3 font-bold">DELIVERED TODAY</th>
                  <th className="pb-2 pl-3 font-bold">STILL WITH THEM</th>
                </tr>
              </thead>
              <tbody>
                {sheet
                  .filter((m) => m.handed || m.delivered || m.carrying)
                  .map((m) => (
                    <tr key={m.id} className="border-b border-takal-line last:border-b-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-takal-yellow text-takal-ink text-[11px] font-bold flex items-center justify-center shrink-0">
                            {m.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <span className="block font-semibold text-takal-ink">
                              {m.name}
                            </span>
                            {/* Somebody who has left, or lost the permission,
                                may still be holding a parcel. Their money does
                                not stop existing, so they keep a row and are
                                labelled rather than dropped. */}
                            {!m.still_here && (
                              <span className="block text-[11px] text-red-600 font-semibold">
                                No longer delivery staff
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="block font-bold text-takal-ink">
                          {m.handed} {m.handed === 1 ? "parcel" : "parcels"}
                        </span>
                        <span className="block text-xs text-takal-ink-soft">
                          Value {rs(m.handed_value)} · Cash {rs(m.handed_cash)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="block font-bold text-green-700">
                          {m.delivered} {m.delivered === 1 ? "parcel" : "parcels"}
                        </span>
                        <span className="block text-xs text-takal-ink-soft">
                          Value {rs(m.delivered_value)} · Cash {rs(m.delivered_cash)}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <span
                          className={`block font-bold ${
                            m.carrying > 0 ? "text-amber-700" : "text-takal-disabled-text"
                          }`}
                        >
                          {m.carrying} {m.carrying === 1 ? "parcel" : "parcels"}
                        </span>
                        <span className="block text-xs text-takal-ink-soft">
                          Value {rs(m.carrying_value)} · Cash {rs(m.carrying_cash)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* "Still with them" counts what is in the bag RIGHT NOW, whatever
              day it was handed over — not handed minus delivered. A parcel
              given out yesterday and still uncollected is in the bag today, and
              would disappear from a subtraction that only looks at one date. */}
          <p className="text-[11px] text-takal-disabled-text mt-3">
            Handed and delivered are for today. Still with them is live, and
            includes parcels handed over on an earlier day.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-takal-ink-soft">Loading parcels…</p>
      ) : (
        <div className="flex gap-6 flex-col lg:flex-row">
          {column(
            "Awaiting drop-off",
            <Package className="w-5 h-5 text-amber-600" />,
            awaiting,
            "Nothing waiting to come in.",
            (p) => btn("Mark received", () => setReceiveFor(p), busyId === p.id)
          )}
          {column(
            "In the office",
            <Inbox className="w-5 h-5 text-blue-600" />,
            inOffice,
            "No parcels on the shelf.",
            (p) => btn("Hand over to staff", () => openHandOver(p), busyId === p.id)
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
                         () => setResetFor(p), busyId === p.id)
            )}
        </div>
      )}

      {/* ── Handing the parcel over ─────────────────────────────────────── */}
      {/* ── HAND OVER TO STAFF ────────────────────────────────────────────── */}
      <HandOverDialog
        busyId={busyId}
        confirmHandOver={confirmHandOver}
        handOverFor={handOverFor}
        pickedStaff={pickedStaff}
        setHandOverFor={setHandOverFor}
        setPickedStaff={setPickedStaff}
        staff={staff}
        staffLoading={staffLoading}
      />
      <DeliverDialog
        code={code}
        confirmDelivery={confirmDelivery}
        deliverFor={deliverFor}
        overrideDelivery={overrideDelivery}
        saving={saving}
        setCode={setCode}
        setDeliverFor={setDeliverFor}
        askOverride={() => setAskOverride(true)}
      />

      {/* The three windows that replaced the browser's grey prompt boxes. */}
      <AskDialog
        open={!!receiveFor}
        title={`Receive parcel #${String(receiveFor?.id ?? "").slice(0, 8)}`}
        hint={`From ${receiveFor?.vendor_name ?? "the vendor"}`}
        label="Shelf or rack reference (optional)"
        placeholder="Shelf B, third from the left"
        initial={receiveFor?.hub_note ?? ""}
        confirmLabel="Mark received"
        busy={busyId === receiveFor?.id}
        onClose={() => setReceiveFor(null)}
        onDone={receive}
      />
      <AskDialog
        open={!!resetFor}
        title={`Send #${String(resetFor?.id ?? "").slice(0, 8)} back to Awaiting drop-off`}
        hint="For a parcel stuck in a state nothing else can move."
        label="Why?"
        placeholder="Claimed by a rider tester before riders were blocked"
        required
        confirmLabel="Send it back"
        busy={busyId === resetFor?.id}
        onClose={() => setResetFor(null)}
        onDone={resetParcel}
      />
      <AskDialog
        open={askOverride}
        danger
        title="Close this parcel WITHOUT the customer's code"
        hint={`Parcel #${String(deliverFor?.id ?? "").slice(0, 8)}`}
        label="Why can the customer not give the code?"
        placeholder="Flat battery · lost phone · left with a neighbour"
        required
        confirmLabel="Close it anyway"
        busy={saving}
        warning="This is written onto the order with your name on it and cannot be removed. The code exists so that a delivery cannot be closed without the customer — use this only when it genuinely cannot be obtained."
        onClose={() => setAskOverride(false)}
        onDone={overrideDelivery}
      />
    </div>
  );
}
