"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS, verticalEmoji, verticalLabel } from "@/lib/verticals";

export default function CommissionsPage() {
  const [defaultCommission, setDefaultCommission] = useState("10");
  const [markup, setMarkup] = useState("0");
  const [saving, setSaving] = useState(false);

  // Per-store-type (vertical) commissions — real, backed by the API.
  const [vcLoading, setVcLoading] = useState(true);
  const [vcRates, setVcRates] = useState<Record<string, string>>({});
  const [vcSavingType, setVcSavingType] = useState<string | null>(null);

  useEffect(() => {
    loadVerticalCommissions();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = (await apiClient.getSettings()) as any;
      if (s?.commission_percent !== null && s?.commission_percent !== undefined)
        setDefaultCommission(String(s.commission_percent));
      if (s?.menu_markup_percent !== null && s?.menu_markup_percent !== undefined)
        setMarkup(String(s.menu_markup_percent));
    } catch {
      /* keep sensible defaults if the load fails */
    }
  };

  const loadVerticalCommissions = async () => {
    try {
      setVcLoading(true);
      const res = (await apiClient.getVerticalCommissions()) as any;
      const map: Record<string, string> = {};
      for (const it of res?.items || []) {
        map[it.vendor_type] =
          it.commission_percent === null || it.commission_percent === undefined
            ? ""
            : String(it.commission_percent);
      }
      setVcRates(map);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load store-type commissions", "error");
    } finally {
      setVcLoading(false);
    }
  };

  const saveVerticalCommission = async (vendorType: string) => {
    const raw = (vcRates[vendorType] ?? "").trim();
    const percent = raw === "" ? null : parseFloat(raw);
    if (percent !== null && (isNaN(percent) || percent < 0 || percent > 100)) {
      toast("Enter 0–100, or leave blank to use the global rate", "error");
      return;
    }
    try {
      setVcSavingType(vendorType);
      await apiClient.setVerticalCommission(vendorType, percent);
      toast(`${verticalLabel(vendorType)} commission saved`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setVcSavingType(null);
    }
  };

  const handleSave = async () => {
    const c = parseFloat(defaultCommission);
    const m = parseFloat(markup);
    if (isNaN(c) || c < 0 || c > 100) {
      toast("Default commission must be between 0 and 100", "error");
      return;
    }
    if (isNaN(m) || m < 0 || m > 100) {
      toast("Menu markup must be between 0 and 100", "error");
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateSettings({ commission_percent: c, menu_markup_percent: m });
      toast("Commission settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Commission Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure platform commission rates and policies
        </p>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900">Important</h3>
          <p className="text-amber-800 text-sm mt-1">
            Changes to commission rates take effect immediately for all new orders.
            Existing orders retain their original commission rates.
          </p>
        </div>
      </div>

      {/* Default Commission */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Default Commission Rate</h2>
        <p className="text-slate-600 text-sm mb-4">
          Applied to all new restaurants unless overridden
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Commission */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Commission Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={defaultCommission}
                onChange={(e) => setDefaultCommission(e.target.value)}
                min="0"
                max="100"
                step="0.5"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <span className="text-slate-600 font-medium">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Recommended: 10-15% for profitability
            </p>
          </div>

          {/* Menu markup — platform margin added on top of the owner's price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Menu Markup (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                min="0"
                max="100"
                step="0.5"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <span className="text-slate-600 font-medium">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Added on top of each item&apos;s price for customers (platform margin). 0 = off.
            </p>
          </div>
        </div>
      </div>

      {/* Commission by Store Type — real, backed by the API */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-slate-900">Commission by Store Type</h2>
          <p className="text-slate-600 text-sm mt-1">
            Charge different commissions per vertical (e.g. higher on food, lower on electronics).
            Leave a field blank to use the default rate. A specific store&apos;s own rate always wins.
          </p>
        </div>

        {vcLoading ? (
          <p className="text-slate-500 py-4">Loading…</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {VERTICALS.map((v) => (
              <div key={v.value} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{verticalEmoji(v.value)}</span>
                  <span className="font-medium text-slate-900">{verticalLabel(v.value)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="Global"
                    value={vcRates[v.value] ?? ""}
                    onChange={(e) =>
                      setVcRates((prev) => ({ ...prev, [v.value]: e.target.value }))
                    }
                    className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-right"
                  />
                  <span className="text-slate-600">%</span>
                  <button
                    onClick={() => saveVerticalCommission(v.value)}
                    disabled={vcSavingType === v.value}
                    className="flex items-center gap-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-slate-900 rounded-lg text-sm font-medium transition"
                  >
                    <Check className="w-4 h-4" />
                    {vcSavingType === v.value ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 sticky bottom-6">
        <button className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-slate-900 rounded-lg font-medium transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
