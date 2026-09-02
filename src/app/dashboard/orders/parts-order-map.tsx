"use client";

/**
 * WHERE THE ORDER IS GOING, on a real map.
 *
 * WHY IT DOES NOT LOAD BY ITSELF.
 *
 * A map is a picture fetched from somebody else's computer, and the web
 * address it is fetched with contains the customer's front door. Loading it
 * the moment an order is opened would send every customer's home address to a
 * third party, every time anybody glanced at an order - hundreds of times a
 * day, for orders nobody is even looking for on a map.
 *
 * So it waits to be asked. Nothing leaves this panel until somebody presses
 * "Show the map", and the panel says so on the button. That is also the honest
 * thing to be able to write in a privacy policy.
 *
 * OpenStreetMap rather than Google: it needs no key, no account and no extra
 * package in the project, and it is the same map the customer app already
 * shows. The "Open in Google Maps" link stays, because that is what a rider on
 * a phone actually wants for directions.
 *
 * THE MAP NEVER REPLACES THE ADDRESS. Sana's rule: the address is shown and
 * printed exactly as the customer wrote it, never "corrected" by a map. The
 * map is drawn from the coordinates the customer's app recorded, and it sits
 * BELOW the written address, never instead of it.
 */

import { useState } from "react";
import { MapPin } from "lucide-react";

export function OrderMap({
  lat,
  lon,
  label,
}: {
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
}) {
  const [shown, setShown] = useState(false);

  const hasPoint =
    typeof lat === "number" &&
    typeof lon === "number" &&
    isFinite(lat) &&
    isFinite(lon) &&
    !(lat === 0 && lon === 0);

  if (!hasPoint) {
    return (
      <div className="rounded-xl border border-dashed border-takal-line bg-takal-page px-4 py-6 text-center text-[13px] text-takal-ink-soft">
        No map point was recorded for this order. The written address above is
        the only location there is.
      </div>
    );
  }

  // A small box around the point, so the map opens zoomed in rather than
  // showing the whole country.
  const d = 0.004;
  const bbox = `${lon! - d},${lat! - d},${lon! + d},${lat! + d}`;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const google = `https://www.google.com/maps?q=${lat},${lon}`;

  return (
    <div>
      {shown ? (
        <iframe
          title={label ? `Map of ${label}` : "Delivery location"}
          src={osm}
          className="h-48 w-full rounded-xl border border-takal-line"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-takal-line bg-takal-page text-takal-ink-soft transition hover:bg-white"
        >
          <MapPin className="h-6 w-6" />
          <span className="text-sm font-bold text-takal-ink">Show the map</span>
          <span className="max-w-[16rem] text-center text-[11.5px] leading-snug">
            The map is fetched from OpenStreetMap, so pressing this sends the
            delivery point to them. Nothing is sent until you do.
          </span>
        </button>
      )}
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="font-mono text-takal-ink-soft">
          {lat!.toFixed(5)}, {lon!.toFixed(5)}
        </span>
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className="font-bold underline"
        >
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
