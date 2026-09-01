"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

// Real delivery-fee model (matches the backend):
//   fee = base fee + (road distance km × per-km rate), capped at the max fee.
//   Stores farther than the max distance are hidden from customers.
//   Riders within the match radius get notified of new orders.
interface FeeForm {
  base_delivery_fee: string;
  per_km_rate: string;
  max_delivery_km: string;
  max_delivery_fee: string;
  rider_match_km: string;
  // Standard (marketplace) orders don't use the distance model above at all —
  // the vendor ships them, so there is no rider and no per-km leg. They pay
  // this flat fee instead. Was hard-coded to 0 in the backend until now.
  standard_shipping_fee: string;
}

const FIELDS: {
  key: keyof FeeForm;
  label: string;
  unit: string;
  hint: string;
}[] = [
  { key: "base_delivery_fee", label: "Base Delivery Fee", unit: "Rs", hint: "Added to every delivery before distance." },
  { key: "per_km_rate", label: "Per KM Rate", unit: "Rs/km", hint: "Charged per km of real road distance." },
  { key: "max_delivery_fee", label: "Maximum Delivery Fee", unit: "Rs", hint: "Hard cap — the fee never exceeds this." },
  { key: "max_delivery_km", label: "Max Delivery Distance", unit: "km", hint: "Stores farther than this are hidden from the customer." },
  { key: "rider_match_km", label: "Rider Match Radius", unit: "km", hint: "Only riders within this distance are notified of an order." },
  { key: "standard_shipping_fee", label: "Standard Shipping Fee", unit: "Rs", hint: "Flat fee for Standard (marketplace) orders the vendor ships themselves — fashion, electronics, home goods and so on. These never use a rider, so none of the distance settings above apply to them. 0 = free shipping." },
];

export default function DeliveryFeesPage() {
  const [form, setForm] = useState<FeeForm>({
    base_delivery_fee: "",
    per_km_rate: "",
    max_delivery_km: "",
    max_delivery_fee: "",
    rider_match_km: "",
    standard_shipping_fee: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as any;
        setForm({
          base_delivery_fee: s?.base_delivery_fee != null ? String(s.base_delivery_fee) : "",
          per_km_rate: s?.per_km_rate != null ? String(s.per_km_rate) : "",
          max_delivery_km: s?.max_delivery_km != null ? String(s.max_delivery_km) : "",
          max_delivery_fee: s?.max_delivery_fee != null ? String(s.max_delivery_fee) : "",
          rider_match_km: s?.rider_match_km != null ? String(s.rider_match_km) : "",
          standard_shipping_fee:
            s?.standard_shipping_fee != null ? String(s.standard_shipping_fee) : "",
        });
      } catch (err) {
        // It used to leave every box blank with no message at all, so a
        // failed load looked exactly like a form that had never been filled
        // in - and saving from it would have written blanks over real fees.
        setLoadError(errorMessage(err, "the delivery fee settings"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof FeeForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const payload: Record<string, number> = {};
    for (const f of FIELDS) {
      const raw = form[f.key].trim();
      if (raw === "") continue; // skip blanks — don't overwrite with 0
      const n = parseFloat(raw);
      if (isNaN(n) || n < 0) {
        toast(`${f.label} must be a number 0 or more`, "error");
        return;
      }
      payload[f.key] = n;
    }
    if (Object.keys(payload).length === 0) {
      toast("Nothing to save", "error");
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateSettings(payload);
      toast("Delivery settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Delivery Fees</h2>
        <p className="text-takal-ink-soft mt-1">Configure how delivery charges are calculated platform-wide</p>
      </div>

      {/* A blank form and a broken form used to look identical. Saving from a
          broken one would have written empty values over the real fees. */}
      {loadError && (
        <ErrorState
          message={
            <>
              <strong>These are not your real settings.</strong> {loadError} Do not
              save from this screen until it has loaded properly.
            </>
          }
          denied={loadError.includes("permission")}
          onRetry={() => window.location.reload()}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900">How the fee is calculated</h3>
          <p className="text-amber-800 text-sm mt-1">
            Fee = Base Fee + (road distance × Per KM Rate), capped at the Maximum Delivery Fee.
            Self-pickup is always free. Changes apply immediately to new orders.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line p-6">
        <h2 className="text-xl font-semibold text-takal-ink mb-6">Global Delivery Settings</h2>
        {loading ? (
          <p className="text-takal-ink-soft">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-takal-ink mb-2">{f.label}</label>
                <div className="flex items-center gap-2">
                  {f.unit === "Rs" && <span className="text-takal-ink-soft font-medium">Rs</span>}
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="flex-1 px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
                  />
                  {f.unit !== "Rs" && <span className="text-takal-ink-soft text-sm">{f.unit}</span>}
                </div>
                <p className="text-xs text-takal-ink-soft mt-2">{f.hint}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 sticky bottom-6">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-6 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg font-medium transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
