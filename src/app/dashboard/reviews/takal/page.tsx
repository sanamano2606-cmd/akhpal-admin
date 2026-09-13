"use client";

/**
 * TAKAL — what customers think of the service itself.
 *
 * This tab did not exist before 13 September 2026, and neither did the
 * question. Nothing anywhere in any of the three apps asked a customer how
 * TAKAL was doing; the Help & Support inbox is messages sent to you, which is
 * a different thing entirely. The customer app now asks it first, before the
 * shop and before the rider, because the first question always gets the most
 * answers.
 */

import ReviewList from "../ReviewList";

export default function TakalReviewsPage() {
  return (
    <ReviewList
      kind="takal"
      title="Reviews of Takal"
      subtitle="What customers think of the app and the service. This is the first thing they are asked after a delivery."
      emptyLine="Nobody has rated Takal yet. This starts filling up once the new customer app is live."
    />
  );
}
