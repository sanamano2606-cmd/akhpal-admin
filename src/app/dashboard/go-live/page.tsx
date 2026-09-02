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
import { Rocket, ShieldAlert, Lock, RefreshCw, CheckCircle2, Eraser } from "lucide-react";
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
  // TWO ACTIONS, TWO BOXES. Sana, 2 September 2026: "If I want to clear it and
  // then want the testers to test again, so will it be done again?" The first
  // version merged the two and sealed itself, so the answer was no — and a
  // second round of testing would have left tester orders in the books at
  // launch. Clearing is now repeatable; only Go Live closes the door.
  const [typedClear, setTypedClear] = useState("");
  const [typedLive, setTypedLive] = useState("");
  const [running, setRunning] = useState<"" | "clear" | "go_live">("");

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

  const clearPhrase: string = data?.confirm_phrase ?? "CLEAR ALL TEST DATA";
  const livePhrase: string = data?.go_live_phrase ?? "GO LIVE FOR REAL";
  const armedClear = typedClear.trim() === clearPhrase;
  const armedLive = typedLive.trim() === livePhrase;

  const run = async (mode: "clear" | "go_live") => {
    const confirm = (mode === "go_live" ? typedLive : typedClear).trim();
    // What the books said BEFORE we asked. If the connection drops we compare
    // against this to work out what really happened, instead of guessing.
    const before = Number(data?.clears_so_far ?? 0);
    try {
      setRunning(mode);
      const res = (await apiClient.goLive({
        confirm,
        mode,
        keep_customers: keepCustomers,
        keep_audit_log: keepAudit,
        keep_distances: keepDistances,
      })) as any;
      toast(res?.message || "Done.", "success");
      setTypedClear("");
      setTypedLive("");
      await load();
      return;
    } catch (err) {
      // ── "MAY OR MAY NOT HAVE GONE THROUGH" IS NOT GOOD ENOUGH HERE ────
      //
      // That is the panel's honest answer for an ordinary write it could not
      // confirm. On an action that cannot be undone it is the worst possible
      // thing to leave somebody holding — found live on 2 September 2026,
      // when the clear was cut off by a 15-second limit and the owner had no
      // way to tell whether her books had just been emptied.
      //
      // It does not have to be a guess. The database counts every clear, so
      // asking it again gives a real answer. Nothing here re-runs the clear;
      // it only reads.
      try {
        const now = (await apiClient.getGoLiveStatus()) as any;
        setData(now);
        const after = Number(now?.clears_so_far ?? 0);
        if (now?.is_live) {
          toast("It DID go through — Takal is now live and the test data is "
                + "cleared.", "success");
          setTypedClear(""); setTypedLive("");
          return;
        }
        if (after > before) {
          toast("It DID go through — the test data was cleared. The message "
                + "from the server was just lost on the way back.", "success");
          setTypedClear(""); setTypedLive("");
          return;
        }
        // AND SAY WHY. The first version of this stopped at "try again",
        // which is what she was told four times on 2 September 2026 while the
        // database was saying "DELETE requires a WHERE clause" into a log she
        // cannot see. The server now sends the reason; this puts it on screen.
        toast("Nothing was deleted — the clear did not run. It all happens "
              + "together or not at all, so your data is exactly as it was. "
              + errorMessage(err, mode === "go_live" ? "the launch" : "the clear"),
              "error");
        return;
      } catch {
        // Even the check failed, so the connection really is down. Now — and
        // only now — the honest answer is that we do not know.
        toast(errorMessage(err, mode === "go_live" ? "the launch" : "the clear"),
              "error");
      }
    } finally {
      setRunning("");
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
            <strong>{data.last_backup_schema || "_backup_test_…"}</strong>
            {(data.clears_so_far ?? 0) > 1 && (
              <> — one for each of the {data.clears_so_far} times you cleared</>
            )}. Nothing reads them and they cost nothing to leave alone.
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

      {/* ── 1. THE EVERYDAY ONE. As many times as testing needs. ────────── */}
      <div className="bg-white border-2 border-takal-orange rounded-lg p-5">
        <p className="font-bold text-takal-ink flex items-center gap-2">
          <Eraser className="w-5 h-5 text-takal-orange" />
          Clear the test data — you can do this again
        </p>
        <p className="text-sm mt-2 leading-relaxed">
          Wipes everything above so your testers can start from zero again.{" "}
          <strong>Takal stays in test mode</strong>, and you can do this as many
          times as you need. A copy is saved first, and nothing is deleted unless
          that copy succeeds.
        </p>
        {(data?.clears_so_far ?? 0) > 0 && (
          <p className="text-sm mt-2 text-takal-ink-soft">
            You have done this <strong>{data.clears_so_far}</strong>{" "}
            {data.clears_so_far === 1 ? "time" : "times"} already
            {data.last_cleared_at && <> — last on <strong>{fmtDateTime(data.last_cleared_at)}</strong></>}.
          </p>
        )}
        <p className="text-sm mt-2">
          To continue, type <strong>{clearPhrase}</strong> below.
        </p>
        <input
          type="text"
          value={typedClear}
          onChange={(e) => setTypedClear(e.target.value)}
          placeholder={clearPhrase}
          spellCheck={false}
          autoComplete="off"
          className={`w-full mt-2 px-3 py-2 rounded-lg font-mono text-sm outline-none border ${
            armedClear
              ? "border-takal-ink ring-2 ring-takal-yellow bg-white"
              : "border-takal-line bg-takal-page"}`}
        />
        <div className="flex items-center gap-2 mt-3">
          <Button disabled={!armedClear || running !== ""}
            loading={running === "clear"} onClick={() => run("clear")}
            title={armedClear ? undefined : `Type "${clearPhrase}" exactly to continue`}>
            Clear test data
          </Button>
          <Button variant="secondary" onClick={() => setTypedClear("")}
            disabled={running !== ""}>Cancel</Button>
        </div>
        {/* The server copies sixteen tables and empties seventeen. On a free
            plan that is not instant, and a silent wait reads as a hang. */}
        {running === "clear" && (
          <p className="text-sm text-takal-ink-soft mt-2">
            Working… this can take up to a minute. It is copying everything to a
            backup first. <strong>Do not close this page.</strong>
          </p>
        )}
      </div>

      {/* ── 2. THE ONE-WAY ONE. Its own phrase, so three routine clears can
              never build the muscle memory that types the launch away. ───── */}
      <div className="bg-white border-2 border-takal-red rounded-lg p-5">
        <p className="font-bold text-[#A31B29] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          Go live — this is the last clear, and it cannot be undone
        </p>
        <p className="text-sm mt-2 leading-relaxed">
          Does the same clear, and then <strong>closes the door for good</strong>.
          After this, neither button ever comes back — no admin can press either
          one again, on purpose or by accident. Every order from that moment is
          from a real customer.
        </p>
        <p className="text-sm mt-2 font-bold text-[#A31B29]">
          Only press this when you are finished testing for good.
        </p>
        <p className="text-sm mt-2">
          To continue, type <strong>{livePhrase}</strong> below — a different
          phrase from the button above, on purpose.
        </p>
        <input
          type="text"
          value={typedLive}
          onChange={(e) => setTypedLive(e.target.value)}
          placeholder={livePhrase}
          spellCheck={false}
          autoComplete="off"
          className={`w-full mt-2 px-3 py-2 rounded-lg font-mono text-sm outline-none border ${
            armedLive
              ? "border-takal-red ring-2 ring-takal-red-soft bg-white"
              : "border-takal-line bg-takal-page"}`}
        />
        <div className="flex items-center gap-2 mt-3">
          <Button variant="danger" disabled={!armedLive || running !== ""}
            loading={running === "go_live"} onClick={() => run("go_live")}
            title={armedLive ? undefined : `Type "${livePhrase}" exactly to continue`}>
            Clear and GO LIVE for good
          </Button>
          <Button variant="secondary" onClick={() => setTypedLive("")}
            disabled={running !== ""}>Cancel</Button>
        </div>
        {running === "go_live" && (
          <p className="text-sm text-takal-ink-soft mt-2">
            Working… this can take up to a minute. It is copying everything to a
            backup first. <strong>Do not close this page.</strong>
          </p>
        )}
        <p className="text-xs text-takal-ink-soft mt-3 leading-relaxed">
          Only an admin given the <strong>Go Live</strong> permission can see
          this page — it is off for every sub-admin unless you tick it yourself
          on Admin Users. Your name and the time are written to the audit log.
        </p>
      </div>
    </div>
  );
}
