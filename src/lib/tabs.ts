// THE TABS, THE OPTIONS INSIDE THEM, AND THE THREE RULES THAT READ THEM.
//
// Mock 89, approved by Sana on 17 September 2026:
//
//   "Sub Admin permission will be By Tabs and then if i want a specific option
//    inside that Tab Only so will give only Access to that specific option
//    inside the TAB. and make sure after i give permission to that option so
//    the sub admin strictly has that permission only."
//
// THIS IS THE PANEL'S COPY OF backend/core_tabs.py.
// The catalogue below was GENERATED from that file, not typed out from memory.
// The server is the one that actually refuses a request; this copy exists so
// the Admin Users screen can draw the tick boxes and so the sidebar can hide a
// link the person cannot use. Step 4 adds the test that fails the day the two
// files disagree.
//
// READ THIS BEFORE TRUSTING ANYTHING HERE
// Everything in this file is COSMETIC, exactly like perms.ts. It decides what
// is drawn. It is not a lock. The lock is on the server, in
// backend/app_guard.py, which checks the signed token on every /admin/ request
// and does not care what the browser believes.

export type TabOption = { key: string; label: string; hint?: string };
export type Tab = { key: string; label: string; hint?: string; options: TabOption[] };

export const TABS: Tab[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    hint:
      "Everyone who can sign in sees the Dashboard. The figures on it are already cut down to what the person is allowed.",
    options: [],
  },
  {
    key: "orders",
    label: "Orders",
    hint:
      "Every order, returns, refunds and the parcels desk. For a delivery man, use My Deliveries instead.",
    options: [
      { key: "orders.all", label: "All Orders" },
      { key: "orders.returns", label: "Returns & Refunds" },
      { key: "orders.parcels", label: "Parcels" },
      { key: "orders.offices", label: "Offices", hint: "Adding, renaming and removing the offices parcels pass through." },
    ],
  },
  {
    key: "my-deliveries",
    label: "My Deliveries",
    hint:
      "The delivery man's one page: parcels out for delivery, marked delivered with the customer's code. Opens nothing else anywhere.",
    options: [],
  },
  {
    key: "support",
    label: "Support",
    hint:
      "Read and answer messages from customers. Not the customer list, not orders, not money.",
    options: [],
  },
  {
    key: "reviews",
    label: "Reviews",
    hint:
      "What customers write about shops, riders, Takal and products, including the photographs they attach.",
    options: [
      { key: "reviews.shops", label: "Shops" },
      { key: "reviews.riders", label: "Riders" },
      { key: "reviews.takal", label: "Takal" },
      { key: "reviews.products", label: "Products" },
      { key: "reviews.hidden", label: "Hidden" },
      { key: "reviews.settings", label: "Settings" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    hint:
      "Customer accounts and their order history.",
    options: [],
  },
  {
    key: "riders",
    label: "Riders",
    hint:
      "Riders, their shifts, their cash, and what they are paid.",
    options: [
      { key: "riders.all", label: "All Riders" },
      { key: "riders.earnings", label: "Earnings & Cash" },
      { key: "riders.pay-rules", label: "Pay Rules", hint: "What every rider is paid." },
    ],
  },
  {
    key: "stores",
    label: "Stores",
    hint:
      "Shops: adding them, editing them, what they sell, what Takal keeps, and how reliable they are.",
    options: [
      { key: "stores.all", label: "All Stores" },
      { key: "stores.catalogue", label: "Catalogue" },
      { key: "stores.inventory", label: "Inventory" },
      { key: "stores.commission", label: "Commission", hint: "What Takal keeps from every shop." },
      { key: "stores.reliability", label: "Reliability" },
    ],
  },
  {
    key: "earnings",
    label: "Earnings",
    hint:
      "What Takal itself earned.",
    options: [],
  },
  {
    key: "payments",
    label: "Payments",
    hint:
      "Who is owed money, and marking payments as paid.",
    options: [
      { key: "payments.balances", label: "Balances & Payments" },
      { key: "payments.settlements", label: "By Pay Period" },
      { key: "riders.earnings", label: "Riders" },
      { key: "payments.staff", label: "Staff Pay", hint: "The staff list and paying them. Setting a salary is Settings -> Staff Pay Rules." },
      { key: "payments.methods", label: "Payment Methods", hint: "The payouts page, and switching cash, Easypaisa and JazzCash on or off." },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    hint:
      "Discount codes, banners, welcome screens and messages sent to customers.",
    options: [
      { key: "marketing.codes", label: "Discount Codes" },
      { key: "marketing.banners", label: "Home Banners" },
      { key: "marketing.welcome", label: "Welcome Screens" },
      { key: "marketing.notifications", label: "Send Notification" },
      { key: "marketing.announcements", label: "Announcements" },
    ],
  },
  {
    key: "users",
    label: "Admin Users",
    hint:
      "Adding and removing admins, and giving out permissions. Main Admin only - this is what stops a sub-admin giving permission to anybody, including himself.",
    options: [],
  },
  {
    key: "reports",
    label: "Reports",
    hint:
      "Reports, sales figures and the audit log.",
    options: [
      { key: "reports.overview", label: "Overview" },
      { key: "reports.sales", label: "Sales & Analytics" },
      { key: "reports.audit", label: "Audit Log" },
    ],
  },
  {
    key: "website",
    label: "Website",
    hint:
      "The public website, takalapp.com - its wording, its delivery area and its links.",
    options: [
      { key: "website.front", label: "Front page" },
      { key: "website.area", label: "Delivery area" },
      { key: "website.links", label: "Links" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    hint:
      "How the whole system works: delivery fees, the sign-up switch, the letterhead.",
    options: [
      { key: "settings.general", label: "General" },
      { key: "settings.delivery-fees", label: "Delivery Fees", hint: "What a customer is charged for delivery." },
      { key: "settings.signup-code", label: "Sign-up", hint: "Whether new shops and riders need a phone code to sign up." },
      { key: "settings.letterhead", label: "Letterhead" },
      { key: "settings.urdu-names", label: "Names in Urdu" },
      { key: "settings.staff-pay", label: "Staff Pay Rules", hint: "What a member of staff is paid." },
    ],
  },
  {
    key: "go-live",
    label: "Go Live",
    hint:
      "Clear ALL the internal-tester data so the real business starts from zero. It can only ever be done once and it cannot be undone. Do not give this to anybody.",
    options: [],
  },
];

export const OLD_NAME_MEANS: Record<string, string[]> = {
  "orders": ["orders.all", "orders.returns", "orders.parcels"],
  "customers": ["customers"],
  "riders": ["riders.all"],
  "restaurants": ["stores.all", "stores.inventory", "stores.reliability"],
  "payments": ["payments.balances", "payments.settlements", "riders.earnings", "payments.staff", "payments.methods"],
  "promos": ["marketing.codes", "marketing.banners", "marketing.announcements"],
  "notifications": ["marketing.notifications"],
  "analytics": ["earnings", "reports.sales"],
  "reports": ["reports.overview", "reports.audit"],
  "support": ["support"],
  "reviews": ["reviews.shops", "reviews.riders", "reviews.takal", "reviews.products", "reviews.hidden", "reviews.settings"],
  "delivery": ["my-deliveries"],
  "go_live": ["go-live"],
  "settings": ["orders.offices", "riders.pay-rules", "stores.catalogue", "stores.commission", "settings.staff-pay", "marketing.welcome", "website.front", "website.area", "website.links", "settings.general", "settings.delivery-fees", "settings.signup-code", "settings.letterhead", "settings.urdu-names"],
};

export const ALWAYS_OPEN: readonly string[] = ["dashboard"];
export const MAIN_ADMIN_ONLY: readonly string[] = ["users"];
export const NEW_FORMAT_MARK = "__tabs_v2__";

export const SENSITIVE_KEYS: readonly string[] = [
  "payments", "settings", "go-live", "riders.pay-rules", "stores.commission", "payments.methods", "payments.balances", "settings.staff-pay", "settings.delivery-fees", "settings.signup-code",
];

export const TAB_KEYS: readonly string[] = TABS.map((t) => t.key);
export const OPTION_KEYS: readonly string[] = TABS.flatMap((t) => t.options.map((o) => o.key));
export const ALL_KEYS: ReadonlySet<string> = new Set([...TAB_KEYS, ...OPTION_KEYS]);

const LABELS: Record<string, string> = {};
for (const t of TABS) {
  LABELS[t.key] = t.label;
  for (const o of t.options) if (!(o.key in LABELS)) LABELS[o.key] = `${t.label} → ${o.label}`;
}

/** The words a person would recognise. "Stores → Inventory", not "stores.inventory". */
export function labelOf(key: string): string {
  return LABELS[key] || key;
}

/** The tab a key belongs to. A tab key belongs to itself. */
export function tabOf(key: string): string {
  return key.includes(".") ? key.split(".")[0] : key;
}

/** Was this list saved in the new way? A list with no marker is an OLD one, and
 *  every word in it is one of the fourteen old names.
 *
 *  EIGHT OF THE OLD WORDS ARE ALSO NEW TAB KEYS - orders, customers, riders,
 *  payments, reports, support, reviews, settings. So "riders" on its own cannot
 *  say whether it means the old thing (All Riders, one page) or the new one
 *  (the whole Riders tab, which includes rider pay). Nothing is ever guessed
 *  from the words themselves: the list SAYS which it is. */
export function isNewFormat(saved: readonly string[] | null | undefined): boolean {
  return (saved || []).some((s) => String(s).trim() === NEW_FORMAT_MARK);
}

/** Everything this saved list opens. */
export function expandPermissions(saved: readonly string[] | null | undefined): Set<string> {
  const out = new Set<string>(ALWAYS_OPEN);
  const names = (saved || []).map((s) => String(s).trim()).filter(Boolean);
  const newStyle = names.includes(NEW_FORMAT_MARK);

  for (const name of names) {
    if (name === NEW_FORMAT_MARK) continue;
    // Never grantable. Ignored rather than obeyed, so a stray row in the
    // database can never hand somebody the Admin Users screen.
    if (MAIN_ADMIN_ONLY.includes(name)) continue;

    if (!newStyle) {
      for (const k of OLD_NAME_MEANS[name] || []) out.add(k);
      continue;
    }
    if (!ALL_KEYS.has(name)) continue;
    out.add(name);
    // A tab carries every option inside it, INCLUDING OPTIONS ADDED LATER.
    for (const t of TABS) if (t.key === name) for (const o of t.options) out.add(o.key);
  }
  return out;
}

/** May this account open the screen called `key`? */
export function mayOpen(
  key: string,
  saved: readonly string[] | null | undefined,
  isSuper = false,
): boolean {
  if (isSuper) return true;
  if (MAIN_ADMIN_ONLY.includes(key)) return false;
  if (ALWAYS_OPEN.includes(key)) return true;
  return expandPermissions(saved).has(key);
}

/** The list to SAVE for a sub-admin: the marker, then the keys. */
export function toNewFormat(keys: Iterable<string>): string[] {
  const clean = [...new Set(keys)]
    .filter((k) => ALL_KEYS.has(k) && !MAIN_ADMIN_ONLY.includes(k) && !ALWAYS_OPEN.includes(k))
    .sort();
  return [NEW_FORMAT_MARK, ...clean];
}

/** What an OLD list becomes when this screen opens it, so the tick boxes show
 *  the EXACT places that account opens today - never the whole tab, which would
 *  quietly hand somebody options they never had. */
export function ticksForSavedList(saved: readonly string[] | null | undefined): Set<string> {
  const names = (saved || []).map((s) => String(s).trim()).filter(Boolean);
  if (names.includes(NEW_FORMAT_MARK)) {
    return new Set(names.filter((n) => n !== NEW_FORMAT_MARK && ALL_KEYS.has(n)));
  }
  const got = new Set<string>();
  for (const n of names) for (const k of OLD_NAME_MEANS[n] || []) got.add(k);
  return got;
}

/** How a tab reads on the screen: every option on, some of them, or none. */
export function tabState(
  tab: Tab,
  ticked: ReadonlySet<string>,
): { whole: boolean; chosen: number; total: number } {
  if (ALWAYS_OPEN.includes(tab.key)) return { whole: true, chosen: 0, total: 0 };
  const total = tab.options.length;
  const chosen = tab.options.filter((o) => ticked.has(o.key)).length;
  return { whole: ticked.has(tab.key), chosen, total };
}

/** IN PLAIN WORDS, WHAT THIS PERSON CAN OPEN.
 *
 *  The line at the bottom of Mock 89. A list of keys is not something anybody
 *  can check at a glance; a sentence is. */
export function inPlainWords(ticked: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const t of TABS) {
    if (ALWAYS_OPEN.includes(t.key)) { out.push(t.label); continue; }
    if (ticked.has(t.key)) { out.push(t.options.length ? `the whole ${t.label} tab` : t.label); continue; }
    for (const o of t.options) if (ticked.has(o.key)) out.push(`${t.label} → ${o.label}`);
  }
  return out;
}
