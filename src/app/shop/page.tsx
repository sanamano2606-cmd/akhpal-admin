"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP PANEL - WHAT A MALL'S OWN STAFF SEE.
// Mock 133 picture H (picture F of Mock 132, updated), approved 1 Oct 2026.
// Mock 172-4 / 172-5 (one login, every store of the mall), approved 8 Oct 2026.
//
// A ONE-SHOP login sees its own shop: Products, Orders, Store settings,
// Location, Money (view only). (Orders for a one-shop login too - Sana,
// 9 Oct 2026: "Yes".)
//
// A WHOLE-MALL login (Step 5, 9 Oct 2026) sees the mall at the top and a row
// of store buttons: "All stores" (one overview) and each store. Products,
// Store settings, Location and Money work in the store chosen there; Orders
// shows the mall's orders, a mall basket as ONE order. A product put in the
// wrong store moves with "Move to another store".
//
// Never: Team (the Main Admin adds staff), "Featured", commission, mark-up,
// delivery fee, approval, payouts - those are Takal's.
//
// THIS PAGE IS NOT THE LOCK. Every request it makes goes through
// core_auth.require_shop_side on the server, which checks - on every single
// request - that this person is switched on and works for THAT shop, and
// refuses Takal's fields (commission, mark-up, delivery fee, approval,
// Featured, payouts) whatever the page sends. Guard:
// backend/tests/test_mall_staff_are_walled_in.py.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, LogOut, MapPin, Package, Receipt, Settings, Wallet } from "lucide-react";
import { apiClient, APIClient } from "@/lib/api-client";
import { AccessDeniedError } from "@/lib/api-errors";
import type { StaffMe } from "@/lib/api-people";
import type { ShopProductsPage } from "@/lib/api-stores";
import { shortName } from "@/lib/malls";
import {
  isMallLogin, pickedStore, staffStores, windowAddress, withNewLogo,
} from "@/lib/mall-staff-window";
import { hoursInWords } from "@/lib/shop-hours";
import { signedInAsStaff } from "@/lib/staff-sign-in";
import { verticalEmoji } from "@/lib/verticals";
import { ErrorState } from "@/components/ui";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { ProductsTab } from "@/app/dashboard/stores/[id]/parts-products";
import { StoreSettingsCard } from "@/app/dashboard/stores/[id]/parts-settings";
import { ShopLocationCard } from "@/app/dashboard/stores/parts-shop-location";
import { ShopMoneyTab } from "./parts-money";
import { ShopOrdersTab } from "./parts-orders";
import { AllStores, StoreSwitcher, useStoreFigures } from "./parts-stores";

type TabId = "products" | "orders" | "settings" | "location" | "money";
const TABS: { id: TabId; label: string; side: string; Icon: any }[] = [
  { id: "products", label: "Products", side: "Products", Icon: Package },
  // Step 5 (Mock 172-5): the order doors opened for a mall's staff in Step 3c.
  // Every staff login - whole-mall AND one-shop (Sana, 9 Oct 2026: "Yes").
  { id: "orders", label: "Orders", side: "Orders", Icon: Receipt },
  { id: "settings", label: "Store settings", side: "Store settings", Icon: Settings },
  { id: "location", label: "Location", side: "Location", Icon: MapPin },
  { id: "money", label: "Money", side: "Money (view only)", Icon: Wallet },
];
const isTab = (v: string | null): v is TabId => !!v && TABS.some((t) => t.id === v);

/** "5 stores · one delivery · Standard 1–3 days · Makan Bagh, Mingora" */
const mallLine = (n: number, address: string | null) =>
  [n + " stores", "one delivery", "Standard 1–3 days", address].filter(Boolean).join(" · ");

export default function ShopPanelPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [error, setError] = useState("");
  const [switchedOff, setSwitchedOff] = useState("");
  const [tab, setTab] = useState<TabId>("products");
  const [asked, setAsked] = useState<string | null>(null);
  const [counts, setCounts] = useState<ShopProductsPage["counts"] | null>(null);
  const [figuresKey, setFiguresKey] = useState(0);
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
      const qs = new URLSearchParams(window.location.search);
      const t = qs.get("tab");
      if (isTab(t)) setTab(t);
      setAsked(qs.get("store"));
    } catch { /* the default tab and store are fine */ }
    setReady(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Which store the window is on ─────────────────────────────────────────
  const stores = staffStores(me);
  const mallLogin = isMallLogin(me);
  const mall = mallLogin ? me?.mall ?? null : null;
  const picked = pickedStore(asked, me);
  const shop = stores.find((s) => String(s.id) === picked) ?? (mallLogin ? null : me?.shop ?? null);
  const tabs = TABS;
  const shownTab: TabId = tabs.some((t) => t.id === tab) ? tab : "products";
  const { figures, loading: figuresLoading, failed } = useStoreFigures(mallLogin ? stores : [], figuresKey);
  const others = stores
    .filter((s) => String(s.id) !== picked)
    .map((s) => ({ id: String(s.id), name: shortName(s.name, mall?.name || ""), vendorType: s.vendor_type || "restaurant" }));

  const remember = (store: string, t: TabId) => {
    try {
      window.history.replaceState(null, "", windowAddress(window.location.href, store, t, mallLogin ? "all" : ""));
    } catch { /* the window still changes; only the address does not */ }
  };
  const openTab = (t: TabId) => {
    setTab(t);
    remember(picked, t);
  };
  const openStore = (id: string) => {
    setAsked(id);
    setCounts(null);
    remember(id, shownTab);
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

  const person = me?.user;
  const hours = hoursInWords(shop?.opening_time, shop?.closing_time);
  const shown = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString());
  const openStores = stores.filter((s) => s.is_open).length;
  const where = mall?.name || shop?.name || "Your shop";
  const logo = mall ? mall.image_url : shop?.image_url;

  const Stat = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
    <div className={`min-w-[104px] rounded-xl border px-3.5 py-2 ${warn ? "bg-takal-orange-soft border-[#FFC7B0]" : "bg-white border-takal-line"}`}>
      <p className="text-[11px] text-takal-ink-soft">{label}</p>
      <p className={`text-lg font-bold leading-tight ${warn ? "text-[#C8410F]" : "text-takal-ink"}`}>{value}</p>
    </div>
  );

  // What the area under the tabs shows: a mall login on "All stores" sees the
  // overview (Products) or is asked to choose a store (a store's own pages).
  const needsAStore = mallLogin && !shop && shownTab !== "orders";

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
        <p className="mx-3 mb-1.5 mt-2 truncate text-[11px] uppercase tracking-wider text-takal-disabled-text" title={where}>
          {where}
        </p>
        <nav aria-label="Shop panel">
          {tabs.map(({ id, side, Icon }) => {
            const on = shownTab === id;
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
          <p className="truncate">{mall ? "Mall staff" : "Staff"} · {where}</p>
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
          <p className="truncate text-sm"><b>{person?.full_name || "…"}</b> · {mall ? "Mall staff" : "Staff"}</p>
          <button onClick={signOut} aria-label="Sign out" title="Sign out"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-slate-100">
            <LogOut className="h-5 w-5 text-takal-red" />
          </button>
        </div>

        {error && !me ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="space-y-4">
            {/* ── Header: the mall for a mall login, the shop otherwise ── */}
            <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-takal-line bg-white px-5 py-4">
              <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-takal-yellow" aria-hidden="true" />
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-takal-blue to-[#0F7B8A] text-3xl">
                {logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logo} alt="" className="h-full w-full object-cover" />
                  : <span>{verticalEmoji(shop?.vendor_type)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-extrabold text-takal-ink">{me ? where : "Loading…"}</h1>
                <p className="mt-0.5 text-[13px] text-takal-ink-soft">
                  {mall
                    ? mallLine(stores.length, mall.address)
                    : [shop?.address, hours].filter(Boolean).join(" · ") || "—"}
                </p>
                {me && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mall && !shop ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${openStores ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}>
                        <span className={`h-2 w-2 rounded-full ${openStores ? "bg-takal-green" : "bg-takal-disabled-text"}`} />
                        {openStores} of {stores.length} stores open
                      </span>
                    ) : shop && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${shop.is_open ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}>
                        <span className={`h-2 w-2 rounded-full ${shop.is_open ? "bg-takal-green" : "bg-takal-disabled-text"}`} />
                        {mall ? `${shortName(shop.name, mall.name)}: ` : ""}{shop.is_open ? "Open for orders" : "Closed"}
                      </span>
                    )}
                    {mall ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-takal-blue-soft px-2.5 py-0.5 text-xs font-bold text-takal-blue">
                        Mall staff: all {stores.length} stores
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#111111] px-2.5 py-0.5 text-xs font-semibold text-takal-yellow">
                        <Lock className="h-3 w-3" /> Your shop only
                      </span>
                    )}
                  </div>
                )}
              </div>
              {shop && shownTab === "products" && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Stat label="Products" value={shown(counts?.all)} />
                  <Stat label="Need a picture" value={shown(counts?.no_picture)} warn={(counts?.no_picture ?? 0) > 0} />
                  <Stat label="Out of stock" value={shown(counts?.out_of_stock)} />
                </div>
              )}
            </div>

            {/* ── The store buttons (a mall login only) ── */}
            {mallLogin && (
              <StoreSwitcher stores={stores} mallName={mall?.name || ""} picked={picked}
                figures={figures} onPick={openStore} />
            )}

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
                {tabs.map(({ id, label, Icon }) => {
                  const on = shownTab === id;
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
                      {id === "products" && shop && counts?.all != null && (
                        <span className={`rounded-full px-2 text-[11px] leading-5 ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                          {counts.all.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-b-2xl border-2 border-t-0 border-takal-line bg-white p-4">
                {!me ? (
                  <div className="py-8 text-center text-sm text-takal-ink-soft">Loading…</div>
                ) : shownTab === "orders" && stores.length > 0 ? (
                  <ShopOrdersTab stores={stores} mallName={mall?.name || ""}
                    onlyStore={shop ? String(shop.id) : null} onChanged={() => setFiguresKey((k) => k + 1)} />
                ) : needsAStore && shownTab === "products" ? (
                  <AllStores stores={stores} mallName={mall?.name || ""} figures={figures}
                    loading={figuresLoading} failed={failed} onPick={openStore} onOrders={() => openTab("orders")} />
                ) : needsAStore || !shop ? (
                  <p className="py-8 text-center text-[15px] text-takal-ink-soft">
                    {tabs.find((t) => t.id === shownTab)?.label} belongs to one store - <b className="text-takal-ink">choose a store above</b>.
                  </p>
                ) : (
                  <>
                    {/* Kept alive when hidden: the search and the page survive a tab
                        switch. A new store is a new list (key). */}
                    <div hidden={shownTab !== "products"}>
                      <ProductsTab key={shop.id} restaurantId={shop.id} vendorType={shop.vendor_type || "restaurant"}
                        onCounts={setCounts} staffView
                        moveTo={mallLogin ? others : undefined} mallName={mall?.name || ""} />
                    </div>
                    {shownTab === "settings" && (
                      <StoreSettingsCard key={shop.id} store={shop} onSaved={load}
                        onLogo={(url) => setMe((m) => (m ? withNewLogo(m, String(shop.id), url) : m))} />
                    )}
                    {shownTab === "location" && <ShopLocationCard key={shop.id} store={shop} onSaved={load} />}
                    {shownTab === "money" && <ShopMoneyTab key={shop.id} restaurantId={shop.id} />}
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
