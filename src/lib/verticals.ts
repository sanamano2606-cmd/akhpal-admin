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
}

export const VERTICALS: Vertical[] = [
  { value: "restaurant", label: "Food", emoji: "🍽️" },
  { value: "grocery", label: "Grocery", emoji: "🛒" },
  { value: "fruits_vegetables", label: "Fruit & Veg", emoji: "🥦" },
  { value: "meat_chicken", label: "Meat & Chicken", emoji: "🍗" },
  { value: "pharmacy", label: "Pharmacy", emoji: "💊" },
  { value: "bakery", label: "Bakery", emoji: "🥐" },
  { value: "clothing_store", label: "Fashion", emoji: "👕" },
  { value: "electronics_shop", label: "Electronics", emoji: "📱" },
  { value: "home_appliances", label: "Home", emoji: "🛋️" },
  { value: "furniture_decor", label: "Furniture", emoji: "🪑" },
  { value: "beauty_cosmetics", label: "Beauty", emoji: "💄" },
  { value: "baby_kids", label: "Baby & Kids", emoji: "🍼" },
  { value: "books_stationery", label: "Books", emoji: "📚" },
  { value: "flowers_gifts", label: "Gifts", emoji: "💐" },
  { value: "pet_supplies", label: "Pets", emoji: "🐾" },
  { value: "sports_fitness", label: "Sports", emoji: "🏀" },
  { value: "jewelry_accessories", label: "Jewelry", emoji: "💍" },
  { value: "garden_plants", label: "Garden", emoji: "🪴" },
  { value: "toys_games", label: "Toys", emoji: "🧸" },
  { value: "auto_parts", label: "Auto Parts", emoji: "🚗" },
  { value: "cleaning_supplies", label: "Cleaning", emoji: "🧽" },
];

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
