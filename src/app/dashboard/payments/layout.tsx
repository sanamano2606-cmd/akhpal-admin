"use client";

/**
 * PAYMENTS — all the money in one place.
 *
 * WAS: two pages sitting next to each other in the sidebar with almost the same
 * name, showing DIFFERENT NUMBERS for the same question.
 *
 *   "Pay Out"  (/dashboard/settlements) — what each shop and rider is owed for
 *              a pay period, ending in a column headed PAY NOW that contained
 *              no button. Its footer told you to go to the other page.
 *   "Payouts"  (/dashboard/payments)    — where a payment is actually recorded,
 *              from a DIFFERENT endpoint giving an all-time balance.
 *
 * On the live panel that was Rs 11,308 on one page and Rs 33,274 on the other.
 * Both correct for their own question, and nothing on either screen said which
 * question it was answering. The operator read a number on one page and typed
 * it into another.
 *
 * They are one section now, and each tab says plainly which question it
 * answers. WHAT HAS NOT CHANGED: how money moves. Every server call is the
 * same call with the same arguments, and the "record it" buttons still carry
 * the one-time key that stops a resend paying twice.
 *
 * STILL TO DECIDE (needs Sana): whether the PAY NOW column should become a
 * real button. That means choosing ONE of the two figures as the truth, and
 * that is a business decision, not a tidying-up one.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/payments");

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Payments</h1>
        <p className="text-takal-ink-soft mt-1">
          What you owe shops and riders, what you have already paid, and which
          ways customers can pay you.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
