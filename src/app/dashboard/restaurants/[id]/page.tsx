"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Check, X, Plus, Pencil, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import ProductEditorModal from "./ProductEditorModal";

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
    if (!window.confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.deleteProduct(String(m.id));
      toast("Product deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
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

  if (loading) return <div className="text-slate-600">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>;
  if (!data) return <div className="text-slate-600">Not found</div>;

  const r = data.restaurant || {};
  const owner = data.owner || {};
  const stats = data.stats || {};
  const orders = data.recent_orders || [];
  const menu = data.menu || [];

  const Stat = ({ label, value }: any) => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/restaurants")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Back to Restaurants
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{r.name || "Restaurant"}</h1>
          <p className="text-slate-600 mt-1">{r.address || "—"}</p>
        </div>
        <button
          onClick={toggleFeatured}
          className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
            r.is_featured
              ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
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

      <LocationCard store={r} onSaved={load} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Profile</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Owner</dt><dd className="font-medium">{owner.full_name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Owner phone</dt><dd className="font-medium">{owner.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Owner email</dt><dd className="font-medium">{owner.email || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Commission</dt><dd className="font-medium">{r.commission_percent ?? 0}%</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium">{r.phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Approved</dt><dd className="font-medium">{r.is_approved ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Open now</dt><dd className="font-medium">{r.is_open ? "Yes" : "No"}</dd></div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Products ({menu.length})</h3>
            <button onClick={() => setEditor({ open: true, product: null })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {menu.length === 0 ? (
              <p className="text-sm text-slate-500">No menu items</p>
            ) : (
              menu.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 py-2">
                  <span className={`flex-1 ${m.is_available === false ? "text-slate-400 line-through" : ""}`}>{m.name}</span>
                  {editStockId === String(m.id) ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min={0} value={stockVal} onChange={(e) => setStockVal(e.target.value)} className="w-14 px-2 py-1 border border-slate-300 rounded" />
                      <button onClick={() => saveStock(m)} className="text-green-600 hover:text-green-700" title="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditStockId(null)} className="text-slate-500 hover:text-slate-700" title="Cancel"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEditStockId(String(m.id)); setStockVal(String(m.stock ?? "")); }}
                      className={`text-xs px-2 py-1 rounded ${m.stock === 0 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}
                      title="Edit stock"
                    >
                      {m.stock == null ? "Stock: ∞" : m.stock === 0 ? "Out of stock" : `Stock: ${m.stock}`}
                    </button>
                  )}
                  {editPriceId === String(m.id) ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min={0} value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                      <button onClick={() => savePrice(m)} className="text-green-600 hover:text-green-700" title="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditPriceId(null)} className="text-slate-500 hover:text-slate-700" title="Cancel"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <button onClick={() => { setEditPriceId(String(m.id)); setPriceVal(String(m.price ?? 0)); }} className="text-slate-700 hover:underline" title="Edit price">
                      {money(m.price)}
                    </button>
                  )}
                  <button onClick={() => toggleItem(m)} className={`text-xs px-2 py-1 rounded font-medium ${m.is_available === false ? "bg-slate-100 text-slate-600" : "bg-green-50 text-green-700"}`}>
                    {m.is_available === false ? "Off" : "On"}
                  </button>
                  <button onClick={() => setEditor({ open: true, product: m })} className="text-slate-500 hover:text-slate-700" title="Edit product"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteProduct(m)} className="text-slate-400 hover:text-red-600" title="Delete product"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200"><h3 className="font-semibold text-slate-900">Recent Orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Order</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-600">No orders</td></tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-200">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">#{o.id}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{o.status}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{money(o.total_amount)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
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


// ─────────────────────────────────────────────────────────────────────────────
// Store location — click the map to drop the pin.
//
// There was no way to set a store's coordinates anywhere in the admin panel,
// yet an EXPRESS store without them is HIDDEN from customers: we cannot route
// a rider to it or price the delivery. So a store could vanish from the app
// with nothing here explaining why or letting you fix it.
//
// Uses Leaflet + OpenStreetMap — the same free map the phone apps use (they use
// flutter_map, which is Leaflet's Flutter equivalent, on the same OSM tiles).
// Loaded from a CDN at runtime rather than added to package.json, so there is
// no install step and nothing to rebuild locally.
// ─────────────────────────────────────────────────────────────────────────────

// Keep in step with core.INSTANT_VENDOR_TYPES on the backend.
const EXPRESS_TYPES = ["restaurant", "grocery", "pharmacy", "bakery"];

// Mingora, Swat — where the map opens when a store has no pin yet.
const DEFAULT_CENTRE: [number, number] = [34.7795, 72.3600];

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
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!leafletPromise) {
    leafletPromise = import("leaflet").then((m: any) => m.default ?? m);
  }
  return leafletPromise;
}

/** A marker drawn in plain HTML/CSS.
 *
 *  Leaflet's stock marker is a PNG that it resolves to a URL relative to the
 *  stylesheet; through a bundler those paths break and you get an invisible
 *  or broken-image pin. Drawing it ourselves sidesteps that entirely and
 *  needs no image files at all. */
function pinIcon(L: any) {
  return L.divIcon({
    className: "",
    html:
      '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;' +
      "background:#DC2626;border:3px solid #fff;transform:rotate(-45deg);" +
      'box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

/** Pull "lat, lon" out of a pasted Google Maps URL or a plain coordinate pair.
 *
 *  NOT exported. A Next.js page file may only export the default component and
 *  a fixed set of framework fields; any other named export fails the build with
 *  "is not a valid Page export field". `tsc --noEmit` does not catch this,
 *  because it is a Next.js rule rather than a TypeScript one. */
function parseCoords(text: string): { lat: number; lon: number } | null {
  if (!text) return null;
  const at = text.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const d3d4 = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const plain = text.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  const m = d3d4 || at || plain;
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function LocationCard({ store, onSaved }: { store: any; onSaved: () => void }) {
  const curLat = Number(store?.latitude ?? 0);
  const curLon = Number(store?.longitude ?? 0);
  const isSet = !(curLat === 0 && curLon === 0) && isFinite(curLat) && isFinite(curLon);
  const isExpress = EXPRESS_TYPES.includes(String(store?.vendor_type || "restaurant"));

  // null = no pin dropped yet
  const [pin, setPin] = useState<[number, number] | null>(isSet ? [curLat, curLon] : null);
  const [saving, setSaving] = useState(false);
  const [mapError, setMapError] = useState("");

  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // The click handler reads this, so it never closes over a stale setter.
  const setPinRef = useRef(setPin);
  setPinRef.current = setPin;

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !mapDiv.current || mapRef.current) return;
        const start = pin ?? DEFAULT_CENTRE;
        const map = L.map(mapDiv.current).setView(start, pin ? 17 : 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        // Leaflet's default marker images 404 unless pointed at the CDN.
        const icon = pinIcon(L);

        const place = (lat: number, lon: number) => {
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
          } else {
            const m = L.marker([lat, lon], { icon, draggable: true }).addTo(map);
            m.on("dragend", () => {
              const p = m.getLatLng();
              setPinRef.current([Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
            });
            markerRef.current = m;
          }
          setPinRef.current([Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
        };

        if (pin) place(pin[0], pin[1]);
        map.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
        // The container starts hidden inside a card; nudge Leaflet to measure.
        setTimeout(() => map.invalidateSize(), 200);
      })
      .catch(() => !cancelled && setMapError("The map could not load. Check your internet, or type the coordinates below."));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Move both the map and the pin — used by typing and by pasting a link. */
  const moveTo = (lat: number, lon: number) => {
    setPin([lat, lon]);
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const icon = pinIcon(L);
      const m = L.marker([lat, lon], { icon, draggable: true }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        setPinRef.current([Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
      });
      markerRef.current = m;
    }
    map.setView([lat, lon], Math.max(map.getZoom(), 16));
  };

  const onPaste = (text: string) => {
    const c = parseCoords(text);
    if (c) {
      moveTo(c.lat, c.lon);
      toast("Pin moved to the pasted location", "success");
    }
  };

  const onTypeLat = (v: string) => {
    const la = Number(v);
    if (isFinite(la) && pin) moveTo(la, pin[1]);
    else setPin(pin ? [Number(v) || 0, pin[1]] : null);
  };
  const onTypeLon = (v: string) => {
    const lo = Number(v);
    if (isFinite(lo) && pin) moveTo(pin[0], lo);
    else setPin(pin ? [pin[0], Number(v) || 0] : null);
  };

  const save = async () => {
    if (!pin) {
      toast("Click the map to place the pin on the shop first", "error");
      return;
    }
    const [la, lo] = pin;
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      toast("That is not a valid location", "error");
      return;
    }
    if (la === 0 && lo === 0) {
      toast("0, 0 is in the ocean — place the pin on the real shop", "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.setRestaurantLocation(String(store.id), la, lo);
      toast("Location saved", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save location", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Shop location on the map</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click the map on the shop. You can drag the pin to fine-tune it.
          </p>
        </div>
        {isSet ? (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Location set
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
            Not set
          </span>
        )}
      </div>

      {!isSet && isExpress && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>This store is hidden from customers.</strong> It delivers by
          rider, so without a map point we cannot work out the distance or the
          delivery fee. Place the pin below to make it visible again.
        </div>
      )}
      {!isSet && !isExpress && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This store ships over 1–3 days, so customers can still see it. Setting
          a location is still worth doing — it routes parcels to the nearest
          Takal office.
        </div>
      )}

      {mapError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {mapError}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-slate-200">
        <div ref={mapDiv} className="w-full h-80 bg-slate-100" />
        <div className="px-3 py-2 text-xs bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-slate-600">
            {pin
              ? <>Pin at <strong>{pin[0].toFixed(6)}, {pin[1].toFixed(6)}</strong> — drag it to adjust.</>
              : "Click the map to place the pin on the shop."}
          </span>
          {pin && (
            <a
              className="shrink-0 text-sky-700 hover:underline"
              target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${pin[0]},${pin[1]}`}
            >
              Check in Google Maps
            </a>
          )}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
          Or enter the coordinates by hand
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Paste a Google Maps link
            </label>
            <input
              type="text"
              onChange={(e) => onPaste(e.target.value)}
              placeholder="Right-click the shop in Google Maps, copy, paste here"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
              <input
                type="text" inputMode="decimal"
                value={pin ? String(pin[0]) : ""}
                onChange={(e) => onTypeLat(e.target.value)}
                placeholder="34.7795"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
              <input
                type="text" inputMode="decimal"
                value={pin ? String(pin[1]) : ""}
                onChange={(e) => onTypeLon(e.target.value)}
                placeholder="72.3600"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
              />
            </div>
          </div>
        </div>
      </details>

      <button
        onClick={save}
        disabled={saving || !pin}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFFF00] text-black border border-yellow-400 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save location"}
      </button>
    </div>
  );
}
