"use client";

/**
 * THE OLD ADDRESS, KEPT ALIVE ON PURPOSE.
 *
 * Reviews moved out of Customers and onto their own sidebar line on
 * 13 September 2026 (Mock 62/63/65). This page is not the reviews screen any
 * more - it only sends whoever lands here to the new one.
 *
 * It exists because bookmarks exist. Somebody has this address saved, or typed
 * into a message, or open in a second tab; deleting the page would give them a
 * "not found" and no idea where it went. The real screen it used to hold is in
 * DELETE-AFTER-TESTING/deprecated-customers-reviews-page.tsx until the new
 * section has been through a full test.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE ADDRESS IT SENDS YOU TO HAS "?moved=1" ON THE END
 *
 * Until this was fixed, next.config.js still carried the OLD move, the other
 * way round: /dashboard/reviews -> /dashboard/customers/reviews. So the new
 * Reviews section could not be opened at all. You clicked Reviews, the server
 * sent you here, this page sent you back, and the panel sat on
 * "Taking you there..." for ever. Sana, 13 September 2026: "The admin panel
 * has still not reviews page working."
 *
 * That old move was a 308 - a "permanent" answer, which browsers write down
 * and keep using even after the server has stopped giving it. A browser that
 * wrote it down would be thrown straight back into the same loop.
 *
 * "?moved=1" is the way out. A browser's saved answer is saved against the
 * exact address, and it has no saved answer for this one - so the page opens,
 * once, and the saved answer never gets a chance to bite. It costs nothing and
 * it means nobody has to clear anything by hand.
 *
 * There is also a plain LINK below. If anything at all goes wrong with the
 * automatic move, there is still a way forward that a person can click, rather
 * than a spinner that never ends.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MovedToReviews() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/reviews?moved=1");
  }, [router]);

  return (
    <div className="bg-white rounded-lg border border-takal-line p-8 text-center">
      <p className="font-semibold text-takal-ink">Reviews have their own section now.</p>
      <p className="text-takal-ink-soft mt-1">Taking you there…</p>
      <Link
        href="/dashboard/reviews?moved=1"
        className="inline-block mt-4 px-4 py-2 rounded-lg bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold transition"
      >
        Open Reviews
      </Link>
    </div>
  );
}
