// ─────────────────────────────────────────────────────────────────────────────
// ONE "SHOP LOCATION" BOX — search bar, map pin, and the address together.
//
// Mock 85, approved by Sana 17 September 2026. It replaces, in the panel:
//   * "Full Address" + a separate map + "Use this map point for the address"
//     on Create store (one shop and mall);
//   * the "Address" box in Store settings AND the separate "Shop location on
//     the map" card with its own Save, on the store page.
//
// How it works (the rules are in src/lib/shop-location.ts):
//   1. Search an area, street or landmark → the map jumps there.
//   2. Click the map or drag the pin onto the shop.
//   3. The address fills in from the pin; the person adds a shop number.
//   4. Moving the pin later ASKS before changing an address someone typed.
//
// This box never saves anything itself. It hands {lat, lon, address} to the
// form it sits in, and that form saves them together.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  afterPinMoved, hasPin, locationBody, riderDirectionsLink, searchText, type FoundPlace,
} from "@/lib/shop-location";
import {
  EXPRESS_TYPES_FALLBACK, expressShopTypes, loadLeaflet, parseCoords, pinIcon,
} from "./[id]/parts-map";

// Mingora, Swat — where the map opens when a shop has no pin yet.
const DEFAULT_CENTRE: [number, number] = [34.7795, 72.36];

export type ShopPlace = { lat: string; lon: string; address: string };

export function ShopLocationBox({
  value, onChange, pinError, addressError, required = true, mapHeight = "h-56",
}: {
  value: ShopPlace;
  onChange: (next: ShopPlace) => void;
  pinError?: string;
  addressError?: string;
  required?: boolean;
  mapHeight?: string;
}) {
  const set = hasPin(value.lat, value.lon);

  // The latest value and callback, for the map's own event handlers.
  const valueRef = useRef(value);
  valueRef.current = value;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  // What the map says is at the pin, and what this box last filled in.
  const [found, setFound] = useState("");
  const [looking, setLooking] = useState(false);
  const lastFilled = useRef("");
  const [ask, setAsk] = useState<string>("");   // a found address waiting for "Use / Keep"
  const movedByPerson = useRef(false);            // only a MOVE may change the address
  const skipLookup = useRef("");                  // a search result already named this pin

  // ── search bar ────────────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const text = searchText(q);
    if (!text) { setResults([]); setSearched(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await apiClient.searchPlaces(text);
        if (!cancelled) { setResults(r?.results || []); setSearched(true); }
      } catch {
        if (!cancelled) { setResults([]); setSearched(true); }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  // ── map ───────────────────────────────────────────────────────────────────
  const div = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState("");

  /** Decide what a newly found place means for the address. Returns the
   *  address to use now, or null to leave it alone. */
  const decide = (f: string, current: string): string | null => {
    setFound(f);
    const step = afterPinMoved(current, lastFilled.current, f);
    if (step === "fill") {
      lastFilled.current = f;
      setAsk("");
      return f;
    }
    setAsk(step === "ask" ? f : "");
    return null;
  };

  /** A person put the pin somewhere. ONE update carries the pin and, when a
   *  search result already named the place, the address with it. */
  const movePin = (la: number, lo: number, knownAddress = "") => {
    movedByPerson.current = true;
    const v = valueRef.current;
    const next: ShopPlace = { ...v, lat: la.toFixed(6), lon: lo.toFixed(6) };
    skipLookup.current = "";
    if (knownAddress) {
      skipLookup.current = `${next.lat},${next.lon}`;
      const a = decide(knownAddress, v.address);
      if (a !== null) next.address = a;
    }
    changeRef.current(next);
  };

  /** The map named the pin after a move. */
  const settle = (f: string) => {
    const v = valueRef.current;
    const a = decide(f, v.address);
    if (a !== null) changeRef.current({ ...v, address: a });
  };

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !div.current || mapRef.current) return;
        const v = valueRef.current;
        const start: [number, number] = hasPin(v.lat, v.lon)
          ? [Number(v.lat), Number(v.lon)] : DEFAULT_CENTRE;
        const map = L.map(div.current).setView(start, hasPin(v.lat, v.lon) ? 17 : 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, attribution: "&copy; OpenStreetMap",
        }).addTo(map);
        map.on("click", (e: any) => movePin(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
        drawPin(L);
        // It may open inside a dialog that was hidden a moment ago, so
        // Leaflet measured a box of zero. This makes the tiles appear.
        setTimeout(() => map.invalidateSize(), 250);
      })
      .catch(() => !cancelled && setMapError(
        "The map could not load. Search above or paste a Google Maps link instead."));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Put the marker where the value says, and bring the map to it. */
  const drawPin = (L: any) => {
    const map = mapRef.current;
    if (!map || !L) return;
    const v = valueRef.current;
    if (!hasPin(v.lat, v.lon)) return;
    const p: [number, number] = [Number(v.lat), Number(v.lon)];
    if (markerRef.current) {
      markerRef.current.setLatLng(p);
    } else {
      const m = L.marker(p, { icon: pinIcon(L), draggable: true }).addTo(map);
      m.on("dragend", () => {
        const at = m.getLatLng();
        movePin(at.lat, at.lng);
      });
      markerRef.current = m;
    }
    if (!map.getBounds().pad(-0.2).contains(p)) {
      map.setView(p, Math.max(map.getZoom(), 16));
    }
  };

  // Whenever the pin changes, move the marker and ask what is there.
  useEffect(() => {
    loadLeaflet().then((L) => drawPin(L)).catch(() => {});
    if (!set) { setFound(""); return; }
    const key = `${Number(value.lat).toFixed(6)},${Number(value.lon).toFixed(6)}`;
    if (skipLookup.current === key) return;   // the search result named it
    let cancelled = false;
    setLooking(true);
    // Debounced: dragging must not send a request per pixel — the free map
    // service allows one a second.
    const t = setTimeout(async () => {
      try {
        const r = (await apiClient.reverseGeocode(Number(value.lat), Number(value.lon))) as any;
        const f = String(r?.address || "").trim();
        if (cancelled) return;
        if (movedByPerson.current) settle(f); else setFound(f);
      } catch {
        if (!cancelled) setFound("");
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(t); setLooking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat, value.lon]);

  const [paste, setPaste] = useState("");
  const applyPaste = () => {
    const c = parseCoords(paste);
    if (!c) { toast("Could not find a map point in that", "error"); return; }
    movePin(c.lat, c.lon);
    if (mapRef.current) mapRef.current.setView([c.lat, c.lon], 17);
    setPaste("");
  };

  const pick = (p: FoundPlace) => {
    setOpen(false);
    setQ(p.name);
    movePin(p.lat, p.lon, p.address);
    if (mapRef.current) mapRef.current.setView([p.lat, p.lon], 17);
  };

  const link = riderDirectionsLink(value.lat, value.lon);
  const bad = Boolean(pinError) || (required && !set && Boolean(addressError));

  return (
    <div className={`rounded-2xl border-2 p-4 ${bad || pinError ? "border-takal-red" : "border-takal-ink"}`}>
      <div className="mb-3 flex items-center gap-2">
        <h4 className="text-base font-bold text-takal-ink">📍 Shop location{required ? " *" : ""}</h4>
        <span className="flex-1" />
        {set ? (
          <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-bold text-takal-green">✓ On the map</span>
        ) : (
          <span className="rounded-full bg-takal-red-soft px-2.5 py-0.5 text-xs font-bold text-takal-red">⚠ Required</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* LEFT: find the place */}
        <div className="min-w-0 space-y-2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border-2 border-takal-ink bg-white px-3 py-2">
              <span aria-hidden>🔍</span>
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (results[0]) pick(results[0]); }
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Search area, street or landmark"
                aria-label="Search area, street or landmark"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                maxLength={100}
              />
              {q && (
                <button type="button" aria-label="Clear search" onClick={() => { setQ(""); setResults([]); }}
                  className="text-sm font-bold text-takal-ink-soft hover:text-takal-ink">✕</button>
              )}
            </div>
            {open && searchText(q) && (
              <div className="absolute left-0 right-0 top-full z-[1100] mt-1 overflow-hidden rounded-xl border border-takal-line bg-white shadow-lg">
                {searching && <div className="px-3 py-2 text-sm text-takal-ink-soft">Searching…</div>}
                {!searching && searched && results.length === 0 && (
                  <div className="px-3 py-2 text-sm text-takal-ink-soft">
                    Nothing found. Try an area or a well-known place nearby, then move the pin.
                  </div>
                )}
                {!searching && results.map((p) => (
                  <button type="button" key={`${p.lat},${p.lon}`} onClick={() => pick(p)}
                    className="flex w-full items-start gap-2 border-b border-takal-line px-3 py-2 text-left text-sm last:border-0 hover:bg-takal-yellow-soft">
                    <span aria-hidden>📍</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-takal-ink">{p.name}</span>
                      {p.detail && <span className="block truncate text-xs text-takal-ink-soft">{p.detail}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-xl border border-takal-line">
            <div ref={div} className={`${mapHeight} w-full bg-takal-page`} />
            {!set && !mapError && (
              <div className="pointer-events-none absolute left-2 right-2 top-2 z-[500] rounded-lg bg-black/80 px-2 py-1 text-center text-xs text-white">
                Search above, or click the map on the shop
              </div>
            )}
          </div>
          {mapError && <p className="text-xs font-medium text-takal-red">{mapError}</p>}

          <div className="flex items-center gap-2 text-xs">
            <span className="shrink-0 text-takal-ink-soft">or paste a Google Maps link:</span>
            <input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPaste(); } }}
              placeholder="https://maps.app.goo.gl/… or 34.7795, 72.3607"
              className="min-w-0 flex-1 rounded-lg border border-takal-line px-2 py-1.5 outline-none"
            />
            <button type="button" onClick={applyPaste}
              className="shrink-0 rounded-lg border-2 border-takal-ink px-3 py-1 font-bold hover:bg-takal-page">
              Use
            </button>
          </div>
        </div>

        {/* RIGHT: what is there, in words */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <span aria-hidden>📍</span>
            <span className="min-w-0">
              <span className="text-takal-ink-soft">Pin is at: </span>
              {!set ? <span className="text-takal-ink-soft">not placed yet</span>
                : looking ? <span className="text-takal-ink-soft">finding the address…</span>
                : found ? <b className="text-takal-ink">{found}</b>
                : <span className="text-takal-ink-soft">{Number(value.lat).toFixed(5)}, {Number(value.lon).toFixed(5)} (no street name here)</span>}
            </span>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-takal-ink">
              Shop address{required ? " *" : ""}
            </span>
            <input
              value={value.address}
              onChange={(e) => { setAsk(""); onChange({ ...value, address: e.target.value }); }}
              placeholder={set ? "Add a shop number or landmark" : "Fills in when you place the pin"}
              maxLength={300}
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-takal-ink ${
                addressError ? "border-2 border-takal-red bg-takal-red-soft" : "border-2 border-takal-ink bg-white"}`}
            />
            {addressError
              ? <span className="mt-1 block text-xs font-medium text-takal-red">⚠ {addressError}</span>
              : <span className="mt-1 block text-xs text-takal-ink-soft">Filled in from the pin. Add a shop number or landmark.</span>}
          </label>

          {ask && (
            <div className="rounded-xl border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
              <b>You moved the pin.</b> Change the address to “{ask}”?
              <div className="mt-2 flex gap-2">
                <button type="button"
                  onClick={() => { lastFilled.current = ask; onChange({ ...value, address: ask }); setAsk(""); }}
                  className="flex-1 rounded-lg bg-takal-yellow px-3 py-1.5 font-bold text-takal-ink hover:bg-takal-yellow-dark">
                  Use new address
                </button>
                <button type="button" onClick={() => setAsk("")}
                  className="flex-1 rounded-lg border-2 border-takal-ink bg-white px-3 py-1.5 font-bold text-takal-ink hover:bg-takal-page">
                  Keep mine
                </button>
              </div>
            </div>
          )}

          {pinError && <p className="text-sm font-medium text-takal-red">⚠ {pinError}</p>}

          <div className="flex gap-2 rounded-xl bg-takal-yellow-soft px-3 py-2 text-xs text-takal-ink">
            <span aria-hidden>ℹ️</span>
            <span>Riders, customers, distance and delivery fee all use the <b>pin</b>. The address is the words people read.</span>
          </div>

          {link && (
            <div className="text-xs text-takal-ink">
              Rider directions:{" "}
              <a href={link} target="_blank" rel="noreferrer" className="font-bold underline">Test in Google Maps ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// THE STORE PAGE'S "SHOP LOCATION" CARD.
//
// Replaces the old "Address" box in Store settings and the old map card with
// its own Save. One card, one button: the pin and its address are saved
// together (PATCH /restaurants/{id}), so they can no longer disagree.
// ─────────────────────────────────────────────────────────────────────────────
export function ShopLocationCard({ store, onSaved }: { store: any; onSaved: () => void }) {
  const fromStore = (): ShopPlace => ({
    lat: hasPin(store?.latitude, store?.longitude) ? String(store.latitude) : "",
    lon: hasPin(store?.latitude, store?.longitude) ? String(store.longitude) : "",
    address: String(store?.address ?? ""),
  });
  const [v, setV] = useState<ShopPlace>(fromStore);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ pin?: string; address?: string }>({});
  // A fresh copy only when another store is opened or a save came back.
  useEffect(() => { setV(fromStore()); setErr({}); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store?.id, store?.updated_at]);

  const [expressTypes, setExpressTypes] = useState<string[]>(EXPRESS_TYPES_FALLBACK);
  useEffect(() => {
    let alive = true;
    expressShopTypes().then((t) => { if (alive) setExpressTypes(t); });
    return () => { alive = false; };
  }, []);
  const isExpress = expressTypes.includes(String(store?.vendor_type || "restaurant"));
  const savedHasPin = hasPin(store?.latitude, store?.longitude);

  const was = fromStore();
  const changed = v.lat !== was.lat || v.lon !== was.lon || v.address.trim() !== was.address.trim();

  const save = async () => {
    const r = locationBody(v.lat, v.lon, v.address);
    if (!r.ok) {
      setErr(hasPin(v.lat, v.lon) ? { address: r.error } : { pin: r.error });
      toast(r.error, "error");
      return;
    }
    setErr({});
    try {
      setSaving(true);
      await apiClient.updateRestaurant(String(store.id), r.body);
      toast("Shop location saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the shop location", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-takal-line bg-white p-5">
      {!savedHasPin && isExpress && (
        <div className="rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm text-takal-ink">
          <strong className="text-takal-red">This store is hidden from customers.</strong> It delivers by
          rider, so without a map pin we cannot work out the distance or the delivery fee.
          Place the pin below and save to make it visible.
        </div>
      )}
      {!savedHasPin && !isExpress && (
        <div className="rounded-lg border border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
          This store ships over 1–3 days, so customers can still see it. The pin is still worth
          setting — it sends parcels to the nearest Takal office.
        </div>
      )}
      <ShopLocationBox
        value={v}
        onChange={(n) => { setV(n); setErr({}); }}
        pinError={err.pin}
        addressError={err.address}
        mapHeight="h-72"
      />
      <div className="flex justify-end gap-2">
        {changed && (
          <button type="button" onClick={() => { setV(fromStore()); setErr({}); }} disabled={saving}
            className="rounded-lg border-2 border-takal-ink bg-white px-4 py-2 text-sm font-bold text-takal-ink hover:bg-takal-page disabled:opacity-50">
            Cancel
          </button>
        )}
        <button type="button" onClick={save} disabled={saving || !changed}
          className="rounded-lg bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-dark disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text">
          {saving ? "Saving…" : "Save location and address"}
        </button>
      </div>
    </div>
  );
}
