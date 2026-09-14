"use client";

/**
 * WEBSITE → DELIVERY AREA.
 *
 * Sana, 14 September 2026: "In the Start we will deliver only in Mingora and
 * surroundings of 10-15 km radius. that should also be editable in Admin panel."
 *
 * THE RADIUS IS NOT EDITED HERE, AND THAT IS THE POINT.
 *
 * There is already one delivery radius - max_delivery_km, on Settings →
 * Delivery Fees. The customer app uses it to decide which shops are in range,
 * and the delivery fee is worked out from it. The website now reads that SAME
 * number.
 *
 * Putting a second box on this screen would let the website promise 20 km while
 * the app refuses anything past 15, and nothing in the system would notice. So
 * this screen SHOWS the number and sends you to the one place it is set.
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { MapPin, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/ui";
import { AREA_FIELDS } from "@/lib/website-fields";
import { WordField } from "../parts-word-field";
import { SaveBar } from "../parts-save-bar";
import { useWebsiteSettings } from "../use-website-settings";

const DEFAULTS: Record<string, string> = {
  site_town: "Mingora",
  site_areas: "Mingora, Saidu Sharif, Kanju, Qambar, Landikas, Rahimabad",
};

export default function WebsiteAreaPage() {
  const { form, set, loading, saving, dirty, loadError, save } = useWebsiteSettings(AREA_FIELDS);
  const [km, setKm] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as any;
        setKm(s?.max_delivery_km != null ? String(s.max_delivery_km) : null);
      } catch {
        // Only a read, only for display. The wording below still saves, and
        // the screen already shows a proper error if the main load failed.
        setKm(null);
      }
    })();
  }, []);

  if (loading) return <LoadingState />;

  const town = (form.site_town || DEFAULTS.site_town).trim();

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState
          message={
            <>
              <strong>This is not your real wording.</strong> {loadError.message} Do not
              save from this screen until it has loaded properly.
            </>
          }
          denied={loadError.denied}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* The one number, and the one place it is changed. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              How far Takal delivers: {km ? `${km} km` : "not set"} around {town}
            </h3>
            <p className="text-amber-800 text-sm mt-1">
              This is <strong>one number, used in three places</strong> — the website, the
              customer app (which shops are close enough to show) and the delivery fee.
              Change it once and all three follow, so the website can never promise a
              distance the app refuses.
            </p>
            <Link
              href="/dashboard/settings/delivery-fees"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-amber-900 underline"
            >
              Change it in Settings → Delivery Fees
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        {AREA_FIELDS.map((f) => (
          <WordField
            key={f.key}
            field={f}
            value={form[f.key] ?? ""}
            onChange={(v) => set(f.key, v)}
            placeholder={DEFAULTS[f.key] ?? ""}
          />
        ))}
        <SaveBar saving={saving} dirty={dirty} onSave={save} />
      </div>
    </div>
  );
}
