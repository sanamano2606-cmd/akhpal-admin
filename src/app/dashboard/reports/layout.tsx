"use client";

/**
 * REPORTS — one sidebar line, everything you read rather than change.
 *
 * WAS: three separate sidebar links in three different groups.
 *   Reports          under FINANCE
 *   Analytics        under SYSTEM
 *   Audit Logs       under SYSTEM, at the address /dashboard/settings/audit
 *
 * All three are read-only. None of them changes anything. There was no reason
 * for them to be apart, and the audit log in particular was filed as a
 * "setting", which it is not - a log is a report.
 *
 * The permission on each tab is the one the SERVER already enforces, unchanged:
 * the audit log is guarded by "reports" and the analytics endpoints by
 * "analytics". Moving where a link appears must never change who may use it.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

// The tabs themselves are listed in lib/navigation.ts, beside the sidebar and
// beside a copy of the server's permission rules - so a test can check that
// each tab asks for a permission that actually works.
const TABS = tabsFor("/dashboard/reports");

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Reports</h1>
        <p className="text-takal-ink-soft mt-1">
          Figures and history. Nothing on these pages changes anything.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
