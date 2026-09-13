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

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/reviews");

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Reviews</h1>
        <p className="text-takal-ink-soft mt-1">
          Everything customers say about shops, riders, Takal and products —
          checked here before anyone else sees it.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
