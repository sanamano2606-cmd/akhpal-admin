"use client";

/**
 * SETTINGS → GENERAL.
 *
 * The facts that are true of the whole system, in one place, so nobody has to
 * go looking through code to find out what currency the panel is in or which
 * address Google Play writes to.
 *
 * Currency and the business details are FIXED IN THE CODE, not editable
 * settings - and this page says so plainly rather than offering a box that
 * does nothing. `lib/contact.ts` is the one place they are written down,
 * because the privacy policy and all three terms pages read from it; two
 * copies of a contact address is two addresses, and the day one changes and
 * the other does not, the published documents disagree about how to reach the
 * business.
 */

import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { TakalContact } from "./parts-takal-contact";
import { CONTACT_EMAIL, BUSINESS_NAME, BUSINESS_LOCATION } from "@/lib/contact";

const FACTS: { label: string; value: string; note: string }[] = [
  {
    label: "Currency",
    value: "Pakistani Rupee (Rs)",
    note: "Every amount in the panel, the three apps and every export.",
  },
  {
    label: "Business name",
    value: BUSINESS_NAME,
    note: "Shown on the privacy policy and all three terms pages.",
  },
  {
    label: "Where the business is",
    value: BUSINESS_LOCATION,
    note: "Shown on the published legal pages.",
  },
  {
    label: "Contact address",
    value: CONTACT_EMAIL,
    note: "Google Play writes here, and a customer can ask for their data to be deleted through it. It has to be an address somebody reads.",
  },
  {
    label: "Times and dates",
    value: "Pakistan time (UTC+5)",
    note: "Every date on every screen, so what you read matches your day.",
  },
];

/**
 * The other settings pages, listed here as well as in the tab strip above.
 *
 * WHY BOTH. The tab strip is drawn from lib/navigation.ts and is hidden from
 * an admin who lacks the permission for a tab — which is right. But it means
 * the ONLY route to the sign-up switch was a tab, and a page reachable by one
 * route only is a page somebody cannot find on the day it is needed.
 *
 * The sign-up switch in particular is turned off exactly once, in a hurry,
 * while new app builds are on their way to the Play Store. That is the worst
 * possible moment to be hunting for it. There is a safety test on this — see
 * backend/tests/test_the_signup_code_switch_can_be_reached.py.
 */
const MORE_SETTINGS = [
  {
    title: "Delivery Fees",
    description:
      "The base fee, the per-kilometre rate, the cap, and how far you deliver at all.",
    href: "/dashboard/settings/delivery-fees",
    icon: "🛵",
  },
  {
    title: "Sign-up phone code",
    description:
      "Whether a new shop or rider must enter a texted code to sign up. Switch it off only while new app builds are on their way to the Play Store.",
    href: "/dashboard/settings/signup-code",
    icon: "📱",
  },
];

/** The published pages customers and Google Play can open. */
const PUBLIC_PAGES = [
  { title: "Privacy policy", href: "/privacy" },
  { title: "Customer terms", href: "/terms/customer" },
  { title: "Rider terms", href: "/terms/rider" },
  { title: "Shop terms", href: "/terms/vendor" },
];

export default function SettingsGeneralPage() {
  return (
    <div className="space-y-6">
      {/* Sana, 2 September 2026: "add in the setting where i can change the
          Takal's phone and email any time." First on the page, because it is
          the only thing here that is actually changed. */}
      <TakalContact />

      <Card>
        <CardHeader
          title="About this system"
          hint="Fixed in the code, not editable here — changing any of these needs a new release."
        />
        <CardBody className="space-y-4">
          {FACTS.map((f) => (
            <div
              key={f.label}
              className="grid gap-1 md:grid-cols-[200px_1fr] md:gap-6 pb-4 border-b border-takal-line last:border-0 last:pb-0"
            >
              <p className="text-sm font-bold text-takal-ink">{f.label}</p>
              <div>
                <p className="text-sm text-takal-ink">{f.value}</p>
                <p className="text-xs text-takal-ink-soft mt-0.5">{f.note}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="The other settings"
          hint="Also in the tabs above — listed here so there is more than one way to find them."
        />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2">
            {MORE_SETTINGS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-start gap-3 px-4 py-3 rounded-lg border border-takal-line hover:border-takal-yellow hover:bg-takal-yellow-soft transition"
              >
                <span aria-hidden className="text-xl leading-none mt-0.5">{s.icon}</span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-takal-ink">{s.title}</span>
                  <span className="block text-xs text-takal-ink-soft mt-0.5">
                    {s.description}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-takal-ink-soft flex-shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pages the public can open"
          hint="Google Play requires these to be reachable without signing in."
        />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2">
            {PUBLIC_PAGES.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                target="_blank"
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-takal-line hover:border-takal-yellow hover:bg-takal-yellow-soft transition"
              >
                <span className="text-sm font-medium text-takal-ink">{p.title}</span>
                <ChevronRight className="w-4 h-4 text-takal-ink-soft" />
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="rounded-lg border border-takal-yellow-dark bg-takal-yellow-soft p-4 flex gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-takal-ink" />
        <div className="text-sm text-takal-ink">
          <p className="font-bold">When a change takes effect</p>
          <p className="mt-1">
            Commission and delivery-fee changes apply to all <strong>new</strong>{" "}
            orders straight away. An order already placed keeps the price the
            customer was quoted — you never change what somebody has already
            agreed to pay.
          </p>
        </div>
      </div>
    </div>
  );
}
