"use client";

import { useState, useEffect } from "react";
import { Save, Bike, AlertTriangle, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Rider pay — what YOU pay the rider, set separately from what the CUSTOMER
// pays for delivery.
//
// These used to be one number, so a free-delivery promo meant the rider earned
// nothing for a delivery they actually made. Now:
//
//   customer delivery fee  = your PRICE  (can be 0 for a promo)
//   rider pay              = your COST   (never 0)
//
// The gap between them is what a delivery earns you — or costs you.
// ─────────────────────────────────────────────────────────────────────────────

interface Settings {
  // What the rider is paid
  rider_base_fee?: number | string | null;
  rider_per_km?: number | string | null;
  rider_max_fee?: number | string | null;
  rider_min_earning?: number | string | null;
  // What the customer pays — shown side by side so you can compare
  base_delivery_fee?: number | string | null;
  per_km_rate?: number | string | null;
  max_delivery_fee?: number | string | null;
}

const FIELDS: { key: keyof Settings; label: string; unit: string; hint: string }[] = [
  {
    key: "rider_base_fee",
    label: "Rider Base Pay",
    unit: "Rs",
    hint: "Paid on every delivery before distance is counted.",
  },
  {
    key: "rider_per_km",
    label: "Rider Per KM",
    unit: "Rs/km",
    hint: "Added for each km of real road distance.",
  },
  {
    key: "rider_max_fee",
    label: "Rider Maximum",
    unit: "Rs",
    hint: "A long delivery never pays more than this. 0 = no cap.",
  },
  {
    key: "rider_min_earning",
    label: "Rider Minimum",
    unit: "Rs",
    hint: "The rider never earns less than this — including on a FREE delivery, where you cover it. 0 = no floor.",
  },
];

export default function RiderPayPage() {
  const [form, setForm] = useState<Record<string, string>>({
    rider_base_fee: "",
    rider_per_km: "",
    rider_max_fee: "",
    rider_min_earning: "",
  });
  const [customer, setCustomer] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const num = (v: unknown) => (v == null ? 0 : parseFloat(String(v)) || 0);

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as Settings;
        setCustomer(s);
        setForm({
          rider_base_fee: s?.rider_base_fee != null ? String(s.rider_base_fee) : "",
          rider_per_km: s?.rider_per_km != null ? String(s.rider_per_km) : "",
          rider_max_fee: s?.rider_max_fee != null ? String(s.rider_max_fee) : "",
          rider_min_earning: s?.rider_min_earning != null ? String(s.rider_min_earning) : "",
        });
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not load settings", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const payload: Record<string, number> = {};
    for (const f of FIELDS) {
      const raw = (form[f.key as string] ?? "").trim();
      if (raw === "") continue;
      const n = parseFloat(raw);
      if (isNaN(n) || n < 0) {
        toast(`${f.label} must be a number 0 or more`, "error");
        return;
      }
      payload[f.key as string] = n;
    }
    if (Object.keys(payload).length === 0) {
      toast("Nothing to save", "error");
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateSettings(payload);
      toast("Rider pay saved — applies to new orders from now", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  // Live worked example so you can see the effect before saving.
  const riderBase = num(form.rider_base_fee);
  const riderKm = num(form.rider_per_km);
  const riderCap = num(form.rider_max_fee);
  const riderMin = num(form.rider_min_earning);
  const usingOwnRates = riderBase > 0 || riderKm > 0;

  const custBase = num(customer.base_delivery_fee);
  const custKm = num(customer.per_km_rate);
  const custCap = num(customer.max_delivery_fee);

  const example = (km: number, free = false) => {
    const customerPays = free
      ? 0
      : Math.min(custBase + km * custKm, custCap > 0 ? custCap : Infinity);
    let riderGets = usingOwnRates
      ? Math.min(riderBase + km * riderKm, riderCap > 0 ? riderCap : Infinity)
      : customerPays;
    riderGets = Math.max(riderGets, riderMin);
    return { km, free, customerPays, riderGets, margin: customerPays - riderGets };
  };

  const rows = [example(2), example(5), example(2, true)];
  const input = "w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Rider Pay</h1>
        <p className="text-slate-600 mt-1 max-w-2xl">
          What <strong>you pay the rider</strong> — set separately from what the
          customer is charged for delivery. If a customer gets free delivery, the
          rider is still paid in full and you cover it.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <>
          {!usingOwnRates && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold">You are not using your own rates yet.</p>
                <p>
                  Base Pay and Per KM are both 0, so riders are paid exactly what
                  the customer was charged. Fill them in below to set your own.
                </p>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-slate-700" />
              <h2 className="font-semibold text-slate-900">Your rider rates</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key as string}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {f.label}{" "}
                    <span className="text-slate-400 font-normal">({f.unit})</span>
                  </label>
                  <input
                    className={input}
                    inputMode="decimal"
                    placeholder="0"
                    value={form[f.key as string] ?? ""}
                    onChange={(e) => set(f.key as string, e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">{f.hint}</p>
                </div>
              ))}
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save rider pay"}
            </button>
            <p className="text-xs text-slate-500">
              Applies to <strong>new orders only</strong>. Deliveries already made
              keep the amount the rider was promised at the time.
            </p>
          </div>

          {/* Worked example */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white">
            <h2 className="font-semibold text-slate-900 mb-1">What this means</h2>
            <p className="text-sm text-slate-600 mb-4">
              Using your current customer rates (Rs {custBase} base + Rs {custKm}/km,
              max Rs {custCap}).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4 font-medium">Delivery</th>
                    <th className="py-2 pr-4 font-medium">Customer pays</th>
                    <th className="py-2 pr-4 font-medium">Rider gets</th>
                    <th className="py-2 font-medium">You keep</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">
                        {r.km} km {r.free && <span className="text-amber-600">(free delivery)</span>}
                      </td>
                      <td className="py-2 pr-4">Rs {r.customerPays.toFixed(0)}</td>
                      <td className="py-2 pr-4 font-medium">Rs {r.riderGets.toFixed(0)}</td>
                      <td
                        className={`py-2 font-semibold ${
                          r.margin < 0 ? "text-red-600" : "text-green-700"
                        }`}
                      >
                        {r.margin < 0 ? "−" : ""}Rs {Math.abs(r.margin).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.some((r) => r.margin < 0 && !r.free) && (
              <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <strong>You are paying riders more than customers pay you</strong> on
                  a normal delivery. That is a real loss on every order — fine if
                  it is deliberate, worth checking if not.
                </p>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-3">
              On a free delivery the rider is still paid, so the whole amount is
              your cost. You can see the running total on the Pay Riders page.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
