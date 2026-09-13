"use client";

/**
 * HIDDEN — everything that was taken off the app but not thrown away.
 *
 * Hide exists so that "take it down" does not have to mean "it never
 * happened". The words and the name stay here, which matters when a vendor
 * asks why a review vanished, or when the same customer does it again.
 */

import ReviewList from "../ReviewList";

export default function HiddenReviewsPage() {
  return (
    <ReviewList
      kind="shop"
      status="hidden"
      title="Hidden reviews"
      subtitle="Taken off the app, kept on record. Use “Put back” to send one to the waiting list again."
      emptyLine="Nothing has been hidden."
    />
  );
}
