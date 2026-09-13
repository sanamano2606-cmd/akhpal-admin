"use client";

/** SHOPS — the tab you will use most. Stars AND the written comment. */

import ReviewList from "./ReviewList";

export default function ShopReviewsPage() {
  return (
    <ReviewList
      kind="shop"
      title="Reviews of shops"
      subtitle="What customers wrote about the shop they ordered from. Nothing shows in the app until you approve it."
      emptyLine="No shop reviews here yet."
    />
  );
}
