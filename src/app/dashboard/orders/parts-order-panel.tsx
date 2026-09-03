"use client";

/**
 * ONE ORDER, OPENED.
 *
 * WHAT THIS REPLACES. A small pop-up with eight lines in it, three of which
 * could never fill in on any order ever placed:
 *   Items    - it showed them `if (order.items)`, and the list endpoint has
 *              never sent items.
 *   Address  - it read `order.address`. The column is `delivery_address`, so
 *              the line was silently blank on every order.
 *   Progress - it drew pending -> confirmed -> cooking -> delivering ->
 *              delivered. Three of those five are words this system has never
 *              used, so it looked for the order's real status in that list,
 *              did not find it, and lit up nothing at all.
 *
 * It also had no phone number, no rider, no money breakdown and no history -
 * nothing that helps you answer a customer who is on the phone asking where
 * their food is - and exactly one action.
 *
 * Approved by Sana on 2 September 2026, mock-up 13.
 */

import { useEffect, useState } from "react";
import { Phone, Printer, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money, fmtDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { OrderStatusBadge, Button, Badge } from "@/components/ui";
import { CustomerReceipt } from "./parts-customer-receipt";
import { OrderMap } from "./parts-order-map";

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-takal-line px-6 py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-takal-ink-soft">
          {title}
        </h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function Person({
  role,
  name,
  phone,
  note,
}: {
  role: string;
  name?: string | null;
  phone?: string | null;
  note?: string | null;
}) {
  return (
    <div className="rounded-xl border border-takal-line bg-takal-page p-4">
      <div className="text-[10px] font-black uppercase tracking-wider text-takal-ink-soft">
        {role}
      </div>
      <div className="mt-1 text-[15px] font-bold text-takal-ink">
        {name || <span className="text-takal-ink-soft">not recorded</span>}
      </div>
      {phone ? (
        <>
          <div className="mt-0.5 font-mono text-[13px] text-takal-ink">{phone}</div>
          <a
            href={`tel:${phone}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-takal-ink bg-takal-yellow px-2.5 py-1 text-xs font-bold text-takal-ink"
          >
            <Phone className="h-3 w-3" /> Call
          </a>
        </>
      ) : (
        <div className="mt-0.5 text-[13px] text-takal-ink-soft">no number on file</div>
      )}
      {note ? (
        <div className="mt-2 text-[11.5px] text-takal-ink-soft">{note}</div>
      ) : null}
    </div>
  );
}

function Row({
  k,
  v,
  strong,
  brand,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  strong?: boolean;
  brand?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-takal-line px-4 py-2.5 text-sm last:border-b-0 ${
        brand ? "bg-takal-yellow font-black text-takal-ink" : ""
      } ${strong ? "bg-takal-ink font-black text-white" : ""}`}
    >
      <span className={strong || brand ? "" : "text-takal-ink-soft"}>{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

export function OrderPanel({
  orderId,
  onClose,
  onChanged,
  onCancel,
  onMove,
  onAssign,
}: {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onCancel: (order: any) => void;
  onMove: (order: any, canMoveTo: string[]) => void;
  onAssign: (order: any) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [printing, setPrinting] = useState(false);
  // Takal's own phone and email for the slip, read once when the panel opens.
  // Sana changes them in Settings; nothing here is written into the code.
  const [settings, setSettings] = useState<any>(null);

  // Escape closes it, like every other window in the panel.
  useEffect(() => {
    if (!orderId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [orderId, onClose]);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      setShowRefund(false);
      try {
        const res = (await apiClient.getOrderFull(orderId)) as any;
        if (alive) setData(res);
      } catch (err) {
        if (alive) setError(errorMessage(err, "this order"));
      } finally {
        if (alive) setLoading(false);
      }
      try {
        const s = (await apiClient.getSettings()) as any;
        if (alive) setSettings(s);
      } catch {
        // The slip falls back to what is written in lib/contact.ts. A slip
        // with no help line is far better than no slip at all.
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  if (!orderId) return null;

  const o = data?.order || {};
  const items: any[] = data?.items || [];
  const takal = o.takal || {};
  const paid = Number(o.total_amount || 0);
  const fee = Number(o.delivery_fee || 0);
  const goods = Number(o.subtotal || 0);
  const vendor = o.vendor_subtotal == null ? null : Number(o.vendor_subtotal);
  const markup = vendor == null ? null : Math.max(0, goods - vendor);

  const submitRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt < 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    // A refund can never be bigger than the order. The server refuses it too -
    // this catch is here so the operator is told before the trip, in words that
    // name both figures.
    if (paid > 0 && amt > paid) {
      toast(`This order came to ${money(paid)}. You cannot refund ${money(amt)}.`, "error");
      return;
    }
    try {
      setRefunding(true);
      await apiClient.refundOrder(orderId, {
        amount: amt,
        reason: refundReason || undefined,
      });
      toast("Refund recorded", "success");
      setShowRefund(false);
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err, "the refund"), "error");
    } finally {
      setRefunding(false);
    }
  };

  return (
    // FULL SCREEN, NOT HALF.
    //
    // This opened as a panel down the right-hand side, about half the width of
    // Sana's screen: "when i click Open the page show Half on the screen". Two
    // columns of an order squeezed into half a monitor, with the list showing
    // uselessly behind it through a grey wash. An order has enough on it to be
    // worth the whole window, and the list is one press of Escape away.
    <div className="fixed inset-0 z-50 bg-black/60 p-0 md:p-6" onClick={onClose}>
      <div
        className="mx-auto h-full w-full max-w-[1500px] overflow-y-auto bg-white shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEAD ── */}
        <div className="sticky top-0 z-10 flex items-start justify-between bg-takal-ink px-6 py-4 text-white">
          <div>
            <div className="text-xl font-black">
              Order #{String(orderId).slice(0, 8)}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                {orderId}
              </span>
            </div>
            <div className="mt-1 text-[12.5px] text-slate-300">
              {o.created_at ? `Placed ${fmtDateTime(o.created_at)}` : "—"}
              {o.delivered_at ? ` · delivered ${fmtDateTime(o.delivered_at)}` : ""}
              {o.age_minutes != null && (
                <span className="ml-1 font-bold text-takal-yellow">
                  · {o.status === "delivered" ? "took" : "waiting"} {o.age_minutes} min
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {o.delivery_type ? (
              <Badge tone={o.delivery_type === "standard" ? "parcel" : "warn"}>
                {o.delivery_type === "standard" ? "Parcel" : "Express"}
              </Badge>
            ) : null}
            <OrderStatusBadge status={o.status} />
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading && (
          <p className="px-6 py-10 text-center text-takal-ink-soft">
            Reading this order…
          </p>
        )}
        {error && (
          <p className="m-6 rounded-lg bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            {data.incomplete && (
              <div className="border-b border-takal-line bg-takal-orange-soft px-6 py-3 text-sm text-[#C8410F]">
                Some of this order could not be read, so parts of this panel are
                missing rather than wrong.
              </div>
            )}

            {/* WHY THIS ORDER ENDED, AND WHO ENDED IT.
                Both were saved and shown nowhere: a shop's reject reason went
                into the database and no screen read it back, so the office
                could see that an order had been rejected and never why. Kept at
                the very top of the panel, because on an ended order it is the
                first thing anybody wants. */}
            {(o.rejection_reason || o.cancelled_by_role) && (
              <div className="border-b border-takal-line bg-takal-red-soft px-6 py-4">
                <div className="text-xs font-black uppercase tracking-wider text-takal-red">
                  Why this order ended
                </div>
                <div className="mt-1 text-[15px] font-bold text-takal-ink">
                  {o.rejection_reason || "No reason was recorded."}
                </div>
                {o.cancelled_by_role ? (
                  <div className="mt-1 text-sm text-takal-ink-soft">
                    Ended by the <b className="capitalize">{o.cancelled_by_role}</b>
                    {o.cancelled_at ? ` · ${fmtDateTime(o.cancelled_at)}` : ""}
                  </div>
                ) : null}
              </div>
            )}

            <Section title="The three people">
              <div className="grid gap-4 md:grid-cols-3">
                <Person
                  role="Customer"
                  name={o.customer_name}
                  phone={o.customer_phone}
                />
                <Person
                  role="Shop"
                  name={o.restaurant_name}
                  phone={o.restaurant_phone}
                />
                {o.rider_id ? (
                  <Person
                    role="Rider"
                    name={o.rider_name}
                    phone={o.rider_phone}
                    note={o.rider_is_online ? "online now" : "offline"}
                  />
                ) : o.hub_id ? (
                  <Person
                    role="Takal office"
                    name={o.hub_name}
                    phone={o.hub_phone}
                    note={o.hub_city}
                  />
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-takal-red bg-takal-red-soft p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-takal-red">
                      Carried by
                    </div>
                    <div className="mt-1 text-[15px] font-bold text-takal-red">
                      Nobody yet
                    </div>
                    <button
                      onClick={() => onAssign(o)}
                      className="mt-2 rounded-lg border-2 border-takal-ink bg-takal-yellow px-2.5 py-1 text-xs font-bold text-takal-ink"
                    >
                      Assign a rider
                    </button>
                  </div>
                )}
              </div>
            </Section>

            <div className="grid md:grid-cols-[1fr_360px]">
              <Section title="What was ordered">
                {items.length === 0 ? (
                  <p className="text-sm text-takal-ink-soft">
                    No lines are recorded against this order.
                  </p>
                ) : (
                  <div>
                    {items.map((it, i) => (
                      <div
                        key={it.id ?? i}
                        className="flex items-center justify-between border-b border-takal-line py-2.5 text-sm last:border-b-0"
                      >
                        <span>
                          <span className="mr-2 rounded-md bg-takal-ink px-1.5 py-0.5 text-[11px] font-black text-takal-yellow">
                            {it.quantity ?? 1}×
                          </span>
                          {it.item_name || "Item"}
                        </span>
                        <span className="font-bold">
                          {money(it.price ?? it.total ?? 0)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 flex items-center justify-between border-t-2 border-takal-ink py-2 text-sm font-black">
                      <span>
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                      <span>{money(goods)}</span>
                    </div>
                  </div>
                )}
                {o.notes ? (
                  <div className="mt-4 rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-4 py-3 text-sm leading-relaxed">
                    <b>Note from the customer:</b> {o.notes}
                  </div>
                ) : null}
              </Section>

              <Section title="Where it went">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-takal-ink-soft">Address</span>
                    <span className="text-right font-bold">
                      {o.delivery_address || "not recorded"}
                    </span>
                  </div>
                  {o.address_details ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-takal-ink-soft">Details</span>
                      <span className="text-right font-bold">{o.address_details}</span>
                    </div>
                  ) : null}
                  {o.address_type ? (
                    <div className="flex justify-between">
                      <span className="text-takal-ink-soft">Type</span>
                      <span className="font-bold capitalize">{o.address_type}</span>
                    </div>
                  ) : null}
                  {o.receiver_name || o.receiver_phone ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-takal-ink-soft">Receiver</span>
                      <span className="text-right font-bold">
                        {o.receiver_name || "—"}
                        {o.receiver_phone ? (
                          <>
                            <br />
                            <span className="font-mono font-normal">
                              {o.receiver_phone}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                  {o.is_pickup ? (
                    <div className="rounded-lg bg-takal-blue-soft px-3 py-2 text-[13px] text-takal-blue">
                      The customer is collecting this from the shop. There is no
                      delivery and no rider.
                    </div>
                  ) : null}
                  {/* The map sits BELOW the written address, never instead of
                      it. Sana's rule: the address is what the customer wrote,
                      and a map result must never replace it. */}
                  <div className="pt-2">
                    <OrderMap
                      lat={o.delivery_latitude}
                      lon={o.delivery_longitude}
                      label={o.delivery_address}
                    />
                  </div>
                </div>
              </Section>
            </div>

            <div className="grid md:grid-cols-[1fr_360px]">
              <Section title="The journey — and how long each step took">
                {(data.journey || []).length === 0 ? (
                  <p className="text-sm text-takal-ink-soft">Nothing recorded yet.</p>
                ) : (
                  <ol className="relative ml-2 border-l-2 border-takal-line pl-6">
                    {data.journey.map((s: any, i: number) => (
                      <li key={i} className="relative pb-4 last:pb-0">
                        <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-takal-green ring-2 ring-takal-green" />
                        <div className="text-sm font-bold">
                          {s.step}
                          {s.minutes_since_last != null && (
                            <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-takal-ink-soft">
                              +{s.minutes_since_last} min
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] text-takal-ink-soft">
                          {fmtDateTime(s.at)}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              <Section title="The money">
                <div className="overflow-hidden rounded-xl border border-takal-line">
                  <Row
                    k={vendor == null ? "Shop's prices (not recorded)" : "Shop's own prices"}
                    v={vendor == null ? "—" : money(vendor)}
                  />
                  <Row
                    k="Takal mark-up"
                    v={markup == null ? "not known" : money(markup)}
                  />
                  <Row k="Delivery fee" v={money(fee)} />
                  {Number(o.credit_used || 0) > 0 && (
                    <Row
                      k="Wallet credit used"
                      v={<span className="text-takal-red">− {money(o.credit_used)}</span>}
                    />
                  )}
                  <Row
                    strong
                    k={
                      o.paid_online
                        ? "Customer paid online"
                        : `Customer pays at the door (${o.payment_method || "cash"})`
                    }
                    v={money(paid)}
                  />
                  {takal?.counted ? (
                    <Row k="Shop is owed (after commission)" v={money(takal.shop_keeps)} />
                  ) : null}
                  {o.refunded && (
                    <Row
                      k="Refunded"
                      v={<span className="text-takal-red">− {money(o.refund_amount)}</span>}
                    />
                  )}
                  <Row k="Rider earns" v={money(o.rider_earning || 0)} />
                  <Row
                    brand
                    k="TAKAL KEEPS"
                    v={
                      takal?.counted
                        ? money(takal.earned)
                        : "nothing yet — not delivered"
                    }
                  />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-takal-ink-soft">
                  Every figure is read from this order and put through the same
                  calculation the Earnings tab uses, so the two can never
                  disagree.
                  {takal && takal.markup_known === false && (
                    <>
                      {" "}
                      This order was placed before 14 August 2026, when the
                      shop&rsquo;s own price started being recorded, so its
                      mark-up is <b>unknown rather than zero</b>.
                    </>
                  )}
                </p>
                {o.refunded ? (
                  <div className="mt-3 rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-2 text-sm">
                    Refunded {money(o.refund_amount)}
                    {o.refund_reason ? ` — ${o.refund_reason}` : ""}
                  </div>
                ) : showRefund ? (
                  <div className="mt-3 space-y-2">
                    <input
                      type="number"
                      min={0}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="Refund amount (Rs)"
                      className="w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
                    />
                    <input
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" loading={refunding} onClick={submitRefund}>
                        Save refund
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowRefund(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[11.5px] text-takal-ink-soft">
                      This only records the refund — you pay the customer back
                      yourself.
                    </p>
                  </div>
                ) : null}
              </Section>
            </div>

            <Section title="Who touched this order">
              {(data.history || []).length === 0 ? (
                <p className="text-sm text-takal-ink-soft">
                  Nothing has been recorded against this order yet. Actions taken
                  from the panel from today onwards appear here.
                </p>
              ) : (
                <div className="text-sm">
                  {data.history.map((h: any, i: number) => (
                    <div
                      key={i}
                      className="flex gap-4 border-b border-dashed border-takal-line py-2 last:border-b-0"
                    >
                      <span className="whitespace-nowrap font-mono text-[12px] text-takal-ink-soft">
                        {fmtDateTime(h.created_at)}
                      </span>
                      <span>
                        {String(h.action || "").replace(/_/g, " ")}
                        {h.by_name ? (
                          <>
                            {" "}
                            by <b>{h.by_name}</b>
                          </>
                        ) : null}
                        {h.user_role ? (
                          <span className="text-takal-ink-soft"> · {h.user_role}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── ACTIONS ── */}
            <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 border-t border-takal-line bg-takal-page px-6 py-4">
              <Button
                onClick={() => onMove(o, data.can_move_to || [])}
                disabled={(data.can_move_to || []).length === 0}
              >
                Move status
              </Button>
              <Button variant="secondary" onClick={() => onAssign(o)}>
                {o.rider_id ? "Change rider" : "Assign a rider"}
              </Button>
              {/* THE CUSTOMER'S RECEIPT, for packing inside the parcel.
                  80mm thermal, black and white, endless roll.

                  This was "Print rider slip" until 2 September 2026, when Sana
                  pointed out the obvious: the rider has everything in his app
                  already, so the slip was the same information twice on paper
                  that goes in a bin - and it took two pages for a one-item
                  order. The receipt is the paper that is actually worth
                  printing, and it follows the OPPOSITE privacy rules. */}
              <Button
                variant="secondary"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => setPrinting(true)}
              >
                Print receipt
              </Button>
              {o.customer_phone ? (
                <a
                  href={`tel:${o.customer_phone}`}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-takal-yellow bg-white px-4 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-soft"
                >
                  <Phone className="h-4 w-4" /> Call customer
                </a>
              ) : null}
              {o.restaurant_phone ? (
                <a
                  href={`tel:${o.restaurant_phone}`}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-takal-yellow bg-white px-4 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-soft"
                >
                  <Phone className="h-4 w-4" /> Call shop
                </a>
              ) : null}
              {!o.refunded && (
                <Button variant="subtle" onClick={() => {
                  setShowRefund(true);
                  setRefundAmount(String(paid || ""));
                  setRefundReason("");
                }}>
                  Record a refund
                </Button>
              )}
              {!["delivered", "cancelled", "rejected"].includes(o.status) && (
                <Button variant="danger" onClick={() => onCancel(o)}>
                  Cancel this order
                </Button>
              )}
              <span className="ml-auto text-[12.5px] text-takal-ink-soft">
                Every one of these is written into the history above, with your
                name on it.
              </span>
            </div>
            <CustomerReceipt
              open={printing}
              order={o}
              items={items}
              settings={settings}
              onDone={() => setPrinting(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
