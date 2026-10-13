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

import { usePathname } from "next/navigation";
import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";
import { isOneStorePage } from "@/lib/store-page";

const TABS = tabsFor("/dashboard/stores");

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (isOneStorePage(path)) return <div>{children}</div>;
  return (
    <div className="space-y-3">
      {/* THE TITLE AND THE TABS ON ONE LINE (Mock 189, Sana 14 Oct 2026: "This
          screen also too spreader"). The sentence that stood under the title
          is its hover text now. */}
      <div className="flex flex-wrap items-end gap-x-5 border-b border-takal-line -mx-6 px-6">
        <h1 className="pb-2 text-2xl font-bold text-takal-ink"
          title="Every shop on Takal — every kind of shop — from the day they apply to the commission you charge them.">
          Stores
        </h1>
        <div className="min-w-0 flex-1"><DomainTabs tabs={TABS} bare /></div>
      </div>
      {children}
    </div>
  );
}
