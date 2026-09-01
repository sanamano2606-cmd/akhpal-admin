"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getMyPerms, SECTION_LABELS } from "@/lib/perms";
import {
  NAVIGATION,
  sectionForPath,
  mayAccess,
  visibleNavigation,
  type NavItem,
} from "@/lib/navigation";
import { apiClient, APIClient } from "@/lib/api-client";
import { Lock, LogOut, Menu, X } from "lucide-react";

// The menu itself - which links exist, which group each sits in, and which
// permission each needs - now lives in lib/navigation.ts. It was moved out of
// this file because three of those permissions did not match what the server
// actually enforces, and nobody could see that while the list was buried in
// the middle of the markup that draws it. See the notes in that file.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [navItems, setNavItems] = useState<NavItem[]>(NAVIGATION);
  // null while we are still reading the profile; true/false once we know.
  const [allowedHere, setAllowedHere] = useState<boolean>(true);

  const applyNav = () => {
    const perms = getMyPerms();
    setNavItems(visibleNavigation(perms));
    setAllowedHere(mayAccess(sectionForPath(pathname), perms));
  };

  // Re-check on every page change. Without this the check would only run once,
  // at login, and clicking through to another page would skip it.
  useEffect(() => {
    applyNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
    // AND the saved copies of everything that was on screen.
    //
    // To keep pages instant, every list this panel loads is kept in the
    // browser under sessionStorage["admin_get_cache_v1"] - customer names and
    // phone numbers, delivery addresses, order lists, rider details, payout
    // figures. Logging out used to remove only the token and the profile and
    // leave all of that behind, so on a shared or borrowed computer "Logout"
    // looked like it had cleaned up while the data was still sitting there for
    // anyone who opened the browser tools.
    //
    // The expired-session path (APIClient.handleUnauthorized) already did this.
    // The button people actually press did not.
    APIClient.clearCache();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-takal-line border-t-takal-yellow-dark rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-takal-page">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-takal-line flex flex-col transition-all duration-300 fixed h-screen md:relative z-40`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-takal-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-takal-yellow rounded-lg flex items-center justify-center text-takal-ink font-bold text-lg">
              🍽️
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-bold text-takal-ink">Takal</p>
                <p className="text-xs text-takal-ink-soft">Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          {(() => {
            // Exact-match the longest href first, so /dashboard/orders/deliveries
            // highlights itself and not the shorter /dashboard/orders.
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
                      ? "bg-takal-yellow text-takal-ink font-semibold"
                      : "text-takal-ink-soft hover:bg-slate-100"
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

            // ONE LINE PER DOMAIN, in the order agreed with Sana.
            //
            // This used to draw 28 links under six headings — ORDERS, STORES,
            // PEOPLE, FINANCE, MARKETING, SYSTEM — because 28 links in a single
            // column cannot be read. With one line per domain the headings
            // became noise: a heading above a single item says nothing.
            //
            // One divider is left, between the work and the system. Above it is
            // what you manage day to day; below it is what you read or set up
            // occasionally.
            return (
              <>
                {navItems.filter((i) => i.group === "TOP").map(renderLink)}
                {navItems.filter((i) => i.group === "WORK").map(renderLink)}

                {navItems.some((i) => i.group === "SYSTEM") && (
                  <div className="mt-5">
                    <div className="mx-3 mb-3 border-t border-takal-line" />
                    {navItems.filter((i) => i.group === "SYSTEM").map(renderLink)}
                  </div>
                )}
              </>
            );
          })()}
        </nav>

        {/* Logout */}
        <div className="px-3 py-6 border-t border-takal-line">
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
        <div className="px-3 py-4 border-t border-takal-line">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 hover:bg-slate-100 rounded-lg transition"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-takal-ink-soft" />
            ) : (
              <Menu className="w-5 h-5 text-takal-ink-soft" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-takal-line px-6 py-4 flex items-center justify-between md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6 text-takal-ink-soft" />
          </button>
          <h1 className="font-bold text-takal-ink">Takal Admin</h1>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <LogOut className="w-6 h-6 text-red-600" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {allowedHere ? (
            children
          ) : (
            <div className="max-w-md mx-auto mt-16 bg-white border border-takal-line rounded-xl p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
                <Lock className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-takal-ink mb-2">
                You don&apos;t have access to this page
              </h2>
              <p className="text-sm text-takal-ink-soft mb-6">
                {(() => {
                  const need = sectionForPath(pathname);
                  if (need === "__super__")
                    return "Only the Main Admin can open this page.";
                  if (need == null) return "";
                  // A page can need more than one permission - Payment Methods
                  // needs "payments" to read and "settings" to switch a
                  // provider on. Name every one that is missing, not just the
                  // first, so one request to the Main Admin is enough.
                  const needed = Array.isArray(need) ? need : [need];
                  const names = needed
                    .map((n) => `"${SECTION_LABELS[n] || n}"`)
                    .join(" and ");
                  const word = needed.length > 1 ? "permissions" : "permission";
                  return `This page needs the ${names} ${word}. Ask the Main Admin to give it to you.`;
                })()}
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-5 py-2.5 bg-takal-yellow text-takal-ink font-semibold rounded-lg hover:bg-takal-yellow-dark transition"
              >
                Back to Dashboard
              </Link>
            </div>
          )}
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
