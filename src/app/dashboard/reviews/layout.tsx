"use client";

/**
 * REVIEWS — everything customers say about shops, riders, Takal and products.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ITS OWN SIDEBAR LINE AND NOT A TAB UNDER CUSTOMERS
 *
 * It used to be a tab inside Customers, and it was two things at once and
 * neither of them well. Sana, 13 September 2026, after opening it herself:
 * "even there is no Proper window for reviews management ... you should create
 * a separate tab in sidebar for that and add all reviews related settings in
 * it. And remove that one review tab from inside Customers Side bar."
 *
 * She is right on three counts.
 *
 *   1. It could not do the job. The only button was Delete, and the screen
 *      never showed what the customer had WRITTEN - only the stars. So the one
 *      decision offered had to be made blind.
 *
 *   2. It sat under Customers while asking for the STORES permission, which
 *      meant the only way to let somebody tidy up abusive reviews was to hand
 *      them every shop on the platform as well. It has its own permission now.
 *
 *   3. Half the reviews were not there at all. A customer can review a single
 *      product AND ATTACH PHOTOGRAPHS, and no screen in this panel could see
 *      one. Those went straight onto the public product page.
 *
 * The tabs are split by WHO is being reviewed, because that is how you look
 * for something: "what are people saying about the riders" is a different
 * question from "what are people saying about that shop".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";
import { apiClient } from "@/lib/api-client";
import { REPORTS_CHANGED } from "@/lib/review-reports";

const TABS = tabsFor("/dashboard/reviews");

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  // THE RED NUMBER ON "Reported" (Mock 208-2): how many reports wait. Read on
  // every tab change and after every decision. Somebody who may not see
  // reports gets a refusal - then simply no number.
  const pathname = usePathname();
  const [reported, setReported] = useState(0);
  useEffect(() => {
    let alive = true;
    const count = () => {
      apiClient.getReviewReports({ state: "open", limit: 1 })
        .then((res: any) => { if (alive) setReported(Number(res?.open_count) || 0); })
        .catch(() => { if (alive) setReported(0); });
    };
    count();
    window.addEventListener(REPORTS_CHANGED, count);
    return () => { alive = false; window.removeEventListener(REPORTS_CHANGED, count); };
  }, [pathname]);
  const tabs = useMemo(
    () => TABS.map((t) => (t.href === "/dashboard/reviews/reported" ? { ...t, count: reported } : t)),
    [reported],
  );

  return (
    <div className="space-y-3">
      {/* THE TITLE AND THE TABS ON ONE LINE (Mock 195, Sana 14 Oct 2026: the
          same as Stores and Orders). The sentence is the title's hover text. */}
      <div className="flex flex-wrap items-end gap-x-5 border-b border-takal-line -mx-6 px-6">
        <h1 className="pb-2 text-2xl font-bold text-takal-ink"
          title="Everything customers say about shops, riders, Takal and products — checked here before anyone else sees it.">
          Reviews
        </h1>
        <div className="min-w-0 flex-1"><DomainTabs tabs={tabs} bare /></div>
      </div>
      {children}
    </div>
  );
}
