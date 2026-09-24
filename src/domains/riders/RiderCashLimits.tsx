"use client";

/**
 * ONE RIDER'S OWN CASH LIMITS. Mock 118, section 2.
 *
 * Sana, 24 September 2026: "i would like to set for each rider separately."
 * A rider working the far villages who comes into the office twice a week is
 * not the same as one working the bazaar.
 *
 * AN EMPTY BOX IS A REAL ANSWER, AND IT IS NOT ZERO.
 *
 *     empty -> follow the office, now and whenever the office figure changes
 *     0     -> this limit is OFF for him, on purpose
 *     5     -> his own figure
 *
 * That distinction is the whole design. A blank box can therefore never switch
 * a limit off by accident — which is the one mistake that would quietly let a
 * rider carry Takal's money for ever. To take a limit off one rider you type
 * 0, and this screen says out loud what 0 means before you can save.
 *
 * NOTHING HERE WORKS OUT A LIMIT FOR ITSELF. Whether these figures would stop
 * him is answered by the server, by the same function that actually stops him.
 */

import { useState, useEffect, useRef } from "react";
import { Save, RotateCcw, Wallet, AlertTriangle, Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui";
import { formFromRider, offSwitchWarnings, type Form } from "@/lib/rider-cash-limits";

export type Limits = {
  enabled?: boolean;
  amount?: number;
  days?: number;
  min_amount?: number;
  where?: Record<string, string>;
  is_his_own?: boolean;
};

// THE RULE ITSELF LIVES IN src/lib/rider-cash-limits.ts — formFromRider and
// offSwitchWarnings, word for word as they were written here.
//
// WHY IT MOVED (24 September 2026). Plain Node runs the panel's tests and
// cannot read a .tsx file at all — it stops at the extension. A rule kept in
// this file could therefore never be tested, and the test that guards it
// failed the whole deploy. Nothing about the rule changed.

export function RiderCashLimits({
  riderId,
  rider,
  office,
  setByName,
  canEdit,
  onSaved,
}: {
  riderId: string;
  rider: any;
  office: Limits;
  setByName?: string | null;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const [saved, setSaved] = useState<Form>(() => formFromRider(rider));
  const [form, setForm] = useState<Form>(() => formFromRider(rider));
  const [saving, setSaving] = useState(false);
  const [effect, setEffect] = useState<any>(null);
  const [effectFailed, setEffectFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const f = formFromRider(rider);
    setSaved(f);
    setForm(f);
  }, [rider]);

  const num = (v: string) => {
    const raw = (v ?? "").trim();
    if (raw === "") return null;         // follow the office
    const n = Number(raw);
    return isNaN(n) ? null : n;
  };

  const payload = () => ({
    cash_limit_amount: num(form.cash_limit_amount),
    cash_limit_days: num(form.cash_limit_days),
    cash_limit_min_amount: num(form.cash_limit_min_amount),
    cash_limit_enabled:
      form.cash_limit_enabled === "" ? null : form.cash_limit_enabled === "yes",
  });

  // The test drive, for this one rider.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const p = (await apiClient.previewCashLimits({ ...payload(), rider_id: riderId })) as any;
        setEffect(p);
        setEffectFailed(false);
      } catch {
        setEffect(null);
        setEffectFailed(true);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, riderId]);

  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const warnings = offSwitchWarnings(form);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const send = async (body: ReturnType<typeof payload>, done: string) => {
    setSaving(true);
    try {
      await apiClient.setRiderCashLimits(riderId, body);
      toast(done, "success");
      onSaved?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save his cash limits", "error");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    for (const k of ["cash_limit_amount", "cash_limit_days", "cash_limit_min_amount"] as const) {
      const raw = form[k].trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (isNaN(n) || n < 0) {
        toast("Every figure must be a number, 0 or more — or empty to follow the office", "error");
        return;
      }
    }
    send(payload(), "His cash limits are saved");
  };

  const backToOffice = () =>
    send(
      {
        cash_limit_amount: null,
        cash_limit_days: null,
        cash_limit_min_amount: null,
        cash_limit_enabled: null,
      },
      "He is back on the office default",
    );

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm";
  const hisOwn = "border-2 border-takal-yellow bg-takal-yellow-soft";

  const Box = ({
    id,
    label,
    field,
    placeholder,
    hint,
  }: {
    id: string;
    label: string;
    field: keyof Form;
    placeholder: string;
    hint: string;
  }) => {
    const mine = form[field].trim() !== "";
    return (
      <div className={"rounded-lg p-3 " + (mine ? hisOwn : "border border-transparent")}>
        <label
          htmlFor={id}
          className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
        >
          {label}
        </label>
        <input
          id={id}
          className={input + " bg-white"}
          inputMode="numeric"
          placeholder={placeholder}
          value={form[field]}
          disabled={!canEdit}
          onChange={(e) => set(field, e.target.value)}
        />
        <p className="text-xs text-takal-ink-soft mt-1">{mine ? hint : "Empty = follow the office."}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-takal-line">
        <Wallet className="w-5 h-5 text-takal-ink" />
        <h3 className="font-semibold text-takal-ink">Cash limits</h3>
        {rider?.cash_limits_set_at && (
          <span className="text-xs text-takal-ink-soft ml-auto">
            Set by {setByName || "the office"} on {fmtDate(rider.cash_limits_set_at)}
          </span>
        )}
      </div>

      <div className="p-6 grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-3">
          <Box
            id="rider-cash-amount"
            label="Most he may hold (Rs)"
            field="cash_limit_amount"
            placeholder={`Office default — ${money(office?.amount)}`}
            hint="His own. 0 here means no amount limit for him."
          />
          <Box
            id="rider-cash-days"
            label="For how many days"
            field="cash_limit_days"
            placeholder={`Office default — ${office?.days ?? 0} day(s)`}
            hint="His own. 0 here means no day limit for him."
          />
          <Box
            id="rider-cash-floor"
            label="Ignore anything under (Rs)"
            field="cash_limit_min_amount"
            placeholder={`Office default — ${money(office?.min_amount)}`}
            hint="His own. Cash under this never starts his day clock."
          />

          <div
            className={
              "rounded-lg p-3 " +
              (form.cash_limit_enabled !== "" ? hisOwn : "border border-transparent")
            }
          >
            <label
              htmlFor="rider-cash-on"
              className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
            >
              Cash limit on
            </label>
            <select
              id="rider-cash-on"
              className={input + " bg-white"}
              value={form.cash_limit_enabled}
              disabled={!canEdit}
              onChange={(e) => set("cash_limit_enabled", e.target.value)}
            >
              <option value="">
                Office default — {office?.enabled === false ? "No" : "Yes"}
              </option>
              <option value="yes">Yes — stop him when he is over</option>
              <option value="no">No — never stop him for cash</option>
            </select>
            <p className="text-xs text-takal-ink-soft mt-1">
              {form.cash_limit_enabled === "" ? "Empty = follow the office." : "His own."}
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={backToOffice} disabled={saving}
                      icon={<RotateCcw className="w-4 h-4" />}>
                Back to office default
              </Button>
              <Button onClick={save} loading={saving} disabled={!changed}
                      icon={<Save className="w-4 h-4" />}>
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {warnings.length > 0 && (
            <div
              data-testid="off-switch-warning"
              className="flex items-start gap-3 p-4 rounded-lg bg-takal-red-soft border border-takal-red"
            >
              <AlertTriangle className="w-5 h-5 text-takal-red shrink-0 mt-0.5" />
              <div className="text-sm text-takal-ink">
                <p className="font-semibold">Read this before you save.</p>
                <ul className="list-disc ml-4 mt-1 space-y-1">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {effectFailed ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-takal-line">
              <AlertTriangle className="w-5 h-5 text-takal-ink-soft shrink-0 mt-0.5" />
              <p className="text-sm text-takal-ink">
                We could not check what these figures would do to him right now.
              </p>
            </div>
          ) : effect ? (
            <div
              data-testid="rider-test-drive"
              className={
                "flex items-start gap-3 p-4 rounded-lg border " +
                ((effect.stopped_after ?? 0) > 0
                  ? "bg-takal-orange-soft border-takal-orange"
                  : "bg-takal-green-soft border-takal-green")
              }
            >
              <Info
                className={
                  "w-5 h-5 shrink-0 mt-0.5 " +
                  ((effect.stopped_after ?? 0) > 0 ? "text-takal-orange" : "text-takal-green")
                }
              />
              <div className="text-sm text-takal-ink">
                {(effect.stopped_after ?? 0) > 0 ? (
                  <>
                    <p className="font-semibold">
                      With these figures he would be stopped right now.
                    </p>
                    {/* The server's reason is a sentence missing only its
                        subject, so the office list can put his name in front
                        of it and this page can put "He". */}
                    <p>He {(effect.would_be_stopped ?? [])[0]?.why || "is over his limit"}.</p>
                  </>
                ) : (
                  <p className="font-semibold">
                    With these figures he can work right now.
                  </p>
                )}
                <p className="mt-2 text-xs opacity-80">Nothing is saved until you press Save.</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3 p-4 rounded-lg bg-takal-blue-soft border border-takal-blue">
            <Info className="w-5 h-5 text-takal-blue shrink-0 mt-0.5" />
            <div className="text-sm text-takal-ink">
              <p className="font-semibold">Empty is a real answer.</p>
              <p>
                It does not mean zero and it does not mean &quot;no limit&quot; — it
                means <strong>follow the office</strong>. Change the office figure
                later and he follows it automatically.
              </p>
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs text-takal-ink-soft">
              You can see his limits but not change them. Changing a rider&apos;s
              cash limit needs the <strong>Pay Rules</strong> permission.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
