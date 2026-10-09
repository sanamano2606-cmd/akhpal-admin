"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "WHOLE CATALOGUE" FOR A MALL'S OWN STAFF.  (Sana: "Yes Catalogue", 1 Oct 2026.)
//
// The SAME page the office uses (dashboard/stores/[id]/catalogue), shown in a
// slim Shop-panel frame. Its three extra calls go to the shop's own doors when
// the person is Mall staff (lib/api-stores.ts), so nothing here reaches /admin.
//
// Not the lock: the server checks, on every request, that this is the staff
// member's own shop. This page only sends a person to the right place:
//   * not signed in            -> sign-in, with "Shop staff" chosen
//   * a Takal admin            -> the admin catalogue page for the same shop
//   * staff, someone else's id -> their OWN shop's catalogue
//   * a whole-mall login        -> any store of ITS mall (Step 5, Mock 172-5)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { staffStores } from "@/lib/mall-staff-window";
import { signedInAsStaff } from "@/lib/staff-sign-in";
import CataloguePage from "@/app/dashboard/stores/[id]/catalogue/page";

export default function ShopCataloguePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/auth/login?as=staff");
      return;
    }
    if (!signedInAsStaff()) {
      router.replace(`/dashboard/stores/${id}/catalogue`);
      return;
    }
    let alive = true;
    apiClient.getMyShopAsStaff()
      .then((me) => {
        if (!alive) return;
        const mine = staffStores(me).find((s) => String(s.id) === id);
        if (me?.shop?.id && !mine) {
          router.replace(`/shop/catalogue/${me.shop.id}`);
          return;
        }
        setShopName(mine?.name || me?.shop?.name || "");
        setReady(true);
      })
      // Switched off, or no longer a shop's staff: the Shop panel explains.
      .catch(() => { if (alive) router.replace("/shop"); });
    return () => { alive = false; };
  }, [id, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-takal-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-takal-line border-t-takal-yellow-dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-takal-page">
      <div className="flex items-center gap-2.5 border-b border-takal-line bg-white px-4 py-3 md:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-takal-yellow font-black text-takal-ink">T</div>
        <p className="font-bold text-takal-ink">Takal <span className="font-normal text-takal-ink-soft">· Shop panel · {shopName}</span></p>
      </div>
      <main className="p-4 md:p-6">
        <CataloguePage params={{ id }} />
      </main>
    </div>
  );
}
