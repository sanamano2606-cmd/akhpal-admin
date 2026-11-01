// ─────────────────────────────────────────────────────────────────────────────
// CHANGING A SHOP'S TYPE - THE RULES, IN ONE PLACE.  (Mock 222, approved by
// Sana 1 Nov 2026: "Approved".)
//
// Sana, 1 Nov: "there is no shop type changing Option" - she looked on Store
// settings, and the only way was a small pencil on the Stores list. A shop's
// type is not a label. It decides:
//   * where customers find the shop (its department);
//   * how its orders travel: a RIDER in minutes, or a PARCEL in 1-3 days
//     (shop_types.speed, read through expressShopTypes());
//   * its commission, when its store type has its own rate;
//   * and a LIVE shop may become a pharmacy only with a checked, valid drug
//     sale licence (the server refuses it too - _becoming_a_pharmacy).
// So the window says every one of those BEFORE anything is saved.
//
// Nothing here talks to the server. The window asks these functions; the tests
// (tests/mock-222-shop-type.test.ts) ask the same functions.
// ─────────────────────────────────────────────────────────────────────────────
import { SIGNUP_VERTICALS, verticalEmoji, verticalLabel, type Vertical } from "./verticals.ts";

/** The licence fields the store page already receives (state.licence -
 *  shop_licence.public_view on the server). Every field may be missing. */
export type LicenceView = {
  number?: string | null;
  valid_until?: string | null;   // "YYYY-MM-DD"
  has_photo?: boolean;
  ok_at?: string | null;
} | null | undefined;

/** The kinds of shop the window offers: the thirteen departments a NEW shop
 *  may choose (the same thirteen the vendor app shows), and the shop's own
 *  current type FIRST when it is a retired one - so the window never pretends
 *  a "Bakery & Sweets" shop is something else. */
export function typesToOffer(current?: string | null): Vertical[] {
  const now = String(current || "").trim() || "restaurant";
  if (SIGNUP_VERTICALS.some((v) => v.value === now)) return SIGNUP_VERTICALS;
  return [{ value: now, label: verticalLabel(now), emoji: verticalEmoji(now),
            examples: "Its type now - no longer offered to new shops" }, ...SIGNUP_VERTICALS];
}

/** Rider (in minutes) or parcel (1-3 days). `express` is the live list of
 *  rider-delivered types (expressShopTypes()). */
export function isRider(code: string | null | undefined, express: string[]): boolean {
  return express.includes(String(code || "").trim() || "restaurant");
}

export function deliveryWords(code: string | null | undefined, express: string[]): string {
  return isRider(code, express) ? "Rider · in minutes" : "Parcel · 1–3 days";
}

/** Today in Pakistan, "YYYY-MM-DD" - the licence's valid-until is a
 *  Pakistan date (shop_licence.today_pk on the server). */
export function todayPk(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The server's own test (shop_licence.state_of, "ok" or "expiring"): a
 *  number of 3+ characters, a photo, a date not passed, and checked by the
 *  office. Anything missing or unreadable is NOT ok - the window must never
 *  promise a change the server will refuse. */
export function licenceIsGood(lic: LicenceView, today: string = todayPk()): boolean {
  if (!lic) return false;
  const num = String(lic.number || "").replace(/\s+/g, " ").trim();
  const until = String(lic.valid_until || "").slice(0, 10);
  if (num.length < 3 || !lic.has_photo || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false;
  if (until < today) return false;
  return !!lic.ok_at;
}

export const PHARMACY = "pharmacy";

/** Why the shop may NOT become [next], in words - or null when it may.
 *  Only one rule today, the server's: a LIVE (approved) shop becomes a
 *  pharmacy only with a checked, valid licence. A shop still waiting may
 *  switch (Approve asks for the licence later). */
export function whyNot(next: string, shop: { is_approved?: boolean | null; vendor_type?: string | null },
                       lic: LicenceView, today: string = todayPk()): string | null {
  if (next !== PHARMACY || shop.vendor_type === PHARMACY) return null;
  if (shop.is_approved !== true) return null;
  if (licenceIsGood(lic, today)) return null;
  return "This shop is live. A live shop can become a pharmacy only with its checked drug sale licence. "
    + "Add the licence first (Settings › Pharmacy licence), then change the type.";
}

/** {vendor_type: percent or null} from GET /admin/vertical-commissions, or
 *  null when it could not be read (that list needs "Commission"). */
export type TypeRates = Record<string, number | null> | null;

export type CommissionNow = {
  fixed: boolean;                 // a fixed-price store pays no commission
  own: number | null;             // the shop's OWN rate, when it has one
  inUse: number | null;           // what the server says it charges today
};

/** What the commission will be after the change, and whether it changes.
 *  Never guesses: when the new type's rate cannot be read, it says so. */
export function commissionAfter(now: CommissionNow, from: string, to: string, rates: TypeRates):
  { same: boolean | null; words: string } {
  const pct = (n: number | null) => (n == null ? "" : ` ${+n.toFixed(2)}%`);
  if (now.fixed) return { same: true, words: "None - fixed-price store" };
  if (now.own != null) return { same: true, words: `This shop's own rate${pct(now.own)}` };
  if (!rates) return { same: null, words: "Set by the type's rate - Store types › Commission" };
  const before = rates[from] ?? null, after = rates[to] ?? null;
  if (before === after) {
    return { same: true, words: after == null ? `Takal rate${pct(now.inUse)}` : `${verticalLabel(to)} rate${pct(after)}` };
  }
  if (after != null) return { same: false, words: `${verticalLabel(to)} rate${pct(after)}` };
  // From a type with its own rate to one without: the global rate. Today's
  // figure was the OLD type's, so the global number is not known here.
  return { same: false, words: "Takal rate" };
}

export type Change = {
  key: "where" | "delivery" | "commission" | "products" | "pin";
  changes: boolean | null;        // true = orange, false = same, null = not known
  bad?: boolean;                  // red: something a person must fix
  title: string;
  words: string;
};

/** Everything that will be different, for the window and for "Are you sure?". */
export function whatChanges(args: {
  from: string; to: string; express: string[]; hasPin: boolean;
  commission: CommissionNow; rates: TypeRates;
}): Change[] {
  const { from, to, express, hasPin } = args;
  const out: Change[] = [];
  out.push({ key: "where", changes: from !== to, title: "Customers find it under",
             words: from === to ? verticalLabel(to) : `${verticalLabel(from)} → ${verticalLabel(to)}` });
  const rFrom = isRider(from, express), rTo = isRider(to, express);
  out.push({ key: "delivery", changes: rFrom !== rTo, title: "Delivery",
             words: rFrom === rTo ? deliveryWords(to, express)
               : `${deliveryWords(from, express)} → ${deliveryWords(to, express)}` });
  const c = commissionAfter(args.commission, from, to, args.rates);
  out.push({ key: "commission", changes: c.same == null ? null : !c.same, title: "Commission", words: c.words });
  out.push({ key: "products", changes: false, title: "Products", words: "Stay on their shelves" });
  // A rider has to know where to collect - and a rider-delivered shop with no
  // pin is hidden from customers (CLAUDE.md: "No map pin · hidden").
  if (rTo && !rFrom) {
    out.push(hasPin
      ? { key: "pin", changes: false, title: "Map pin", words: "Set - the rider knows where to collect" }
      : { key: "pin", changes: true, bad: true, title: "No map pin",
          words: "Customers cannot see a rider-delivered shop until it is placed on the map" });
  }
  return out;
}
