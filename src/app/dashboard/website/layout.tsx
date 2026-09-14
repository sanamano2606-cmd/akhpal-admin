"use client";

/**
 * WEBSITE — what the public sees at takalapp.com.
 *
 * Approved by Sana on 14 September 2026 (Mock 68): "must be manageable each and
 * everything from admin panel."
 *
 * THE RULE THIS SECTION FOLLOWS: only things that appear on the PUBLIC website
 * live here. Anything that is really about a shop, a product or the money is
 * managed where it already lives, and the website simply reads it:
 *
 *   Categories   → Stores → Catalogue     (the website shows the same list)
 *   Products     → the shops themselves   (they appear on the site by themselves)
 *   Legal pages  → already published      (one copy, in both languages)
 *
 * A second place to edit any of those would be a second answer to the same
 * question, and one of the two would go stale.
 */

import { DomainTabs } from "@/components/ui";
import { tabsFor } from "@/lib/navigation";

const TABS = tabsFor("/dashboard/website");

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-takal-ink">Website</h1>
        <p className="text-takal-ink-soft mt-1">
          Everything the public sees at takalapp.com. The products and shops on the
          site come from the app&rsquo;s own database, so they look after themselves —
          what is here is the wording around them.
        </p>
      </div>
      <DomainTabs tabs={TABS} />
      {children}
    </div>
  );
}
