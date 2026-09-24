"use client";

/**
 * RIDERS → CASH LIMITS. The office default.
 *
 * WHY THIS SCREEN EXISTS AT ALL. The automatic cash limit has worked since the
 * first week — Rs 10,000 or 2 days — and until today there was NO SCREEN
 * ANYWHERE IN THE PANEL to change it. Those two numbers sat in the database as
 * built-in defaults; the server had always been ready to accept a change and
 * nothing had ever sent one. Sana, 24 September 2026: "Add this setting in
 * admin panel from where i can set the days and money range."
 *
 * THE FOURTH BOX IS NEW. "Ignore anything under" is the floor under the DAY
 * rule. Without it the rule reads "held for N days AND the amount is above
 * ZERO", so an order of Rs 553.50 paid in cash, against a hand-over box that
 * only takes whole rupees, leaves Rs 0.50 — and two days later that rider
 * cannot work. The shop side of this project has refused to call dust a debt
 * since the first pay run; riders had no such rule.
 *
 * NOTHING ON THIS SCREEN WORKS OUT A LIMIT FOR ITSELF. The "who would this
 * stop" line is answered by the server, by the same function that actually
 * stops a rider. A preview that disagreed with the block would be worse than
 * no preview at all — see previewCashLimits().
 */

import { useState, useEffect, useRef } from "react";
import { Save, Wallet, AlertTriangle, Info, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState, Button } from "@/components/ui";

type Form = {
  cash_limit_enabled: string;   // "yes" | "no"
  cash_limit_amount: string;
  cash_limit_days: string;
  cash_limit_min_amount: string;
};

type Preview = {
  checked?: number;
  stopped_now?: number;
  stopped_after?: number;
  would_be_stopped?: { rider_id: string; name: string; why: string | null }[];
  newly_stopped?: { rider_id: string; name: string; why: string | null }[];
  newly_freed?: { rider_id: string; name: string }[];
  incomplete?: boolean;
  incomplete_warning?: string;
};

const EMPTY: Form = {
  cash_limit_enabled: "yes",
  cash_limit_amount: "",
  cash_limit_days: "",
  cash_limit_min_amount: "",
};

export default function CashLimitsPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readForm = (s: any): Form => ({
    // The column may not exist yet on a server running ahead of migration 105.
    // An absent answer is NOT "no": the limit has been ON since the first week.
    cash_limit_enabled: s?.cash_limit_enabled === false ? "no" : "yes",
    cash_limit_amount: s?.cash_limit_amount != null ? String(Math.round(Number(s.cash_limit_amount))) : "",
    cash_limit_days: s?.cash_limit_days != null ? String(s.cash_limit_days) : "",
    cash_limit_min_amount:
      s?.cash_limit_min_amount != null ? String(Math.round(Number(s.cash_limit_min_amount))) : "",
  });

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as any;
        const f = readForm(s);
        setForm(f);
        setSaved(f);
      } catch (err) {
        // A FAILED READ MUST NOT BECOME A FACT ABOUT THE CASH RULE. Four empty
        // boxes on this screen, saved, would switch every limit off.
        setLoadError(readFailure(err, "the cash limit settings"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── The test drive ────────────────────────────────────────────────────────
  // Asked again, quietly, a moment after typing stops. It writes nothing.
  useEffect(() => {
    if (loading || loadError) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const p = (await apiClient.previewCashLimits(payload())) as Preview;
        setPreview(p);
        setPreviewFailed(false);
      } catch {
        // The test drive is a warning, not the screen. If the server cannot
        // answer, this SAYS SO rather than showing a confident "nobody would
        // be stopped" — which is the one wrong answer it could give.
        setPreview(null);
        setPreviewFailed(true);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loading, loadError]);

  const num = (v: string) => {
    const raw = (v ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  };

  const payload = () => ({
    cash_limit_amount: num(form.cash_limit_amount),
    cash_limit_days: num(form.cash_limit_days),
    cash_limit_min_amount: num(form.cash_limit_min_amount),
    cash_limit_enabled: form.cash_limit_enabled === "yes",
  });

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const changed = JSON.stringify(form) !== JSON.stringify(saved);

  const save = async () => {
    const body: Record<string, any> = { cash_limit_enabled: form.cash_limit_enabled === "yes" };
    for (const k of ["cash_limit_amount", "cash_limit_days", "cash_limit_min_amount"] as const) {
      const raw = (form[k] ?? "").trim();
      if (raw === "") continue;          // untouched box, leave the figure alone
      const n = Number(raw);
      if (isNaN(n) || n < 0) {
        toast("Every figure must be a number, 0 or more", "error");
        return;
      }
      body[k] = k === "cash_limit_days" ? Math.round(n) : n;
    }
    setSaving(true);
    try {
      await apiClient.updateSettings(body);
      setSaved(form);
      toast("Cash limits saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the cash limits", "error");
    } finally {
      setSaving(false);
    }
  };

  const on = form.cash_limit_enabled === "yes";
  const amount = Number(form.cash_limit_amount) || 0;
  const days = Number(form.cash_limit_days) || 0;
  const floor = Number(form.cash_limit_min_amount) || 0;

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm";
  const newBox = "border-2 border-takal-yellow bg-takal-yellow-soft rounded-lg p-3 -m-1";

  const Hint = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-takal-ink-soft mt-1">{children}</p>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Cash Limits</h2>
        <p className="text-takal-ink-soft mt-1 max-w-2xl">
          How much of Takal&apos;s cash a rider may be holding, and for how long,
          before he is stopped from taking new orders. This is the{" "}
          <strong>office default</strong> — it applies to every rider unless you
          give one his own figures on his page.
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
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* ── The four boxes ─────────────────────────────────────────── */}
          <div className="border border-takal-line rounded-xl bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-takal-line">
              <Wallet className="w-5 h-5 text-takal-ink" />
              <h3 className="font-semibold text-takal-ink">Cash limits — office default</h3>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label
                  htmlFor="cash-limit-on"
                  className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
                >
                  Cash limit on
                </label>
                <select
                  id="cash-limit-on"
                  className={input}
                  value={form.cash_limit_enabled}
                  onChange={(e) => set("cash_limit_enabled", e.target.value)}
                >
                  <option value="yes">Yes — stop a rider who is over</option>
                  <option value="no">No — never stop a rider for cash</option>
                </select>
                <Hint>
                  Off means nobody is ever stopped for cash. The figures below are
                  still kept, so switching it back on puts the same rule back.
                </Hint>
              </div>

              <div>
                <label
                  htmlFor="cash-limit-amount"
                  className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
                >
                  Most he may hold (Rs)
                </label>
                <input
                  id="cash-limit-amount"
                  className={input}
                  inputMode="numeric"
                  placeholder="10000"
                  value={form.cash_limit_amount}
                  onChange={(e) => set("cash_limit_amount", e.target.value)}
                />
                <Hint>
                  Over this, he is stopped straight away. <strong>0 = no amount limit.</strong>
                </Hint>
              </div>

              <div>
                <label
                  htmlFor="cash-limit-days"
                  className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
                >
                  For how many days
                </label>
                <input
                  id="cash-limit-days"
                  className={input}
                  inputMode="numeric"
                  placeholder="2"
                  value={form.cash_limit_days}
                  onChange={(e) => set("cash_limit_days", e.target.value)}
                />
                <Hint>
                  Cash held longer than this stops him, whatever the amount.{" "}
                  <strong>0 = no day limit.</strong>
                </Hint>
              </div>

              <div className={newBox}>
                <label
                  htmlFor="cash-limit-floor"
                  className="block text-xs font-bold uppercase tracking-wide text-takal-ink mb-1"
                >
                  Ignore anything under (Rs) <span className="text-takal-ink-soft">◂ new</span>
                </label>
                <input
                  id="cash-limit-floor"
                  className={input + " bg-white"}
                  inputMode="numeric"
                  placeholder="200"
                  value={form.cash_limit_min_amount}
                  onChange={(e) => set("cash_limit_min_amount", e.target.value)}
                />
                <Hint>
                  The day limit skips small change. <strong>0 = skip nothing</strong>, so
                  fifty paisa left over from a whole-rupee hand-over stops a rider
                  once the days are up.
                </Hint>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-takal-line bg-takal-page">
              <Button
                variant="secondary"
                onClick={() => setForm(saved)}
                disabled={saving || !changed}
              >
                Cancel
              </Button>
              <Button onClick={save} loading={saving} disabled={!changed} icon={<Save className="w-4 h-4" />}>
                Save
              </Button>
            </div>
          </div>

          {/* ── What these figures would do, right now ───────────────────── */}
          <div className="space-y-4">
            <TestDrive
              preview={preview}
              failed={previewFailed}
              changed={changed}
            />

            {!on && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-takal-orange shrink-0 mt-0.5" />
                <div className="text-sm text-takal-ink">
                  <p className="font-semibold">The cash limit is switched off.</p>
                  <p>
                    No rider is ever stopped for holding cash, however much or
                    however long. Your figures are kept and will apply again the
                    moment you switch it back on.
                  </p>
                </div>
              </div>
            )}

            {on && amount === 0 && days === 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-takal-orange shrink-0 mt-0.5" />
                <div className="text-sm text-takal-ink">
                  <p className="font-semibold">Both figures are 0, so nothing stops anybody.</p>
                  <p>
                    The limit says it is on, but 0 means &quot;no limit&quot; on
                    both boxes. Put a figure in at least one of them, or switch
                    the limit off above so the screen says what is really happening.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-5 h-5 text-takal-blue shrink-0 mt-0.5" />
              <div className="text-sm text-takal-ink space-y-2">
                <p className="font-semibold">What these three figures mean together.</p>
                <p>
                  A rider is stopped when he is holding{" "}
                  <strong>more than {money(amount)}</strong>
                  {days > 0 ? (
                    <>
                      , <em>or</em> when he has held cash for{" "}
                      <strong>{days} day{days === 1 ? "" : "s"} or more</strong> and
                      it is more than {money(floor)}
                    </>
                  ) : null}
                  . Nothing else stops him.
                </p>
                <p>
                  Handing cash in pays off his <strong>oldest</strong> orders first,
                  so the clock moves forward on its own — he never gets stuck on a
                  day count he cannot clear.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
              <Info className="w-5 h-5 text-takal-green shrink-0 mt-0.5" />
              <div className="text-sm text-takal-ink">
                <p className="font-semibold">One rider can have his own figures.</p>
                <p>
                  Open a rider from <strong>All Riders</strong> and fill in his
                  boxes. A box you leave empty there keeps following this screen —
                  change a figure here later and he follows it automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** "With these figures, 2 of your 6 riders would be stopped right now."
 *
 *  THE ONE MISTAKE THIS SCREEN CAN MAKE is a figure that quietly stops half the
 *  riders, and it is invisible without this line. The count comes from the
 *  server, from the same function that actually stops a rider. */
function TestDrive({
  preview,
  failed,
  changed,
}: {
  preview: Preview | null;
  failed: boolean;
  changed: boolean;
}) {
  if (failed) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-takal-line">
        <AlertTriangle className="w-5 h-5 text-takal-ink-soft shrink-0 mt-0.5" />
        <div className="text-sm text-takal-ink">
          <p className="font-semibold">We could not check who these figures would stop.</p>
          <p className="text-takal-ink-soft">
            The figures above are still yours to save — we just cannot tell you
            the effect right now. Try again in a moment.
          </p>
        </div>
      </div>
    );
  }
  if (!preview) return null;

  const checked = preview.checked ?? 0;
  const after = preview.stopped_after ?? 0;
  const newly = preview.newly_stopped ?? [];
  const freed = preview.newly_freed ?? [];
  const bad = after > 0;

  return (
    <div
      className={
        "p-4 rounded-lg border " +
        (bad ? "bg-takal-orange-soft border-takal-orange" : "bg-takal-green-soft border-takal-green")
      }
    >
      <div className="flex items-start gap-3">
        <Users className={"w-5 h-5 shrink-0 mt-0.5 " + (bad ? "text-takal-orange" : "text-takal-green")} />
        <div className={"text-sm " + (bad ? "text-takal-ink" : "text-takal-ink")}>
          <p className="font-semibold">
            {changed ? "With these figures, " : "As things stand, "}
            {after} of your {checked} rider{checked === 1 ? "" : "s"}{" "}
            would be stopped right now.
          </p>

          {newly.length > 0 && (
            <p className="mt-2">
              <strong>
                {newly.length === 1
                  ? "One rider who can work today would be stopped:"
                  : `${newly.length} riders who can work today would be stopped:`}
              </strong>{" "}
              {newly.map((r) => r.name).join(", ")}.
            </p>
          )}
          {freed.length > 0 && (
            <p className="mt-2">
              <strong>
                {freed.length === 1
                  ? "One rider who is stopped today could work again:"
                  : `${freed.length} riders who are stopped today could work again:`}
              </strong>{" "}
              {freed.map((r) => r.name).join(", ")}.
            </p>
          )}

          {(preview.would_be_stopped ?? []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {(preview.would_be_stopped ?? []).map((r) => (
                <li key={r.rider_id} className="text-xs">
                  <strong>{r.name}</strong> {r.why || "is over his limit"}
                </li>
              ))}
            </ul>
          )}

          {preview.incomplete && (
            <p className="mt-2 text-xs">
              <strong>This count may be short.</strong>{" "}
              {preview.incomplete_warning ||
                "Some figures could not be read, so treat the number above as a guide."}
            </p>
          )}

          <p className="mt-2 text-xs opacity-80">
            Nothing is saved until you press Save.
          </p>
        </div>
      </div>
    </div>
  );
}
