"use client";

/**
 * RIDERS → EARNINGS &amp; CASH.
 *
 * The same figures, the same buttons and the same server calls as the Payments
 * section — one shared component, so the two can never disagree. See
 * src/domains/riders/RiderMoney.tsx for why.
 *
 * THIS TAB IS THE FIX FOR A REAL PROBLEM. On the live panel both riders were
 * switched off by the automatic cash limit, and the Riders page could only tell
 * you so and point at a different page. Now the rider, the reason and the
 * button that clears it are in the same section.
 */

import { useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui";
import { RiderMoney } from "@/domains/riders/RiderMoney";

export default function RiderEarningsPage() {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<number | "all">(30);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Earnings &amp; Cash</h2>
        <p className="text-takal-ink-soft mt-1 text-sm">
          What each rider is owed, and what cash they are still holding.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-takal-disabled-text pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search riders"
            />
          </div>
          <select
            value={String(days)}
            onChange={(e) => setDays(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="w-auto"
            aria-label="Period"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </Card>

      <RiderMoney period={{ kind: "days", days }} search={search} />
    </div>
  );
}
