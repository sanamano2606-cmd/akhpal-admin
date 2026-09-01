"use client";

/**
 * RIDERS — everything about a rider, in the rider's own section.
 *
 * WAS: rider information in one place and rider MONEY in three others.
 *   Riders            PEOPLE
 *   Rider Pay         FINANCE, at /dashboard/settings/rider-pay
 *   Rider Payouts     a tab on the Payouts page
 *   Cash (COD)        another tab on the Payouts page
 *   "cash still held" a read-only column on the Pay Out page
 *
 * That split had a real cost. On the live panel BOTH riders were switched off
 * by the automatic cash limit — so the platform had no working riders — and the
 * Riders page could only explain the problem and link you somewhere else to fix
 * it. Now the rider, the reason and the button are in one place.
 *
 * The money tab uses the SAME component the Payments section uses, so the two
 * read the same figures from the same endpoints. Two doors, never two answers.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/riders");

export default function RidersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Riders</h1>
        <p className="text-takal-ink-soft mt-1">
          Applications, deliveries, what each rider earns and what they still owe.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
