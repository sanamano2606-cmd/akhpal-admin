"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Check, X, Plus, Pencil, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money, fmtDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import ProductEditorModal from "./ProductEditorModal";

// This page was 1,013 lines. It was split on 2026-08-30 into the cards below;
// the page keeps its address and its default export, so no link changed.
import { LocationCard } from "./parts-map";
import { StoreSettingsCard } from "./parts-settings";
import { StoreOrdersCard } from "./parts-orders";
import { ErrorState } from "@/components/ui";

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState("");
  const [editStockId, setEditStockId] = useState<string | null>(null);
  const [stockVal, setStockVal] = useState("");
  const [editor, setEditor] = useState<{ open: boolean; product: any | null }>({ open: false, product: null });

  const deleteProduct = async (m: any) => {
    if (!window.confirm(
      `Remove "${m.name}"?\n\n` +
      `If it has never been ordered it is deleted. If customers have ordered ` +
      `it, it is switched off instead — it disappears from the app but stays ` +
      `on their past receipts.`
    )) return;
    try {
      // Report what the server ACTUALLY did. This used to always say "deleted",
      // even when the database had refused, so the product came back on the
      // next refresh and looked like a bug in the panel.
      const res = (await apiClient.deleteProduct(String(m.id))) as any;
      toast(res?.message || "Product removed", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove", "error");
    }
  };

  const saveStock = async (m: any) => {
    const s = parseInt(stockVal);
    if (isNaN(s) || s < 0) {
      toast("Enter a valid stock number", "error");
      return;
    }
    try {
      await apiClient.updateMenuItem(String(m.id), { stock: s });
      setEditStockId(null);
      toast("Stock updated", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update stock", "error");
    }
  };

  const toggleItem = async (m: any) => {
    try {
      await apiClient.toggleMenuItem(String(m.id));
      toast(m.is_available === false ? "Item turned ON" : "Item turned OFF", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle item", "error");
    }
  };

  const savePrice = async (m: any) => {
    const p = parseFloat(priceVal);
    if (isNaN(p) || p < 0) {
      toast("Enter a valid price", "error");
      return;
    }
    try {
      await apiClient.updateMenuItem(String(m.id), { price: p });
      setEditPriceId(null);
      toast("Price updated", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update price", "error");
    }
  };

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

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const d = (await apiClient.getRestaurantDetail(id)) as any;
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurant");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-takal-ink-soft">Loading...</div>;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <div className="text-takal-ink-soft">Not found</div>;

  const r = data.restaurant || {};
  const owner = data.owner || {};
  const stats = data.stats || {};
  const orders = data.recent_orders || [];
  const menu = data.menu || [];

  const Stat = ({ label, value }: any) => (
    <div className="bg-white rounded-lg border border-takal-line p-4">
      <p className="text-xs text-takal-ink-soft">{label}</p>
      <p className="text-xl font-bold text-takal-ink mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/stores")} className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
        <ChevronLeft className="w-4 h-4" /> Back to Restaurants
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-takal-ink">{r.name || "Store"}</h2>
          <p className="text-takal-ink-soft mt-1">{r.address || "—"}</p>
        </div>
        <button
          onClick={toggleFeatured}
          className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
            r.is_featured
              ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
              : "bg-white border-takal-line text-takal-ink-soft hover:bg-takal-page"
          }`}
          title="Featured stores appear in the app's Featured row and get the Top-Rated badge"
        >
          {r.is_featured ? "★ Featured" : "☆ Mark as Featured"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Delivered Orders" value={stats.total_delivered ?? 0} />
        <Stat label="Earned" value={money(stats.earned)} />
        <Stat label="Paid" value={money(stats.paid)} />
        <Stat label="Outstanding" value={money(stats.outstanding)} />
      </div>

      <StoreSettingsCard store={r} onSaved={load} />

      <LocationCard store={r} onSaved={load} />

      <StoreOrdersCard restaurantId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-takal-line p-6">
          <h3 className="font-semibold text-takal-ink mb-3">Profile</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Owner</dt><dd className="font-medium">{owner.full_name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Owner phone</dt><dd className="font-medium">{owner.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Owner email</dt><dd className="font-medium">{owner.email || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Commission</dt><dd className="font-medium">{r.commission_percent ?? 0}%</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Phone</dt><dd className="font-medium">{r.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Approved</dt><dd className="font-medium">{r.is_approved ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt className="text-takal-ink-soft">Open now</dt><dd className="font-medium">{r.is_open ? "Yes" : "No"}</dd></div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-takal-line p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-takal-ink">Products ({menu.length})</h3>
            <button onClick={() => setEditor({ open: true, product: null })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {menu.length === 0 ? (
              <p className="text-sm text-takal-ink-soft">No menu items</p>
            ) : (
              menu.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm border-b border-takal-line py-2">
                  <span className={`flex-1 ${m.is_available === false ? "text-takal-disabled-text line-through" : ""}`}>{m.name}</span>
                  {editStockId === String(m.id) ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min={0} value={stockVal} onChange={(e) => setStockVal(e.target.value)} className="w-14 px-2 py-1 border border-takal-line rounded" />
                      <button onClick={() => saveStock(m)} className="text-green-600 hover:text-green-700" title="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditStockId(null)} className="text-takal-ink-soft hover:text-takal-ink" title="Cancel"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEditStockId(String(m.id)); setStockVal(String(m.stock ?? "")); }}
                      className={`text-xs px-2 py-1 rounded ${m.stock === 0 ? "bg-red-50 text-red-700" : "bg-takal-page text-takal-ink-soft"}`}
                      title="Edit stock"
                    >
                      {m.stock == null ? "Stock: ∞" : m.stock === 0 ? "Out of stock" : `Stock: ${m.stock}`}
                    </button>
                  )}
                  {editPriceId === String(m.id) ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min={0} value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className="w-20 px-2 py-1 border border-takal-line rounded" />
                      <button onClick={() => savePrice(m)} className="text-green-600 hover:text-green-700" title="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditPriceId(null)} className="text-takal-ink-soft hover:text-takal-ink" title="Cancel"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <button onClick={() => { setEditPriceId(String(m.id)); setPriceVal(String(m.price ?? 0)); }} className="text-takal-ink hover:underline" title="Edit price">
                      {money(m.price)}
                    </button>
                  )}
                  <button onClick={() => toggleItem(m)} className={`text-xs px-2 py-1 rounded font-medium ${m.is_available === false ? "bg-slate-100 text-takal-ink-soft" : "bg-green-50 text-green-700"}`}>
                    {m.is_available === false ? "Off" : "On"}
                  </button>
                  <button onClick={() => setEditor({ open: true, product: m })} className="text-takal-ink-soft hover:text-takal-ink" title="Edit product"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteProduct(m)} className="text-takal-disabled-text hover:text-red-600" title="Delete product"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="px-6 py-4 border-b border-takal-line"><h3 className="font-semibold text-takal-ink">Recent Orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-takal-ink">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-takal-ink-soft">No orders</td></tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-takal-line">
                    <td className="px-6 py-3 text-sm font-medium text-takal-ink">#{o.id}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{money(o.total_amount)}</td>
                    <td className="px-6 py-3 text-sm text-takal-ink-soft">{fmtDate(o.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editor.open && (
        <ProductEditorModal
          restaurantId={id}
          vendorType={r.vendor_type || "restaurant"}
          product={editor.product}
          onClose={() => setEditor({ open: false, product: null })}
          onSaved={() => { setEditor({ open: false, product: null }); load(); }}
        />
      )}
    </div>
  );
}




/** Load Leaflet from our own bundle, once, shared across mounts.
 *
 *  This used to pull leaflet.js from unpkg, and the map never appeared: the
 *  admin sends `script-src 'self'`, so the browser blocked the third-party
 *  script — exactly as intended, since that policy is what stops an injected
 *  script from reading the admin's bearer token. Bundling it makes the map
 *  same-origin, so the CSP stays strict and the map still works.
 *
 *  Imported dynamically rather than at the top of the file so the map code is
 *  only downloaded when someone actually opens a store page, and never runs
 *  during server-side rendering (Leaflet needs `window`).
 */







