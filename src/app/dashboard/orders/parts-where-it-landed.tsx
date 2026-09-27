"use client";

/**
 * DID THIS ORDER LAND WHERE IT WAS PRICED?
 *
 * Money audit M14, decided by Sana on 24 September 2026.
 * NO MONEY IN IT AT ALL, decided by Sana on 28 September 2026.
 *
 * The delivery pin comes straight from the customer's phone and is checked
 * against nothing, so an order can be delivered a long way from the point it
 * was priced on. This panel says so, and says only that.
 *
 * IT USED TO SHOW TWO FIGURES AND A BUTTON — "customer under-paid Rs X",
 * "rider is short Rs Y", and one click to pay the rider the difference. All
 * three are gone. Sana, 28 September 2026:
 *
 *     "The customer only pay the delivery fee what was he showed during
 *      placing an order there will no extra delivery fee at all for any one.
 *      No Extra Fee even if the customer is not on the pinned location."
 *
 * and, asked whether the rider half should stay: "Remove Both". The rider is
 * paid exactly what he was promised when he took the job.
 *
 * WHAT IS LEFT IS AN ADDRESS PROBLEM, NOT A MONEY ONE. A pin a long way from
 * the door usually means the customer's saved address is wrong, and that is
 * worth seeing — it is why the panel still exists. A rider who needs paying
 * for something is paid from the Riders screen, as any other payment is.
 */

import { MapPin } from "lucide-react";
import { GAP_THAT_MATTERS_M, whatWeFound, gapInWords } from "@/lib/where-it-landed";

export { GAP_THAT_MATTERS_M, whatWeFound, gapInWords };

// THE RULE ITSELF LIVES IN src/lib/where-it-landed.ts — GAP_THAT_MATTERS_M,
// whatWeFound and gapInWords, word for word as they were written here. Plain
// Node cannot read a .tsx file, so a rule kept in this file is a rule no test
// can reach. This file paints; it decides nothing.

export function WhereItLanded({ order }: { order: any }) {
  const found = whatWeFound(order);

  if (!found.checked) return null;
  if (!found.far) return null;

  return (
    <div
      data-testid="where-it-landed"
      className="rounded-lg border border-takal-orange bg-takal-orange-soft px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-takal-orange" />
        <div className="flex-1 text-[13px] leading-relaxed text-takal-ink">
          <p className="font-bold">
            Delivered {gapInWords(found.gapM)} from where it was priced
          </p>

          <p className="mt-1">
            {found.pricedKm ? <>Priced for <strong>{found.pricedKm.toFixed(1)} km</strong> · </> : null}
            Really <strong>{(found.realKm ?? 0).toFixed(1)} km</strong> from the shop
          </p>

          {/* SAID OUT LOUD, so nobody reads this box as a bill waiting to be
              settled. It is here to show a saved address that looks wrong. */}
          <p className="mt-2 text-xs text-takal-ink-soft">
            This changes no money. The customer pays the delivery fee he was
            shown when he placed the order, and the rider is paid what he was
            promised. Worth checking the customer&apos;s saved address.
          </p>
        </div>
      </div>
    </div>
  );
}
