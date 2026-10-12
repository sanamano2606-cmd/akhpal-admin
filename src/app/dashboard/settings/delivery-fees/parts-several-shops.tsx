"use client";

/**
 * SETTINGS > DELIVERY FEES > "Several shops in one order" (Mock 181, Sana
 * 12 October 2026: "all the control must be in admin panel too, from where i
 * can change any of the rate later and even swich off").
 *
 * Its own card with its own Save, so the fees above and this never overwrite
 * each other. The rules (what is sent, what is refused) live in
 * src/lib/trip-settings.ts; the worked example is asked from the server.
 */
import { useEffect, useState } from "react";
import { Save, Bike, Package } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  tripFormFrom,
  tripChanges,
  tripExampleLines,
  type TripForm,
  type TripExample,
} from "@/lib/trip-settings";

function OnOff({ on, label, onClick, disabled }: {
  on: boolean; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={on ? "text-takal-green" : "text-takal-ink-soft"}>{on ? "On" : "Off"}</span>
      <span className={`relative h-[26px] w-[46px] rounded-full transition-colors ${
        on ? "bg-takal-green group-hover:bg-takal-green/90" : "bg-takal-line group-hover:bg-takal-ink-soft/40"}`}>
        <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "right-[3px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

const BOXES: { key: keyof TripForm; id: string; label: string; unit: string; hint: string }[] = [
  { key: "trip_stop_fee", id: "trip-stop-fee", label: "Fee per extra shop", unit: "Rs",
    hint: "The customer pays the whole trip's distance once, plus this for every shop after the first." },
  { key: "trip_stop_bonus", id: "trip-stop-bonus", label: "Rider's bonus per extra shop", unit: "Rs",
    hint: "The rider is paid his normal pay for the whole trip, plus this for every shop after the first." },
  { key: "trip_within_km", id: "trip-within-km", label: "Shops at most this far apart", unit: "km",
    hint: "Only shops this close to each other go in one trip." },
  { key: "trip_max_shops", id: "trip-max-shops", label: "Most shops in one trip", unit: "shops",
    hint: "From 2 to 5." },
];

export default function SeveralShopsCard({ settings }: { settings: Record<string, unknown> | null }) {
  const start = tripFormFrom(settings);
  const [was, setWas] = useState<TripForm>(start.form);
  const [form, setForm] = useState<TripForm>(start.form);
  const [bonusIsMine, setBonusIsMine] = useState(start.bonusIsMine);
  const [notRunYet, setNotRunYet] = useState(start.notRunYet);
  const [example, setExample] = useState<TripExample | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = tripFormFrom(settings);
    setWas(s.form);
    setForm(s.form);
    setBonusIsMine(s.bonusIsMine);
    setNotRunYet(s.notRunYet);
  }, [settings]);

  const loadExample = () =>
    apiClient
      .getTripExample()
      .then((e) => setExample(e as TripExample))
      .catch(() => setExample(null));

  useEffect(() => {
    if (settings && !tripFormFrom(settings).notRunYet) loadExample();
  }, [settings]);

  const set = (k: keyof TripForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const out = tripChanges(was, form, bonusIsMine);
    if ("error" in out) {
      toast(out.error, "error");
      return;
    }
    if (Object.keys(out.payload).length === 0) {
      toast("Nothing has been changed, so there is nothing to save.", "info");
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateSettings(out.payload);
      setWas(form);
      toast("Several shops in one order: saved", "success");
      loadExample();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-takal-line p-6" id="several-shops">
      <h2 className="text-xl font-semibold text-takal-ink">Several shops in one order</h2>
      <p className="text-sm text-takal-ink-soft mt-1">
        When a customer buys from more than one shop at once. Both parts start Off - Off is exactly
        how it works today. A change applies to new orders only.
      </p>

      {notRunYet && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          The database has not been made ready for this yet (migration 130). Nothing here can be
          saved until it is.
        </p>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-takal-line p-4">
          <div className="flex items-start gap-3">
            <Bike className="w-5 h-5 mt-0.5 text-takal-ink-soft" />
            <div>
              <p className="font-semibold text-takal-ink">One rider for nearby shops</p>
              <p className="text-[13px] text-takal-ink-soft">
                Rider (Express) shops close to each other go in one trip with one rider, for one
                delivery fee.
              </p>
            </div>
          </div>
          <OnOff on={form.trip_enabled} label="One rider for nearby shops" disabled={notRunYet}
                 onClick={() => set("trip_enabled", !form.trip_enabled)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
          {BOXES.map((b) => {
            const locked = b.key === "trip_stop_bonus" && !bonusIsMine;
            return (
              <div key={b.key}>
                <label htmlFor={b.id} className="block text-sm font-medium text-takal-ink mb-2">{b.label}</label>
                <div className="flex items-center gap-2">
                  {b.unit === "Rs" && <span className="text-takal-ink-soft font-medium">Rs</span>}
                  <input
                    id={b.id}
                    type="number"
                    min="0"
                    step={b.key === "trip_within_km" ? "0.5" : "1"}
                    value={locked ? "" : String(form[b.key])}
                    placeholder={locked ? "Set on Riders > Pay rules" : undefined}
                    disabled={locked || notRunYet}
                    onChange={(e) => set(b.key, e.target.value)}
                    className="flex-1 px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none disabled:bg-slate-50"
                  />
                  {b.unit !== "Rs" && <span className="text-takal-ink-soft text-sm">{b.unit}</span>}
                </div>
                <p className="text-xs text-takal-ink-soft mt-2">
                  {locked ? "Rider pay - only someone with Riders > Pay rules can change it." : b.hint}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-takal-line p-4">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 mt-0.5 text-takal-ink-soft" />
            <div>
              <p className="font-semibold text-takal-ink">One parcel fee per basket</p>
              <p className="text-[13px] text-takal-ink-soft">
                Parcel (Standard) shops outside a mall that send to the same Takal office pay the
                Standard Shipping Fee once, not once each.
              </p>
            </div>
          </div>
          <OnOff on={form.parcel_basket_enabled} label="One parcel fee per basket" disabled={notRunYet}
                 onClick={() => set("parcel_basket_enabled", !form.parcel_basket_enabled)} />
        </div>
      </div>

      {example && (
        <div className="mt-6 rounded-lg bg-takal-yellow-soft border border-takal-line p-4 text-sm text-takal-ink"
             data-testid="trip-example">
          <p className="font-semibold mb-1">Worked example, with the saved rates</p>
          {tripExampleLines(example).map((l) => <p key={l}>{l}</p>)}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving || notRunYet || !settings}
          className="flex items-center gap-2 px-6 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg font-medium transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save these"}
        </button>
      </div>
    </div>
  );
}
