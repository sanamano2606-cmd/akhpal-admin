"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP PANEL - WHAT A MALL'S OWN STAFF SEE.
// Mock 133 picture H (picture F of Mock 132, updated), approved 1 Oct 2026.
//
// ONE shop, the staff member's own, and only these four: Products, Store
// settings, Location, Money (view only). No Team (the Main Admin adds staff),
// no Orders yet (the order doors are not open to staff), no "Featured", no
// "Whole catalogue" (its three server doors are Admin-only for now).
//
// THIS PAGE IS NOT THE LOCK. Every request it makes goes through
// core_auth.require_shop_side on the server, which checks - on every single
// request - that this person is switched on and works for THIS shop, and
// refuses Takal's fields (commission, mark-up, delivery fee, approval,
// Featured, payouts) whatever the page sends. Guard:
// backend/tests/test_mall_staff_are_walled_in.py.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, LogOut, MapPin, Package, Settings, Wallet } from "lucide-react";
import { apiClient, APIClient } from "@/lib/api-client";
import { AccessDeniedError } from "@/lib/api-errors";
import type { StaffMe } from "@/lib/api-people";
import type { ShopProductsPage } from "@/lib/api-stores";
import { hoursInWords } from "@/lib/shop-hours";
import { signedInAsStaff } from "@/lib/staff-sign-in";
import { verticalEmoji } from "@/lib/verticals";
import { ErrorState } from "@/components/ui";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { ProductsTab } from "@/app/dashboard/stores/[id]/parts-products";
import { StoreSettingsCard } from "@/app/dashboard/stores/[id]/parts-settings";
import { ShopLocationCard } from "@/app/dashboard/stores/parts-shop-location";
import { ShopMoneyTab } from "./parts-money";

type TabId = "products" | "settings" | "location" | "money";
const TABS: { id: TabId; label: string; side: string; Icon: any }[] = [
  { id: "products", label: "Products", side: "Products", Icon: Package },
  { id: "settings", label: "Store settings", side: "Store settings", Icon: Settings },
  { id: "location", label: "Location", side: "Location", Icon: MapPin },
  { id: "money", label: "Money", side: "Money (view only)", Icon: Wallet },
];
const isTab = (v: string | null): v is TabId => !!v && TABS.some((t) => t.id === v);

export default function ShopPanelPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [error, setError] = useState("");
  const [switchedOff, setSwitchedOff] = useState("");
  const [tab, setTab] = useState<TabId>("products");
  const [counts, setCounts] = useState<ShopProductsPage["counts"] | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForced, setPwForced] = useState(false);

  const load = async () => {
    setError("");
    try {
      const out = await apiClient.getMyShopAsStaff();
      setMe(out);
      // `=== true`: a missing mark must never mean a window nobody can leave.
      if (out?.user?.must_change_password === true) {
        setPwForced(true);
        setPwOpen(true);
      }
    } catch (e) {
      // 403 = this login was switched off, or no longer belongs to a shop.
      if (e instanceof AccessDeniedError) {
        setSwitchedOff(e.message || "This staff login is switched off. Please contact Takal.");
      } else {
        setError(e instanceof Error ? e.message : "Your shop could not be read.");
      }
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/auth/login?as=staff");
      return;
    }
    // Takal's own admins have their own panel.
    if (!signedInAsStaff()) {
      router.replace("/dashboard");
      return;
    }
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (isTab(t)) setTab(t);
    } catch { /* the default tab is fine */ }
    setReady(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTab = (t: TabId) => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      if (t === "products") u.searchParams.delete("tab");
      else u.searchParams.set("tab", t);
      window.history.replaceState(null, "", u.toString());
    } catch { /* the tab still changes; only the address does not */ }
  };

  const signOut = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    // And every saved copy of what was on screen (see the dashboard's logout).
    APIClient.clearCache();
    router.push("/auth/login?as=staff");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-takal-page">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-takal-line border-t-takal-yellow-dark" />
      </div>
    );
  }

  if (switchedOff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-takal-page px-4">
        <div className="w-full max-w-md rounded-2xl border border-takal-line bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-takal-red-soft">
            <Lock className="h-7 w-7 text-takal-red" />
          </div>
          <h1 className="mb-2 text-lg font-bold text-takal-ink">You cannot use the Shop panel</h1>
          <p className="mb-6 text-sm text-takal-ink-soft">{switchedOff}</p>
          <button onClick={signOut}
            className="rounded-lg bg-takal-yellow px-5 py-2.5 font-semibold text-takal-ink hover:bg-takal-yellow-dark">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const shop = me?.shop;
  const person = me?.user;
  const hours = hoursInWords(shop?.opening_time, shop?.closing_time);
  const shown = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString());

  const Stat = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
    <div className={`min-w-[104px] rounded-xl border px-3.5 py-2 ${warn ? "bg-takal-orange-soft border-[#FFC7B0]" : "bg-white border-takal-line"}`}>
      <p className="text-[11px] text-takal-ink-soft">{label}</p>
      <p className={`text-lg font-bold leading-tight ${warn ? "text-[#C8410F]" : "text-takal-ink"}`}>{value}</p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-takal-page">
      <ChangePasswordModal
        open={pwOpen}
        forced={pwForced}
        staff
        onClose={() => setPwOpen(false)}
        onDone={() => {
          // No longer forced the moment it is done, so "Password changed"
          // can be closed normally.
          setPwForced(false);
          setMe((m) => (m ? { ...m, user: { ...m.user, must_change_password: false } } : m));
        }}
      />

      {/* ── Sidebar (computer and tablet). On a phone the tabs do the same job. ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-takal-line bg-white px-3.5 py-5 md:flex">
        <div className="mb-3.5 flex items-center gap-2.5 border-b border-takal-line px-1.5 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-takal-yellow text-lg font-black text-takal-ink">T</div>
          <div>
            <p className="font-bold text-takal-ink">Takal</p>
            <p className="text-xs text-takal-ink-soft">Shop panel</p>
          </div>
        </div>
        <p className="mx-3 mb-1.5 mt-2 truncate text-[11px] uppercase tracking-wider text-takal-disabled-text" title={shop?.name}>
          {shop?.name || "Your shop"}
        </p>
        <nav aria-label="Shop panel">
          {TABS.map(({ id, side, Icon }) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => openTab(id)} aria-current={on ? "page" : undefined}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${
                  on ? "bg-takal-yellow font-bold text-takal-ink shadow-[0_2px_0_#E6E600]" : "text-takal-ink hover:bg-slate-100"
                }`}>
                <Icon className="h-5 w-5 shrink-0" />
                {side}
              </button>
            );
          })}
        </nav>
        <div className="mt-4 rounded-xl bg-[#111111] px-3.5 py-3 text-[13px] text-white">
          <p className="truncate text-sm font-bold text-takal-yellow">{person?.full_name || "…"}</p>
          <p className="truncate">Staff · {shop?.name || "…"}</p>
          <button onClick={() => { setPwForced(false); setPwOpen(true); }}
            className="mt-2 flex items-center gap-1.5 text-[#BBBBBB] hover:text-white">
            <KeyRound className="h-3.5 w-3.5" /> Change password
          </button>
          <button onClick={signOut} className="mt-1 flex items-center gap-1.5 text-[#BBBBBB] hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        {/* Phone: a slim bar with who you are and Sign out. */}
        <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 md:hidden">
          <p className="truncate text-sm"><b>{person?.full_name || "…"}</b> · Staff</p>
          <button onClick={signOut} aria-label="Sign out" title="Sign out"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-slate-100">
            <LogOut className="h-5 w-5 text-takal-red" />
          </button>
        </div>

        {error && !me ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="space-y-4">
            {/* ── Header ── */}
            <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-takal-line bg-white px-5 py-4">
              <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-takal-yellow" aria-hidden="true" />
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-takal-blue to-[#0F7B8A] text-3xl">
                {shop?.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={shop.image_url} alt="" className="h-full w-full object-cover" />
                  : <span>{verticalEmoji(shop?.vendor_type)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-extrabold text-takal-ink">{shop?.name || "Loading…"}</h1>
                <p className="mt-0.5 text-[13px] text-takal-ink-soft">
                  {[shop?.address, hours].filter(Boolean).join(" · ") || "—"}
                </p>
                {shop && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${shop.is_open ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}>
                      <span className={`h-2 w-2 rounded-full ${shop.is_open ? "bg-takal-green" : "bg-takal-disabled-text"}`} />
                      {shop.is_open ? "Open for orders" : "Closed"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#111111] px-2.5 py-0.5 text-xs font-semibold text-takal-yellow">
                      <Lock className="h-3 w-3" /> Your shop only
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Stat label="Products" value={shown(counts?.all)} />
                <Stat label="Need a picture" value={shown(counts?.no_picture)} warn={(counts?.no_picture ?? 0) > 0} />
                <Stat label="Out of stock" value={shown(counts?.out_of_stock)} />
              </div>
            </div>

            {/* ── What Takal sets ── */}
            <div className="flex gap-2.5 rounded-xl border-[1.5px] border-[#B9CFE0] bg-takal-blue-soft px-4 py-2.5 text-[13px] text-takal-blue">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <b>Set by Takal — Mall staff cannot change these:</b> commission, menu mark-up,
                delivery fee, approval, “Featured”, payments to the shop. The Mall cannot see
                other shops, customers, riders or Takal’s settings.
              </p>
            </div>

            {/* ── Tabs ── */}
            <div>
              <div className="flex gap-1 overflow-x-auto border-b-2 border-takal-line" role="tablist">
                {TABS.map(({ id, label, Icon }) => {
                  const on = tab === id;
                  return (
                    <button key={id} role="tab" aria-selected={on} onClick={() => openTab(id)}
                      className={[
                        "flex items-center gap-2 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold transition",
                        on
                          ? "-mb-[2px] border-2 border-b-white border-takal-line bg-white text-takal-ink shadow-[inset_0_4px_0_#FFFF00]"
                          : "text-takal-ink-soft hover:text-takal-ink",
                      ].join(" ")}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {id === "products" && counts?.all != null && (
                        <span className={`rounded-full px-2 text-[11px] leading-5 ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                          {counts.all.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-b-2xl border-2 border-t-0 border-takal-line bg-white p-4">
                {!shop ? (
                  <div className="py-8 text-center text-sm text-takal-ink-soft">Loading…</div>
                ) : (
                  <>
                    {/* Kept alive when hidden: the search and the page survive a tab switch. */}
                    <div hidden={tab !== "products"}>
                      <ProductsTab restaurantId={shop.id} vendorType={shop.vendor_type || "restaurant"}
                        onCounts={setCounts} staffView />
                    </div>
                    {tab === "settings" && (
                      <StoreSettingsCard store={shop} onSaved={load}
                        onLogo={(url) => setMe((m) => (m ? { ...m, shop: { ...m.shop, image_url: url } } : m))} />
                    )}
                    {tab === "location" && <ShopLocationCard store={shop} onSaved={load} />}
                    {tab === "money" && <ShopMoneyTab restaurantId={shop.id} />}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
