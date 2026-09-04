"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS, verticalEmoji, verticalLabel } from "@/lib/verticals";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

export default function CommissionsPage() {
  // EMPTY, NOT "10".
  //
  // Fixed 3 September 2026. These used to start at "10" and "0". A failed or
  // refused settings read left those two numbers on screen looking exactly
  // like real settings — and pressing Save wrote 10% commission and 0% mark-up
  // over whatever was really configured, for every shop.
  //
  // The Delivery Fees page had the identical bug and was fixed months ago:
  // "saving from it would have written blanks over real fees". This page never
  // got the same treatment, and it was the more dangerous of the two, because
  // 10% is a number somebody believes.
  const [defaultCommission, setDefaultCommission] = useState("");
  const [markup, setMarkup] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<ReadFailure>(null);

  // Per-store-type (vertical) commissions — real, backed by the API.
  const [vcLoading, setVcLoading] = useState(true);
  const [vcRates, setVcRates] = useState<Record<string, string>>({});
  const [vcSavingType, setVcSavingType] = useState<string | null>(null);

  useEffect(() => {
    loadVerticalCommissions();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const s = (await apiClient.getSettings()) as any;
      if (s?.commission_percent !== null && s?.commission_percent !== undefined)
        setDefaultCommission(String(s.commission_percent));
      if (s?.menu_markup_percent !== null && s?.menu_markup_percent !== undefined)
        setMarkup(String(s.menu_markup_percent));
    } catch (err) {
      // The boxes are left EMPTY and Save is switched off below. An empty box
      // cannot be mistaken for a rate; "10" can.
      setSettingsError(readFailure(err, "your commission settings"));
    } finally {
      setLoadingSettings(false);
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
    // THE LOCK, NOT JUST THE WARNING.
    //
    // A banner nobody reads is not a guard. If the real settings never
    // arrived, this screen has nothing to save and must refuse.
    if (settingsError) {
      toast("Your real settings could not be read, so there is nothing to save yet", "error");
      return;
    }
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
      // Read it back. If the server clamps or rounds a rate, the screen used to
      // keep showing what was typed and there was no way to tell.
      await loadSettings();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {settingsError && (
        <ErrorState
          message={
            <>
              <strong>These are not your settings.</strong> {settingsError} The
              two boxes below are empty for that reason, and Save is switched
              off — so nothing on this page can be written over your real rates.
            </>
          }
          onRetry={loadSettings}
          denied={settingsError.denied}
        />
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Commission</h2>
        <p className="text-takal-ink-soft mt-1 text-sm">
          The share Takal keeps from each order. A single shop can be given its
          own rate instead, on the <strong>All Stores</strong> tab — a rate set
          there beats everything on this page for that shop.
        </p>
        <p className="text-takal-ink-soft mt-1">
          Configure platform commission rates and policies
        </p>
      </div>

      {/* A SHOP ON 0% IS NOT A FAULT.
          Written here on 2 September 2026 because a delivered order that earns
          Takal nothing looks exactly like something broken, and the next person
          to notice it will "fix" it. Sana confirmed the pharmacy is on no
          commission on purpose. */}
      <div className="flex items-start gap-3 rounded-lg border border-[#BFD4E4] bg-takal-blue-soft p-4">
        <div>
          <h3 className="font-semibold text-takal-blue">A shop on 0% is deliberate</h3>
          <p className="mt-1 text-sm text-takal-blue">
            At least one shop — the pharmacy — is set to <b>0% commission</b> on
            purpose. Its delivered orders earn Takal the delivery margin and
            nothing else, and the Orders page marks them <b>0%</b> so nobody
            mistakes it for a fault. Do not change it back without asking Sana.
          </p>
        </div>
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
      <div className="bg-white rounded-lg border border-takal-line p-6">
        <h2 className="text-xl font-semibold text-takal-ink mb-6">Default Commission Rate</h2>
        <p className="text-takal-ink-soft text-sm mb-4">
          Applied to all new restaurants unless overridden
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Commission */}
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-2">
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
                className="flex-1 px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
              />
              <span className="text-takal-ink-soft font-medium">%</span>
            </div>
            <p className="text-xs text-takal-ink-soft mt-2">
              Recommended: 10-15% for profitability
            </p>
          </div>

          {/* Menu markup — platform margin added on top of the owner's price */}
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-2">
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
                className="flex-1 px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
              />
              <span className="text-takal-ink-soft font-medium">%</span>
            </div>
            <p className="text-xs text-takal-ink-soft mt-2">
              Added on top of each item&apos;s price for customers (platform margin). 0 = off.
            </p>
          </div>
        </div>
      </div>

      {/* Commission by Store Type — real, backed by the API */}
      <div className="bg-white rounded-lg border border-takal-line p-6">
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-takal-ink">Commission by Store Type</h2>
          <p className="text-takal-ink-soft text-sm mt-1">
            Charge different commissions per vertical (e.g. higher on food, lower on electronics).
            Leave a field blank to use the default rate. A specific store&apos;s own rate always wins.
          </p>
        </div>

        {vcLoading ? (
          <p className="text-takal-ink-soft py-4">Loading…</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {VERTICALS.map((v) => (
              <div key={v.value} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{verticalEmoji(v.value)}</span>
                  <span className="font-medium text-takal-ink">{verticalLabel(v.value)}</span>
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
                    className="w-24 px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-right"
                  />
                  <span className="text-takal-ink-soft">%</span>
                  <button
                    onClick={() => saveVerticalCommission(v.value)}
                    disabled={vcSavingType === v.value}
                    className="flex items-center gap-1 px-3 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg text-sm font-medium transition"
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
        {/* WAS A BUTTON THAT DID NOTHING.
            It had no onClick and no form, and it sat next to Save on the page
            that sets platform commission — so it looked exactly like
            "discard my edits" and was not. It now reloads the real settings,
            which is what it was pretending to do. */}
        <button
          type="button"
          onClick={loadSettings}
          disabled={saving || loadingSettings}
          className="px-6 py-2 border border-takal-line rounded-lg hover:bg-takal-page font-medium transition disabled:opacity-50"
        >
          Undo my changes
        </button>
        <button
          onClick={handleSave}
          // Switched off, not just warned about, when the real settings never
          // arrived — see the note on handleSave.
          disabled={saving || loadingSettings || !!settingsError}
          title={settingsError ? "Your real settings could not be read" : undefined}
          className="flex items-center gap-2 px-6 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text text-takal-ink rounded-lg font-medium transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
