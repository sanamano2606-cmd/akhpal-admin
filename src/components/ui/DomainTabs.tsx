"use client";

/**
 * The tab strip at the top of a domain.
 *
 * THE WHOLE POINT OF THE REBUILD: one domain, one sidebar line. Everything
 * about a thing lives inside that thing's section, as tabs across the top -
 * instead of being scattered down a sidebar of 28 links where Orders, Returns
 * and Parcels look like three unrelated features and the settings that CONTROL
 * money sit five clicks away from the money.
 *
 * A tab is hidden if this admin does not have the permission for it, so nobody
 * is shown a tab that will refuse them. The permission comes from the same one
 * place the sidebar uses - lib/navigation.ts - so a tab and its sidebar line
 * can never disagree.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMyPerms } from "@/lib/perms";
import { mayAccess, type Section } from "@/lib/navigation";

export type DomainTab = {
  label: string;
  href: string;
  /** Permission needed. Same meaning as in lib/navigation.ts. */
  section?: Section;
  /** Something is waiting on this tab ("Needs a call · 1", Mock 198): the
   *  tab turns red and shows the number. Nothing waiting = the plain tab. */
  badge?: number;
};

/** `bare`: no line and no edge-to-edge band of its own - for a section that
 *  puts its title and its tabs on ONE line (Stores, Mock 189). */
export function DomainTabs({ tabs, bare = false }: { tabs: DomainTab[]; bare?: boolean }) {
  const pathname = usePathname();
  // Permissions live in the browser, so they are only known after mount.
  // Everything is shown until then, and the server refuses anything it should.
  // Only WHICH tabs she may open is kept; the tabs themselves are always
  // today's, so a count that arrives later ("Needs a call · 1") shows at once.
  const [allowed, setAllowed] = useState<Set<string> | null>(null);

  useEffect(() => {
    const perms = getMyPerms();
    setAllowed(new Set(tabs.filter((t) => mayAccess(t.section ?? null, perms)).map((t) => t.href)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const visible = allowed ? tabs.filter((t) => allowed.has(t.href)) : tabs;

  // The longest matching address wins, so /reports/audit highlights itself and
  // not the shorter /reports.
  const active = visible
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (visible.length < 2) return null;

  return (
    <div
      className={bare ? "flex gap-1 overflow-x-auto" : "border-b border-takal-line flex gap-1 overflow-x-auto -mx-6 px-6"}
      role="tablist"
    >
      {visible.map((t) => {
        const on = active?.href === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={[
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition",
              on
                ? "border-takal-yellow text-takal-ink font-bold"
                : "border-transparent text-takal-ink-soft hover:text-takal-ink",
              (t.badge ?? 0) > 0 ? "!text-takal-red font-bold" : "",
            ].join(" ")}
          >
            {(t.badge ?? 0) > 0 ? `☎ ${t.label} · ${t.badge}` : t.label}
          </Link>
        );
      })}
    </div>
  );
}
