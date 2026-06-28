// Reads the logged-in admin's role/permissions from localStorage (set at login).

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

/** Can the current admin access a given section? Main Admin can access everything. */
export function canAccess(section: string): boolean {
  const { isSuper, sections } = getMyPerms();
  return isSuper || sections.includes(section);
}
