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
  { label: "Restaurants", href: "/dashboard/restaurants", icon: Building2, section: "restaurants" },
  { label: "Reviews", href: "/dashboard/reviews", icon: Star, section: "restaurants" },
  { label: "Customers", href: "/dashboard/customers", icon: UserCircle, section: "customers" },
  { label: "Riders", href: "/dashboard/riders", icon: Bike, section: "riders" },
  { label: "Admin Users", href: "/dashboard/users", icon: Users, section: "__super__" },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, section: "payments" },
  { label: "Promo Codes", href: "/dashboard/promos", icon: Tag, section: "promos" },
  { label: "Analytics", href: "/dashboard/analytics", icon: TrendingUp, section: "analytics" },
  { label: "Reports", href: "/dashboard/reports", icon: FileText, section: "reports" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, section: "settings" },
];

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

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    applyNav();
    setLoading(false);
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
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              🍽️
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-bold text-slate-900">Akhpal</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-2 ${
                  isActive
                    ? "bg-primary-100 text-primary-600 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title={item.label}
                onClick={() => { if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false); }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
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
          <h1 className="font-bold text-slate-900">Akhpal Admin</h1>
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
