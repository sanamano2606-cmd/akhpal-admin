"use client";

/**
 * CUSTOMERS — the people who order.
 *
 * REVIEWS USED TO BE A TAB IN HERE, and they left on 13 September 2026. Sana,
 * after opening it herself: "even there is no Proper window for reviews
 * management ... And remove that one review tab from inside Customers Side
 * bar." (Mock 62/63/65.)
 *
 * She was right, and the tab was wrong in a way worth remembering: it sat
 * under Customers while asking for the STORES permission, so the menu said one
 * thing and the lock said another. Reviews now have their own sidebar line and
 * their own key. The old address still works and sends you there.
 *
 * What is left here is one job: accounts and order history. The customer
 * detail page (/dashboard/customers/<id>) sits inside this domain too.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/customers");

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Customers</h1>
        <p className="text-takal-ink-soft mt-1">
          Accounts and order history.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
