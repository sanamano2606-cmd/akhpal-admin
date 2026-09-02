// THE SIDEBAR, AND WHO MAY SEE EACH LINE.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS
//
// All of this used to live inside dashboard/layout.tsx, mixed in with the
// markup that draws the menu. That made two things impossible to see at a
// glance:
//
//   1. whether a link's permission matches the one the SERVER enforces, and
//   2. whether a permission that exists is actually used by anything.
//
// Both had gone wrong. Three pages asked for a permission the server does not
// check for them, so the page opened and then failed. And one permission -
// "notifications" - was offered on the Admin Users screen, with a label and a
// helpful description, while unlocking absolutely nothing.
//
// The fix is not cleverness. It is putting the two lists next to each other in
// one file, where a person can read them side by side - and a test can compare
// them. See SERVER_RULES below and tests/navigation.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BarChart3, ShoppingCart, Building2, Users, UserCircle, Bike, CreditCard,
  Settings, FileText, Megaphone, Truck,
} from "lucide-react";

/** Special values a `section` can take, besides a real permission name. */
export const ALWAYS = null;
export const SUPER_ONLY = "__super__";

/**
 * What a link needs before it is shown.
 *
 *  null          - everyone signed in
 *  "__super__"   - Main Admin only
 *  "orders"      - that one permission
 *  ["a","b"]     - ALL of them. Used where a page reads with one permission
 *                  and writes with another, so showing it to somebody holding
 *                  only half would give them a screen they cannot use.
 */
export type Section = string | string[] | null;

/**
 * The sidebar used to be 28 links under six headings - ORDERS, STORES, PEOPLE,
 * FINANCE, MARKETING, SYSTEM - because 28 links in one column is unreadable.
 * With one line per domain the headings became noise: a heading above a single
 * item tells you nothing you cannot see.
 *
 * There is one divider left, between the work and the system. Everything above
 * it is a thing you manage day to day; everything below is a report or a
 * setting you visit occasionally.
 */
export const GROUP_ORDER = ["WORK", "SYSTEM"] as const;

export type Group = (typeof GROUP_ORDER)[number] | "TOP";

/** A tab inside a domain. Same permission rules as a sidebar line. */
export type TabItem = {
  label: string;
  href: string;
  section: Section;
  /** The /admin/ addresses this tab calls, so a test can check its permission. */
  calls: string[];
};

export type NavItem = {
  label: string;
  href: string;
  icon: any;
  section: Section;
  group: Group;
  /**
   * The tabs across the top of this domain, if it has any.
   *
   * THEY LIVE HERE, not in the layout file that draws them, so there is exactly
   * ONE list of what exists in this panel and who may see it. A tab hidden in a
   * layout file is a tab no test can check - and unchecked permissions are how
   * four of them came to disagree with the server in the first place.
   */
  tabs?: TabItem[];
  /** The /admin/ addresses this page calls. Kept here so the permission above
   *  can be CHECKED against SERVER_RULES by a test, instead of taken on trust.
   *  Prefix an entry with "write:" when the page changes that data - one
   *  address (the office list) needs a stronger permission to change than to
   *  read, exactly as the server has it. */
  calls: string[];
};

export const NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, section: ALWAYS, group: "TOP",
    calls: ["/admin/dashboard"] },

  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, section: "orders", group: "WORK",
    calls: ["/admin/orders"],
    tabs: [
      { label: "All Orders", href: "/dashboard/orders", section: "orders",
        calls: ["/admin/orders"] },
      { label: "Returns & Refunds", href: "/dashboard/orders/returns", section: "orders",
        calls: ["/admin/returns"] },
      { label: "Parcels", href: "/dashboard/orders/parcels", section: "orders",
        calls: ["/admin/hub-parcels", "/admin/hub-parcels/staff", "/admin/hubs"] },
      // The office list moved out of Settings. CHANGING an office still needs
      // the settings permission - that is what the server enforces, and this
      // must not quietly widen it.
      { label: "Offices", href: "/dashboard/orders/offices", section: "settings",
        calls: ["write:/admin/hubs"] },
    ] },

  { label: "My Deliveries", href: "/dashboard/my-deliveries", icon: Truck, section: "delivery", group: "WORK",
    calls: ["/admin/hub-parcels"] },

  { label: "Customers", href: "/dashboard/customers", icon: UserCircle, section: "customers", group: "WORK",
    calls: ["/admin/customers"],
    tabs: [
      { label: "All Customers", href: "/dashboard/customers", section: "customers",
        calls: ["/admin/customers"] },
      // Reviews keep the "restaurants" permission, because that is what the
      // server enforces on /admin/reviews. Moving where a link sits must never
      // change who may use it.
      { label: "Reviews", href: "/dashboard/customers/reviews", section: "restaurants",
        calls: ["/admin/reviews"] },
    ] },

  { label: "Riders", href: "/dashboard/riders", icon: Bike, section: "riders", group: "WORK",
    calls: ["/admin/riders"],
    tabs: [
      { label: "All Riders", href: "/dashboard/riders", section: "riders",
        calls: ["/admin/riders"] },
      { label: "Earnings & Cash", href: "/dashboard/riders/earnings", section: "payments",
        calls: ["/admin/riders/payouts", "/admin/riders/cash"] },
      { label: "Pay Rules", href: "/dashboard/riders/pay-rules", section: "settings",
        calls: ["/admin/settings"] },
    ] },

  { label: "Stores", href: "/dashboard/stores", icon: Building2, section: "restaurants", group: "WORK",
    calls: ["/admin/restaurants", "/admin/stores"],
    tabs: [
      { label: "All Stores", href: "/dashboard/stores", section: "restaurants",
        calls: ["/admin/restaurants", "/admin/stores"] },
      { label: "Catalogue", href: "/dashboard/stores/catalogue", section: "settings",
        calls: ["/admin/categories", "/admin/shop-types", "/admin/settings"] },
      { label: "Inventory", href: "/dashboard/stores/inventory", section: "restaurants",
        calls: ["/admin/low-stock"] },
      { label: "Commission", href: "/dashboard/stores/commission", section: "settings",
        calls: ["/admin/settings", "/admin/vertical-commissions"] },
      { label: "Reliability", href: "/dashboard/stores/reliability", section: "restaurants",
        calls: ["/admin/vendors/reliability"] },
    ] },

  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, section: "payments", group: "WORK",
    calls: ["/admin/payouts", "/admin/restaurants/payout"],
    tabs: [
      { label: "Balances & Payments", href: "/dashboard/payments", section: "payments",
        calls: ["/admin/payouts", "/admin/restaurants/payout", "/admin/riders/payouts", "/admin/riders/cash", "/admin/settlements"] },
      { label: "By Pay Period", href: "/dashboard/payments/settlements", section: "payments",
        calls: ["/admin/settlements"] },
      // The same shared rider component the Riders section uses.
      { label: "Riders", href: "/dashboard/riders/earnings", section: "payments",
        calls: ["/admin/riders/payouts", "/admin/riders/cash"] },
      // The office staff who carry marketplace parcels: salary, bonus and the
      // cash they are holding. Reading the pay run and recording a payment is
      // "payments"; CHANGING somebody's salary writes to
      // /admin/staff/pay-settings, which needs "settings" - so whoever runs a
      // pay run cannot give themselves a raise. Both are named here, the same
      // way Payment Methods names both.
      { label: "Staff Pay", href: "/dashboard/payments/staff", section: ["payments", "settings"],
        calls: ["/admin/staff", "write:/admin/staff/pay-settings"] },
      // Reading which providers are live needs "payments"; switching one on or
      // off writes to /admin/settings, which needs "settings". Both, then.
      { label: "Payment Methods", href: "/dashboard/payments/methods", section: ["payments", "settings"],
        calls: ["/admin/payment-status", "/admin/settings"] },
    ] },

  { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone, section: "promos", group: "WORK",
    calls: ["/admin/promo-codes"],
    tabs: [
      { label: "Discount Codes", href: "/dashboard/marketing", section: "promos",
        calls: ["/admin/promo-codes"] },
      { label: "Home Banners", href: "/dashboard/marketing/banners", section: "promos",
        calls: ["/admin/promo-banners"] },
      { label: "Welcome Screens", href: "/dashboard/marketing/welcome", section: "settings",
        calls: ["/admin/onboarding"] },
      { label: "Send Notification", href: "/dashboard/marketing/notifications", section: "notifications",
        calls: ["/admin/notifications"] },
      { label: "App Banner", href: "/dashboard/marketing/app-banner", section: "settings",
        calls: ["/admin/settings"] },
    ] },

  { label: "Admin Users", href: "/dashboard/users", icon: Users, section: SUPER_ONLY, group: "WORK",
    calls: ["/admin/users"] },

  { label: "Reports", href: "/dashboard/reports", icon: FileText, section: "reports", group: "SYSTEM",
    calls: ["/admin/reports"],
    tabs: [
      { label: "Overview", href: "/dashboard/reports", section: "reports",
        calls: ["/admin/reports", "/admin/audit-logs"] },
      { label: "Sales & Analytics", href: "/dashboard/reports/sales", section: "analytics",
        calls: ["/admin/analytics"] },
      { label: "Audit Log", href: "/dashboard/reports/audit", section: "reports",
        calls: ["/admin/audit-logs"] },
    ] },

  { label: "Settings", href: "/dashboard/settings", icon: Settings, section: "settings", group: "SYSTEM",
    calls: [],
    tabs: [
      { label: "General", href: "/dashboard/settings", section: "settings", calls: [] },
      { label: "Delivery Fees", href: "/dashboard/settings/delivery-fees", section: "settings",
        calls: ["/admin/settings"] },
      { label: "Sign-up", href: "/dashboard/settings/signup-code", section: "settings",
        calls: ["/admin/settings"] },
    ] },
];

/**
 * A COPY of the server's own list, from backend/app_guard.py -> _SECTION_RULES.
 *
 * It is written here so the two can be compared. It is NOT the lock - the lock
 * is on the server and does not care what the browser believes. If these two
 * ever disagree, the SERVER is right and this file is the one to change.
 *
 * Most-specific first, exactly as the server reads it. Kept in the same order
 * so a line-by-line diff against app_guard.py is possible.
 */
export type ServerRule = [string, string | string[], ("read" | "write")?];

export const SERVER_RULES: ServerRule[] = [
  ["/admin/me", "__any__"],
  ["/admin/dashboard", "__any__"],
  ["/admin/fcm-status", "__any__"],
  ["/admin/fcm-test", "notifications"],
  ["/admin/system", "settings"],
  ["/admin/health", "settings"],
  ["/admin/users", "__super__"],
  ["/admin/customers", "customers"],
  ["/admin/reviews", "restaurants"],
  ["/admin/orders", "orders"],
  ["/admin/returns", "orders"],
  ["/admin/restaurants/payout", "payments"],
  ["/admin/restaurants/bulk-delivery-fee", "settings"],
  ["/admin/restaurants", "restaurants"],
  ["/admin/vendors/reliability", "restaurants"],
  ["/admin/low-stock", "restaurants"],
  ["/admin/hub-parcels/staff", "orders"],
  ["/admin/hub-parcels", ["orders", "delivery"]],   // either one is enough
  // One address, two answers. CHANGING an office is a settings job. Just
  // READING the list of office names is not - the Parcels page shows them in
  // a filter box, so a flat "settings" here would leave a parcels-only
  // sub-admin staring at an empty dropdown. Same split as the server.
  ["/admin/hubs", "settings", "write"],
  ["/admin/hubs", "__any__", "read"],
  ["/admin/stores", "restaurants"],
  ["/admin/vertical-commissions", "settings"],
  ["/admin/categories", "settings"],
  ["/admin/shop-types", "settings"],
  // Parcel staff pay. Reading and paying is a PAYMENTS job; CHANGING what
  // somebody's salary is, is a SETTINGS job - so whoever can run a pay run
  // cannot give themselves a raise. The stricter line sits first because the
  // first matching prefix wins, exactly as on the server.
  ["/admin/staff/pay-settings", "settings", "write"],
  ["/admin/staff", "payments"],
  ["/admin/settlements", "payments"],
  ["/admin/payment-status", "payments"],
  ["/admin/riders/payouts", "payments"],
  ["/admin/riders/cash", "payments"],
  ["/admin/riders", "riders"],
  ["/admin/payouts", "payments"],
  ["/admin/promo-codes", "promos"],
  ["/admin/promo-banners", "promos"],
  ["/admin/onboarding", "settings"],
  ["/admin/analytics", "analytics"],
  ["/admin/reports", "reports"],
  ["/admin/audit-logs", "reports"],
  ["/admin/settings", "settings"],
  ["/admin/notifications", "notifications"],
];

/** What permission the server would demand for a given address. Reads the list
 *  above the same way the server reads its own: first match wins. */
export function serverSectionFor(
  adminPath: string,
  mode: "read" | "write" = "read"
): string | string[] {
  for (const [prefix, sec, appliesTo] of SERVER_RULES) {
    if (appliesTo && appliesTo !== mode) continue;
    if (adminPath === prefix || adminPath.startsWith(prefix)) return sec;
  }
  return "__super__"; // deny by default, same rule as the server
}

/** Would an admin holding exactly `held` get through the server rule `needed`?
 *
 *  A LIST from the server means "any ONE of these is enough" (the parcels
 *  list, readable by the office clerk OR by the delivery man). That is the
 *  opposite of a list in NAVIGATION, which means "all of these" - so the two
 *  are deliberately never mixed up in one function. */
export function serverWouldAllow(needed: string | string[], held: string[]): boolean {
  if (needed === "__any__") return true;
  if (needed === "__super__") return false;
  const options = Array.isArray(needed) ? needed : [needed];
  return options.some((s) => held.includes(s));
}

/** The permissions a sub-admin must hold for a nav item to be shown to them. */
export function requiredSections(section: Section): string[] {
  if (section == null) return [];
  if (section === SUPER_ONLY) return [];
  return Array.isArray(section) ? section : [section];
}

/**
 * Which permission a page needs, worked out from NAVIGATION itself.
 *
 * WHY IT LIVES HERE AND IS APPLIED IN ONE PLACE: hiding a link is not a lock.
 * A sub-admin who typed the address, used a bookmark, or pressed Back still
 * reached the page. The real lock is on the server; this is the tidy front
 * door, so nobody lands on a screen full of red errors instead of a clear
 * message. Applying it in the layout that wraps EVERY dashboard page means a
 * page cannot be forgotten.
 *
 * Longest match wins, so /dashboard/settings/hubs uses the hubs line and not
 * the shorter /dashboard/settings. Detail pages inherit their list page, so
 * /dashboard/customers/123 needs the same permission as /dashboard/customers.
 *
 * Anything under /dashboard/ with no line at all is Main-Admin-only - the same
 * "unlisted means no" rule the server uses.
 */
export function sectionForPath(pathname: string): Section {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return ALWAYS;
  // Tabs are checked alongside sidebar lines and the LONGEST address wins, so
  // /dashboard/reports/sales gets the analytics permission rather than falling
  // back to its parent's "reports".
  const candidates: { href: string; section: Section }[] = [];
  for (const item of NAVIGATION) {
    if (item.href !== "/dashboard") {
      candidates.push({ href: item.href, section: item.section });
    }
    for (const tab of item.tabs ?? []) {
      candidates.push({ href: tab.href, section: tab.section });
    }
  }
  const match = candidates
    .filter((c) => pathname === c.href || pathname.startsWith(c.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.section : SUPER_ONLY;
}

/** Every tab of a domain, whether or not this admin may see them. */
export function tabsFor(href: string): TabItem[] {
  return NAVIGATION.find((i) => i.href === href)?.tabs ?? [];
}

/** May this admin open something guarded by `section`? */
export function mayAccess(
  section: Section,
  perms: { isSuper: boolean; sections: string[] }
): boolean {
  if (section == null) return true;
  if (perms.isSuper) return true;
  if (section === SUPER_ONLY) return false;
  const needed = Array.isArray(section) ? section : [section];
  // An array means ALL of them - see the note on the Section type.
  return needed.every((s) => perms.sections.includes(s));
}

/** The sidebar for this particular admin. */
export function visibleNavigation(perms: { isSuper: boolean; sections: string[] }): NavItem[] {
  return NAVIGATION.filter((item) => mayAccess(item.section, perms));
}
