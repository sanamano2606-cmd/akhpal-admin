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
import type { ContactHit } from "./contact-info";
import type { PictureQuality } from "./picture-check";
import type { WaLang } from "./whatsapp-words";
import type { FoundBox } from "@/components/PictureViewer";

export type ReviewMark = { state: "ok" | "fix"; reason?: string; words?: string };

export type ReviewFix = {
  key: string; label: string; reason: string; words: string;
  where: "profile" | "hours" | "product" | "products" | "office";
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
  // ── MOCK 215 (Sana 28 Oct 2026) ─────────────────────────────────────────
  /** Phone numbers / websites the SERVER found in the shop's and products'
   *  words - name, description, every product's name, description, details
   *  and options. Any one of them locks Approve for everybody. */
  contact?: { text_hits: TextHit[] };
  /** Every picture of the shop (logo + every photo of every product, all
   *  pages) and what was read off each one so far. */
  pictures?: { list: { url: string; key: string; label: string }[]; checks: Record<string, SavedPictureCheck> };
  /** Other shops with the same phone, owner or bank account. */
  same_shop?: SameShop[];
  /** Every WhatsApp message and send-back to this shop, newest first. */
  messages?: ShopMessage[];
  /** The office's own notes - the vendor never sees them. */
  notes?: ShopMessage[];
};

export type TextHit = { key: string; label: string; field: string; excerpt: string; hits: ContactHit[] };
export type SavedPictureCheck = {
  url: string; key?: string; hits: ContactHit[]; boxes: FoundBox[]; quality: PictureQuality | null;
  checked_at?: string;
  /** A reviewer looked and said it is NOT a phone number or website (the
   *  reader can misread a pattern) - with her name and the time. */
  not_contact?: { by: string; at: string } | null;
};
export type SameShop = { id: string; name: string; status: string; why: string[]; rejected_reason?: string | null };
export type ShopMessage = {
  id: string; kind: "whatsapp" | "sent_back" | "what_is_left" | "note";
  lang?: WaLang | null; text: string; by_name?: string | null; at: string;
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
  // THE PRODUCTS THEMSELVES (Sana 27 Oct 2026): a shop with no products, or
  // too few, can be sent back for them. Drawn at the top of the Products
  // section; it ticks itself only when the shop has 5, each with a photo.
  { title: "Products", keys: ["products"] },
];

/** The products line's key and the number it asks for (server: PRODUCTS_KEY). */
export const PRODUCTS_LINE = "products";
export const PRODUCTS_NEEDED = 5;

/** "Mark everything not checked as OK" must not mark the products line OK on
 *  a shop that does not have enough of them yet. Example: 2 products -> false. */
export function productsMayBeMarkedOk(page?: { products_total?: number | null } | null): boolean {
  return (Number(page?.products_total) || 0) >= PRODUCTS_NEEDED;
}

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

// ── THE READY REASONS (Mock 207-2; more added in Mock 215, Sana 28 Oct 2026:
//    "add more message suggestion as many are missing"). The vendor reads
//    these words exactly; each has its own Urdu and Roman Urdu wording for
//    WhatsApp in lib/whatsapp-words.ts (a test fails if one is missing).
export const PICTURE_REASONS = [
  "Has a phone number or website on it", "No logo uploaded yet", "Picture is blurry", "Too dark", "Not the shop's own logo",
  "Cut off / wrong size", "A person's photo, not a logo", "A photo of the shop, not a logo",
  "Has another company's brand on it", "Writing is too small to read", "Picture is stretched",
];
export const PRODUCT_REASONS = [
  "Phone number or website on the photo", "Phone number or website in the description",
  "Blurry", "Too dark", "Not a real photo of this product", "Messy background - use plain white",
  "Photo copied with another shop's logo", "Wrong product", "Price looks wrong", "Name is not clear",
  "Description is missing", "Size or weight is missing (example: 500 g)", "Wrong shelf",
  "Discount looks too big", "Cannot be sold without a licence", "Same product added twice",
];
const DETAIL_REASONS: Record<string, string[]> = {
  "owner.name": ["Name is not complete", "Spelling is wrong", "Write the full name as on the CNIC"],
  "owner.phone": ["Phone is not answering", "Number looks wrong", "Number is not on WhatsApp", "Number belongs to someone else"],
  "owner.email": ["Email looks wrong", "Email is missing"],
  "shop.name": ["Spelling is wrong", "Not the name on the sign board", "Shop name and type do not match",
                "Has a phone number or city in the name", "Too long - remove extra words"],
  "shop.type": ["Wrong shop type", "Choose a more exact type"],
  "shop.description": ["Description is empty or too short", "Description is not about this shop", "Spelling mistakes",
                       "Has a phone number or website - remove it", "Write simply what you sell"],
  "shop.minimum_order": ["Minimum order looks wrong", "Minimum order is too low", "Minimum order is too high"],
  "shop.hours": ["Opening hours look wrong", "Closing time is before opening time", "AM and PM look swapped",
                 "Shown open 24 hours - is that right?"],
  place: ["Map pin is in the wrong place", "Address is not complete", "Pin is not on the shop",
          "Add a nearby landmark", "Shop is outside the delivery area"],
  payout: ["Account name does not match the owner", "Account number looks wrong", "Details are missing",
           "IBAN is not complete", "Bank name is missing", "Account is not in the owner's or shop's name"],
  licence: ["Photo is not clear", "Number does not match the photo", "Licence is in another name", "Date looks wrong"],
  products: ["No products uploaded", "Fewer than 5 products", "Some products have no photo",
             "Products are not from this shop type", "Same product added twice", "Prices are missing"],
};

/** Every ready reason, once - the WhatsApp words must cover each of them. */
export function allReadyReasons(): string[] {
  return [...new Set([...PICTURE_REASONS, ...PRODUCT_REASONS, ...Object.values(DETAIL_REASONS).flat()])];
}

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

/** HALF-WAY THROUGH A REVIEW (26 Oct 2026): "Reviewing · 5 checked · 2 to
 *  fix" for a shop the office has started ticking but not sent back yet.
 *  null = not started (or already sent back / fixed - those say so). The
 *  server counts the saved ticks (review_checked / review_to_fix). */
export function reviewingLine(r: { review_state?: string | null; review_checked?: number | null;
                                   review_to_fix?: number | null }): string | null {
  if (reviewStateOf(r) !== "new") return null;
  const checked = Number(r?.review_checked) || 0;
  if (checked <= 0) return null;
  const toFix = Number(r?.review_to_fix) || 0;
  return `Reviewing · ${checked} checked` + (toFix > 0 ? ` · ${toFix} to fix` : "");
}

/** Sort the waiting shops by review rank, keeping the chosen order inside each. */
export function sortByReview<T extends { review_state?: string | null }>(rows: T[]): T[] {
  return rows.map((r, i) => ({ r, i }))
    .sort((a, b) => reviewRank(a.r) - reviewRank(b.r) || a.i - b.i)
    .map((x) => x.r);
}
