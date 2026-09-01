"use client";

/**
 * MARKETING — one sidebar line for everything you say to customers.
 *
 * WAS: five links in three places, two of them invisible.
 *   Discount Codes    under MARKETING
 *   Home Banners      under MARKETING
 *   Welcome Screens   under MARKETING
 *   Send Notification under MARKETING, at /dashboard/settings/notifications
 *   App Banner        NOT IN THE SIDEBAR AT ALL - reachable only by first
 *                     opening Settings and spotting a card
 *
 * And they were split across permissions, so a sub-admin given "promos" could
 * open two of the five and was shown links to the rest that refused them.
 *
 * The two "banner" pages were the worst of it: an APP BANNER (an announcement
 * bar inside the customer app) and HOME BANNERS (the promo cards on the home
 * screen) were different features, in different sections, both called "banner".
 * They are neighbours now, and named for what they actually are.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/marketing");

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Marketing</h1>
        <p className="text-takal-ink-soft mt-1">
          Discounts, banners and messages — everything customers see and hear from you.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
