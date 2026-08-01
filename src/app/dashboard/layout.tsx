"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  ShoppingCart,
  Building2,
  Users,
  UserCircle,
  Bike,
  CreditCard,
  Tag,
  TrendingUp,
  Settings,
  FileText,
  Star,
  Boxes,
  RotateCcw,
  Megaphone,
  Sparkles,
  Package,
  Percent,
  Truck,
  Wallet,
  Send,
  ScrollText,
  Banknote,
  Bike as BikeIcon,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { getMyPerms } from "@/lib/perms";
import { apiClient } from "@/lib/api-client";

// `section` controls visibility: null = always; "__super__" = Main Admin only;
// otherwise the sub-admin must have that section permission.
const NAVIGATION = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, section: null as string | null },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, section: "orders" },
  { label: "Returns", href: "/dashboard/returns", icon: RotateCcw, section: "orders" },
  // Takal office desk for Standard/marketplace parcels (no rider involved).
  { label: "Parcels", href: "/dashboard/parcels", icon: Package, section: "orders" },
  // "Stores", not "Restaurants". This page has always managed ALL 16 vendor
  // types — Fashion, Electronics, Pharmacy, Grocery and the rest — but the old
  // label told you your Fashion store wasn't here. It was.
  { label: "Stores", href: "/dashboard/restaurants", icon: Building2, section: "restaurants" },
  { label: "Inventory", href: "/dashboard/inventory", icon: Boxes, section: "restaurants" },
  { label: "Store Reviews", href: "/dashboard/reviews", icon: Star, section: "restaurants" },
  { label: "Customers", href: "/dashboard/customers", icon: UserCircle, section: "customers" },
  { label: "Riders", href: "/dashboard/riders", icon: Bike, section: "riders" },
  { label: "Admin Users", href: "/dashboard/users", icon: Users, section: "__super__" },
  { label: "Pay Out", href: "/dashboard/settlements", icon: Banknote, section: "payments" },
  { label: "Payouts", href: "/dashboard/payments", icon: CreditCard, section: "payments" },
  // Promoted out of Settings so they sit beside the payouts they govern.
  //
  // IMPORTANT: they keep section "settings", the permission they have always
  // had. Moving WHERE a link appears must not change WHO may use it — giving
  // these the "payments" section would have let a clerk who can only record
  // payouts start changing the commission rate itself. Position and permission
  // are deliberately independent here.
  { label: "Commission", href: "/dashboard/settings/commissions", icon: Percent, section: "settings" },
  { label: "Delivery Fees", href: "/dashboard/settings/delivery-fees", icon: Truck, section: "settings" },
  { label: "Rider Pay", href: "/dashboard/settings/rider-pay", icon: BikeIcon, section: "settings" },
  { label: "Payment Methods", href: "/dashboard/settings/payments", icon: Wallet, section: "settings" },
  { label: "Reports", href: "/dashboard/reports", icon: FileText, section: "reports" },
  { label: "Discount Codes", href: "/dashboard/promos", icon: Tag, section: "promos" },
  { label: "Home Banners", href: "/dashboard/home-banners", icon: Megaphone, section: "promos" },
  { label: "Welcome Screens", href: "/dashboard/welcome-pages", icon: Sparkles, section: "settings" },
  // Sending a notification is a daily ACTION, not a setting.
  { label: "Send Notification", href: "/dashboard/settings/notifications", icon: Send, section: "settings" },
  { label: "Analytics", href: "/dashboard/analytics", icon: TrendingUp, section: "analytics" },
  // Both keep section "settings" — the permission they already had.
  { label: "Takal Offices", href: "/dashboard/settings/hubs", icon: Package, section: "settings" },
  // A log is a report, not a setting.
  { label: "Audit Logs", href: "/dashboard/settings/audit", icon: ScrollText, section: "settings" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, section: "settings" },
];

// Which heading each page sits under, and the order the headings appear in.
//
// WHY: the sidebar was 17 items in one flat column with no headings, so there
// was no clue that Orders / Returns / Parcels belong together, and the settings
// that CONTROL money (commission, delivery fees, payment methods) lived in a
// completely different place from the money itself. Grouping fixes both without
// touching a single page.
//
// A heading only appears if the admin can see at least one page under it, so a
// sub-admin never sees an empty "FINANCE" label.
const GROUP_ORDER = [
  "ORDERS",
  "STORES",
  "PEOPLE",
  "FINANCE",
  "MARKETING",
  "SYSTEM",
] as const;

const GROUP_OF: Record<string, (typeof GROUP_ORDER)[number] | "TOP"> = {
  "/dashboard": "TOP",

  "/dashboard/orders": "ORDERS",
  "/dashboard/returns": "ORDERS",
  "/dashboard/parcels": "ORDERS",

  "/dashboard/restaurants": "STORES",
  "/dashboard/inventory": "STORES",
  "/dashboard/reviews": "STORES",

  "/dashboard/customers": "PEOPLE",
  "/dashboard/riders": "PEOPLE",
  "/dashboard/users": "PEOPLE",

  // All money in one run, so paying a vendor and setting the rate you pay them
  // are neighbours instead of being five clicks apart.
  "/dashboard/settlements": "FINANCE",
  "/dashboard/payments": "FINANCE",
  "/dashboard/settings/commissions": "FINANCE",
  "/dashboard/settings/delivery-fees": "FINANCE",
  "/dashboard/settings/rider-pay": "FINANCE",
  "/dashboard/settings/payments": "FINANCE",
  "/dashboard/reports": "FINANCE",

  "/dashboard/promos": "MARKETING",
  "/dashboard/home-banners": "MARKETING",
  "/dashboard/welcome-pages": "MARKETING",
  "/dashboard/settings/notifications": "MARKETING",

  "/dashboard/analytics": "SYSTEM",
  "/dashboard/settings/hubs": "SYSTEM",
  "/dashboard/settings/audit": "SYSTEM",
  "/dashboard/settings": "SYSTEM",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [navItems, setNavItems] = useState(NAVIGATION);

  const applyNav = () => {
    const { isSuper, sections } = getMyPerms();
    setNavItems(
      NAVIGATION.filter((it) =>
        it.section == null
          ? true
          : it.section === "__super__"
          ? isSuper
          : isSuper || sections.includes(it.section)
      )
    );
  };

  // Keep the free-tier backend awake while the admin panel is open — the same
  // idea as the customer app warming the server the moment it launches. Ping
  // now, then every 4 minutes, so it never sleeps mid-session and saves stay
  // instant instead of waiting for a cold start.
  useEffect(() => {
    apiClient.warmUp();
    const id = setInterval(() => apiClient.warmUp(), 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    applyNav();
    setLoading(false);
    // Prefetch the pages you're most likely to open next, so they're already
    // cached (instant) by the time you click them.
    apiClient.prefetchCommon();
    // Refresh the stored profile (role + permissions) so access is always current,
    // even for sessions that logged in before permissions existed.
    apiClient
      .getMe()
      .then((me: any) => {
        if (me && me.id) {
          localStorage.setItem("admin_user", JSON.stringify(me));
          applyNav();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-slate-300 border-t-primary-600 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-slate-200 flex flex-col transition-all duration-300 fixed h-screen md:relative z-40`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-slate-900 font-bold text-lg">
              🍽️
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-bold text-slate-900">Takal</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          {(() => {
            // Exact-match the longest href first, so /dashboard/settings/hubs
            // highlights itself and not the shorter /dashboard/settings.
            const bestMatch = navItems
              .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
              .sort((a, b) => b.href.length - a.href.length)[0];

            const renderLink = (item: (typeof navItems)[number]) => {
              const Icon = item.icon;
              const isActive = bestMatch?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all mb-1 ${
                    isActive
                      ? "bg-primary-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  title={item.label}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 768)
                      setSidebarOpen(false);
                  }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm">{item.label}</span>}
                </Link>
              );
            };

            return (
              <>
                {/* Dashboard sits above every heading. */}
                {navItems.filter((i) => GROUP_OF[i.href] === "TOP").map(renderLink)}

                {GROUP_ORDER.map((group) => {
                  const items = navItems.filter((i) => GROUP_OF[i.href] === group);
                  // Never show a heading with nothing under it — a sub-admin
                  // without finance permission must not see an empty FINANCE.
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="mt-5 first:mt-2">
                      {sidebarOpen ? (
                        <p className="px-4 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400">
                          {group}
                        </p>
                      ) : (
                        // Collapsed sidebar has no room for text, so a divider
                        // keeps the visual grouping.
                        <div className="mx-3 mb-2 border-t border-slate-200" />
                      )}
                      {items.map(renderLink)}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </nav>

        {/* Logout */}
        <div className="px-3 py-6 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>

        {/* Toggle Button */}
        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 hover:bg-slate-100 rounded-lg transition"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <h1 className="font-bold text-slate-900">Takal Admin</h1>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <LogOut className="w-6 h-6 text-red-600" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
