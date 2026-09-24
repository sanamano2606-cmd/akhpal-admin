"use client";

/**
 * DID THIS ORDER LAND WHERE IT WAS PRICED?
 *
 * Money audit M14, decided by Sana on 24 September 2026.
 *
 * The delivery pin comes straight from the customer's phone and is checked
 * against nothing. A pin dragged toward the shop makes the order cheaper — and
 * on the live rates the RIDER carries three quarters of the loss for a ride he
 * still makes in full.
 *
 * It cannot be caught at checkout, so the server compares where the rider
 * really was when he pressed Delivered with the pin the order was priced on.
 *
 * THIS PANEL DECIDES NOTHING. Sana's option A: the money already taken is
 * never changed, the order's address and pin are never changed, and no rider
 * is paid by the server. She reads the two figures and presses the button —
 * one click, and she still decides every case.
 *
 * A customer who dropped a pin badly by accident looks exactly like one who
 * did it on purpose. That is why a person makes the call.
 */

import { useState } from "react";
import { MapPin, AlertTriangle, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { newIdempotencyKey } from "@/lib/api-core";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";
import { canAccess } from "@/lib/perms";
import { GAP_THAT_MATTERS_M, whatWeFound, gapInWords } from "@/lib/where-it-landed";

export { GAP_THAT_MATTERS_M, whatWeFound, gapInWords };

// THE RULE ITSELF LIVES IN src/lib/where-it-landed.ts — GAP_THAT_MATTERS_M,
// whatWeFound and gapInWords, word for word as they were written here. Plain
// Node cannot read a .tsx file, so a rule kept in this file is a rule no test
// can reach. This file paints; it decides nothing.

export function WhereItLanded({ order, onPaid }: { order: any; onPaid?: () => void }) {
  const found = whatWeFound(order);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  if (!found.checked) return null;
  if (!found.far) return null;

  const mayPay = canAccess("riders.earnings");

  const payTheRider = async () => {
    if (!order?.rider_id || found.riderShort <= 0) return;
    setPaying(true);
    try {
      await apiClient.recordRiderPayout(
        String(order.rider_id),
        found.riderShort,
        "cash",
        undefined,
        newIdempotencyKey(),
      );
      setPaid(true);
      toast("Paid to the rider and recorded", "success");
      onPaid?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not record the payment", "error");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      data-testid="where-it-landed"
      className="rounded-lg border border-takal-orange bg-takal-orange-soft px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-takal-orange" />
        <div className="flex-1 text-[13px] leading-relaxed text-takal-ink">
          <p className="font-bold">
            Delivered {gapInWords(found.gapM)} from where it was priced
          </p>

          <p className="mt-1">
            {found.pricedKm ? <>Priced for <strong>{found.pricedKm.toFixed(1)} km</strong> · </> : null}
            Really <strong>{(found.realKm ?? 0).toFixed(1)} km</strong> from the shop
          </p>

          <div className="mt-2 space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-takal-ink-soft">Customer under-paid</span>
              <span className="font-bold">{money(found.customerShort)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-takal-ink-soft">Rider is short</span>
              <span className="font-bold">{money(found.riderShort)}</span>
            </div>
          </div>

          {/* NOTHING HAPPENED TO THE MONEY. Said out loud, because a screen
              that shows two shortfalls and says nothing else reads as though
              somebody has already dealt with them. */}
          <p className="mt-2 text-xs text-takal-ink-soft">
            Nothing has been charged and nothing has been paid. The customer paid
            what the app asked for, and the rider was paid what he was promised.
          </p>

          {found.riderShort > 0 && order?.rider_id ? (
            paid ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-takal-green">
                <Check className="h-3.5 w-3.5" />
                Paid {money(found.riderShort)} to the rider
              </p>
            ) : mayPay ? (
              <button
                onClick={payTheRider}
                disabled={paying}
                data-testid="pay-the-rider"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border-2 border-takal-ink bg-takal-yellow px-2.5 py-1 text-xs font-bold text-takal-ink disabled:opacity-50"
              >
                <MapPin className="h-3.5 w-3.5" />
                {paying ? "Paying…" : `Pay the rider ${money(found.riderShort)}`}
              </button>
            ) : (
              <p className="mt-2 text-xs text-takal-ink-soft">
                Paying the rider needs the <strong>Earnings &amp; Cash</strong> permission.
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
