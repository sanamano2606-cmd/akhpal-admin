"use client";

/**
 * STORES — everything about a shop, in the shop's own section.
 *
 * WAS: five links spread across two groups, and the folder was called
 * "restaurants" while the page was called "Stores".
 *   Stores             STORES, at /dashboard/restaurants
 *   Inventory          STORES
 *   Categories         STORES, but gated on the SETTINGS permission
 *   Store Reliability  STORES
 *   Commission         FINANCE, at /dashboard/settings/commissions
 *
 * COMMISSION is the one that mattered. The rate you charge a shop is a fact
 * about that shop - and it was set in THREE places that did not know about each
 * other: a global rate and a per-shop-type rate under Finance, and a per-store
 * override typed straight into the Stores list. Nothing on the Commission page
 * told you a store override existed. They are neighbours now.
 *
 * The folder rename is cosmetic and stops at the panel: the SERVER's addresses
 * are untouched. The phone apps talk to /restaurants/... and always will.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/stores");

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Stores</h1>
        <p className="text-takal-ink-soft mt-1">
          Every shop on Takal — all 16 kinds — from the day they apply to the
          commission you charge them.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
