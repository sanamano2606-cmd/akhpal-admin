"use client";

/**
 * SETTINGS — global config, and nothing else.
 *
 * THE RULE: if a setting is about a THING, it belongs to that thing. Only what
 * applies to the whole system stays here.
 *
 * WHAT WAS HERE AND WHERE IT WENT:
 *   Commission          → Stores    (it is a rate you charge a shop)
 *   Payment Methods     → Payments  (it is about money)
 *   Rider Pay           → Riders    (it is what a rider is paid)
 *   Send Notification   → Marketing (it is a daily action, not a setting)
 *   App Banner          → Marketing (it is a message to customers)
 *   Audit Log           → Reports   (a log is a report)
 *   Takal Offices       → Orders    (the Parcels desk cannot work without it)
 *   Categories          → Stores    (it is the shop catalogue)
 *   Team Management     → deleted   (a second door to Admin Users)
 *
 * What is left genuinely belongs to the whole system: what it costs to deliver
 * anywhere, and whether new sign-ups need a texted code.
 *
 * The old Settings page was a SIGNPOST - two real settings, a grid of links to
 * pages that had moved, and a tip box. A settings page whose main job is to
 * tell you the settings are elsewhere is a sign that the shelving is wrong.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/settings");

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Settings</h1>
        <p className="text-takal-ink-soft mt-1">
          Settings that apply to the whole system. Anything about a shop, a rider
          or money lives in that section instead.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
