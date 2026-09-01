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
};

export function DomainTabs({ tabs }: { tabs: DomainTab[] }) {
  const pathname = usePathname();
  // Permissions live in the browser, so they are only known after mount.
  // Everything is shown until then, and the server refuses anything it should.
  const [visible, setVisible] = useState<DomainTab[]>(tabs);

  useEffect(() => {
    const perms = getMyPerms();
    setVisible(tabs.filter((t) => mayAccess(t.section ?? null, perms)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // The longest matching address wins, so /reports/audit highlights itself and
  // not the shorter /reports.
  const active = visible
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (visible.length < 2) return null;

  return (
    <div
      className="border-b border-takal-line flex gap-1 overflow-x-auto -mx-6 px-6"
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
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
