"use client";

import { useState, useEffect } from "react";
import { Save, Bike, AlertTriangle, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money, moneyExact } from "@/lib/format";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

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
  // What a delivery really costs, ANSWERED BY THE BACKEND. See the note on the
  // worked example below: this page used to work it out again for itself.
  const [feeExamples, setFeeExamples] = useState<
    { km: number; customer_pays: number; charged_km: number; capped: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // A FAILED READ MUST NOT BECOME A FACT ABOUT RIDER PAY.
  // Before: a toast, then four empty boxes and a blue notice saying "You are
  // not using your own rates yet" - on a page where saving those empty boxes
  // would have wiped the real rates.
  const [loadError, setLoadError] = useState<ReadFailure>(null);

  const num = (v: unknown) => (v == null ? 0 : parseFloat(String(v)) || 0);

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as Settings;
        setCustomer(s);
        try {
          const fx = (await apiClient.getFeeExamples()) as {
            examples?: { km: number; customer_pays: number; charged_km: number; capped: boolean }[];
          };
          setFeeExamples(fx?.examples ?? []);
        } catch {
          // The worked example is a convenience, not the page. If the backend
          // cannot answer, the table below simply does not appear - which is
          // the right failure. Showing a number this page worked out for
          // itself is what caused the problem in the first place.
          setFeeExamples([]);
        }
        setForm({
          rider_base_fee: s?.rider_base_fee != null ? String(s.rider_base_fee) : "",
          rider_per_km: s?.rider_per_km != null ? String(s.rider_per_km) : "",
          rider_max_fee: s?.rider_max_fee != null ? String(s.rider_max_fee) : "",
          rider_min_earning: s?.rider_min_earning != null ? String(s.rider_min_earning) : "",
        });
      } catch (err) {
        setLoadError(readFailure(err, "the rider pay settings"));
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
      // Not an error. Nothing was typed, so there is nothing to write.
      toast("Nothing has been changed, so there is nothing to save.", "info");
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

  // WHAT THE CUSTOMER PAYS IS NOT WORKED OUT HERE ANY MORE.
  //
  // This page used to hold its own copy of the delivery-fee formula:
  //     Math.min(custBase + km * custKm, custCap)
  // and the copy was wrong in two ways. It never capped the DISTANCE at
  // max_delivery_km, and it never applied the rounding rule (whole rupees,
  // half up). With the rates live on 2026-08-31 the two happened to agree, so
  // nothing looked wrong - but set a half-rupee per-km rate and the page is
  // out by 50 paisa, and set the delivery limit below 5 km and it is out by
  // Rs 20 on the 5 km row. An owner choosing a price from this table would
  // have been choosing it from a number no customer is ever charged.
  //
  // The figures now come from the backend, from the same function that bills
  // the customer. What is still worked out here is the RIDER's side, because
  // that arithmetic lives nowhere else - and it is compared against the
  // backend's answer rather than against a second guess at it.
  const rows = feeExamples
    .filter((e) => e.km === 2 || e.km === 5)
    .flatMap((e) => {
      const row = (free: boolean) => {
        const customerPays = free ? 0 : e.customer_pays;
        let riderGets = usingOwnRates
          ? Math.min(riderBase + e.km * riderKm, riderCap > 0 ? riderCap : Infinity)
          : e.customer_pays;
        riderGets = Math.max(riderGets, riderMin);
        return {
          km: e.km,
          free,
          chargedKm: e.charged_km,
          customerPays,
          riderGets,
          margin: customerPays - riderGets,
        };
      };
      return e.km === 2 ? [row(false), row(true)] : [row(false)];
    })
    .sort((a, b) => a.km - b.km || Number(a.free) - Number(b.free));
  const input = "w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Pay Rules</h2>
        <p className="text-takal-ink-soft mt-1 max-w-2xl">
          What <strong>you pay the rider</strong> — set separately from what the
          customer is charged for delivery. If a customer gets free delivery, the
          rider is still paid in full and you cover it.
        </p>
      </div>

      {loading ? (
        <p className="text-takal-ink-soft">Loading…</p>
      ) : loadError ? (
        <ErrorState
          message={loadError.message}
          onRetry={() => window.location.reload()}
          denied={loadError.denied}
        />
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

          <div className="border border-takal-line rounded-xl p-5 bg-white space-y-4">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-takal-ink" />
              <h2 className="font-semibold text-takal-ink">Your rider rates</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key as string}>
                  <label className="block text-sm font-medium text-takal-ink mb-1">
                    {f.label}{" "}
                    <span className="text-takal-disabled-text font-normal">({f.unit})</span>
                  </label>
                  <input
                    className={input}
                    inputMode="decimal"
                    placeholder="0"
                    value={form[f.key as string] ?? ""}
                    onChange={(e) => set(f.key as string, e.target.value)}
                  />
                  <p className="text-xs text-takal-ink-soft mt-1">{f.hint}</p>
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
            <p className="text-xs text-takal-ink-soft">
              Applies to <strong>new orders only</strong>. Deliveries already made
              keep the amount the rider was promised at the time.
            </p>
          </div>

          {/* Worked example. Hidden entirely when the backend could not give
              the customer-side figures: an example table with headers and no
              rows reads as "these deliveries earn nothing". */}
          {rows.length > 0 && (
          <div className="border border-takal-line rounded-xl p-5 bg-white">
            <h2 className="font-semibold text-takal-ink mb-1">What this means</h2>
            <p className="text-sm text-takal-ink-soft mb-4">
              Using your current customer rates ({moneyExact(custBase)} base +
              {moneyExact(custKm)}/km, max {moneyExact(custCap)}).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-takal-ink-soft border-b border-takal-line">
                    <th className="py-2 pr-4 font-medium">Delivery</th>
                    <th className="py-2 pr-4 font-medium">Customer pays</th>
                    <th className="py-2 pr-4 font-medium">Rider gets</th>
                    <th className="py-2 font-medium">You keep</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-takal-line last:border-0">
                      <td className="py-2 pr-4">
                        {r.km} km {r.free && <span className="text-amber-600">(free delivery)</span>}
                        {!r.free && r.chargedKm < r.km && (
                          <span className="text-takal-ink-soft">
                            {" "}(only {r.chargedKm} km billed — your delivery limit)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{money(r.customerPays)}</td>
                      <td className="py-2 pr-4 font-medium">{money(r.riderGets)}</td>
                      <td
                        className={`py-2 font-semibold ${
                          r.margin < 0 ? "text-red-600" : "text-green-700"
                        }`}
                      >
                        {r.margin < 0 ? "−" : ""}{money(Math.abs(r.margin))}
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
            <p className="text-xs text-takal-ink-soft mt-3">
              On a free delivery the rider is still paid, so the whole amount is
              your cost. You can see the running total on the Pay Riders page.
            </p>
          </div>
          )}
        </>
      )}
    </div>
  );
}
