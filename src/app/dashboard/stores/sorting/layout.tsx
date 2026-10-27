"use client";

// STORES › PRODUCT SORTING - the inner tabs (Mock 210, approved 27 Oct 2026).
// Overview · Find & move · Sorting list · Shelf check. Shelf check is the same
// page as before (Mock 201); it simply lives here now, next to the others.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SORTING_TABS } from "@/lib/product-sorting";

export default function SortingLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "";
  const on = (href: string) => href === "/dashboard/stores/sorting" ? path === href : path.startsWith(href);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-takal-ink">Product sorting</h2>
        <nav aria-label="Product sorting" className="flex max-w-full gap-1 overflow-x-auto rounded-[10px] border border-takal-line bg-white p-[3px]">
          {SORTING_TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={on(t.href) ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] ${on(t.href) ? "bg-black font-bold text-takal-yellow" : "font-medium text-takal-ink-soft hover:text-takal-ink"}`}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
