"use client";

/**
 * GO LIVE — clearing the internal-tester data, once.
 *
 * Sana, 2 September 2026: "I want to clear all the data ... so when I launch
 * officially, everything starts from zero." Then, on the design: "Keep that in
 * a separate sidebar tab so when I add a sub-admin I can switch that off for
 * sub-admins."
 *
 * WHY IT IS A DOOR THAT SEALS ITSELF, NOT A DELETE BUTTON
 * A button that wipes the whole business's records, living in a live panel for
 * ever, is the most dangerous thing that could be in it: one wrong click, one
 * confused sub-admin, one stolen password — six months from now, with thousands
 * of real orders behind it. It is needed EXACTLY ONCE, so after it runs this
 * page becomes a receipt and the button never comes back.
 *
 * THE PART THAT IS EASY TO MISS, AND IS SAID OUT LOUD HERE
 * Star ratings are stored ON the shop and rider rows, not worked out from the
 * reviews table. Delete every review and Fashion Clothes still shows 5.0 from
 * 3 reviews — stars given by Sana's own testers, shown to the first real
 * customer as if earned. The screen names that separately so the person
 * pressing the button can see it is handled.
 */

import { useCallback, useEffect, useState } from "react";
import { Rocket, ShieldAlert, Lock, RefreshCw, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";
import { Button, ErrorState } from "@/components/ui";

/** A count the server could not read comes back as -1. On a page with a button
 *  that cannot be undone, "?" is the only honest way to draw that — a 0 is a
 *  number somebody will believe. */
const n = (v: any) => (Number(v) < 0 ? "?" : String(Number(v) ?? 0));

export default function GoLivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);

  // The three choices. Defaults are the recommendations, so doing nothing is
  // the safe outcome.
  const [keepCustomers, setKeepCustomers] = useState(true);
  const [keepAudit, setKeepAudit] = useState(true);
  const [keepDistances, setKeepDistances] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await apiClient.getGoLiveStatus());
    } catch (err) {
      setData(null);
      setError(errorMessage(err, "the launch status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const phrase: string = data?.confirm_phrase ?? "CLEAR ALL TEST DATA";
  const armed = typed.trim() === phrase;

  const run = async () => {
    if (!armed) return;
    try {
      setRunning(true);
      const res = (await apiClient.goLive({
        confirm: typed.trim(),
        keep_customers: keepCustomers,
        keep_audit_log: keepAudit,
        keep_distances: keepDistances,
      })) as any;
      toast(res?.message || "Takal is live.", "success");
      setTyped("");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the clear"), "error");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <p className="text-takal-ink-soft">Loading…</p>;
  }
  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-takal-ink">Go Live</h2>
        <ErrorState message={error} denied={error.includes("permission")} onRetry={load} />
      </div>
    );
  }

  // ── ALREADY LIVE: a receipt, and no button ───────────────────────────────
  if (data?.is_live) {
    const s = data.summary || {};
    return (
      <div className="space-y-6 max-w-3xl">
        <h2 className="text-xl font-bold text-takal-ink">Go Live</h2>

        <div className="bg-takal-green-soft border-2 border-takal-green rounded-lg p-5 flex gap-3">
          <CheckCircle2 className="w-6 h-6 text-takal-green shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-takal-ink">
              Takal went live on {fmtDateTime(data.went_live_at)}
            </p>
            <p className="text-sm text-takal-ink mt-1 leading-relaxed">
              Cleared by <strong>{data.went_live_by || "an admin"}</strong>. Every
              order since then is from a real customer.
            </p>
            {Object.keys(s).length > 0 && (
              <p className="text-sm text-takal-ink-soft mt-2 leading-relaxed">
                Removed: {n(s.orders)} orders, {n(s.order_items)} order lines,{" "}
                {n(s.notifications)} notifications, {n(s.reviews)} reviews and{" "}
                {n(s.star_ratings)} star ratings.{" "}
                Kept: {n(s.kept_shops)} shops, {n(s.kept_products)} products,{" "}
                {n(s.kept_categories)} categories and {n(s.kept_accounts)} accounts.
              </p>
            )}
          </div>
        </div>

        <div className="border border-dashed border-takal-line rounded-lg p-5 text-center">
          <p className="font-bold text-takal-ink-soft flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> This can only be done once, and it has been done.
          </p>
          <p className="text-sm text-takal-ink-soft mt-2 leading-relaxed max-w-xl mx-auto">
            The button is gone for every admin, including you. Re-opening it needs
            a developer to change the database on purpose — which is the point: a
            &ldquo;delete everything&rdquo; button that lives in the panel for
            ever is the most dangerous thing that could be in it.
          </p>
        </div>

        <div className="bg-white border border-takal-line rounded-lg p-5">
          <p className="text-xs font-bold text-takal-ink-soft tracking-wide">
            YOUR TEST DATA IS STILL SAFE
          </p>
          <p className="text-sm mt-2 leading-relaxed">
            A full copy sits in the database under{" "}
            <strong>_backup_launch</strong>. Nothing reads it and it costs
            nothing to leave alone.
          </p>
          <p className="text-xs text-takal-ink-soft mt-1">
            Delete it after a week of real trading, once you are sure nothing was
            needed.
          </p>
        </div>
      </div>
    );
  }

  // ── STILL A TEST SYSTEM ──────────────────────────────────────────────────
  const c = data?.will_clear ?? {};
  const k = data?.will_keep ?? {};

  const Row = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between px-4 py-2 text-sm border-b border-takal-line last:border-0">
      <span>{label}</span><span className="font-bold tabular-nums">{n(value)}</span>
    </div>
  );

  const Choice = ({ on, set, label, hint }: {
    on: boolean; set: (v: boolean) => void; label: string; hint: string;
  }) => (
    <label className="flex gap-3 items-start py-3 border-b border-takal-line last:border-0 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-takal-green shrink-0" />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-takal-ink-soft leading-relaxed mt-0.5">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Go Live</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            Clear everything your internal testers did, so the real business
            starts from zero.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}
          onClick={load}>Refresh</Button>
      </div>

      <div className="bg-takal-orange-soft border-2 border-takal-orange rounded-lg p-5 flex gap-3">
        <Rocket className="w-6 h-6 text-takal-orange shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-takal-ink">Takal is in TEST MODE</p>
          <p className="text-sm text-takal-ink mt-1 leading-relaxed">
            Everything below was created by your internal testers. Clearing it
            once, here, is how the real business starts from zero — with a copy
            of the old data kept safe, and every rate, shop, product and photo
            untouched.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#F3C9CE] rounded-lg overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-bold tracking-wide bg-takal-red-soft
                        text-[#A31B29] border-b border-takal-line">
            THIS WILL BE CLEARED
          </p>
          <Row label="Orders" value={c.orders} />
          <Row label="Order lines" value={c.order_items} />
          <Row label="Notifications" value={c.notifications} />
          <Row label="Reviews" value={c.reviews} />
          <Row label="Payments to shops" value={c.shop_payouts} />
          <Row label="Payments to riders" value={c.rider_payouts} />
          <Row label="Cash handed in" value={c.cash_handovers} />
          {/* Named on its own because deleting the reviews does NOT remove the
              stars — they are stored on the shop and rider rows. */}
          <div className="flex justify-between px-4 py-2 text-sm bg-takal-yellow-soft
                          border-t border-takal-line">
            <span className="font-bold">Star ratings reset to zero</span>
            <span className="font-bold tabular-nums">{n(data?.star_ratings_to_reset)}</span>
          </div>
        </div>

        <div className="bg-white border border-takal-line rounded-lg overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-bold tracking-wide bg-takal-green-soft
                        text-[#186040] border-b border-takal-line">
            THIS WILL BE KEPT
          </p>
          <Row label="Shops" value={k.shops} />
          <Row label="Products" value={k.products} />
          <Row label="Categories" value={k.categories} />
          <Row label="Accounts" value={k.accounts} />
          <Row label="Saved road distances" value={k.distances} />
          <Row label="Audit log" value={k.audit_log} />
          <div className="flex justify-between px-4 py-2 text-sm border-t border-takal-line">
            <span>Your rates, offices, promo codes, banners, photos</span>
            <span className="font-bold">all</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-takal-line rounded-lg p-4">
        <p className="text-xs font-bold text-takal-ink-soft tracking-wide mb-1">
          THREE CHOICES
        </p>
        <Choice on={keepCustomers} set={setKeepCustomers}
          label={`Keep the tester customer accounts (${n(k.customers)})`}
          hint="Their orders go either way — this only decides whether the accounts and saved addresses stay. Recommended ON." />
        <Choice on={keepAudit} set={setKeepAudit}
          label={`Keep the audit log (${n(k.audit_log)} entries)`}
          hint="Who changed what, and every failed login. Your only evidence if anything is ever disputed. Recommended ON." />
        <Choice on={keepDistances} set={setKeepDistances}
          label={`Keep the saved road distances (${n(k.distances)})`}
          hint="Real journeys around Swat that you have already paid the map service for. Clearing them makes you pay again. Recommended ON." />
      </div>

      <div className="bg-white border-2 border-takal-red rounded-lg p-5">
        <p className="font-bold text-[#A31B29] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          This cannot be undone, and can only be done once
        </p>
        <p className="text-sm mt-2 leading-relaxed">
          A copy of everything is saved first, and nothing is deleted unless that
          copy succeeds. It all happens together or not at all.{" "}
          <strong>After this runs, the button is sealed for good</strong> — no
          admin can ever press it again, on purpose or by accident.
        </p>
        <p className="text-sm mt-2">
          To continue, type <strong>{phrase}</strong> below.
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={phrase}
          spellCheck={false}
          autoComplete="off"
          className={`w-full mt-2 px-3 py-2 rounded-lg font-mono text-sm outline-none border ${
            armed
              ? "border-takal-ink ring-2 ring-takal-yellow bg-white"
              : "border-takal-line bg-takal-page"}`}
        />
        <div className="flex items-center gap-2 mt-3">
          <Button variant="danger" disabled={!armed} loading={running} onClick={run}
            title={armed ? undefined : `Type "${phrase}" exactly to continue`}>
            Clear test data and go live
          </Button>
          <Button variant="secondary" onClick={() => setTyped("")} disabled={running}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-takal-ink-soft mt-3 leading-relaxed">
          Only an admin given the <strong>Go Live</strong> permission can see
          this page — it is off for every sub-admin unless you tick it yourself
          on Admin Users. Your name and the time are written to the audit log.
        </p>
      </div>
    </div>
  );
}
