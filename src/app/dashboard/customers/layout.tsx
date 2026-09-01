"use client";

/**
 * CUSTOMERS — the people who order, and what they say afterwards.
 *
 * WAS: Customers under PEOPLE, Store Reviews under STORES.
 *
 * A review is written BY A CUSTOMER. It was filed under Stores because it is
 * about a shop, which is true - but the only thing you can DO with a review
 * here is delete it, and that is a moderation job about what a customer wrote.
 * The shop's side of it is the star rating, which already shows on the store.
 *
 * The customer detail page (/dashboard/customers/<id>) sits inside this domain
 * too, so a customer's orders, spend and history open under the same heading.
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
          Accounts, order history and the reviews customers leave.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
