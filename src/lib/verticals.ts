// Store types (verticals) shared across the admin UI. `value` matches
// restaurants.vendor_type in the database and the customer app's switcher.

export interface Vertical {
  value: string;
  label: string;
  emoji: string;
}

export const VERTICALS: Vertical[] = [
  { value: "restaurant", label: "Food", emoji: "🍽️" },
  { value: "grocery", label: "Grocery", emoji: "🛒" },
  { value: "pharmacy", label: "Pharmacy", emoji: "💊" },
  { value: "clothing_store", label: "Fashion", emoji: "👕" },
  { value: "electronics_shop", label: "Electronics", emoji: "📱" },
  { value: "home_appliances", label: "Home", emoji: "🛋️" },
  { value: "beauty_cosmetics", label: "Beauty", emoji: "💄" },
  { value: "bakery", label: "Bakery", emoji: "🥐" },
  { value: "books_stationery", label: "Books", emoji: "📚" },
  { value: "flowers_gifts", label: "Gifts", emoji: "💐" },
  { value: "pet_supplies", label: "Pets", emoji: "🐾" },
  { value: "sports_fitness", label: "Sports", emoji: "🏀" },
  { value: "jewelry_accessories", label: "Jewelry", emoji: "💍" },
  { value: "laundry_cleaning", label: "Laundry", emoji: "🧺" },
  { value: "garden_plants", label: "Garden", emoji: "🪴" },
  { value: "toys_games", label: "Toys", emoji: "🧸" },
];

const BY_VALUE: Record<string, Vertical> = {};
for (const v of VERTICALS) BY_VALUE[v.value] = v;

/** Friendly label for a vendor_type, defaulting legacy/blank to Food. */
export function verticalLabel(value?: string | null): string {
  const v = (value || "").trim() || "restaurant";
  return BY_VALUE[v]?.label ?? "Food";
}

export function verticalEmoji(value?: string | null): string {
  const v = (value || "").trim() || "restaurant";
  return BY_VALUE[v]?.emoji ?? "🍽️";
}
