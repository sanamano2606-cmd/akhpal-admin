"use client";

import { useState, useEffect } from "react";
import { Save, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS, verticalEmoji, verticalLabel } from "@/lib/verticals";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";
import { changedRows, rowPercent, rowWords, sameNumber, savedWords } from "@/lib/commission-changes";

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
  // Remembered, not just toasted — see the note in loadVerticalCommissions.
  const [vcError, setVcError] = useState<ReadFailure>(null);
  const [vcRates, setVcRates] = useState<Record<string, string>>({});
  // MOCK 241 (approved 11 Nov 2026): how many shops use each store type, read
  // AFTER the page is drawn so the page never waits for it. null = not known.
  const [shopsPerType, setShopsPerType] = useState<Record<string, number> | null>(null);
  // WHAT THE SERVER HOLDS (fix 9): the rows and the two top boxes as last read
  // or saved, so the screen can tell which ones you have changed.
  const [vcSaved, setVcSaved] = useState<Record<string, string>>({});
  const [savedSettings, setSavedSettings] = useState<{ c: string; m: string }>({ c: "", m: "" });
  const changedTypes = changedRows(vcRates, vcSaved, VERTICALS.map((v) => v.value));

  useEffect(() => {
    loadVerticalCommissions();
    loadSettings();
    // Shops per store type - a nicety, read last; a failure just leaves it out.
    (async () => {
      try {
        const res = (await apiClient.getRestaurants({})) as any;
        const list: any[] = Array.isArray(res) ? res : res?.restaurants || res?.items || [];
        const n: Record<string, number> = {};
        for (const r of list) {
          if (r?.rejected_at) continue;
          const t = String(r?.vendor_type || "").split(",")[0].trim();
          if (t) n[t] = (n[t] || 0) + 1;
        }
        setShopsPerType(n);
      } catch {
        setShopsPerType(null);
      }
    })();
  }, []);

  const loadSettings = async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const s = (await apiClient.getSettings()) as any;
      const c = s?.commission_percent !== null && s?.commission_percent !== undefined ? String(s.commission_percent) : "";
      const m = s?.menu_markup_percent !== null && s?.menu_markup_percent !== undefined ? String(s.menu_markup_percent) : "";
      if (c !== "") setDefaultCommission(c);
      if (m !== "") setMarkup(m);
      setSavedSettings({ c, m });
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
      setVcSaved(map);
      setVcError(null);
    } catch (err) {
      // THE SAME LOCK THE TWO BOXES ABOVE ALREADY HAVE.  (Audit, 20 Sep 2026.)
      //
      // A failed read used to be a 3.5-second toast and nothing else. The 21
      // boxes then sat BLANK - and the sentence above them says "leave a field
      // blank to use the default rate", which the server obeys by DELETING
      // that store type's rate. So a slow server plus one Save wiped a real
      // 18% and nobody was told. Remembered now, shown in red, and every Save
      // underneath is switched off until a real read succeeds.
      setVcError(readFailure(err, "the store-type commissions"));
      setVcRates({});
      setVcSaved({});
      toast(err instanceof Error ? err.message : "Failed to load store-type commissions", "error");
    } finally {
      setVcLoading(false);
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
    // EVERY SHOP-TYPE ROW YOU CHANGED, checked before anything is written
    // (fix 9, audit O13). A typo in one row saves nothing at all.
    const rows = vcError ? [] : changedTypes;
    for (const t of rows) {
      if (!rowPercent(vcRates[t]).ok) {
        toast(`${verticalLabel(t)}: enter 0–100, or leave it blank for the global rate. Nothing was saved.`, "error");
        return;
      }
    }
    const topChanged = !sameNumber(defaultCommission, savedSettings.c) || !sameNumber(markup, savedSettings.m);
    const done: string[] = [];
    const failed: string[] = [];
    setSaving(true);
    try {
      if (topChanged) {
        try {
          await apiClient.updateSettings({ commission_percent: c, menu_markup_percent: m });
          if (!sameNumber(defaultCommission, savedSettings.c)) done.push(`default rate ${c}%`);
          if (!sameNumber(markup, savedSettings.m)) done.push(`markup ${m}%`);
          // Read it back. If the server clamps or rounds a rate, the screen
          // used to keep showing what was typed and there was no way to tell.
          await loadSettings();
        } catch (err) {
          failed.push(`default rate and markup (${err instanceof Error ? err.message : "not saved"})`);
        }
      }
      for (const t of rows) {
        const raw = (vcRates[t] ?? "").trim();
        const r = rowPercent(raw);
        if (!r.ok) continue;
        try {
          await apiClient.setVerticalCommission(t, r.percent);
          setVcSaved((prev) => ({ ...prev, [t]: raw }));
          done.push(rowWords(verticalLabel(t), r.percent));
        } catch (err) {
          failed.push(`${verticalLabel(t)} (${err instanceof Error ? err.message : "not saved"})`);
        }
      }
      if (failed.length) {
        toast(`Not saved: ${failed.join("; ")}.${done.length ? ` ${savedWords(done)}.` : ""}`, "error");
      } else {
        toast(savedWords(done), done.length ? "success" : "info");
      }
    } finally {
      setSaving(false);
    }
  };

  const boxClass = (changed: boolean) =>
    `w-24 h-10 px-3 rounded-[10px] border-[1.5px] text-right text-base font-bold outline-none focus:ring-2 focus:ring-takal-yellow ${
      changed ? "border-black bg-takal-yellow-soft" : "border-takal-line bg-white"}`;
  const topChangedNow = !sameNumber(defaultCommission, savedSettings.c) || !sameNumber(markup, savedSettings.m);
  const pending = [
    ...(topChangedNow ? ["the rate for every shop"] : []),
    ...(vcError ? [] : changedTypes.map((t) => verticalLabel(t))),
  ];

  return (
    <div className="space-y-4">
      {settingsError && (
        <ErrorState
          message={
            <>
              <strong>These are not your settings.</strong> {settingsError.message} The
              two boxes below are empty for that reason, and Save is switched
              off — so nothing on this page can be written over your real rates.
            </>
          }
          onRetry={loadSettings}
          denied={settingsError.denied}
        />
      )}

      {/* MOCK 241 (approved by Sana 11 Nov 2026): one short info line, small
          boxes, a compact store-type table and ONE Save at the bottom. */}
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Commission</h2>
        <p className="text-takal-ink-soft mt-1 text-sm">
          The share Takal keeps from each order. A shop&apos;s own rate (set on <strong>All Stores</strong>) beats this page.
        </p>
      </div>

      {/* A SHOP ON 0% IS NOT A FAULT (2 Sep 2026) + new orders only - one line now. */}
      <div data-commission-info className="flex items-start gap-2 rounded-xl border border-[#BFD4E4] bg-takal-blue-soft px-4 py-2.5 text-sm text-[#0B3A5E]">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <p>
          A new rate counts for <b>new orders only</b>. A shop on <b>0%</b> (the pharmacy) is on purpose –
          ask the Main Admin before changing it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr] xl:items-start">
        <div className="rounded-2xl border border-takal-line bg-white">
          <h3 className="border-b border-takal-line px-4 py-3 text-lg font-bold text-takal-ink">For every shop</h3>
          <div className="space-y-4 px-4 py-4">
            <div>
              <label htmlFor="c-default" className="mb-1 block text-sm font-bold text-takal-ink">Commission</label>
              <span className="inline-flex items-center gap-2">
                <input id="c-default" type="number" value={defaultCommission} min="0" max="100" step="0.5"
                  onChange={(e) => setDefaultCommission(e.target.value)}
                  className={boxClass(!sameNumber(defaultCommission, savedSettings.c))} />
                <span className="font-medium text-takal-ink-soft">%</span>
              </span>
              <p className="mt-1 text-xs text-takal-ink-soft">10–15% is usual.</p>
            </div>
            <div>
              <label htmlFor="c-markup" className="mb-1 block text-sm font-bold text-takal-ink">Price markup for customers</label>
              <span className="inline-flex items-center gap-2">
                <input id="c-markup" type="number" value={markup} min="0" max="100" step="0.5"
                  onChange={(e) => setMarkup(e.target.value)}
                  className={boxClass(!sameNumber(markup, savedSettings.m))} />
                <span className="font-medium text-takal-ink-soft">%</span>
              </span>
              <p className="mt-1 text-xs text-takal-ink-soft">Added on top of each price. 0 = off.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-takal-line bg-white">
          <h3 className="border-b border-takal-line px-4 py-3 text-lg font-bold text-takal-ink">
            By store type{" "}
            <span className="text-xs font-medium text-takal-ink-soft">– an empty box uses the rate for every shop
              {defaultCommission !== "" ? ` (${defaultCommission}%)` : ""}</span>
          </h3>
          {vcError ? (
            <div className="p-4">
              <ErrorState message={vcError.message} denied={vcError.denied} onRetry={loadVerticalCommissions} />
            </div>
          ) : vcLoading ? (
            <p className="px-4 py-4 text-takal-ink-soft">Loading…</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
                  <th className="border-b border-takal-line px-4 py-2">Store type</th>
                  <th className="border-b border-takal-line px-4 py-2">Commission</th>
                  <th className="border-b border-takal-line px-4 py-2" />
                  <th className="border-b border-takal-line px-4 py-2">Shops</th>
                </tr>
              </thead>
              <tbody>
                {VERTICALS.map((v) => {
                  const changed = changedTypes.includes(v.value);
                  const shops = shopsPerType ? shopsPerType[v.value] || 0 : null;
                  return (
                    <tr key={v.value} data-type-row={v.value} className={changed ? "bg-takal-yellow-soft/60" : ""}>
                      <td className="border-b border-[#F0F0EA] px-4 py-2 text-sm">
                        <span className="mr-1.5">{verticalEmoji(v.value)}</span>
                        <b className="text-takal-ink">{verticalLabel(v.value)}</b>
                      </td>
                      <td className="border-b border-[#F0F0EA] px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <input type="number" min="0" max="100" step="0.5"
                            aria-label={`${verticalLabel(v.value)} commission`}
                            placeholder={defaultCommission || "–"}
                            value={vcRates[v.value] ?? ""}
                            onChange={(e) => setVcRates((prev) => ({ ...prev, [v.value]: e.target.value }))}
                            disabled={!!vcError}
                            className={`${boxClass(changed)} !h-8 !w-24 placeholder:font-medium placeholder:text-takal-disabled-text`} />
                          <span className="text-takal-ink-soft">%</span>
                        </span>
                      </td>
                      <td className="border-b border-[#F0F0EA] px-4 py-2">
                        {changedTypes.includes(v.value) && (
                          <span className="whitespace-nowrap text-xs font-extrabold text-[#C8410F]">● changed – not saved yet</span>
                        )}
                      </td>
                      <td className="border-b border-[#F0F0EA] px-4 py-2 text-sm text-takal-ink-soft">
                        {shops === null ? "" : `${shops} shop${shops === 1 ? "" : "s"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ONE Save (Mock 241). Its own strip at the bottom (C12, 10 Nov 2026),
          saying what will be saved. */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-takal-line bg-takal-page/95 py-3 backdrop-blur-sm">
        <span data-pending className="mr-auto text-sm text-takal-ink-soft sm:mr-0">
          {pending.length ? `Not saved yet: ${pending.join(", ")}` : "Nothing changed"}
        </span>
        {/* WAS A BUTTON THAT DID NOTHING - it now reloads the real settings. */}
        <button
          type="button"
          onClick={() => { loadSettings(); loadVerticalCommissions(); }}
          disabled={saving || loadingSettings}
          className="h-10 rounded-[10px] border-[1.5px] border-[#CFCFC8] bg-white px-4 font-semibold transition hover:border-black hover:bg-takal-yellow-soft disabled:opacity-50"
        >
          Undo my changes
        </button>
        <button
          onClick={handleSave}
          // Switched off, not just warned about, when the real settings never
          // arrived — see the note on handleSave.
          disabled={saving || loadingSettings || !!settingsError}
          title={settingsError ? "Your real settings could not be read" : undefined}
          className="flex h-10 items-center gap-2 rounded-[10px] border-[1.5px] border-black bg-takal-yellow px-4 font-extrabold text-takal-ink shadow-[0_2px_0_#000] transition hover:bg-takal-yellow-dark disabled:border-takal-line disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text disabled:shadow-none"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : changedTypes.length && !vcError
            ? `Save changes (${changedTypes.length} store type${changedTypes.length === 1 ? "" : "s"} too)`
            : "Save changes"}
        </button>
      </div>
    </div>
  );
}
