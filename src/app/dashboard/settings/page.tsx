"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

// Settings had become a dumping ground: eight unrelated things, several of
// which were not settings at all. Commission, Delivery Fees and Payment Methods
// now live under FINANCE in the sidebar, next to the payouts they govern.
// Send Notification is a daily action and sits under MARKETING. Audit Logs is a
// report. Takal Offices is operations. "Team Management" was simply a second
// door to the Admin Users page already in the sidebar — a duplicate, removed.
//
// What is left here is the genuine leftover: the one thing with no better home.
const SETTINGS_SECTIONS = [
  {
    title: "App Banner",
    description: "Show an announcement banner inside the customer app",
    href: "/dashboard/settings/banner",
    icon: "📣",
    color: "bg-orange-100",
  },
  {
    title: "Sign-up phone code",
    description:
      "Whether a new shop or rider must enter a texted code to sign up. Switch it off only while new app builds are on their way to the Play Store.",
    href: "/dashboard/settings/signup-code",
    icon: "📱",
    color: "bg-sky-100",
  },
];

// Pages that used to be listed here and where they went, so nobody hunts for
// them. Shown as plain shortcuts underneath.
const MOVED = [
  { title: "Commission", where: "Finance", href: "/dashboard/settings/commissions" },
  { title: "Delivery Fees", where: "Finance", href: "/dashboard/settings/delivery-fees" },
  { title: "Payment Methods", where: "Finance", href: "/dashboard/settings/payments" },
  { title: "Send Notification", where: "Marketing", href: "/dashboard/settings/notifications" },
  { title: "Takal Offices", where: "System", href: "/dashboard/settings/hubs" },
  { title: "Audit Logs", where: "System", href: "/dashboard/settings/audit" },
  { title: "Admin Users", where: "People", href: "/dashboard/users" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Most settings now live beside the work they affect — money settings are
          under Finance, notifications under Marketing.
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group block"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-6 hover:border-primary-300 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${section.color} mb-4 text-2xl`}>
                    {section.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-1">
                    {section.title}
                  </h3>
                  <p className="text-slate-600 text-sm">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 transition mt-2" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Where everything else went */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Moved to the sidebar</h3>
        <p className="text-slate-600 text-sm mb-4">
          These used to be here. They now sit next to the work they belong to —
          click any of them to go straight there.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MOVED.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-slate-50 transition"
            >
              <span className="text-sm text-slate-900">{m.title}</span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                {m.where}
                <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 mb-2">💡 Tip</h3>
        <p className="text-amber-900 text-sm">
          Commission and delivery-fee changes apply to all NEW orders straight
          away. Orders already placed keep the price the customer was quoted.
        </p>
      </div>
    </div>
  );
}
