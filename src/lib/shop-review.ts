// REVIEWING A NEW SHOP  (Mock 207, approved by Sana 23 October 2026)
//
// "when a new Vendor get register ... I want to review that Vendors In Admin
// Panel but Its Not Easy And Simple and If there is any Issue in Pictures
// uploaded or any other details ... how can i tell that Vendor."
//
// The server decides everything (backend/routers/shop_review.py): what can be
// marked, what the vendor is told, when a fix counts as made. This file only
// holds the words the review page offers and the small sums the page and the
// waiting list both need, so they cannot disagree.

import type { ShopLicence } from "./shop-licence";

export type ReviewMark = { state: "ok" | "fix"; reason?: string; words?: string };

export type ReviewFix = {
  key: string; label: string; reason: string; words: string;
  where: "profile" | "hours" | "product" | "office";
  product_id: string | null; vendor_can_fix: boolean; done: boolean;
  removed?: boolean; thumb: string | null;
};

export type ReviewProduct = {
  id: string; name: string; price: number | null; discount_percent?: number | null;
  image_url: string | null; description?: string | null; is_available?: boolean;
  photos: string[]; category_name?: string;
};

export type ShopReviewPage = {
  shop: Record<string, any> & { id: string; name: string; status: string; vendor_type_name?: string };
  owner: { full_name?: string | null; phone?: string | null; email?: string | null };
  payout: { given: boolean | null; method?: string; method_label?: string;
            account_title?: string; account_number?: string; bank_name?: string };
  products: ReviewProduct[];
  products_total: number | null;
  page: number; per_page: number;
  review: { state: "reviewing" | "sent_back" | "fixed" | "closed"; marks: Record<string, ReviewMark>;
            fixes: ReviewFix[]; round: number; sent_back_at: string | null;
            resubmitted_at: string | null; fixed_count: number };
  whatsapp: { number: string | null; text: string };
  keys: Record<string, { label: string; where: string }>;
  /** A pharmacy's licence (Mock 208-4). needs_licence false for other shops;
   *  missing before database update 148. */
  licence?: ShopLicence;
};

export type SendBackAnswer = { sent: boolean; fixes: ReviewFix[];
                               whatsapp: { number: string | null; text: string } };

/** The things on the page that are not products, in the order shown. */
export const REVIEW_SECTIONS: { title: string; keys: string[] }[] = [
  { title: "Owner", keys: ["owner.name", "owner.phone", "owner.email"] },
  { title: "Shop details", keys: ["shop.name", "shop.type", "shop.description", "shop.minimum_order", "shop.hours"] },
  { title: "Logo", keys: ["logo"] },
  { title: "Location", keys: ["place"] },
  { title: "Money", keys: ["payout"] },
];

export const productKey = (id: string) => `product:${id}`;

/** The things to check on THIS shop: the fixed ones, plus "licence" for a
 *  pharmacy (Mock 208-4). Example: a pharmacy -> [...7 keys..., "licence"]. */
export function fixedKeysFor(page?: Pick<ShopReviewPage, "licence"> | null): string[] {
  const keys = REVIEW_SECTIONS.flatMap((s) => s.keys);
  return page?.licence?.needs_licence ? [...keys, "licence"] : keys;
}

/** "Mark everything not checked as OK" must not mark a licence OK that is
 *  missing or has run out - the server refuses that, and the whole save with
 *  it. Example: state "missing" -> false; "waiting" -> true. */
export function licenceMayBeMarkedOk(page?: Pick<ShopReviewPage, "licence"> | null): boolean {
  const st = page?.licence?.state;
  return !!page?.licence?.needs_licence && st !== "missing" && st !== "expired";
}

// ── THE READY REASONS (Mock 207-2). The vendor reads these words exactly. ──
export const PICTURE_REASONS = [
  "Picture is blurry", "Too dark", "Not the shop's own logo",
  "Has a phone number or website on it", "Cut off / wrong size",
];
export const PRODUCT_REASONS = [
  "Blurry", "Too dark", "Not a real photo of this product",
  "Messy background - use plain white", "Wrong product", "Price looks wrong", "Name is not clear",
];
const DETAIL_REASONS: Record<string, string[]> = {
  "owner.name": ["Name is not complete", "Spelling is wrong"],
  "owner.phone": ["Phone is not answering", "Number looks wrong"],
  "owner.email": ["Email looks wrong"],
  "shop.name": ["Spelling is wrong", "Not the name on the sign board"],
  "shop.type": ["Wrong shop type"],
  "shop.description": ["Description is empty or too short", "Description is not about this shop"],
  "shop.minimum_order": ["Minimum order looks wrong"],
  "shop.hours": ["Opening hours look wrong"],
  place: ["Map pin is in the wrong place", "Address is not complete"],
  payout: ["Account name does not match the owner", "Account number looks wrong"],
  licence: ["Photo is not clear", "Number does not match the photo", "Licence is in another name", "Date looks wrong"],
};

/** The chips for one thing. Unknown keys get none - "Write my own" only. */
export function reasonsFor(key: string): string[] {
  if (key === "logo") return PICTURE_REASONS;
  if (key.startsWith("product:")) return PRODUCT_REASONS;
  return DETAIL_REASONS[key] || [];
}

export const REASON_MIN = 3;
export const REASON_MAX = 120;
export const WORDS_MAX = 300;

function tidy(t: string): string {
  return String(t || "").split(/\s+/).filter(Boolean).join(" ");
}

/** The list "Send back for changes" sends: every thing marked Needs fix.
 *  A fix with no reason chosen sends its own words as the reason. */
export function fixesFromMarks(marks: Record<string, ReviewMark>) {
  return Object.entries(marks)
    .filter(([, m]) => m && m.state === "fix")
    .map(([key, m]) => {
      const reason = tidy(m.reason || "") || tidy(m.words || "");
      const words = m.reason ? tidy(m.words || "") : "";
      return { key, reason: reason.slice(0, REASON_MAX), ...(words ? { words: words.slice(0, WORDS_MAX) } : {}) };
    });
}

/** A Needs fix with too few words to tell anybody anything. */
export function fixesMissingAReason(marks: Record<string, ReviewMark>): string[] {
  return fixesFromMarks(marks).filter((f) => f.reason.length < REASON_MIN).map((f) => f.key);
}

/** How many of these things are marked (OK or Needs fix). */
export function checkedCount(keys: string[], marks: Record<string, ReviewMark>): number {
  return keys.filter((k) => marks[k]?.state === "ok" || marks[k]?.state === "fix").length;
}

/** wa.me link with the message written in it. Null without a number. */
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const n = String(number || "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text || "")}`;
}

// ── THE WAITING LIST (Mock 207-1) ───────────────────────────────────────────
export type ReviewState = "new" | "sent_back" | "fixed";

/** "New - not reviewed yet", "Sent back - waiting for vendor", "FIXED - check again". */
export function reviewStateOf(r: { review_state?: string | null }): ReviewState {
  if (r?.review_state === "fixed") return "fixed";
  if (r?.review_state === "sent_back") return "sent_back";
  return "new";
}

/** The order of the waiting list: FIXED first, then new, then sent back. */
export function reviewRank(r: { review_state?: string | null }): number {
  const s = reviewStateOf(r);
  return s === "fixed" ? 0 : s === "new" ? 1 : 2;
}

/** Sort the waiting shops by review rank, keeping the chosen order inside each. */
export function sortByReview<T extends { review_state?: string | null }>(rows: T[]): T[] {
  return rows.map((r, i) => ({ r, i }))
    .sort((a, b) => reviewRank(a.r) - reviewRank(b.r) || a.i - b.i)
    .map((x) => x.r);
}
