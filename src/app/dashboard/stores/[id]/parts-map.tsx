// ─────────────────────────────────────────────────────────────────────────────
// The map pieces the "Shop location" box is built from (Mock 85): loading the
// map library, the drawn pin, reading a pasted Google Maps link, and which
// kinds of shop a rider carries. The box itself is ../parts-shop-location.tsx.
//
// WHY THE MAP LOADS THIS WAY
// It used to pull leaflet.js from a public CDN and the map simply never
// appeared. The library is now part of the panel and is loaded once, on demand.
//
// A shop with no position cannot be reached: no rider can be routed to it and
// no delivery fee can be worked out, so it never appears to a customer.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { apiClient } from "@/lib/api-client";

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

// WHICH KINDS OF SHOP A RIDER CARRIES.
//
// THIS LIST WAS HAND-COPIED, AND IT HAD DRIFTED. It said "keep in step with
// the backend" and did not: `fruits_vegetables` and `meat_chicken` are both
// rider-delivered and both were missing. A greengrocer with no map pin is just
// as invisible to customers as a restaurant with no map pin, and this screen
// was telling the office it was only a small problem.
//
// It is a FALLBACK now, not the answer. The real list lives in the database
// (table `shop_types`, column `speed`) and is read from /admin/shop-types, so
// a kind of shop added today is judged correctly today. This is only what to
// believe while that request is in flight or if it fails - and it is now
// complete, so believing it is never dangerous.
export const EXPRESS_TYPES_FALLBACK = [
  "restaurant", "grocery", "fruits_vegetables", "meat_chicken",
  "pharmacy", "bakery",
];

/** The rider-delivered shop types, from the server, with the list above as a
 *  fallback. Asked once and remembered: this is a settings list, not data. */
let expressTypesCache: string[] | null = null;

export async function expressShopTypes(): Promise<string[]> {
  if (expressTypesCache) return expressTypesCache;
  try {
    const res = (await apiClient.getAdminShopTypes()) as any;
    const live = (res?.shop_types || [])
      .filter((t: any) => String(t?.speed || "") === "instant"
        && t?.is_active !== false)
      .map((t: any) => String(t.code));
    // NEVER an empty list. An empty answer would mark every shop as a
    // marketplace shop, and a restaurant with no pin would then look fine.
    if (live.length) expressTypesCache = live;
  } catch {
    /* offline, or no permission — the fallback below is complete */
  }
  return expressTypesCache ?? EXPRESS_TYPES_FALLBACK;
}

let leafletPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
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
export function pinIcon(L: any) {
  return L.divIcon({
    className: "",
    html:
      '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;' +
      // A raw colour on purpose: Leaflet builds this pin from a plain CSS
      // string, so a Tailwind class would never be applied to it. Red
      // because a map pin must stand out from the map, not match the panel.
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
export function parseCoords(text: string): { lat: number; lon: number } | null {
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

// CreateStorePin and LocationCard were here. Both were replaced by the one
// "Shop location" box (Mock 85, 17 September 2026) in
// ../parts-shop-location.tsx. The old versions are kept in
// DELETE-AFTER-TESTING/shop-location-2026-09-17/.
