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
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MovedToReviews() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/reviews");
  }, [router]);

  return (
    <div className="bg-white rounded-lg border border-takal-line p-8 text-center">
      <p className="font-semibold text-takal-ink">Reviews have their own section now.</p>
      <p className="text-takal-ink-soft mt-1">Taking you there…</p>
    </div>
  );
}
