"use client";

/**
 * THE OLD ADDRESS, KEPT ALIVE ON PURPOSE (Mock 210, 27 October 2026).
 *
 * Shelf check moved inside Stores › Product sorting, as its third tab:
 * /dashboard/stores/sorting/shelf-check. This page only sends whoever lands
 * on the old address there - a bookmark must not open a store called
 * "shelf-check" (this address would otherwise be read as one store's page).
 * A plain link is there too, in case the automatic move does not happen.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SHELF_CHECK_NOW = "/dashboard/stores/sorting/shelf-check";

export default function MovedToProductSorting() {
  const router = useRouter();
  useEffect(() => { router.replace(SHELF_CHECK_NOW); }, [router]);
  return (
    <div className="rounded-lg border border-takal-line bg-white p-8 text-center">
      <p className="font-semibold text-takal-ink">Shelf check is inside Product sorting now.</p>
      <p className="mt-1 text-takal-ink-soft">Taking you there…</p>
      <Link href={SHELF_CHECK_NOW}
        className="mt-4 inline-block rounded-lg bg-takal-yellow px-4 py-2 font-semibold text-takal-ink hover:bg-takal-yellow-dark">
        Open Shelf check
      </Link>
    </div>
  );
}
