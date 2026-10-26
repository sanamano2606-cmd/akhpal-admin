"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ONE STORE.  (Mock 132, approved by Sana 30 September 2026.)
//
// WAS: one long page - four money boxes, Store settings, Shop location, Live
// orders, Profile, Payout details, then Products in a box 288 px tall, then
// Recent orders. Staff come here for products, and products were sixth.
// The old version is in DELETE-AFTER-TESTING/store-page-mock-132-2026-09-30/.
//
// NOW: a header, and five tabs. It opens on Products.
//   Products        parts-products.tsx - pages, search, filters, pictures
//   Orders          the live-orders card and the recent orders
//   Store settings  the settings card and the profile
//   Location        the map card
//   Money           the four money boxes and where Takal sends the money
//
// Only the open tab is drawn, so the live-orders card and the payout card ask
// the server for nothing until somebody opens their tab. The Products tab is
// kept alive when hidden, so a search is still there when you come back.
//
// The tab is in the address (?tab=orders), so a link can open the right one
// and the browser's Back button behaves.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Package, Receipt, Settings, MapPin, Wallet, Users } from "lucide-react";
import { PayoutDetailsCard } from "@/components/PayoutDetailsCard";
import { apiClient } from "@/lib/api-client";
import type { ShopProductsPage } from "@/lib/api-stores";
import { money, moneyExact, fmtDate, orderLabel } from "@/lib/format";
import { owedOrOverpaid } from "@/app/dashboard/payments/money";
import { toast } from "@/lib/toast";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { ShopLocationCard } from "../parts-shop-location";
import { StoreSettingsCard } from "./parts-settings";
import { StoreOrdersCard } from "./parts-orders";
import { ProductsTab } from "./parts-products";
import { hoursInWords } from "@/lib/shop-hours";
import { getMyPerms } from "@/lib/perms";
import type { ShopStaffMember } from "@/lib/api-people";
import { MallStaffTab } from "./parts-staff";
import { PriceModeCard } from "./parts-price-mode";
import type { Mall } from "@/lib/api-stores";
import { StoreStatusChip, StoreStatusActions, storeStatusOf } from "./parts-status-bar";
import { allStoresHref } from "@/lib/stores-list-address";
import { waNumber } from "@/lib/vendor-queue";
import { LicenceCard, LicenceChip } from "./parts-licence";
import { mayAccess } from "@/lib/navigation";
import type { ShopLicence } from "@/lib/shop-licence";

type TabId = "products" | "orders" | "settings" | "location" | "money" | "staff";
const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: "products", label: "Products", Icon: Package },
  { id: "orders", label: "Orders", Icon: Receipt },
  { id: "settings", label: "Store settings", Icon: Settings },
  { id: "location", label: "Location", Icon: MapPin },
  { id: "money", label: "Money", Icon: Wallet },
  // Mock 133: a Mall's own staff logins. Drawn for the MAIN ADMIN only (see
  // `tabs` below); the server refuses everybody else on every staff door.
  { id: "staff", label: "Staff logins", Icon: Users },   // was "Mall staff" (fix 13): ordinary shops have it too
];
const isTab = (v: string | null): v is TabId => !!v && TABS.some((t) => t.id === v);

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("products");
  const [counts, setCounts] = useState<ShopProductsPage["counts"] | null>(null);
  // A fixed-price store's header figures (Mock 171-1), and a standard store
  // filling its buying prices before the switch (Mock 171-3).
  const [priceSummary, setPriceSummary] = useState<{ missing: number; loss: number; avgPercent: number | null } | null>(null);
  const [buyingFirst, setBuyingFirst] = useState(false);

  // ── Mall staff (Mock 133) - the Main Admin only ──────────────────────────
  const [isMain, setIsMain] = useState(false);
  const [staff, setStaff] = useState<ShopStaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffError("");
    try {
      setStaff((await apiClient.getShopStaff(id)).staff || []);
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "The staff list could not be read.");
    } finally {
      setStaffLoading(false);
    }
  };
  useEffect(() => {
    const main = getMyPerms().isSuper;
    setIsMain(main);
    if (main && id) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const tabs = TABS.filter((t) => t.id !== "staff" || isMain);
  const staffOn = staff.filter((s) => s.is_active).length;

  // Read the tab from the address once. useSearchParams would force the whole
  // page to render on the client only; the stores list does the same.
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      // ?tab=staff is honoured for the Main Admin only. Anybody else lands
      // on Products - never on an empty panel with no tab chosen (found by
      // clicking through as a sub-admin, 1 Oct 2026).
      if (isTab(t) && (t !== "staff" || getMyPerms().isSuper)) setTab(t);
    } catch { /* the default tab is fine */ }
  }, []);

  // UNSAVED TYPING IS NOT THROWN AWAY (fix 10, Sana 12 Oct 2026: "OK fix
  // 10"; audit O8). Settings and Location tell the page when they hold changes
  // not saved yet; switching tab or pressing "← All stores" then asks first.
  const [dirtyParts, setDirtyParts] = useState<Record<string, boolean>>({});
  const settingsDirty = useCallback((d: boolean) => setDirtyParts((p) => (p.settings === d ? p : { ...p, settings: d })), []);
  const locationDirty = useCallback((d: boolean) => setDirtyParts((p) => (p.location === d ? p : { ...p, location: d })), []);
  const unsaved = Object.values(dirtyParts).some(Boolean);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const leaveIfSaved = (go: () => void) => { if (unsaved) setLeaving(() => go); else go(); };
  // Closing the browser tab or reloading also warns while something is unsaved.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const openTab = (t: TabId) => {
    if (t !== tab && unsaved) { setLeaving(() => () => { setDirtyParts({}); switchTab(t); }); return; }
    switchTab(t);
  };
  const switchTab = (t: TabId) => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      if (t === "products") u.searchParams.delete("tab");
      else u.searchParams.set("tab", t);
      window.history.replaceState(null, "", u.toString());
    } catch { /* the tab still changes; only the address does not */ }
  };

  // THE MALL THIS STORE IS IN (Mock 172-6): "Part of ..." in the header, the
  // mall's logo when the store has none, and whole-mall staff logins.
  const [mall, setMall] = useState<Mall | null>(null);
  const mallId = data?.restaurant?.mall_id as string | undefined;
  useEffect(() => {
    if (!mallId) { setMall(null); return; }
    apiClient.getMall(mallId).then(setMall).catch(() => setMall(null));
  }, [mallId]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setData(await apiClient.getRestaurantDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the store");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // MARKING FEATURED ASKS FIRST (fix 8, audit O9): it puts the shop at the top
  // for every customer. Taking Featured off stays one click.
  const [askFeature, setAskFeature] = useState(false);
  // ⋯ on the one line (MOCK 203 v2): address, owner, figures, Featured.
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleFeatured = async () => {
    const next = !(data?.restaurant?.is_featured === true);
    try {
      await apiClient.setRestaurantFeatured(id, next);
      toast(next ? "Store is now Featured" : "Store removed from Featured", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update featured", "error");
    }
  };

  // A PHARMACY'S LICENCE (Mock 208-4). The header chip reads the state the
  // detail call already sends; the Settings card asks for the full licence
  // (with its 10-minute photo link) only when Settings is open.
  const [licence, setLicence] = useState<ShopLicence | null | undefined>(undefined);   // undefined = reading
  const [licenceRead, setLicenceRead] = useState(0);
  const isPharmacyPage = !!data?.state?.licence?.needs_licence;
  useEffect(() => {
    if (!isPharmacyPage || tab !== "settings") return;
    let alive = true;
    apiClient.getShopLicence(id)
      .then((l) => { if (alive) setLicence(l); })
      .catch(() => { if (alive) setLicence(null); });
    return () => { alive = false; };
  }, [isPharmacyPage, tab, id, licenceRead]);
  const [mayApproveShops, setMayApproveShops] = useState(false);
  useEffect(() => setMayApproveShops(mayAccess("stores.approve", getMyPerms())), []);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;

  const r = data?.restaurant || {};
  const owner = data?.owner || {};
  const stats = data?.stats || {};
  const orders = data?.recent_orders || [];
  const hours = hoursInWords(r.opening_time, r.closing_time);
  const fixedStore = r.price_mode === "fixed";
  // Stores page fix 3 (12 Oct 2026): the server's own view of this shop.
  const state = data?.state || {};
  const status = storeStatusOf(r, state.status);
  /** What Takal really charges: "8% (own rate)" or "Global rate (10%)" -
   *  never "0%" for a shop that simply uses the global rate. */
  const commissionWords = fixedStore ? "None - fixed-price store"
    : r.commission_percent != null ? `${r.commission_percent}% (this shop's own rate)`
    : state.commission_in_use_percent != null ? `Global rate (${state.commission_in_use_percent}%)`
    : "Global rate";

  // Mock 188 (14 Oct 2026): small numbers beside the buttons, not big boxes.
  const Stat = ({ label, value, warn = false }: { label: string; value: any; warn?: boolean }) => (
    <div className={`rounded-lg border px-2.5 py-1 text-center leading-tight ${warn ? "bg-takal-orange-soft border-[#FFC7B0]" : "bg-white border-takal-line"}`}>
      <p className="text-[10.5px] text-takal-ink-soft whitespace-nowrap">{label}</p>
      <p className={`text-[15px] font-bold ${warn ? "text-[#C8410F]" : "text-takal-ink"}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* ── ONE LINE (MOCK 203 v2, approved by Sana 20 Oct 2026) ──────────
          ‹ back · logo · name · every chip · the tabs · Suspend/Approve · ⋯
          It was three rows (the "All stores / name" line, the store card,
          the tab strip). Nothing is gone: the address, hours, owner and his
          phone are on the name (hover) and in ⋯ with every figure and
          "Mark as Featured". */}
      <div data-store-line className="relative flex flex-wrap items-center gap-x-1.5 gap-y-1.5 overflow-visible rounded-xl border border-takal-line bg-white py-1.5 pl-3 pr-2">
        <span className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-takal-yellow" aria-hidden="true" />
        {/* Back to the SAME list, order and search you came from (fix 7). */}
        <button onClick={() => leaveIfSaved(() => { setDirtyParts({}); router.push(allStoresHref()); })}
          title="All stores" aria-label="All stores"
          className="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-takal-ink-soft hover:bg-takal-page hover:text-takal-ink">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-takal-orange to-takal-red flex items-center justify-center text-lg overflow-hidden shrink-0">
          {(r.image_url || mall?.image_url)
            // No logo of its own: the mall's, as the customers see it.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.image_url || mall?.image_url} alt="" title={r.image_url ? "" : "The mall's logo"} className="w-full h-full object-cover" />
            : <span>{verticalEmoji(r.vendor_type)}</span>}
        </div>
        <h2 className="text-[15px] font-extrabold leading-tight text-takal-ink truncate max-w-[190px] min-[1800px]:max-w-[320px]"
          title={[r.name, r.address, r.phone, hours, owner.full_name ? `Owner ${owner.full_name}` : "", owner.phone].filter(Boolean).join(" · ")}>
          {loading && !data ? "Loading…" : r.name || "Store"}
        </h2>
        {data && (<>
          {/* THE TRUE STATUS (fix 3): Live, Waiting, Suspended since, or
              Rejected with its reason - not "Approved" for all. */}
          <StoreStatusChip r={r} status={status} />
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${r.is_open ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}
            title={r.is_open && state.open_now === false ? "Switched on - but closed by its opening hours right now" : hours || undefined}>
            <span className={`w-1.5 h-1.5 rounded-full ${r.is_open ? "bg-takal-green" : "bg-takal-disabled-text"}`} />
            {r.is_open ? (state.open_now === false ? "On · closed by hours" : "Open") : "Closed"}
          </span>
          {state.hidden_no_location && (
            <button onClick={() => openTab("location")}
              className="rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-bold text-takal-red ring-1 ring-red-200 hover:bg-red-100"
              title="Customers cannot see this shop until it is placed on the map. Click to open Location.">
              ⚠ No map pin — hidden from customers
            </button>
          )}
          <span className="rounded-full bg-takal-purple-soft px-2 py-0.5 text-[11.5px] font-semibold text-takal-purple">
            {verticalLabel(r.vendor_type)}
          </span>
          <LicenceChip licence={state.licence || null} onOpen={() => openTab("settings")} />
          {/* How Takal earns from this store (Mock 171-1 / 171-3). */}
          {fixedStore ? (
            <span className="rounded-full bg-black px-2 py-0.5 text-[11.5px] font-bold text-takal-yellow"
              title="Fixed-price store - Takal earns selling minus buying; no commission, no markup">🔒 Fixed-price · no commission</span>
          ) : (
            <span className="rounded-full bg-takal-blue-soft px-2 py-0.5 text-[11.5px] font-semibold text-takal-blue"
              title={[`Standard store - Commission: ${commissionWords}`,
                r.menu_markup_percent != null ? `Markup ${r.menu_markup_percent}%` : ""].filter(Boolean).join(" · ")}>
              Standard · {fixedStore ? "" : r.commission_percent != null ? `${r.commission_percent}%` : state.commission_in_use_percent != null ? `${state.commission_in_use_percent}%` : "global rate"}
            </span>
          )}
          {mall && (
            <Link href={`/dashboard/stores/malls/${mall.id}`}
              className="max-w-[130px] truncate rounded-full bg-[#111111] px-2 py-0.5 text-[11.5px] font-bold text-takal-yellow hover:underline"
              title={`Part of ${mall.name}`}>
              🛍️ {mall.name} ›
            </Link>
          )}
        </>)}

        {/* ── The tabs, on the same line ── */}
        <div className="flex flex-wrap items-center gap-0 border-l border-takal-line pl-1.5" role="tablist">
          {tabs.map(({ id: t, label, Icon }) => {
            const on = tab === t;
            return (
              <button key={t} role="tab" aria-selected={on} onClick={() => openTab(t)}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1 text-[12.5px] font-semibold transition ${
                  on ? "bg-black text-takal-yellow" : "text-takal-ink-soft hover:bg-takal-page hover:text-takal-ink"}`}>
                <Icon className="hidden w-3.5 h-3.5 min-[1700px]:inline" />
                {label === "Store settings" ? "Settings" : label === "Staff logins" ? "Staff" : label}
                {/* MOCK 203 v2: the product count lives on the tab again - the
                    big "Products" figure and the "All" button are gone. */}
                {t === "products" && counts?.all != null && (
                  <span className={`rounded-full px-1.5 text-[10.5px] leading-[18px] ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                    {counts.all.toLocaleString()}
                  </span>
                )}
                {t === "staff" && (
                  <>
                    {staff.length > 0 && (
                      <span className={`rounded-full px-1.5 text-[10.5px] leading-[18px] ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                        {staff.length}
                      </span>
                    )}
                    <span className="hidden rounded-full bg-[#111111] px-1.5 text-[10px] font-extrabold leading-[18px] text-takal-yellow min-[1800px]:inline"
                      title="Staff logins - Main Admin only">
                      🛡️ Main Admin only
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* APPROVE / REJECT / SUSPEND HERE TOO (fix 3) - the same buttons
              and the same boxes that ask first as on the list. */}
          {/* CALL / WHATSAPP THE OWNER, in the header (audit 23 October
              2026) - the number used to be only inside the ⋯ box. */}
          {data && (owner.phone || r.phone) && (
            <>
              <a href={`tel:${owner.phone || r.phone}`} title={`Call ${owner.full_name || "the owner"} - ${owner.phone || r.phone}`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-takal-line bg-white px-2 text-[13px] font-bold hover:bg-takal-page">
                📞 Call
              </a>
              {waNumber(owner.phone || r.phone) && (
                <a href={`https://wa.me/${waNumber(owner.phone || r.phone)}`} target="_blank" rel="noopener noreferrer"
                  title={`WhatsApp ${owner.full_name || "the owner"}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#25D366] bg-white px-2 text-[13px] font-bold text-[#128C7E] hover:bg-[#E9FBEF]">
                  WhatsApp
                </a>
              )}
            </>
          )}
          {data && (
            <StoreStatusActions r={r} status={status}
              productCount={counts?.all ?? null} onChanged={load} />
          )}
          <div className="relative">
            <button onClick={() => setMoreOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={moreOpen}
              title="The address, owner, figures and Featured"
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-bold ${moreOpen ? "border-takal-ink bg-takal-yellow" : "border-takal-line bg-white hover:bg-takal-page"}`}>
              {r.is_featured ? "★ ⋯" : "⋯"}
            </button>
            {moreOpen && (
              <div data-store-more onMouseLeave={() => setMoreOpen(false)}
                className="absolute right-0 top-full z-40 mt-1 w-[320px] rounded-xl border border-takal-line bg-white p-3 text-[12.5px] text-takal-ink shadow-xl">
                <p className="text-takal-ink-soft">{[r.address, r.phone, hours].filter(Boolean).join(" · ") || "—"}</p>
                {/* THE OWNER (fix 3). A tap on the phone calls him. */}
                {data && (owner.full_name || owner.phone) && (
                  <p className="mt-1">
                    {" · "}Owner <b className="text-takal-ink">{owner.full_name || "—"}</b>
                    {owner.phone && (<> · <a href={`tel:${owner.phone}`} className="text-takal-ink hover:underline">📞 {owner.phone}</a></>)}
                    {owner.is_active === false && (
                      <span className="ml-1 font-semibold text-takal-red"> · his login is switched off</span>
                    )}
                  </p>
                )}
                <p className="mt-1 text-takal-ink-soft">Commission: <b className="text-takal-ink">{commissionWords}</b>
                  {!fixedStore && r.menu_markup_percent != null ? <> · Markup <b className="text-takal-ink">{r.menu_markup_percent}%</b></> : null}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Stat label="Products" value={counts?.all != null ? counts.all.toLocaleString() : "–"} />
                  {fixedStore ? (
                    <>
                      <Stat label="Buying price missing" value={priceSummary ? priceSummary.missing.toLocaleString() : "–"}
                        warn={(priceSummary?.missing ?? 0) > 0} />
                      <Stat label="Sold at a loss" value={priceSummary ? priceSummary.loss.toLocaleString() : "–"}
                        warn={(priceSummary?.loss ?? 0) > 0} />
                      <div className="rounded-lg border border-[#BFE3CF] bg-takal-green-soft px-2.5 py-1 text-center leading-tight">
                        <p className="text-[10.5px] text-takal-ink-soft whitespace-nowrap">Takal earns (avg)</p>
                        <p className="text-[15px] font-bold text-takal-green">
                          {priceSummary?.avgPercent != null ? `${priceSummary.avgPercent}%` : "–"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <Stat label="Need a picture" value={counts?.no_picture != null ? counts.no_picture.toLocaleString() : "–"}
                      warn={(counts?.no_picture ?? 0) > 0} />
                  )}
                  <Stat label="Outstanding" value={!data ? "–" : data.incomplete ? "not known" : owedOrOverpaid(stats.outstanding, stats.overpaid)} />
                  {isMain && staff.length > 0 && <Stat label="Staff logins" value={`${staffOn} on`} />}
                </div>
                <button onClick={() => { setMoreOpen(false); if (r.is_featured) toggleFeatured(); else setAskFeature(true); }} disabled={!data}
                  title="Featured stores appear in the app's Featured row and get the Top-Rated badge"
                  className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition ${
                    r.is_featured ? "bg-takal-yellow border-[#DADA00] text-black" : "bg-white border-takal-line text-takal-ink hover:bg-takal-page"}`}>
                  {r.is_featured ? "★ Featured - click to take it off" : "☆ Mark as Featured"}
                </button>
              </div>
            )}
          </div>
          <ConfirmDialog
            open={askFeature}
            danger={false}
            onCancel={() => setAskFeature(false)}
            onConfirm={async () => { setAskFeature(false); await toggleFeatured(); }}
            title={`Feature ${r.name || "this store"}?`}
            confirmLabel="Yes, feature it"
            message={<>It goes to the top for <strong>all customers</strong>: the app&apos;s Featured row and the Top-Rated badge. You can take it off again with one click.</>}
          />
        </div>
      </div>

      <div>
        <div className="rounded-xl border border-takal-line bg-white p-2.5">
          {/* Kept alive when hidden: the search and the page survive a tab switch. */}
          <div hidden={tab !== "products"}>
            <ProductsTab restaurantId={id} vendorType={r.vendor_type || "restaurant"} onCounts={setCounts}
              buyingFirst={buyingFirst && !fixedStore} onPriceSummary={setPriceSummary}
              commissionPercent={fixedStore ? null : r.commission_percent ?? state.commission_in_use_percent ?? null} />
          </div>

          {tab === "orders" && (
            <div className="space-y-4">
              <StoreOrdersCard restaurantId={id} />
              <div className="rounded-xl border border-takal-line overflow-hidden">
                <div className="px-5 py-3 border-b border-takal-line"><h3 className="font-semibold text-takal-ink">Recent orders</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-takal-line bg-takal-page">
                        <th className="px-5 py-2.5 text-left text-sm font-semibold text-takal-ink">Order</th>
                        <th className="px-5 py-2.5 text-left text-sm font-semibold text-takal-ink">Status</th>
                        <th className="px-5 py-2.5 text-left text-sm font-semibold text-takal-ink">Amount</th>
                        <th className="px-5 py-2.5 text-left text-sm font-semibold text-takal-ink">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {error && !data ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-takal-ink-soft">The orders could not be read.</td></tr>
                      ) : orders.length === 0 ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-takal-ink-soft">No orders</td></tr>
                      ) : orders.map((o: any) => (
                        // Fix 12: the number people say (#10001), and the row
                        // opens that order on the Orders page.
                        <tr key={o.id} onClick={() => router.push(`/dashboard/orders?order=${encodeURIComponent(o.id)}`)}
                          className="cursor-pointer border-b border-takal-line hover:bg-takal-page" title="Open this order">
                          <td className="px-5 py-2.5 text-sm font-medium text-takal-ink">{orderLabel(o)}</td>
                          <td className="px-5 py-2.5 text-sm text-takal-ink-soft">{o.status}</td>
                          <td className="px-5 py-2.5 text-sm text-takal-ink-soft">{money(o.total_amount)}</td>
                          <td className="px-5 py-2.5 text-sm text-takal-ink-soft">{fmtDate(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "settings" && data && (
            <div className="space-y-4">
              <StoreSettingsCard store={r} onSaved={load} onDirty={settingsDirty}
                nameSetBy={mall?.store_names?.follow ? mall.name : null}
                onLogo={(url) => setData((d: any) => (d ? { ...d, restaurant: { ...d.restaurant, image_url: url } } : d))} />
              {isPharmacyPage && (
                <LicenceCard key={`${licence?.number}-${licence?.valid_until}-${licence?.ok_at}-${licence?.has_photo}`}
                  restaurantId={id} licence={licence} mayApprove={mayApproveShops}
                  onSaved={() => { setLicenceRead((n) => n + 1); load(); }} />
              )}
              <PriceModeCard store={r}
                onSaved={() => { setBuyingFirst(false); load(); }}
                onFillBuyingFirst={() => { setBuyingFirst(true); openTab("products"); }} />
              <div className="rounded-xl border border-takal-line p-5">
                <h3 className="font-semibold text-takal-ink mb-3">Profile</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
                  {[
                    ["Owner", owner.full_name], ["Owner phone", owner.phone], ["Owner email", owner.email],
                    ["Commission", commissionWords],
                    // Fix 11 (audit O3): shown here, changed only on the list
                    // (Sana's D3). A SETTING, so moneyExact - Rs 12.5 is not 13.
                    ["Delivery fee", r.admin_delivery_fee == null ? "Standard rule" : `Fixed · ${moneyExact(r.admin_delivery_fee)}`],
                    ["Store phone", r.phone],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between border-b border-[#F3F3F3] py-1">
                      <dt className="text-takal-ink-soft">{k}</dt><dd className="font-medium">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {tab === "location" && data && <ShopLocationCard store={r} onSaved={load} onDirty={locationDirty} />}

          <ConfirmDialog
            open={leaving !== null}
            onCancel={() => setLeaving(null)}
            onConfirm={() => { const go = leaving; setLeaving(null); go?.(); }}
            title="Leave without saving?"
            confirmLabel="Leave"
            cancelLabel="Stay"
            message={<>You have changes on this page that are <strong>not saved</strong>. If you leave now they are lost. Press <strong>Stay</strong>, then Save.</>}
          />

          {tab === "staff" && isMain && (
            <MallStaffTab restaurantId={id} shopName={r.name || "this shop"} staff={staff}
              loading={staffLoading} error={staffError} reload={loadStaff}
              mall={mall ? { id: mall.id, name: mall.name, storeCount: mall.store_count } : null} />
          )}

          {tab === "money" && data && (
            <div className="space-y-4">
              {/* A failed read is said, never shown as "Paid Rs 0" (money
                  audit B4, 13 Oct 2026). */}
              {data.incomplete && (
                <div className="rounded-lg border border-takal-red bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
                  <p className="font-bold">⚠️ These figures could not all be checked - do not pay from this page.</p>
                  <ul className="list-disc ml-5 mt-1">
                    {(data.incomplete_parts ?? []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Delivered orders", stats.total_delivered ?? 0],
                  ["Earned", data.incomplete ? "not known" : money(stats.earned)],
                  ["Paid", data.incomplete ? "not known" : money(stats.paid)],
                  ["Outstanding", data.incomplete ? "not known" : owedOrOverpaid(stats.outstanding, stats.overpaid)],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl border border-takal-line p-4">
                    <p className="text-xs text-takal-ink-soft">{k}</p>
                    <p className="text-xl font-bold text-takal-ink mt-1">{v}</p>
                  </div>
                ))}
              </div>
              {/* Where Takal sends the money (Mock 111). It draws nothing for an
                  admin who may not see it. */}
              <PayoutDetailsCard restaurantId={id} shopName={r.name} />
            </div>
          )}

          {tab !== "products" && !data && (
            error ? <ErrorState message={error} onRetry={load} />
              : <div className="py-8 text-center text-sm text-takal-ink-soft">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
