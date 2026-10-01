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

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Package, Receipt, Settings, MapPin, Wallet, Users } from "lucide-react";
import { PayoutDetailsCard } from "@/components/PayoutDetailsCard";
import { apiClient } from "@/lib/api-client";
import type { ShopProductsPage } from "@/lib/api-stores";
import { money, fmtDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";
import { ErrorState } from "@/components/ui";
import { ShopLocationCard } from "../parts-shop-location";
import { StoreSettingsCard } from "./parts-settings";
import { StoreOrdersCard } from "./parts-orders";
import { ProductsTab } from "./parts-products";
import { hoursInWords } from "@/lib/shop-hours";
import { getMyPerms } from "@/lib/perms";
import type { ShopStaffMember } from "@/lib/api-people";
import { MallStaffTab } from "./parts-staff";

type TabId = "products" | "orders" | "settings" | "location" | "money" | "staff";
const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: "products", label: "Products", Icon: Package },
  { id: "orders", label: "Orders", Icon: Receipt },
  { id: "settings", label: "Store settings", Icon: Settings },
  { id: "location", label: "Location", Icon: MapPin },
  { id: "money", label: "Money", Icon: Wallet },
  // Mock 133: a Mall's own staff logins. Drawn for the MAIN ADMIN only (see
  // `tabs` below); the server refuses everybody else on every staff door.
  { id: "staff", label: "Mall staff", Icon: Users },
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

  const openTab = (t: TabId) => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      if (t === "products") u.searchParams.delete("tab");
      else u.searchParams.set("tab", t);
      window.history.replaceState(null, "", u.toString());
    } catch { /* the tab still changes; only the address does not */ }
  };

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

  if (error && !data) return <ErrorState message={error} onRetry={load} />;

  const r = data?.restaurant || {};
  const owner = data?.owner || {};
  const stats = data?.stats || {};
  const orders = data?.recent_orders || [];
  const hours = hoursInWords(r.opening_time, r.closing_time);

  const Stat = ({ label, value, warn = false }: { label: string; value: any; warn?: boolean }) => (
    <div className={`min-w-[112px] rounded-xl border px-3.5 py-2 ${warn ? "bg-takal-orange-soft border-[#FFC7B0]" : "bg-white border-takal-line"}`}>
      <p className="text-[11px] text-takal-ink-soft">{label}</p>
      <p className={`text-lg font-bold leading-tight ${warn ? "text-[#C8410F]" : "text-takal-ink"}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <button onClick={() => router.push("/dashboard/stores")}
        className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
        <ChevronLeft className="w-4 h-4" /> All stores
      </button>

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-takal-line bg-white px-5 py-4 flex flex-wrap items-center gap-4">
        <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-takal-yellow" aria-hidden="true" />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-takal-orange to-takal-red flex items-center justify-center text-3xl overflow-hidden shrink-0">
          {r.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.image_url} alt="" className="w-full h-full object-cover" />
            : <span>{verticalEmoji(r.vendor_type)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold text-takal-ink truncate">{loading && !data ? "Loading…" : r.name || "Store"}</h2>
          <p className="text-[13px] text-takal-ink-soft mt-0.5">
            {[r.address, r.phone, hours].filter(Boolean).join(" · ") || "—"}
          </p>
          {data && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_open ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}>
                <span className={`w-2 h-2 rounded-full ${r.is_open ? "bg-takal-green" : "bg-takal-disabled-text"}`} />
                {r.is_open ? "Open for orders" : "Closed"}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_approved ? "bg-takal-blue-soft text-takal-blue" : "bg-takal-orange-soft text-[#C8410F]"}`}>
                {r.is_approved ? "Approved" : "Waiting for approval"}
              </span>
              <span className="rounded-full bg-takal-purple-soft px-2.5 py-0.5 text-xs font-semibold text-takal-purple">
                {verticalLabel(r.vendor_type)}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Stat label="Products" value={counts?.all != null ? counts.all.toLocaleString() : "–"} />
          <Stat label="Need a picture" value={counts?.no_picture != null ? counts.no_picture.toLocaleString() : "–"}
            warn={(counts?.no_picture ?? 0) > 0} />
          <div className="hidden 2xl:block"><Stat label="Outstanding" value={data ? money(stats.outstanding) : "–"} /></div>
          {isMain && staff.length > 0 && (
            <div className="hidden xl:block"><Stat label="Staff logins" value={`${staffOn} on`} /></div>
          )}
          <button onClick={toggleFeatured} disabled={!data}
            title="Featured stores appear in the app's Featured row and get the Top-Rated badge"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              r.is_featured ? "bg-takal-yellow border-[#DADA00] text-black" : "bg-white border-takal-line text-takal-ink hover:bg-takal-page"}`}>
            {r.is_featured ? "★ Featured" : "☆ Mark as Featured"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 overflow-x-auto border-b-2 border-takal-line" role="tablist">
          {tabs.map(({ id: t, label, Icon }) => {
            const on = tab === t;
            return (
              <button key={t} role="tab" aria-selected={on} onClick={() => openTab(t)}
                className={[
                  "flex items-center gap-2 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold transition",
                  on
                    ? "-mb-[2px] border-2 border-b-white border-takal-line bg-white text-takal-ink shadow-[inset_0_4px_0_#FFFF00]"
                    : "text-takal-ink-soft hover:text-takal-ink",
                ].join(" ")}>
                <Icon className="w-4 h-4" />
                {label}
                {t === "staff" && (
                  <>
                    <span className={`rounded-full px-2 text-[11px] leading-5 ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                      {staff.length}
                    </span>
                    <span className="hidden rounded-full bg-[#111111] px-2 text-[10.5px] font-extrabold leading-5 text-takal-yellow lg:inline">
                      🛡️ Main Admin only
                    </span>
                  </>
                )}
                {t === "products" && counts?.all != null && (
                  <span className={`rounded-full px-2 text-[11px] leading-5 ${on ? "bg-takal-yellow text-black" : "bg-[#EEEEEE] text-takal-ink"}`}>
                    {counts.all.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-b-2xl border-2 border-t-0 border-takal-line bg-white p-4">
          {/* Kept alive when hidden: the search and the page survive a tab switch. */}
          <div hidden={tab !== "products"}>
            <ProductsTab restaurantId={id} vendorType={r.vendor_type || "restaurant"} onCounts={setCounts} />
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
                        <tr key={o.id} className="border-b border-takal-line">
                          <td className="px-5 py-2.5 text-sm font-medium text-takal-ink">#{o.id}</td>
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
              <StoreSettingsCard store={r} onSaved={load} />
              <div className="rounded-xl border border-takal-line p-5">
                <h3 className="font-semibold text-takal-ink mb-3">Profile</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
                  {[
                    ["Owner", owner.full_name], ["Owner phone", owner.phone], ["Owner email", owner.email],
                    ["Commission", `${r.commission_percent ?? 0}%`], ["Store phone", r.phone],
                    ["Approved", r.is_approved ? "Yes" : "No"], ["Open now", r.is_open ? "Yes" : "No"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between border-b border-[#F3F3F3] py-1">
                      <dt className="text-takal-ink-soft">{k}</dt><dd className="font-medium">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {tab === "location" && data && <ShopLocationCard store={r} onSaved={load} />}

          {tab === "staff" && isMain && (
            <MallStaffTab restaurantId={id} shopName={r.name || "this shop"} staff={staff}
              loading={staffLoading} error={staffError} reload={loadStaff} />
          )}

          {tab === "money" && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Delivered orders", stats.total_delivered ?? 0],
                  ["Earned", money(stats.earned)],
                  ["Paid", money(stats.paid)],
                  ["Outstanding", money(stats.outstanding)],
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
