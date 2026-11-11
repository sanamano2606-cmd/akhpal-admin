/**
 * Is a shop LIVE? One honest word for "My new shops" (Stores visual audit,
 * 10 Nov 2026, finding B1).
 *
 * The server's `is_approved` there means "approved BY TAKAL" (Mock 207) - a
 * shop can be approved and still hidden from customers, or suspended. The page
 * used to print "Live" for every approved shop: Tar Kora Mart (suspended) and
 * two hidden Wakeel shops all said "Live · Already live".
 *
 * Example: approved, shown, not suspended -> "Live"; approved but hidden ->
 * "Approved · hidden"; suspended -> "Suspended".
 */

export type LiveState = "live" | "approved_hidden" | "suspended" | "not_approved";

export type LiveFacts = {
  is_approved: boolean;
  shown_to_customers?: boolean;
  suspended?: boolean;
};

export function liveState(s: LiveFacts): LiveState {
  if (s.suspended === true) return "suspended";
  if (s.is_approved !== true) return "not_approved";
  // An older server that does not send shown_to_customers: never guess "Live".
  if (s.shown_to_customers === true) return "live";
  return "approved_hidden";
}

export const LIVE_WORDS: Record<Exclude<LiveState, "not_approved">, string> = {
  live: "Live",
  approved_hidden: "Approved · hidden",
  suspended: "Suspended",
};

export const LIVE_TONE: Record<Exclude<LiveState, "not_approved">, "good" | "warn" | "bad"> = {
  live: "good",
  approved_hidden: "warn",
  suspended: "bad",
};

/** The "What is left" words for an approved shop, or null to use the checklist. */
export function leftWords(state: LiveState, ready: boolean): string | null {
  if (state === "live") return "Already live";
  if (state === "suspended") return "Suspended by Takal";
  if (state === "approved_hidden" && ready) return "Nothing — switch it on in All Stores";
  return null;
}
