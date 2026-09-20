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
  Settings, FileText, Megaphone, Truck, TrendingUp, Rocket, MessageSquare,
  Star, Globe,
} from "lucide-react";

/** Special values a `section` can take, besides a real permission name. */
import { mayOpen } from "./tabs.ts";

export const ALWAYS = null;
export const SUPER_ONLY = "__super__";

/**
 * What a link needs before it is shown.
 *
 *  null          - everyone signed in
 *  "__super__"   - Main Admin only
 *  "orders"      - that one permission
 *  ["a","b"]     - ANY ONE of them opens the page. Used where a page READS
 *                  with one permission and WRITES with another. It used to
 *                  mean ALL of them, and that had it exactly backwards: the
 *                  pay run needs only "payments" to read and record a payment,
 *                  so requiring "settings" as well meant the ONLY person who
 *                  could open the pay run was somebody who could also give
 *                  themselves a raise - the opposite of what the rule was for.
 *                  The write is still guarded, on the page and on the server;
 *                  see the note on Staff Pay below.
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
   *  read, exactly as the server has it.
   *
   *  Prefix an entry with "optional:" when the page ASKS for that address but
   *  works without it. The Reports page shows a strip of recent activity it
   *  fetches from the audit log; somebody who may see the reports but not the
   *  audit log gets the page with no strip, rather than a refusal. An optional
   *  address is NOT counted when checking that a link's permission is enough,
   *  because demanding it would hide the whole page over an extra. */
  calls: string[];
};

// A SIDEBAR LINE THAT HAS TABS NEEDS THE KEYS OF ITS TABS, NOT ITS OWN.
//
// Mock 89, step 4. A permission is now a tab ("orders") or ONE option inside it
// ("orders.parcels"). Somebody given only Orders -> Parcels must still SEE the
// Orders line, or they could never reach the one page they were given. So the
// sidebar line lists every option underneath it and ANY ONE of them shows it.
//
// Granting the whole tab still works: mayOpen() knows that "orders" carries
// every option inside it, including options added later.
const ORDERS_TAB = ["orders.all", "orders.returns", "orders.parcels", "orders.offices"];
const REVIEWS_TAB = ["reviews.shops", "reviews.riders", "reviews.takal",
                     "reviews.products", "reviews.hidden", "reviews.settings"];
const RIDERS_TAB = ["riders.all", "riders.earnings", "riders.pay-rules"];
const STORES_TAB = ["stores.all", "stores.catalogue", "stores.inventory",
                    "stores.commission", "stores.reliability"];
const PAYMENTS_TAB = ["payments.balances", "payments.settlements", "riders.earnings",
                      "payments.staff", "settings.staff-pay", "payments.methods"];
const MARKETING_TAB = ["marketing.codes", "marketing.banners", "marketing.welcome",
                       "marketing.notifications", "marketing.announcements"];
const REPORTS_TAB = ["reports.overview", "reports.sales", "reports.audit"];
const WEBSITE_TAB = ["website.front", "website.area", "website.links"];
const SETTINGS_TAB = ["settings.general", "settings.delivery-fees", "settings.signup-code",
                      "settings.letterhead", "settings.urdu-names"];

export const NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, section: ALWAYS, group: "TOP",
    calls: ["/admin/dashboard"] },

  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, section: ORDERS_TAB, group: "WORK",
    calls: ["/admin/orders"],
    tabs: [
      { label: "All Orders", href: "/dashboard/orders", section: "orders.all",
        calls: ["/admin/orders"] },
      { label: "Returns & Refunds", href: "/dashboard/orders/returns", section: "orders.returns",
        calls: ["/admin/returns"] },
      { label: "Parcels", href: "/dashboard/orders/parcels", section: "orders.parcels",
        calls: ["/admin/hub-parcels", "/admin/hub-parcels/staff", "/admin/hubs"] },
      // The office list moved out of Settings. CHANGING an office still needs
      // the settings permission - that is what the server enforces, and this
      // must not quietly widen it.
      { label: "Offices", href: "/dashboard/orders/offices", section: "orders.offices",
        calls: ["write:/admin/hubs"] },
    ] },

  { label: "My Deliveries", href: "/dashboard/my-deliveries", icon: Truck, section: "my-deliveries", group: "WORK",
    calls: ["/admin/hub-parcels"] },

  // THE SUPPORT INBOX. (Plan 52, approved 10 September 2026.)
  //
  // Its own permission, not "customers". A support person needs to answer
  // messages; they do not need the customer list, and a conversation can carry
  // an address, a phone number and a photo of somebody's home.
  { label: "Support", href: "/dashboard/support", icon: MessageSquare, section: "support", group: "WORK",
    calls: ["/admin/support"] },

  // REVIEWS. Its own line, its own permission. (Mock 62/63/65, approved by
  // Sana on 13 September 2026: "you should create a separate tab in sidebar
  // for that and add all reviews related settings in it. And remove that one
  // review tab from inside Customers Side bar.")
  //
  // It used to be a tab under Customers that asked for the "restaurants"
  // permission - so letting somebody tidy up an abusive review meant handing
  // them every shop on the platform. "reviews" unlocks reviews and nothing
  // else.
  //
  // The tabs are split by WHO is being reviewed, because that is how you go
  // looking: "what are people saying about the riders" is a different question
  // from "what are people saying about that shop".
  { label: "Reviews", href: "/dashboard/reviews", icon: Star, section: REVIEWS_TAB, group: "WORK",
    calls: ["/admin/reviews"],
    tabs: [
      { label: "Shops", href: "/dashboard/reviews", section: "reviews.shops",
        calls: ["/admin/reviews"] },
      { label: "Riders", href: "/dashboard/reviews/riders", section: "reviews.riders",
        calls: ["/admin/reviews", "/admin/reviews/rider-scores"] },
      { label: "Takal", href: "/dashboard/reviews/takal", section: "reviews.takal",
        calls: ["/admin/reviews"] },
      // The only reviews that carry PHOTOGRAPHS, and the only ones that had no
      // screen anywhere in this panel before today.
      { label: "Products", href: "/dashboard/reviews/products", section: "reviews.products",
        calls: ["/admin/product-reviews"] },
      // Questions customers ask about a product (Mock 93). Sana: they must
      // reach the Admin Panel as well as the shop.
      { label: "Questions", href: "/dashboard/reviews/questions", section: "reviews.products",
        calls: ["/admin/product-questions"] },
      { label: "Hidden", href: "/dashboard/reviews/hidden", section: "reviews.hidden",
        calls: ["/admin/reviews"] },
      { label: "Settings", href: "/dashboard/reviews/settings", section: "reviews.settings",
        calls: ["/admin/reviews/settings"] },
    ] },

  { label: "Customers", href: "/dashboard/customers", icon: UserCircle, section: "customers", group: "WORK",
    calls: ["/admin/customers"],
    tabs: [] },

  { label: "Riders", href: "/dashboard/riders", icon: Bike, section: RIDERS_TAB, group: "WORK",
    calls: ["/admin/riders"],
    tabs: [
      { label: "All Riders", href: "/dashboard/riders", section: "riders.all",
        calls: ["/admin/riders"] },
      { label: "Earnings & Cash", href: "/dashboard/riders/earnings", section: "riders.earnings",
        calls: ["/admin/riders/payouts", "/admin/riders/cash"] },
      { label: "Pay Rules", href: "/dashboard/riders/pay-rules", section: "riders.pay-rules",
        calls: ["/admin/settings"] },
    ] },

  { label: "Stores", href: "/dashboard/stores", icon: Building2, section: STORES_TAB, group: "WORK",
    calls: ["/admin/restaurants", "/admin/stores"],
    tabs: [
      { label: "All Stores", href: "/dashboard/stores", section: "stores.all",
        calls: ["/admin/restaurants", "/admin/stores"] },
      { label: "Catalogue", href: "/dashboard/stores/catalogue", section: "stores.catalogue",
        calls: ["/admin/categories", "/admin/shop-types", "/admin/settings"] },
      { label: "Inventory", href: "/dashboard/stores/inventory", section: "stores.inventory",
        calls: ["/admin/low-stock"] },
      { label: "Commission", href: "/dashboard/stores/commission", section: "stores.commission",
        calls: ["/admin/settings", "/admin/vertical-commissions"] },
      { label: "Reliability", href: "/dashboard/stores/reliability", section: "stores.reliability",
        calls: ["/admin/vendors/reliability"] },
    ] },

  // WHAT TAKAL EARNED. Its own sidebar line, not a tab inside Payments -
  // Sana, 2 September 2026: "No, Takal Earnings must be a separate tab on the
  // sidebar." And it IS its own domain: Payments answers "who do I owe";
  // this answers "what did I make". Two different questions.
  { label: "Earnings", href: "/dashboard/earnings", icon: TrendingUp, section: "earnings", group: "WORK",
    calls: ["/admin/earnings"] },

  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, section: PAYMENTS_TAB, group: "WORK",
    calls: ["/admin/payouts", "/admin/restaurants/payout"],
    tabs: [
      { label: "Balances & Payments", href: "/dashboard/payments", section: ["payments.balances", "riders.earnings"],
        calls: ["/admin/payouts", "/admin/restaurants/payout", "/admin/riders/payouts", "/admin/riders/cash", "/admin/settlements"] },
      { label: "By Pay Period", href: "/dashboard/payments/settlements", section: "payments.settlements",
        calls: ["/admin/settlements"] },
      // The same shared rider component the Riders section uses.
      { label: "Riders", href: "/dashboard/riders/earnings", section: "riders.earnings",
        calls: ["/admin/riders/payouts", "/admin/riders/cash"] },
      // The office staff who carry marketplace parcels: salary, bonus and the
      // cash they are holding. Reading the pay run and recording a payment is
      // "payments"; CHANGING somebody's salary writes to
      // /admin/staff/pay-settings, which needs "settings" - so whoever runs a
      // pay run still cannot give themselves a raise. EITHER permission opens
      // the page; the raise button is switched off without "settings", and the
      // server refuses it as well.
      { label: "Staff Pay", href: "/dashboard/payments/staff", section: ["payments.staff", "settings.staff-pay"],
        calls: ["/admin/staff", "write:/admin/staff/pay-settings"] },
      // Reading which providers are live needs "payments"; switching one on or
      // off writes to /admin/settings, which needs "settings". Either one opens
      // the page; the switches are off without "settings".
      { label: "Payment Methods", href: "/dashboard/payments/methods", section: "payments.methods",
        calls: ["/admin/payment-status", "/admin/settings"] },
      // WHAT THE REFERRAL SCHEME HAS GIVEN AWAY. (Mock 97, approved by Sana
      // 19 September 2026.) A Payments tab and not a Marketing one: this is
      // money out of the door and customer credit still owed, the same
      // question the other tabs here answer. The rules themselves are changed
      // in Settings; this page reads them and links there.
      { label: "Referrals & Credit", href: "/dashboard/payments/referrals", section: "payments.balances",
        calls: ["/admin/referrals"] },
    ] },

  { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone, section: MARKETING_TAB, group: "WORK",
    calls: ["/admin/promo-codes"],
    tabs: [
      { label: "Discount Codes", href: "/dashboard/marketing", section: "marketing.codes",
        calls: ["/admin/promo-codes"] },
      { label: "Home Banners", href: "/dashboard/marketing/banners", section: "marketing.banners",
        calls: ["/admin/promo-banners"] },
      { label: "Welcome Screens", href: "/dashboard/marketing/welcome", section: "marketing.welcome",
        calls: ["/admin/onboarding"] },
      { label: "Send Notification", href: "/dashboard/marketing/notifications", section: "marketing.notifications",
        calls: ["/admin/notifications", "/admin/broadcasts"] },
      // WAS "App Banner": one text box that could set one line of words, with
      // the colour, size, font, shape, timing and position all written inside a
      // Flutter widget. Sana, 4 September 2026: "I want full modification
      // setting in admin panel for that banner." It is now a list of
      // announcements she owns completely, and it sits under "promos" with the
      // home banners rather than under "settings", because it is the same
      // person doing the same job.
      { label: "Announcements", href: "/dashboard/marketing/announcements", section: "marketing.announcements",
        calls: ["/admin/announcements"] },
    ] },

  { label: "Admin Users", href: "/dashboard/users", icon: Users, section: SUPER_ONLY, group: "WORK",
    calls: ["/admin/users"] },

  { label: "Reports", href: "/dashboard/reports", icon: FileText, section: REPORTS_TAB, group: "SYSTEM",
    calls: ["/admin/reports"],
    tabs: [
      { label: "Overview", href: "/dashboard/reports", section: "reports.overview",
        // The recent-activity strip on this page is an EXTRA. Without the Audit
        // Log permission the server refuses it, the strip is left out, and the
        // rest of the page still works - so it is marked optional rather than
        // demanded here. See the note on `calls` above.
        calls: ["/admin/reports", "optional:/admin/audit-logs"] },
      { label: "Sales & Analytics", href: "/dashboard/reports/sales", section: "reports.sales",
        calls: ["/admin/analytics"] },
      { label: "Audit Log", href: "/dashboard/reports/audit", section: "reports.audit",
        calls: ["/admin/audit-logs"] },
    ] },

  // THE PUBLIC WEBSITE at takalapp.com. Mock 68, approved by Sana on
  // 14 September 2026: "must be manageable each and everything from admin
  // panel."
  //
  // The "settings" permission, because that is what the server enforces: every
  // screen here reads and writes /admin/settings, the same row the delivery
  // fees live in. Inventing a gentler permission for this section would be a
  // link that opens a page the server then refuses - the exact fault this file
  // was written to stop.
  //
  // There is NO "Categories" tab and NO "Legal" tab, though the approved mock
  // sketched both. Categories are already managed on Stores > Catalogue and
  // the website reads that same list; the legal pages are already written and
  // published in both languages. A second place to edit either would be a
  // second answer to the same question, and one of them would go stale.
  { label: "Website", href: "/dashboard/website", icon: Globe, section: WEBSITE_TAB, group: "SYSTEM",
    calls: ["/admin/settings"],
    tabs: [
      { label: "Front page", href: "/dashboard/website", section: "website.front",
        calls: ["/admin/settings"] },
      { label: "Delivery area", href: "/dashboard/website/area", section: "website.area",
        calls: ["/admin/settings"] },
      { label: "Links", href: "/dashboard/website/links", section: "website.links",
        calls: ["/admin/settings"] },
    ] },

  { label: "Settings", href: "/dashboard/settings", icon: Settings, section: SETTINGS_TAB, group: "SYSTEM",
    calls: [],
    tabs: [
      { label: "General", href: "/dashboard/settings", section: "settings.general", calls: [] },
      { label: "Delivery Fees", href: "/dashboard/settings/delivery-fees", section: "settings.delivery-fees",
        calls: ["/admin/settings"] },
      { label: "Sign-up", href: "/dashboard/settings/signup-code", section: "settings.signup-code",
        calls: ["/admin/settings"] },
      // Approved by Sana as Mock 7 on 4 September 2026. It reads the same
      // settings row everything else on this tab reads - the name, the offices,
      // and the phone and email from the contact card - and prints them.
      { label: "Letterhead", href: "/dashboard/settings/letterhead", section: "settings.letterhead",
        calls: ["/admin/settings"] },
      // Approved by Sana as Mock 33 on 7 September 2026 (audit finding P-9).
      // The Urdu name of each kind of shop. The column has always existed and
      // the server has always sent it; there was simply no screen that could
      // write it, so all 21 were empty and an Urdu customer read English shop
      // names on an Urdu page.
      { label: "Names in Urdu", href: "/dashboard/settings/urdu-names", section: "settings.urdu-names",
        calls: ["/admin/shop-types"] },
    ] },

  // GO LIVE — clearing the internal-tester data, once.
  //
  // Its OWN line, and its own permission, at Sana's instruction on 2 September
  // 2026: "Keep that in a separate sidebar tab so when I add a sub-admin I can
  // switch that off for sub-admins." Folded into Settings it would have gone
  // to every sub-admin ever trusted to change a delivery fee.
  //
  // LAST in the sidebar because it is the end of one thing and the start of
  // another - and because, once used, it disappears. The permission is off for
  // every sub-admin unless somebody deliberately ticks it.
  { label: "Go Live", href: "/dashboard/go-live", icon: Rocket, section: "go-live", group: "SYSTEM",
    calls: ["/admin/go-live", "write:/admin/go-live"] },
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

// ⚠ THIS TABLE IS THE PRE-MOCK-89 COPY OF THE SERVER'S RULES.  (20 Sep 2026.)
//
// On 20 September the server moved from fourteen loose words to tabs and
// options: backend/app_guard.py now says "stores.inventory" where this table
// still says "restaurants". The two no longer match, and that is KNOWN, not a
// surprise - STEP 4 of Mock 89 is the job of moving this file onto the new keys
// and adding the test that fails the day they disagree.
//
// Until then: the words here and the `section` on every link below are still
// the OLD ones, they still agree WITH EACH OTHER, and perms.ts translates them
// for an account saved the new way. So the menus are right today.
//
// DO NOT "fix" a link's section against the server by hand in the meantime -
// you would be mixing the two languages in one file. Wait for step 4.
export const SERVER_RULES: ServerRule[] = [
  // GENERATED FROM backend/app_guard.py ON 20 SEPTEMBER 2026, and checked
  // against that file on every test run by
  // tests/the-tabs-and-the-server-agree.test.ts. Do not hand-edit one line:
  // change the server, then bring the change across whole.
  // The "__skip__" lines are left out - the panel never calls them.
  ["/admin/me", "__any__"],
  ["/admin/dashboard", "__any__"],
  ["/admin/fcm-status", "__any__"],
  ["/admin/fcm-test", "marketing.notifications"],
  ["/admin/alerts", "__any__"],
  ["/admin/fcm-token", "__any__"],
  ["/admin/system", "settings.general"],
  ["/admin/health", "settings.general"],
  ["/admin/users", "__super__"],
  ["/admin/support", "support"],
  ["/admin/customers", "customers"],
  ["/admin/reviews/rider-scores", "reviews.riders"],
  ["/admin/reviews/settings", "reviews.settings"],
  ["/admin/reviews", ["reviews.shops", "reviews.riders", "reviews.takal", "reviews.hidden"]],
  ["/admin/product-reviews", "reviews.products"],
  ["/admin/product-questions", "reviews.products"],
  ["/admin/orders", "orders.all"],
  ["/admin/returns", "orders.returns"],
  ["/admin/restaurants/payout", "payments.balances"],
  ["/admin/restaurants/bulk-delivery-fee", "settings.delivery-fees"],
  ["/admin/restaurants", "stores.all"],
  ["/admin/vendors/reliability", "stores.reliability"],
  ["/admin/low-stock", "stores.inventory"],
  ["/admin/hub-parcels/staff", "orders.parcels"],
  ["/admin/hub-parcels", ["orders.parcels", "my-deliveries"]],
  ["/admin/hubs", "orders.offices", "write"],
  ["/admin/hubs", "__any__"],
  ["/admin/stores", "stores.all"],
  ["/admin/vertical-commissions", "stores.commission"],
  ["/admin/categories", "stores.catalogue"],
  ["/admin/shop-types", ["stores.catalogue", "settings.urdu-names"]],
  ["/admin/staff/pay-settings", "settings.staff-pay", "write"],
  ["/admin/staff", "payments.staff"],
  ["/admin/go-live", "go-live"],
  ["/admin/earnings", "earnings"],
  ["/admin/payouts/cancel", "__super__"],
  ["/admin/riders/payouts/cancel", "__super__"],
  ["/admin/riders/cash-handovers/cancel", "__super__"],
  ["/admin/settlements", ["payments.balances", "payments.settlements"]],
  ["/admin/payment-status", "payments.methods"],
  ["/admin/riders/payouts", "riders.earnings"],
  ["/admin/riders/cash", "riders.earnings"],
  ["/admin/riders", "riders.all"],
  ["/admin/payouts", "payments.balances"],
  ["/admin/referrals", "payments.balances"],
  ["/admin/promo-codes", "marketing.codes"],
  ["/admin/promo-banners", "marketing.banners"],
  ["/admin/announcements", "marketing.announcements"],
  ["/admin/onboarding", "marketing.welcome"],
  ["/admin/analytics", "reports.sales"],
  ["/admin/reports", "reports.overview"],
  ["/admin/audit-logs", "reports.audit"],
  ["/admin/pictures/make-small-copies", "settings.general"],
  ["/admin/settings/fee-examples", "settings.delivery-fees"],
  ["/admin/settings", ["payments.methods", "riders.pay-rules", "settings.delivery-fees",
                       "settings.general", "settings.letterhead", "settings.signup-code",
                       "stores.catalogue", "stores.commission",
                       "website.area", "website.front", "website.links"]],
  ["/admin/notifications", "marketing.notifications"],
  ["/admin/broadcasts", "marketing.notifications"],
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
  const candidates: { href: string; section: Section; isTab: boolean }[] = [];
  for (const item of NAVIGATION) {
    if (item.href !== "/dashboard") {
      candidates.push({ href: item.href, section: item.section, isTab: false });
    }
    for (const tab of item.tabs ?? []) {
      candidates.push({ href: tab.href, section: tab.section, isTab: true });
    }
  }
  const match = candidates
    .filter((c) => pathname === c.href || pathname.startsWith(c.href + "/"))
    // Longest address first. WHERE TWO ARE THE SAME LENGTH, THE TAB WINS.
    //
    // A domain's first tab always sits at the domain's own address, so
    // /dashboard/riders matches both the sidebar line and the "All Riders" tab.
    // Before Mock 89 both asked for the same word and it made no difference.
    // Now the LINE asks for any option inside the Riders tab - because somebody
    // given only Pay Rules must still see the line - while the TAB asks for
    // "riders.all". Taking the line would let a pay-rules-only sub-admin onto
    // the rider list, which the server would then refuse. The tab is the
    // precise answer, so the tab is the one to use.
    .sort((a, b) => (b.href.length - a.href.length) || (Number(b.isTab) - Number(a.isTab)))[0];
  return match ? match.section : SUPER_ONLY;
}

/** Every tab of a domain, whether or not this admin may see them. */
export function tabsFor(href: string): TabItem[] {
  return NAVIGATION.find((i) => i.href === href)?.tabs ?? [];
}

/** May this admin open something guarded by `section`?
 *
 *  ASKS mayOpen(), NOT includes().  (Mock 89, step 4.)
 *
 *  `perms.sections` is what is SAVED on the account, untouched. It is one of
 *  two things and it says which: a new list of tabs and options, or an old list
 *  of the fourteen words. mayOpen() reads both, and it knows that holding a tab
 *  carries every option inside it. A plain includes() understood neither, so a
 *  person given the whole Orders tab would have been shown no Parcels tab, and
 *  a person still saved the old way would have been shown nothing at all. */
export function mayAccess(
  section: Section,
  perms: { isSuper: boolean; sections: string[] }
): boolean {
  if (section == null) return true;
  if (perms.isSuper) return true;
  if (section === SUPER_ONLY) return false;
  const needed = Array.isArray(section) ? section : [section];
  // An array means ANY ONE of them - see the note on the Section type.
  return needed.some((s) => mayOpen(s, perms.sections, perms.isSuper));
}

/** The sidebar for this particular admin. */
export function visibleNavigation(perms: { isSuper: boolean; sections: string[] }): NavItem[] {
  return NAVIGATION.filter((item) => mayAccess(item.section, perms));
}
