"use client";

/**
 * ORDERS — the whole life of an order, in one place.
 *
 * WAS: four sidebar links, plus the office list filed under Settings.
 *   My Deliveries    ORDERS
 *   Orders           ORDERS
 *   Returns          ORDERS
 *   Parcels          ORDERS
 *   Takal Offices    SYSTEM, at /dashboard/settings/hubs
 *
 * The offices are the odd one out and the reason this matters: the Parcels
 * desk CANNOT WORK without them - a parcel is received into an office, handed
 * to a person from that office, and sent out from it. Yet the list of offices
 * was filed as a "setting", two groups away, and a sub-admin who ran Parcels
 * had to be given the settings permission to add one.
 *
 * MY DELIVERIES is deliberately still its own tab, not folded into Parcels.
 * A Takal delivery man holds only the "delivery" permission, and that tab is
 * the ONLY thing in the entire panel he can open. Merging it into a page that
 * needs "orders" would either shut him out or hand him the whole order desk.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/orders");

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Orders</h1>
        <p className="text-takal-ink-soft mt-1">
          Every order from the moment it is placed to the moment it is delivered,
          returned or refunded.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
