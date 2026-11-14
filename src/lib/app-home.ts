// ─────────────────────────────────────────────────────────────────────────────
// MARKETING -> APP HOME (Mock 244, APPROVED by Sana 11 Nov 2026)
//
// The rules the PAGE needs - names, choices, readable colours. The server
// (backend/home_layout.py) is the one that decides what may be published;
// these only let the page say it straight away, as you type, and draw the
// preview. Numbers and names here must match the server's - a test compares.
// ─────────────────────────────────────────────────────────────────────────────

export type When = { from_date?: string; to_date?: string; from_time?: string; to_time?: string; ready?: string };
export type Block = { key: string; on: boolean; where: "all" | "mingora" | "matta"; when: When };
export type PicItem = { product_id?: string; url?: string };
export type Pic = {
  source: "auto" | "takal" | "live" | "own"; items: PicItem[]; change_seconds: number; motion: "fade" | "slide";
  size: number; fit: "cover" | "contain"; shape: "circle" | "round" | "square"; place: "br" | "tr" | "left" | "full";
  line: boolean; line_color: string; line_width: number; shadow: boolean; fade: boolean;
  /** Mock 246: with fewer than AUTO_MIN live pictures - the fixed picture, or what there is. */
  fewer: "fixed" | "any";
};
export type Card = {
  key: CardKey; on: boolean; name_en: string; name_ur: string; line_en: string; line_ur: string;
  button_en: string; button_ur: string; bg1: string; bg2: string; name_color: string; line_color: string;
  text_size: "normal" | "big"; bold: boolean; words_at: "top" | "bottom"; symbol: string;
  pin_color: string; pin_place: "none" | "tl" | "tr"; pic: Pic;
};
export type TabItemLook = { code: string; on: boolean; name_en: string; name_ur: string; pic: Pic };
export type Tabs = {
  style: "tile" | "circle" | "square" | "chip"; chosen_fill: string; chosen_words: string; ring: string;
  ring_width: number; tile: string | null; line_color: string; size: number; shrink: boolean; stick: boolean;
  first: string; items: TabItemLook[];
  /** Mock 246: the whole row - Takal's live pictures or the fixed ones, and
   *  how often they change (0 = never). */
  pics: "auto" | "takal"; pics_seconds: number;
};
export type Look = {
  id: string; name: string; normal: boolean; from_date: string; to_date: string;
  cards: { style: CardStyle; items: Card[] }; tabs: Tabs;
};
export type Collection = {
  id: string; title_en: string; title_ur: string; fill: "products" | "shops" | "rule"; ids: string[];
  rule: { kind?: "under_price" | "new_shops"; max?: number; type?: string; days?: number };
};
export type Rain = { on: boolean; kind: string; text_en: string; text_ur: string; until: string; where: "all" | "mingora" | "matta" };
export type Layout = { v: 1; pics_v?: number; blocks: Block[]; rain: Rain; collections: Collection[]; looks: Look[] };

export type CardKey = "food" | "fresh" | "health" | "market";
export type CardStyle = "soft" | "blend" | "bigpic" | "pictop";

/** The blocks the office may move, in today's order (backend BLOCK_KEYS). */
export const BLOCK_KEYS = ["offers", "departments", "popular", "order_again", "deals", "recently_viewed", "shops_near"] as const;

export const BLOCK_NAMES: Record<string, { name: string; note: string }> = {
  offers: { name: "Offers", note: "The offer code, Home Banners and Home Shops - one sliding row" },
  departments: { name: "Shop by department", note: "The 4 cards - design them in 🗂 4 cards" },
  popular: { name: "Popular in the chosen tab", note: "Changes with the tab on view" },
  order_again: { name: "Order again", note: "Only for customers who ordered before" },
  deals: { name: "Deals & combos", note: "Shows on the Food tab only" },
  recently_viewed: { name: "Recently viewed", note: "Only when the customer looked at products" },
  shops_near: { name: "Shops near you", note: "Open shops first" },
};

/** What always stays where it is - shown in the list, locked. */
export const FIXED_TOP = [
  { name: "Search bar", note: "Always on top" },
  { name: "Top round tabs", note: "Design them in ⭕ Top tabs" },
  { name: "Announcement", note: "Set in Marketing → Announcements" },
  { name: "Live order card", note: "Shows only while an order is on the way" },
];
export const FIXED_BOTTOM = { name: "Product feed", note: "The long list at the end - it keeps loading, so it stays last" };

export const CARD_NAMES: Record<CardKey, string> = {
  food: "Food & Drinks", fresh: "Grocery & Fresh", health: "Health & Pharmacy", market: "Marketplace",
};
/** The app's own small lines (customer_app strings_en.dart). */
export const CARD_LINES: Record<CardKey, string> = {
  food: "Restaurant taste, now at home", fresh: "Fresh and good, every day",
  health: "Your health comes first", market: "Everything for home, one place",
};
/** The app's own Urdu words for the cards (customer_app strings_ur.dart) -
 *  shown in the Urdu boxes so an empty box says what the phone will show. */
export const CARD_NAMES_UR: Record<CardKey, string> = {
  food: "کھانا اور مشروبات", fresh: "گروسری اور تازہ", health: "صحت اور دوائیں", market: "بازار",
};
export const CARD_LINES_UR: Record<CardKey, string> = {
  food: "ریسٹورنٹ کا ذائقہ، اب گھر پر", fresh: "تازہ اور معیاری، روزانہ",
  health: "آپ کی صحت، ہماری ترجیح", market: "گھر کا ہر سامان، ایک جگہ",
};
export const CARD_PHOTOS: Record<CardKey, string> = {
  food: "/app-home/cards/food_and_drinks_1.jpg", fresh: "/app-home/cards/fruits_vegetables_1.jpg",
  health: "/app-home/cards/pharmacy_1.jpg", market: "/app-home/cards/electronics_shop_2.jpg",
};
export const POSITIONS = ["top left", "top right", "bottom left", "bottom right"];

export const CARD_STYLES: { key: CardStyle; name: string; note: string }[] = [
  { key: "soft", name: "Soft grey", note: "as today" },
  { key: "blend", name: "Colour blend", note: "two colours, a button" },
  { key: "bigpic", name: "Big picture", note: "photo fills it" },
  { key: "pictop", name: "Picture on top", note: "photo, then words" },
];
export const TAB_STYLES: { key: Tabs["style"]; name: string; note: string }[] = [
  { key: "tile", name: "Photo tile", note: "as today" },
  { key: "circle", name: "Circle only", note: "photo + name pill" },
  { key: "square", name: "Square photo", note: "round corners" },
  { key: "chip", name: "Rounded chip", note: "a tall pill" },
];
export const SYMBOLS: { key: string; icon: string }[] = [
  { key: "none", icon: "None" }, { key: "food", icon: "🍽" }, { key: "cart", icon: "🛒" },
  { key: "health", icon: "✚" }, { key: "gift", icon: "🎁" }, { key: "moon", icon: "🌙" },
  { key: "star", icon: "⭐" }, { key: "fire", icon: "🔥" }, { key: "bag", icon: "🛍" }, { key: "leaf", icon: "🌿" },
];
export const READY_TIMES: { key: string; name: string }[] = [
  { key: "breakfast", name: "Breakfast 7 – 11 AM" }, { key: "lunch", name: "Lunch 12 – 3 PM" },
  { key: "dinner", name: "Dinner 7 – 11 PM" }, { key: "sehri", name: "Sehri (2 hours before dawn)" },
  { key: "iftar", name: "Iftar (2 hours before sunset)" }, { key: "jumma", name: "Jumma (Friday)" },
  { key: "weekend", name: "Weekend (Sat – Sun)" },
];
export const RAIN_KINDS: { key: string; name: string; en: string; ur: string }[] = [
  { key: "rain", name: "🌧 Rain", en: "Heavy rain in Swat - delivery may take a little longer.", ur: "بارش کی وجہ سے ڈیلیوری میں تھوڑی دیر ہو سکتی ہے" },
  { key: "busy", name: "🔥 Very busy", en: "Very busy right now - your order may take a little longer.", ur: "اس وقت بہت رش ہے - آرڈر میں تھوڑی دیر ہو سکتی ہے" },
  { key: "snow", name: "❄️ Snow on roads", en: "Snow on the roads - riders are driving slowly and safely.", ur: "سڑکوں پر برف ہے - رائیڈر آہستہ اور احتیاط سے آ رہے ہیں" },
  { key: "jumma", name: "🕌 Jumma break", en: "Jumma break - orders resume after prayers.", ur: "جمعہ کا وقفہ - نماز کے بعد آرڈر جاری رہیں گے" },
];

/** The app's own short tab names (customer_app shop_types.dart _tab). */
export const TAB_NAMES: Record<string, string> = {
  restaurant: "Food", grocery: "Grocery", pharmacy: "Health", clothing_store: "Fashion",
  electronics_shop: "Electronics", baby_kids: "Baby & Toys", flowers_gifts: "Flowers",
  beauty_cosmetics: "Beauty", home_appliances: "Home", sports_fitness: "Sports",
  books_stationery: "Books", pet_supplies: "Pets", auto_parts: "Automotive",
};

/** The app's own fall-back names (customer_app shop_types.dart _short): a
 *  type with no one-word tab name - a retired one like furniture_decor -
 *  shows this, never its code. */
export const TAB_SHORT: Record<string, string> = {
  fruits_vegetables: "Fruits & Veg", bakery: "Bakery", meat_chicken: "Meat & Chicken",
  jewelry_accessories: "Jewellery", furniture_decor: "Furniture", toys_games: "Toys",
  garden_plants: "Garden", cleaning_supplies: "Cleaning",
};
/** The app's one-word Urdu tab names (customer_app shop_types.dart _tabUr). */
export const TAB_NAMES_UR: Record<string, string> = {
  restaurant: "کھانا", grocery: "کریانہ", fruits_vegetables: "پھل سبزی", pharmacy: "صحت",
  bakery: "بیکری", beauty_cosmetics: "بیوٹی", meat_chicken: "گوشت", clothing_store: "فیشن",
  electronics_shop: "الیکٹرانکس", home_appliances: "گھر", baby_kids: "بچے",
  jewelry_accessories: "زیورات", sports_fitness: "کھیل", books_stationery: "کتابیں",
  furniture_decor: "فرنیچر", pet_supplies: "پالتو", flowers_gifts: "پھول", auto_parts: "گاڑیاں",
  toys_games: "کھلونے", garden_plants: "باغبانی", cleaning_supplies: "صفائی",
};
/** The name under a round tab, as the phone shows it when the office wrote none. */
export function tabName(code: string): string {
  if (TAB_NAMES[code]) return TAB_NAMES[code];
  if (TAB_SHORT[code]) return TAB_SHORT[code];
  const words = code.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : code;
}

/** The same 4.5 the server demands (home_layout.MIN_CONTRAST). */
export const MIN_CONTRAST = 4.5;
export const SOFT_TILE = "#F6F6F3";

export function isHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v || "");
}

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast, 1 - 21, rounded like the server. */
export function contrast(a: string, b: string): number {
  if (!isHex(a) || !isHex(b)) return 21;
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

/** `a` blended `t` of the way to `b` (backend home_layout.mix). */
export function mix(a: string, b: string, t: number): string {
  if (!isHex(a) || !isHex(b)) return a;
  const p = (s: string, i: number) => parseInt(s.slice(1 + i, 3 + i), 16);
  return "#" + [0, 2, 4].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
    .toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** The colours a card's words sit on (backend card_backgrounds). */
export function cardBackgrounds(style: CardStyle, c: Card): string[] {
  if (style === "bigpic") return [];
  if (style === "pictop") return ["#FFFFFF"];
  if (style === "blend") return [c.bg1, mix(c.bg1, c.bg2, 0.3)];
  return [c.bg1];
}

/** The worst contrast of a card's name and small line - for the green tick. */
export function cardReadable(style: CardStyle, c: Card): { name: number; line: number; ok: boolean } {
  const bgs = cardBackgrounds(style, c);
  const worst = (col: string) => (bgs.length ? Math.min(...bgs.map((b) => contrast(col, b))) : 21);
  const name = worst(c.name_color), line = worst(c.line_color);
  return { name, line, ok: name >= MIN_CONTRAST && line >= MIN_CONTRAST };
}

/** Today's tabs, for "Reset to today". */
export function defaultTabs(): Tabs {
  return { style: "tile", chosen_fill: "#FFFF00", chosen_words: "#000000", ring: "#000000", ring_width: 0,
    tile: SOFT_TILE, line_color: "#E5E5E5", size: 0.9, shrink: true, stick: true, first: "", items: [],
    pics: "auto", pics_seconds: 0 };
}

export function defaultPic(forTab = false): Pic {
  return { source: "auto", items: [], change_seconds: 0, motion: "fade", size: forTab ? 0.9 : 0.43,
    fit: "cover", shape: "circle", place: "br", line: true, line_color: "#FFFFFF", line_width: 4,
    shadow: false, fade: false, fewer: "fixed" };
}

export function defaultCard(key: CardKey): Card {
  return { key, on: true, name_en: "", name_ur: "", line_en: "", line_ur: "", button_en: "", button_ur: "",
    bg1: SOFT_TILE, bg2: SOFT_TILE, name_color: "#000000", line_color: "#6E6E68", text_size: "normal",
    bold: true, words_at: "top", symbol: "none", pin_color: "#FFFFFF", pin_place: "none",
    pic: { ...defaultPic(), change_seconds: AUTO_SECONDS } };
}

export function newLook(name: string): Look {
  return { id: "look-" + Math.random().toString(36).slice(2, 10), name, normal: false, from_date: "", to_date: "",
    cards: { style: "soft", items: (Object.keys(CARD_NAMES) as CardKey[]).map(defaultCard) }, tabs: defaultTabs() };
}

export function newCollection(): Collection {
  return { id: "c" + Math.random().toString(36).slice(2, 10), title_en: "", title_ur: "", fill: "products", ids: [], rule: {} };
}

/** "10 – 12 Mar", "From 10 Mar", "Always" - for the lists. */
export function whenWords(w: When | undefined): string {
  if (!w) return "Always";
  const d = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const parts: string[] = [];
  if (w.from_date && w.to_date) parts.push(w.from_date === w.to_date ? d(w.from_date) : `${d(w.from_date)} – ${d(w.to_date)}`);
  if (w.from_time && w.to_time) parts.push(`${w.from_time} – ${w.to_time}`);
  if (w.ready) parts.push(READY_TIMES.find((r) => r.key === w.ready)?.name.split(" (")[0] || w.ready);
  return parts.length ? parts.join(" · ") : "Always";
}

/** A block's display name - a collection is called by its title. */
export function blockName(key: string, layout: Layout): string {
  if (BLOCK_NAMES[key]) return BLOCK_NAMES[key].name;
  const id = key.startsWith("collection:") ? key.slice(11) : "";
  const c = layout.collections.find((x) => x.id === id);
  return c ? `📚 ${c.title_en || "New collection"}` : key;
}

/** The look on for a Pakistan day (yyyy-mm-dd), like the app's lookFor. */
export function lookOn(layout: Layout, day: string): Look {
  for (const l of layout.looks) {
    if (l.normal || !l.from_date || !l.to_date) continue;
    if (day >= l.from_date && day <= l.to_date) return l;
  }
  return layout.looks.find((l) => l.normal) || layout.looks[0];
}

/** Today in Pakistan, yyyy-mm-dd. */
export function pkToday(now = new Date()): string {
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** The 10 km towns (same points as lib/shop-location.ts HOME_TOWNS). */
export const TOWN_POINTS = { mingora: { lat: 34.7795, lon: 72.3607 }, matta: { lat: 34.925, lon: 72.4144 } };

// ── WHEN: the same rules as the app (customer_app services/home_layout.dart) ──

/** Minutes after midnight, Pakistan time, when the sun is `angle` degrees
 *  below the horizon over Swat - the app's swatSunMinutes, for the preview. */
export function swatSunMinutes(day: string, angle: number, morning: boolean): number {
  const lat = 34.7795, lon = 72.3607, tz = 5;
  const [y, m, d] = day.split("-").map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const g = (2 * Math.PI / 365) * (n - 1);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const phi = (lat * Math.PI) / 180, h = (-angle * Math.PI) / 180;
  const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  const ha = (Math.acos(Math.max(-1, Math.min(1, cosH))) * 180) / Math.PI;
  const noon = 720 - 4 * lon - eot + tz * 60;
  return Math.round(morning ? noon - 4 * ha : noon + 4 * ha);
}

function hhmm(s?: string): number {
  if (!s || !/^\d{2}:\d{2}$/.test(s)) return -1;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
}

/** Is a block's "when" on, on Pakistan `day` at `minute` past midnight? */
export function readyNow(w: When | undefined, day: string, minute: number): boolean {
  if (!w) return true;
  if (w.from_date && day < w.from_date) return false;
  if (w.to_date && day > w.to_date) return false;
  const a = hhmm(w.from_time), b = hhmm(w.to_time);
  if (a >= 0 && b >= 0 && !(a <= b ? minute >= a && minute < b : minute >= a || minute < b)) return false;
  if (w.ready) {
    const wd = new Date(day + "T12:00:00Z").getUTCDay(); // 0 Sunday
    switch (w.ready) {
      case "breakfast": return minute >= 420 && minute < 660;
      case "lunch": return minute >= 720 && minute < 900;
      case "dinner": return minute >= 1140 && minute < 1380;
      case "sehri": { const f = swatSunMinutes(day, 18, true); return minute >= f - 120 && minute < f; }
      case "iftar": { const s = swatSunMinutes(day, 0.833, false) + 1; return minute >= s - 120 && minute < s; }
      case "jumma": return wd === 5;
      case "weekend": return wd === 6 || wd === 0;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 246 - TAKAL PICKS LIVE PICTURES (Sana, 14 Nov 2026: "Approved A")
//
// "auto" = real product photos of shops that are open and can deliver to the
// customer, picked by the server (backend/home_pictures.py). It is the NORMAL
// choice. These numbers match backend/home_layout.py - a test compares.
// ─────────────────────────────────────────────────────────────────────────────

/** The fewest live pictures a card shows (backend AUTO_MIN). */
export const AUTO_MIN = 2;
/** How often a card's live picture changes when nobody said (backend AUTO_SECONDS). */
export const AUTO_SECONDS = 4;

export type LivePicture = { url: string; shop: string; shop_id?: string };
export type LivePictures = {
  town: string; min: number;
  cards: Partial<Record<CardKey, LivePicture[]>>;
  tabs: Record<string, LivePicture[]>;
  tab_card: Record<string, CardKey>;
};

/** Food and grocery pictures fill the space; a medicine box or a dress shows
 *  whole - the same rule the app keeps (search cards). */
export function liveFit(card: CardKey | undefined): "cover" | "contain" {
  return card === "food" || card === "fresh" ? "cover" : "contain";
}

/** The live pictures a picture setting would really show, or [] when it shows
 *  its fixed picture (too few, or not "auto"). */
export function liveShown(pic: Pic, live: LivePicture[] | undefined, min = AUTO_MIN): LivePicture[] {
  if (pic.source !== "auto" || !live) return [];
  const need = pic.fewer === "any" ? 1 : min;
  return live.length >= need ? live : [];
}

/** A tab follows its row: "auto" on a tab means "as the row says". */
export function tabLiveShown(tabs: Tabs, pic: Pic, live: LivePicture[] | undefined, min = AUTO_MIN): LivePicture[] {
  if (tabs.pics !== "auto") return [];
  return liveShown({ ...pic, fewer: "fixed" }, live, min);
}
