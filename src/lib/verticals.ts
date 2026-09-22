// Store types (verticals) shared across the admin UI. `value` matches
// restaurants.vendor_type in the database and the customer app's switcher.
//
// AUDIT 15 SEPTEMBER 2026 — THIS LIST HAD DRIFTED.
// It held 16 kinds. The server accepts 21 (routers/restaurants_shared.py,
// VALID_VENDOR_TYPES, standing in for the `shop_types` table) and the vendor
// app offers the same 21. So the panel could not create, filter or re-type a
// Fruit & Veg, Meat, Baby & Kids, Auto Parts, Furniture or Cleaning shop — and
// it showed every one of them as "🍽️ Food". It also OFFERED "Laundry", which
// the server refuses. The backend test
// tests/test_the_three_shop_doors_agree.py now fails if the two lists differ.

export interface Vertical {
  value: string;
  label: string;
  emoji: string;
  /** False = a section, not a department. Still valid for the shops already on
   *  it; simply not offered when a NEW shop is created. See migration 099. */
  offeredAtSignup?: boolean;
  /** The line shown under the tile on the create-store screen: the kinds of
   *  shop that belong in this department. This is the actual fix for the
   *  complaint — a tile saying only "Food & Drinks" tells a baker no more than
   *  "Food" did. */
  examples?: string;
}

// MOCK 113, 22 SEPTEMBER 2026 — TWO THINGS WERE WRONG WITH THIS LIST.
//
// 1. SIXTEEN OF THE TWENTY-ONE NAMES DID NOT MATCH THE VENDOR APP.
//    A vendor was told on the phone to pick "Clothing Store"; this panel
//    called the same shop "Fashion". The names below are now copied from
//    `shop_types.name` in the database, which is the one list. If you change
//    one here, change it there in the same breath — or better, do not change
//    it here at all.
//
// 2. EIGHT OF THEM WERE NOT DEPARTMENTS AT ALL.
//    "Bakery" sat beside "Food" as if they were equals, when Bakery lives
//    INSIDE Food & Drinks. Those eight are RETIRED: still perfectly good for
//    the shops already on them — which keep their type, their rider delivery
//    and their commission — but no longer offered when a NEW shop is created.
//    `offeredAtSignup: false` marks them, and ONLY the create-store screen
//    reads it. Every other screen still shows all twenty-one, because a
//    commission still has to be settable on a retired type and a shop of that
//    type still has to be named, filtered and edited.
//
// The whole list stays here, all twenty-one, and the backend test
// test_the_three_shop_doors_agree.py fails if a code is added or lost.
export const VERTICALS: Vertical[] = [
  { value: "restaurant", label: "Food & Drinks", emoji: "🍽️", offeredAtSignup: true, examples: "Restaurant, cafe, bakery, BBQ" },
  { value: "grocery", label: "Grocery & Fresh", emoji: "🛒", offeredAtSignup: true, examples: "Kiryana, fruit & veg, meat" },
  { value: "pharmacy", label: "Health & Pharmacy", emoji: "💊", offeredAtSignup: true, examples: "Medical store, health items" },
  { value: "beauty_cosmetics", label: "Beauty & Personal Care", emoji: "💄", offeredAtSignup: true, examples: "Cosmetics, skin & hair care" },
  { value: "clothing_store", label: "Fashion", emoji: "👕", offeredAtSignup: true, examples: "Clothes, shoes, bags, jewellery" },
  { value: "electronics_shop", label: "Electronics & Mobiles", emoji: "📱", offeredAtSignup: true, examples: "Mobiles, laptops, accessories" },
  { value: "home_appliances", label: "Home & Living", emoji: "🛋️", offeredAtSignup: true, examples: "Furniture, appliances, garden" },
  { value: "baby_kids", label: "Baby, Kids & Toys", emoji: "🍼", offeredAtSignup: true, examples: "Diapers, baby clothes, toys" },
  { value: "sports_fitness", label: "Sports & Outdoors", emoji: "🏀", offeredAtSignup: true, examples: "Cricket, gym, sportswear" },
  { value: "books_stationery", label: "Books, Stationery & Hobbies", emoji: "📚", offeredAtSignup: true, examples: "Books, pens, art, music" },
  { value: "pet_supplies", label: "Pets", emoji: "🐾", offeredAtSignup: true, examples: "Pet food, cages, grooming" },
  { value: "flowers_gifts", label: "Flowers & Gifts", emoji: "💐", offeredAtSignup: true, examples: "Flowers, cakes, gift boxes" },
  { value: "auto_parts", label: "Automotive", emoji: "🚗", offeredAtSignup: true, examples: "Car & bike parts, oils" },
  { value: "bakery", label: "Bakery & Sweets", emoji: "🥐", offeredAtSignup: false, examples: "Retired - now inside Food & Drinks" },
  { value: "fruits_vegetables", label: "Fruits & Vegetables", emoji: "🥦", offeredAtSignup: false, examples: "Retired - now inside Grocery & Fresh" },
  { value: "meat_chicken", label: "Meat & Chicken", emoji: "🍗", offeredAtSignup: false, examples: "Retired - now inside Grocery & Fresh" },
  { value: "cleaning_supplies", label: "Cleaning & Laundry Supplies", emoji: "🧽", offeredAtSignup: false, examples: "Retired - now inside Grocery & Fresh" },
  { value: "furniture_decor", label: "Furniture & Decor", emoji: "🪑", offeredAtSignup: false, examples: "Retired - now inside Home & Living" },
  { value: "garden_plants", label: "Garden & Plants", emoji: "🪴", offeredAtSignup: false, examples: "Retired - now inside Home & Living" },
  { value: "jewelry_accessories", label: "Jewellery & Accessories", emoji: "💍", offeredAtSignup: false, examples: "Retired - now inside Fashion" },
  { value: "toys_games", label: "Toys & Games", emoji: "🧸", offeredAtSignup: false, examples: "Retired - now inside Baby, Kids & Toys" },
];

/** The store types offered when a NEW shop is created — the thirteen
 *  departments, in the order the customer's category tiles are in.
 *
 *  This is the panel's copy of `/categories/shop-types?for_signup=true`. It is
 *  the same thirteen the vendor app shows, for the same reason: a vendor and
 *  an admin creating the same shop must be answering the same question. */
export const SIGNUP_VERTICALS: Vertical[] =
  VERTICALS.filter((v) => v.offeredAtSignup !== false);

// Names for kinds that are NOT offered any more but may still be on an old
// row. Shown, never offered. ("laundry_cleaning" was in this list until the
// 15 September 2026 audit; the server has never accepted it.)
const RETIRED: Record<string, Vertical> = {
  laundry_cleaning: { value: "laundry_cleaning", label: "Laundry", emoji: "🧺" },
};

const BY_VALUE: Record<string, Vertical> = { ...RETIRED };
for (const v of VERTICALS) BY_VALUE[v.value] = v;

/** "fruits_vegetables" -> "Fruits Vegetables". Used only for a kind this file
 *  does not know yet (one added in the database today). Better than the old
 *  fallback, which called every unknown shop "Food". */
function fromCode(code: string): string {
  return code
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Friendly label for a vendor_type. Blank means Food (the column default). */
export function verticalLabel(value?: string | null): string {
  const v = (value || "").trim() || "restaurant";
  return BY_VALUE[v]?.label ?? fromCode(v);
}

export function verticalEmoji(value?: string | null): string {
  const v = (value || "").trim() || "restaurant";
  return BY_VALUE[v]?.emoji ?? "🏪";
}

/** The options for a "store type" dropdown. A shop whose current type is not
 *  on the list (a retired or brand-new kind) still gets its own option, so
 *  the box shows the truth instead of silently reading "Food" — and picking
 *  something else is a deliberate change, not an accident. */
export function verticalOptions(current?: string | null): Vertical[] {
  const v = (current || "").trim();
  if (!v || VERTICALS.some((x) => x.value === v)) return VERTICALS;
  return [{ value: v, label: verticalLabel(v), emoji: verticalEmoji(v) }, ...VERTICALS];
}
