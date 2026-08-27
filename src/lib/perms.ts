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

export const ALL_SECTIONS = [
  "orders", "restaurants", "customers", "riders", "payments",
  "promos", "analytics", "reports", "settings", "notifications",
] as const;

export const SECTION_LABELS: Record<string, string> = {
  orders: "Orders",
  restaurants: "Restaurants",
  customers: "Customers",
  riders: "Riders",
  payments: "Payments",
  promos: "Promo Codes",
  analytics: "Analytics",
  reports: "Reports",
  settings: "Settings",
  notifications: "Notifications & Banner",
};

/** One plain sentence per section, shown beside its switch on the Admin Users
 *  page. A permission list is only safe to hand out if the person handing it
 *  out can see what each line actually unlocks - "payments" reads harmless
 *  until you spell out that it means marking money as paid. */
export const SECTION_HINTS: Record<string, string> = {
  orders: "See and manage every order.",
  restaurants: "Add, edit and switch stores on or off.",
  customers: "See customer accounts and their order history.",
  riders: "Manage riders, their shifts and their cash.",
  payments: "See who is owed money, and mark payments as paid.",
  promos: "Create, edit and delete discount codes.",
  analytics: "Sales charts and business figures.",
  reports: "Download reports and export data.",
  settings: "Change how the whole system works.",
  notifications: "Send push messages and change the home banner.",
};

/** Sections that move money or change the system for everyone. Flagged in the
 *  interface so they are a deliberate choice, never an accidental tick. */
export const SENSITIVE_SECTIONS: readonly string[] = ["payments", "settings"];

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
 * per-page check is a page somebody will forget. */
export function canAccess(section: string): boolean {
  const { isSuper, sections } = getMyPerms();
  return isSuper || sections.includes(section);
}
