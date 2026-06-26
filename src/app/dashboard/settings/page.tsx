"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const SETTINGS_SECTIONS = [
  {
    title: "Commission Settings",
    description: "Configure platform commission rates and policies",
    href: "/dashboard/settings/commissions",
    icon: "💰",
    color: "bg-green-100",
  },
  {
    title: "Delivery Fees Management",
    description: "Set delivery charges, zones, and special rates",
    href: "/dashboard/settings/delivery-fees",
    icon: "🚗",
    color: "bg-blue-100",
  },
  {
    title: "Tax Settings",
    description: "Configure GST, SGST, CGST and tax policies",
    href: "/dashboard/settings/taxes",
    icon: "📊",
    color: "bg-purple-100",
  },
  {
    title: "Notifications",
    description: "Email, SMS, and push notification settings",
    href: "/dashboard/settings/notifications",
    icon: "🔔",
    color: "bg-yellow-100",
  },
  {
    title: "Team Management",
    description: "Manage admin users and team members",
    href: "/dashboard/settings/team",
    icon: "👥",
    color: "bg-red-100",
  },
  {
    title: "Roles & Permissions",
    description: "Define roles and access control policies",
    href: "/dashboard/settings/roles",
    icon: "🔐",
    color: "bg-indigo-100",
  },
  {
    title: "Audit Logs",
    description: "View admin actions and system audit trail",
    href: "/dashboard/settings/audit",
    icon: "📋",
    color: "bg-cyan-100",
  },
  {
    title: "Appearance",
    description: "Customize brand colors, logo, and appearance",
    href: "/dashboard/settings/appearance",
    icon: "🎨",
    color: "bg-pink-100",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Manage platform configuration, commission, fees, and more
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
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition mt-2" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tip</h3>
        <p className="text-blue-800 text-sm">
          Changes to commission rates and delivery fees take effect immediately and apply to all new orders.
          Make sure to test thoroughly before deploying to production.
        </p>
      </div>
    </div>
  );
}
