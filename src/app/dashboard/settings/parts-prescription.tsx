"use client";

/**
 * SETTINGS → GENERAL → PRESCRIPTION MEDICINES.  (Mock 184, Sana 13 Oct 2026:
 * "b. yes, but keep it optional".)
 *
 * ONE switch for the whole of Takal (Sana's default, "one global prescription
 * switch"). ON: products on a prescription shelf (Health & Pharmacy ›
 * Medicines › Prescription, Antibiotics, Diabetes, Heart & Blood Pressure,
 * Brain/Nerves/Sleep, Thyroid & Hormones, Injections & Drips) show a small
 * "Prescription" mark, and the customer MAY add a photo at checkout. OFF:
 * neither, anywhere. An order is NEVER stopped for want of a photo.
 *
 * The photo lives in a PRIVATE store (migration 133) and is opened only by
 * the pharmacy that received the order, the office and the customer.
 */

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

export function PrescriptionSwitch() {
  // null = not read yet, or this admin does not own it (the server leaves the
  // field out of the settings it sends) - then the card is not drawn at all.
  const [on, setOn] = useState<boolean | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.getSettings().then((s: any) => {
      if (!alive || !s) return;
      if ("prescription_photo_enabled" in s) setOn(s.prescription_photo_enabled === true);
      // Migration 133 not run yet: the row has no such column. (Only somebody
      // who owns Settings > General opens this page, and the server sends
      // them this field whenever it exists.)
      else if (Object.keys(s).length > 0) setMissing(true);
    }).catch(() => { /* the card stays hidden */ });
    return () => { alive = false; };
  }, []);

  if (on === null && !missing) return null;

  const flip = async () => {
    if (on === null) return;
    setBusy(true);
    try {
      await apiClient.updateSettings({ prescription_photo_enabled: !on });
      setOn(!on);
      toast(!on ? "Prescription mark and photo are ON" : "Prescription mark and photo are OFF", "success");
    } catch (e) {
      toast(errorMessage(e, "saving the prescription switch"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Prescription medicines"
                  hint="For products on the prescription shelves of Health & Pharmacy. Always optional - an order is never stopped for it." />
      <CardBody>
        {missing ? (
          <p className="text-sm text-takal-ink">
            Not switched on yet - database step 133 has not been run.
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <button type="button" role="switch" aria-checked={!!on} onClick={flip} disabled={busy}
                    aria-label="Let customers add a prescription photo"
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-takal-ink transition
                      ${on ? "bg-takal-yellow" : "bg-takal-disabled-bg"} ${busy ? "opacity-60" : ""}`}>
              <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-takal-ink transition ${on ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
            <div className="flex-1 min-w-[14rem] text-sm text-takal-ink">
              <p className="font-bold">Let customers add a prescription photo</p>
              <p className="mt-1">
                {on ? "ON" : "OFF"} - {on
                  ? "those products show a small ℞ Prescription mark, and at checkout the customer may add a photo of the doctor's prescription."
                  : "no mark and no photo box anywhere."}
              </p>
              <p className="mt-2 text-xs text-takal-ink-soft">
                The photo is kept with the order in a private store. Only the pharmacy that received
                the order, the office and the customer can open it. No photo? The pharmacy can ring
                the customer before packing.
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
