// Reads the logged-in admin's role/permissions from localStorage (set at login).
//
// ─────────────────────────────────────────────────────────────────────────────
// READ THIS BEFORE TRUSTING ANYTHING IN THIS FILE.
//
// localStorage belongs to the BROWSER, not to us. Anyone can open the browser's
// developer tools and edit "admin_user" by hand - including setting
// is_super_admin to true. So everything here is COSMETIC: it decides which
// links appear and which pages render a friendly "no access" card.
//
// It is NOT a security control and must never be the only thing standing
// between a sub-admin and your data.
//
// The real lock lives on the server, in backend/main.py -> _SECTION_RULES,
// which checks the signed token on every single /admin/ request and does not
// care what the browser believes. A faked is_super_admin gets you a full menu
// and a screen full of 403 errors, which is annoying but harmless.
//
// The layout refreshes this from the server (GET /admin/me) on every load, so
// a hand-edited value is also short-lived.
// ─────────────────────────────────────────────────────────────────────────────

import { mayOpen } from "./tabs.ts";

// THE FOURTEEN OLD WORDS. Kept because navigation.ts still describes every
// link with one of them, and because an account saved before Mock 89 still
// holds them. The Admin Users screen no longer offers them - it offers tabs and
// options from tabs.ts. Step 4 moves navigation.ts onto the new keys and most
// of what is below can then go.
export const ALL_SECTIONS = [
  // "delivery" leads because it is the narrowest permission on the list and the
  // one most often handed to somebody who should get nothing else. Putting it
  // first means the person ticking boxes meets the small key before the big
  // ones, instead of scrolling past "Orders" and settling for that.
  "delivery",
  "orders", "restaurants", "customers", "riders", "payments",
  // Answering customers, and nothing else. Deliberately separate from
  // "customers" - see the note in navigation.ts. (Plan 52.)
  "support",
  // Reviews and nothing else. It used to ride on "restaurants", which meant
  // the only way to let somebody take down an abusive review was to also let
  // them edit, add and switch off every shop. (13 September 2026.)
  "reviews",
  "promos", "analytics", "reports", "settings", "notifications",
  // LAST on the list on purpose - it is the most dangerous switch here and it
  // should be met after every ordinary one, never scrolled past on the way to
  // something else. Sana, 2 September 2026: "Keep that in a separate sidebar
  // tab so when I add a sub-admin I can switch that off for sub-admins." Its
  // own name is what makes that possible; inside "settings" it would have been
  // handed to every sub-admin ever trusted to change a delivery fee.
  "go_live",
] as const;

export const SECTION_LABELS: Record<string, string> = {
  delivery: "Delivery",
  orders: "Orders",
  restaurants: "Restaurants",
  customers: "Customers",
  support: "Support Inbox",
  reviews: "Reviews",
  riders: "Riders",
  payments: "Payments",
  promos: "Promo Codes",
  analytics: "Analytics",
  reports: "Reports",
  settings: "Settings",
  notifications: "Notifications & Banner",
  go_live: "Go Live (clear test data)",
};

/** One plain sentence per section, shown beside its switch on the Admin Users
 *  page. A permission list is only safe to hand out if the person handing it
 *  out can see what each line actually unlocks - "payments" reads harmless
 *  until you spell out that it means marking money as paid. */
export const SECTION_HINTS: Record<string, string> = {
  delivery:
    "Only parcels that are out for delivery, and only to mark them delivered " +
    "with the customer's code. Nothing else in the panel.",
  orders:
    "See and manage every order — this also opens Returns and Parcels. " +
    "For a delivery man, use Delivery instead.",
  restaurants: "Add, edit and switch stores on or off.",
  customers: "See customer accounts and their order history.",
  support:
    "Read and answer messages from customers, and nothing else — not the " +
    "customer list, not orders, not money. A conversation can carry an " +
    "address, a phone number and a photo, so this is its own key.",
  reviews:
    "Approve, hide or delete what customers write about shops, riders, Takal " +
    "and products — including the photographs they attach. Opens nothing else.",
  riders: "Manage riders, their shifts and their cash.",
  payments: "See who is owed money, and mark payments as paid.",
  promos: "Create, edit and delete discount codes.",
  analytics:
    "Sales charts and business figures — and the money shown on the Dashboard " +
    "(revenue and commission).",
  reports: "Download reports and export data.",
  settings: "Change how the whole system works.",
  notifications: "Send push messages and change the home banner.",
  go_live:
    "Clear ALL the internal-tester data — every order, review and payment — " +
    "so the real business starts from zero. It can only ever be done once, and " +
    "it cannot be undone. Do not give this to anybody.",
};

/** Sections that move money or change the system for everyone. Flagged in the
 *  interface so they are a deliberate choice, never an accidental tick. */
export const SENSITIVE_SECTIONS: readonly string[] = ["payments", "settings", "go_live"];

export function getMyPerms(): { isSuper: boolean; sections: string[] } {
  if (typeof window === "undefined") return { isSuper: false, sections: [] };
  try {
    const me = JSON.parse(localStorage.getItem("admin_user") || "{}");
    return {
      isSuper: !!me.is_super_admin,
      sections: Array.isArray(me.permissions) ? me.permissions.map(String) : [],
    };
  } catch {
    return { isSuper: false, sections: [] };
  }
}

/** Can the current admin access a given section? Main Admin can access everything.
 *
 * Used by the dashboard layout (see sectionForPath there), which applies it to
 * EVERY page at once. Do not add a copy of this check to individual pages - a
 * per-page check is a page somebody will forget.
 *
 * IT ASKS mayOpen(), AND IT IS NOW EXACT.  (Mock 89, step 4.)
 *
 * In step 3 this had to guess: navigation.ts still spoke in the fourteen old
 * words, so a new-style account was matched by turning the old word back into
 * the places it used to mean, and the answer was deliberately a little too
 * generous. Step 4 put the real key on every link, so the question asked here
 * is now the same question the server answers, and the guessing is gone.
 *
 * mayOpen() reads BOTH kinds of saved list - a new one of tabs and options, and
 * an old one of the fourteen words - and it knows a tab carries every option
 * inside it. */
export function canAccess(section: string): boolean {
  const { isSuper, sections } = getMyPerms();
  return mayOpen(section, sections, isSuper);
}

