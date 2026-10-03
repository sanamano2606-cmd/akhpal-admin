"use client";

/**
 * SETTINGS → GENERAL → APP UPDATES  (Mock 140, approved by Sana on 2 October 2026)
 *
 * "When i upload the new build ... the users get the pop up window for update
 *  the App, and the pop up appears on each time opening until they update."
 *
 * One line per phone app. A phone OLDER than "Newest version" sees the update
 * pop-up every time it opens the app, while "Show the update pop-up" is on.
 * A phone older than "Oldest that still works" MUST update - no "Later" - and
 * so does every older phone when "Must update" is on.
 *
 * MAIN ADMIN ONLY. The card hides itself from a sub-admin, and the server
 * refuses them as well (routers/app_versions.py) - "must update" on the wrong
 * app would lock every customer out, so it is not a sub-admin's switch.
 *
 * NOTHING CHANGES FOR ANYBODY UNTIL SAVE. Migration 113 starts every app at
 * 2.4.7 with the pop-up off.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";
import { apiClient, type AppKey, type AppVersionRow } from "@/lib/api-client";
import { getMyPerms } from "@/lib/perms";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

const NAMES: Record<AppKey, string> = {
  customer: "Takal (customer)",
  rider: "Takal Riders",
  vendor: "Takal Vendors",
};

const ORDER: AppKey[] = ["customer", "rider", "vendor"];

/** The same rule as the server and the phones: 1 to 4 numbers and dots. */
export function looksLikeVersion(v: string): boolean {
  return /^[0-9]+(\.[0-9]+){0,3}$/.test(v.trim());
}

/** Compared as numbers: "2.4.10" is newer than "2.4.9". */
export function olderThan(a: string, b: string): boolean {
  const pa = a.trim().split(".").map(Number);
  const pb = b.trim().split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** What the badge beside an app's name says. */
export function statusOf(r: AppVersionRow): { text: string; warn: boolean } {
  if (r.force_update) return { text: `Must update · ${r.latest_version}`, warn: true };
  if (r.show_prompt) return { text: `Pop-up ON · ${r.latest_version}`, warn: true };
  return { text: `Pop-up off · ${r.latest_version}`, warn: false };
}

function Switch({
  on,
  danger,
  onChange,
  label,
}: {
  on: boolean;
  danger?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-3 text-sm font-semibold text-takal-ink"
    >
      <span
        className={`relative inline-block h-6 w-11 rounded-full transition ${
          on ? (danger ? "bg-takal-red" : "bg-takal-green") : "bg-takal-line"
        }`}
      >
        <span
          className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
            on ? "left-[23px]" : "left-[3px]"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export function AppUpdates() {
  const [isSuper, setIsSuper] = useState(false);
  const [rows, setRows] = useState<AppVersionRow[]>([]);
  const [saved, setSaved] = useState<AppVersionRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AppKey | null>(null);

  useEffect(() => {
    const me = getMyPerms();
    setIsSuper(me.isSuper);
    if (!me.isSuper) return;
    (async () => {
      try {
        const r = await apiClient.getAppVersions();
        const sorted = ORDER.map((k) => r.apps.find((a) => a.app === k)).filter(
          Boolean,
        ) as AppVersionRow[];
        setRows(sorted);
        setSaved(sorted);
      } catch (err) {
        setError(errorMessage(err, "the app versions"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isSuper) return null;

  const set = (app: AppKey, patch: Partial<AppVersionRow>) =>
    setRows((rs) => rs.map((r) => (r.app === app ? { ...r, ...patch } : r)));

  const problem = (r: AppVersionRow): string | null => {
    if (!looksLikeVersion(r.latest_version)) return "Newest version must look like 2.4.8.";
    if (!looksLikeVersion(r.minimum_version))
      return "Oldest that still works must look like 2.4.6.";
    if (olderThan(r.latest_version, r.minimum_version))
      return "Oldest that still works cannot be newer than the newest version.";
    if (r.whats_new.split("\n").filter((l) => l.trim()).length > 5)
      return "What's new can have at most 5 lines.";
    return null;
  };

  const save = async (r: AppVersionRow) => {
    const p = problem(r);
    if (p) {
      toast(p, "error");
      return;
    }
    try {
      setSaving(r.app);
      const out = await apiClient.saveAppVersion(r.app, {
        latest_version: r.latest_version.trim(),
        minimum_version: r.minimum_version.trim(),
        show_prompt: r.show_prompt,
        force_update: r.force_update,
        whats_new: r.whats_new,
      });
      setRows((rs) => rs.map((x) => (x.app === r.app ? { ...x, ...out.app } : x)));
      setSaved((rs) => rs.map((x) => (x.app === r.app ? { ...x, ...out.app } : x)));
      toast(`Saved. ${NAMES[r.app]} phones see this the next time they open the app.`, "success");
    } catch (err) {
      toast(errorMessage(err, "the app version"), "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="App updates"
        hint='Phones older than "Newest version" see the update pop-up every time they open the app. Main Admin only.'
      />
      <CardBody className="space-y-0 p-0">
        {loading && <p className="px-6 py-4 text-sm text-takal-ink-soft">Loading…</p>}
        {error && (
          <p className="m-6 rounded-lg bg-takal-red-soft px-4 py-3 text-sm text-takal-red">{error}</p>
        )}
        {rows.map((r) => {
          const st = statusOf(saved.find((s) => s.app === r.app) ?? r);
          const changed = JSON.stringify(r) !== JSON.stringify(saved.find((s) => s.app === r.app));
          const p = problem(r);
          return (
            <div key={r.app} className="border-b border-takal-line px-6 py-5 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-takal-ink">{NAMES[r.app]}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    st.warn ? "bg-takal-orange-soft text-takal-orange" : "bg-takal-green-soft text-takal-green"
                  }`}
                >
                  {st.text}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-takal-ink-soft">
                  Newest version
                  <input
                    value={r.latest_version}
                    onChange={(e) => set(r.app, { latest_version: e.target.value })}
                    placeholder="2.4.8"
                    className="mt-1 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm font-semibold text-takal-ink outline-none focus:border-takal-yellow"
                  />
                </label>
                <label className="block text-xs font-semibold text-takal-ink-soft">
                  Oldest that still works
                  <input
                    value={r.minimum_version}
                    onChange={(e) => set(r.app, { minimum_version: e.target.value })}
                    placeholder="2.4.6"
                    className="mt-1 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm font-semibold text-takal-ink outline-none focus:border-takal-yellow"
                  />
                </label>
                <label className="block text-xs font-semibold text-takal-ink-soft sm:col-span-2">
                  What&apos;s new (one line each, optional, at most 5)
                  <textarea
                    value={r.whats_new}
                    onChange={(e) => set(r.app, { whats_new: e.target.value })}
                    rows={3}
                    placeholder={"Pages open faster\nEasier checkout"}
                    className="mt-1 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm text-takal-ink outline-none focus:border-takal-yellow"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Switch
                  on={r.show_prompt}
                  onChange={(v) => set(r.app, { show_prompt: v })}
                  label="Show the update pop-up"
                />
                <Switch
                  on={r.force_update}
                  danger
                  onChange={(v) => set(r.app, { force_update: v })}
                  label='Must update (no "Later") - only for serious problems'
                />
              </div>
              {p && <p className="mt-2 text-xs font-semibold text-takal-red">{p}</p>}
              <div className="mt-4">
                <Button
                  onClick={() => save(r)}
                  loading={saving === r.app}
                  disabled={!changed || !!p || saving !== null}
                >
                  Save {NAMES[r.app]}
                </Button>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
