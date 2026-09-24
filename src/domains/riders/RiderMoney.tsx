"use client";

/**
 * RIDER MONEY — what riders are owed, and what cash they are holding.
 *
 * WHY THIS IS ONE COMPONENT AND NOT TWO PAGES.
 *
 * Rider money was split across FOUR screens, and could only be FIXED on one:
 *
 *   Riders            showed that a rider was blocked, and linked you elsewhere
 *   Pay Out           showed "cash riders still hold", read-only
 *   Payouts → Riders  the only place a payout could be recorded
 *   Payouts → Cash    the only place a handover could be recorded
 *
 * On the live panel that was not academic: BOTH riders were switched off by the
 * automatic cash limit, and the Riders page - the page you open when a rider
 * cannot work - explained the problem and then sent you to another page to
 * solve it.
 *
 * So this is one component, used in two places: the Riders section, where you
 * go when a rider has a problem, and the Payments section, where you go to do
 * a payment run. SAME code, SAME endpoints, SAME figures. Two doors, never two
 * answers - which is exactly what the panel had before, with the Pay Out and
 * Payouts pages showing different numbers for the same question.
 *
 * NOTHING ABOUT HOW MONEY MOVES HAS CHANGED. The same three server calls, with
 * the same arguments, in the same order - recordRiderPayout and
 * recordCashHandover both still carry the one-time key that stops a resend
 * paying twice.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { newIdempotencyKey } from "@/lib/api-core";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { money, fmtDate } from "@/lib/format";
import { isCancelled, cancelReason } from "@/lib/money-void";
import { getMyPerms } from "@/lib/perms";
import { CancelPaymentDialog } from "@/app/dashboard/payments/parts-cancel-dialog";
import {
  Button, Card, CardHeader, Table, Modal, Money, ErrorState, EmptyState,
  type Column,
} from "@/components/ui";

type Row = any;

/** Adds a column up across whatever rows are ON SCREEN, so a search that
 *  narrows the table narrows the total with it. */
const total = (rows: Row[], pick: (r: Row) => any) =>
  rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);

/** Where the figures should come from. Either a rolling window in days, or an
 *  exact pay period. Passed in so the caller's own period picker still rules. */
export type MoneyPeriod =
  | { kind: "days"; days: number | "all" }
  // `label` was added on 21 September 2026 (Mock 102). A month is a perfectly
  // good thing to pay for, and without its name the dialog below could only
  // call it by its dates.
  | { kind: "period"; label?: string; from: string; to: string };

/** The ways a payout can be paid. It used to be typed out TWICE, in two
 *  dialogs, so switching a provider off in Settings removed it from neither. */
export const PAYOUT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

/** WHOSE CASH LIMITS IS THIS RIDER ON? Mock 118, section 3.
 *
 *  Three answers, and they have to be three different-looking things:
 *
 *      Office · Rs 10,000 · 2 days   he follows the office, like everybody
 *      His own · Rs 10,000 · 5 days  somebody gave him his own figures
 *      Limit off for him             he is never stopped for cash
 *
 *  The figures come from the server, which asks the SAME function the block
 *  that stops him asks. This component paints; it decides nothing.
 *
 *  Colours are the brand kit's: blue for "his own", orange for "needs you",
 *  plain grey for the ordinary case. No new colour. */
function CashLimitChip({ limits }: { limits?: any }) {
  if (!limits) return <span className="text-takal-ink-soft">—</span>;

  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap";

  if (limits.enabled === false) {
    return (
      <span className={base + " bg-takal-orange-soft text-takal-ink border border-takal-orange"}
            title="He is never stopped for holding cash.">
        Limit off for him
      </span>
    );
  }

  const amount = Number(limits.amount) || 0;
  const days = Number(limits.days) || 0;
  const bits = [
    amount > 0 ? money(amount) : "no amount limit",
    days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "no day limit",
  ];

  return limits.is_his_own ? (
    <span className={base + " bg-takal-blue-soft text-takal-ink border border-takal-blue"}
          title="Somebody gave this rider his own figures. Open him to see or change them.">
      His own · {bits.join(" · ")}
    </span>
  ) : (
    <span className={base + " bg-takal-page text-takal-ink-soft border border-takal-line"}
          title="He follows the office default, set on Riders → Cash Limits.">
      Office · {bits.join(" · ")}
    </span>
  );
}

export function RiderMoney({
  period = { kind: "days", days: 30 },
  search = "",
  /** Show only the cash section - used where earnings are not the question. */
  only,
}: {
  period?: MoneyPeriod;
  search?: string;
  only?: "earnings" | "cash";
}) {
  const [owedRows, setOwedRows] = useState<Row[]>([]);
  const [cashRows, setCashRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  /** Warnings the SERVER sends when part of a figure could not be read. A
   *  screen whose "already paid" column failed to load shows the FULL amount
   *  as still owing - which is how somebody gets paid twice. */
  const [incomplete, setIncomplete] = useState<string[]>([]);

  const [payTarget, setPayTarget] = useState<Row | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  // The one-time keys for whichever window is open (Audit, 20 Sep 2026).
  const [payKey, setPayKey] = useState("");
  const [handKey, setHandKey] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  // WHICH WEEK THE PAYMENT IS FOR. Money audit M4, the same hole M2 closed
  // for shops: the By Pay Period screen counts a payment against the period
  // it NAMES, and falls back to the day it was typed only when it names none.
  // So a payment for last week, recorded on Monday, was counted against THIS
  // week - last week still showed as owing (pay twice) and this week showed
  // as already paid (pay too little). "" means all-time, on purpose and in
  // writing; see the note in the dialog.
  const [payPeriods, setPayPeriods] = useState<
    { label: string; from: string; to: string }[]
  >([]);
  const [payPeriod, setPayPeriod] = useState<string>("");
  /** The grey (or red) line under the Amount box, saying where it came from. */
  const [payWhy, setPayWhy] = useState<{ text: string; bad?: boolean } | null>(null);
  // WHAT EACH RIDER EARNED, WAS PAID, AND IS STILL OWED *IN THE CHOSEN WINDOW*.
  // Mock 102, approved 21 September 2026 - the shop screen got this first, and
  // Sana asked for the rider screen to match. Empty unless a real stretch of
  // time is chosen, because on a rolling window there is no week to name.
  const [winFigures, setWinFigures] = useState<Record<string, any>>({});
  // Set when those figures could NOT be read. The amount then falls back to
  // the all-time balance and SAYS SO - it must never quietly offer an
  // all-time amount while a week is showing, which is the whole fault here.
  const [winFailed, setWinFailed] = useState(false);

  const [handTarget, setHandTarget] = useState<Row | null>(null);
  const [handAmount, setHandAmount] = useState("");
  const [handSaving, setHandSaving] = useState(false);

  // WHAT HAS ALREADY BEEN RECORDED, and putting a wrong one right.
  // Money audit M3: until this there was no list of rider payments in the
  // office at all, so a payment typed wrong could not even be FOUND, let alone
  // corrected. Cancelling is Main Admin only; the server checks again.
  const [ledger, setLedger] = useState<Row[]>([]);
  const [canCancel, setCanCancel] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);

  // EVERY LETTER TYPED IN THE SEARCH BOX RE-ASKED THE SERVER FOR THE MONEY.
  //
  // The search box lives on the PARENT page, and the parent hands the period
  // down as a fresh object literal - `period={{ kind: "days", days }}`. A new
  // object every render is a new value to React, so `load` was rebuilt on
  // every keystroke and the effect below ran again: eight letters of a rider's
  // name meant eight full reads of the payout and cash reports on a free
  // server, and the tables flashed back to skeletons each time.
  //
  // The fix is to depend on what the period SAYS, not on the object carrying
  // it. Typing in the search box now filters the rows already on screen, which
  // is all it ever needed to do.
  const periodKey = JSON.stringify(period);

  const load = useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];
    const gaps: string[] = [];
    const noteGaps = (r: any) => {
      if (r?.incomplete && r?.incomplete_warning) gaps.push(r.incomplete_warning);
    };

    // Kept in a local as well as in state, because the recorded-payments list
    // below needs the rider NAMES and setState has not landed by then.
    let riderNames: Record<string, string> = {};
    try {
      const rp = (await apiClient.getRiderPayoutsReport()) as any;
      noteGaps(rp);
      const list = (rp?.payouts || []) as Row[];
      setOwedRows(list);
      riderNames = Object.fromEntries(
        list.map((r) => [String(r.rider_id), String(r.name || "")]));
    } catch (err) {
      setOwedRows([]);
      problems.push(errorMessage(err, "what riders are owed"));
    }

    try {
      const cash = (await apiClient.getRiderCashReconciliation(
        period.kind === "days" ? (period.days === "all" ? undefined : period.days) : undefined,
        period.kind === "period" ? period.from : undefined,
        period.kind === "period" ? period.to : undefined,
      )) as any;
      noteGaps(cash);
      setCashRows(cash?.riders || []);
    } catch (err) {
      setCashRows([]);
      problems.push(errorMessage(err, "rider cash"));
    }

    // WHAT HAS ALREADY BEEN RECORDED - payments out and cash in, one list.
    // Read all-time on purpose: a payment typed wrong last month is exactly
    // the one somebody comes looking for, and a period filter would hide it.
    try {
      const [pays, hands] = await Promise.all([
        apiClient.getRiderPayoutHistory() as Promise<any>,
        apiClient.getRiderHandoverHistory() as Promise<any>,
      ]);
      const named = (r: Row, kind: string) => ({
        ...r, kind,
        rider_name: riderNames[String(r.rider_id)] || "",
      });
      setLedger([
        ...((pays?.history || []) as Row[]).map((r) => named(r, "payout")),
        ...((hands?.history || []) as Row[]).map((r) => named(r, "handover")),
      ].sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || ""))));
    } catch (err) {
      setLedger([]);
      problems.push(errorMessage(err, "what has already been recorded"));
    }

    // ── WHAT THIS WINDOW OWES, per rider.  (Mock 102.) ───────────────────
    // Only asked when a real stretch of time is chosen. On the rolling windows
    // nothing extra is asked and this screen behaves exactly as it did, which
    // is why those paths cannot regress.
    if (period.kind === "period") {
      try {
        const st = (await apiClient.getRiderSettlements({
          from: period.from, to: period.to,
        })) as any;
        const byId: Record<string, any> = {};
        for (const row of st?.riders || []) byId[String(row.rider_id)] = row;
        setWinFigures(byId);
        setWinFailed(false);
      } catch (err) {
        // NOT a whole-screen failure. The balances above are real and still
        // usable; what is lost is the ability to offer a per-week amount, and
        // openPay() below says so in red rather than quietly offering the
        // all-time figure next to a week.
        setWinFigures({});
        setWinFailed(true);
        problems.push(errorMessage(err, "what this period owes"));
      }
    } else {
      setWinFigures({});
      setWinFailed(false);
    }

    setErrors(problems);
    setIncomplete(Array.from(new Set(gaps)));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  useEffect(() => { load(); }, [load]);

  // localStorage only exists in the browser, so this is read after mount.
  useEffect(() => { setCanCancel(getMyPerms().isSuper); }, []);

  // The real pay periods (this week / last week / your 10-day cycle), read
  // from the payout settings so the list always matches how you actually pay.
  useEffect(() => {
    (async () => {
      try {
        const p = (await apiClient.getSettlementPeriods()) as any;
        setPayPeriods(p?.periods ?? []);
      } catch {
        // A convenience. Without it the payment simply has no week named,
        // which is the behaviour every older payment already relies on.
      }
    })();
  }, []);

  const blocked = incomplete.length > 0;
  const blockedWhy = blocked
    ? "Some figures could not be read — refresh before paying"
    : undefined;

  const match = (r: Row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.name || "").toLowerCase().includes(q) || (r.phone || "").includes(q);
  };

  const owed = owedRows.filter(match);
  const cash = cashRows.filter(match);

  // ── recording ────────────────────────────────────────────────────────────

  // THE WEEKS THE PAY WINDOW IS ALLOWED TO NAME.
  //
  // The pay periods the server lists, plus the chosen window itself when that
  // is something else - a MONTH. A month is not in the server's pay-period
  // list, and reading the old list would send the wrong dates or none at all.
  const periodOptions = useMemo(() => {
    if (period.kind !== "period") return payPeriods;
    if (payPeriods.some((p) => p.from === period.from && p.to === period.to)) {
      return payPeriods;
    }
    return [{ label: period.label || `${period.from} to ${period.to}`,
              from: period.from, to: period.to }, ...payPeriods];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriods, periodKey]);

  /** Where the chosen window sits in that list, or "" if it is not a window. */
  const chosenOptionValue = (() => {
    if (period.kind !== "period") return "";
    const i = periodOptions.findIndex(
      (p) => p.from === period.from && p.to === period.to);
    return i >= 0 ? String(i) : "";
  })();

  const openPay = (r: Row) => {
    setPayTarget(r);
    setPayMethod("cash");
    // One key per window, not per press of Save (Audit, 20 September 2026).
    setPayKey(newIdempotencyKey());

    // ── THE AMOUNT AND THE WEEK COME FROM THE SAME STRETCH OF TIME ────────
    //
    // Mock 102, approved by Sana on 21 September 2026, and extended to this
    // screen at her word the same day ("Rider pay screen Yes").
    //
    // The history: on 19 September the week box started on whatever period was
    // on screen. But the amount is `outstanding`, which the table's own note
    // calls an ALL-TIME balance - "a wage does not expire because the date
    // filter moved". So the two boxes disagreed: an all-time amount, named as
    // one week. The server ties a payment that names a week to that week and
    // no other, so the weeks before it stayed owing and were paid again on the
    // next run. On 20 September (audit C4) the week box was emptied to stop
    // the harm. This makes the two AGREE instead.
    const allTime = Math.max(0, Math.round(Number(r.outstanding) || 0));
    const win = period.kind === "period"
      ? winFigures[String(r.rider_id)]
      : undefined;

    if (period.kind !== "period") {
      // A rolling window or all time. There is no week to name, and the
      // all-time balance is the right offer.
      setPayAmount(String(allTime));
      setPayPeriod("");
      setPayWhy(null);
    } else if (winFailed) {
      // THE ONE THAT MATTERS. Falling back to the all-time amount while a week
      // is still showing is the exact fault being fixed here, so the week is
      // dropped AND the screen says why, in red.
      setPayAmount(String(allTime));
      setPayPeriod("");
      setPayWhy({
        bad: true,
        text: "The figure for this period could not be read, so the all-time "
            + "balance is shown instead and no week is named.",
      });
    } else {
      const toPay = Math.max(0, Math.round(Number(win?.to_pay) || 0));
      const earned = Math.round(Number(win?.earned) || 0);
      setPayAmount(toPay > 0 ? String(toPay) : "");
      // Naming the week is only honest when the amount came from it. With
      // nothing to pay there is no payment, so no week is named either.
      setPayPeriod(toPay > 0 ? chosenOptionValue : "");
      if (toPay > 0) {
        setPayWhy({
          text: `What ${r.name || "this rider"} earned between ${period.from} `
              + `and ${period.to}, less what has already been paid for it. `
              + `All-time balance ${money(allTime)} — choose "All time" `
              + `above to pay that instead.`,
        });
      } else if (earned <= 0) {
        setPayWhy({
          text: `Nothing was earned between ${period.from} and ${period.to}. `
              + `All-time balance ${money(allTime)} — choose "All time" `
              + `above to pay that.`,
        });
      } else {
        setPayWhy({
          text: `This period is settled — ${money(earned)} earned and `
              + `already paid. All-time balance ${money(allTime)} — choose `
              + `"All time" above to pay that.`,
        });
      }
    }
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setPaySaving(true);
      // periodOptions, NOT payPeriods: when a month is chosen it is the first
      // entry of that list and exists nowhere else, so reading the old list
      // here would send the wrong dates or none at all.
      const _p = payPeriod === "" ? null : periodOptions[Number(payPeriod)];
      await apiClient.recordRiderPayout(
        payTarget.rider_id, Number(payAmount), payMethod,
        _p ? { from: _p.from, to: _p.to } : undefined, payKey);
      setPayTarget(null);
      toast("Rider payout recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the payout"), "error");
      // The window stays open with the amount in it, so the figures behind it
      // must be re-read - it may well have gone through (Audit, 20 Sep 2026).
      await load().catch(() => {});
    } finally {
      setPaySaving(false);
    }
  };

  const openHandover = (r: Row) => {
    setHandTarget(r);
    setHandAmount(String(Math.max(0, Math.round(Number(r.cash_outstanding) || 0))));
    setHandKey(newIdempotencyKey());
  };

  const submitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handTarget) return;
    try {
      setHandSaving(true);
      await apiClient.recordCashHandover({
        rider_id: handTarget.rider_id,
        amount: Number(handAmount),
        method: "cash",
      }, handKey);
      setHandTarget(null);
      toast("Cash handover recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the handover"), "error");
      await load().catch(() => {});
    } finally {
      setHandSaving(false);
    }
  };

  // ── tables ───────────────────────────────────────────────────────────────
  const owedColumns: Column<Row>[] = [
    { key: "name", header: "Rider", cell: (r) => <span className="font-bold">{r.name || "—"}</span> },
    { key: "phone", header: "Phone", hideOnSmall: true, cell: (r) => r.phone || "—" },
    // Sana, 1 September 2026: "Both Period and All time. Total." These three
    // are ALL-TIME balances — a wage does not expire because the date filter
    // moved — and the TOTAL row below adds them up.
    { key: "owed", header: "Owed (all-time)", numeric: true,
      cell: (r) => <Money value={r.owed} />,
      total: (rows) => <Money value={total(rows, (r) => r.owed)} /> },
    { key: "paid", header: "Paid (all-time)", numeric: true, hideOnSmall: true,
      cell: (r) => <Money value={r.paid} />,
      total: (rows) => <Money value={total(rows, (r) => r.paid)} /> },
    { key: "out", header: "Outstanding", numeric: true,
      cell: (r) => <strong><Money value={r.outstanding} tone="out" /></strong>,
      total: (rows) => <Money value={total(rows, (r) => r.outstanding)} tone="out" /> },
    {
      key: "action", header: "Action",
      cell: (r) => (
        <Button size="sm" disabled={blocked} title={blockedWhy} onClick={() => openPay(r)}>
          Record payout
        </Button>
      ),
    },
  ];

  const cashColumns: Column<Row>[] = [
    { key: "name", header: "Rider", cell: (r) => <span className="font-bold">{r.name || "—"}</span> },
    { key: "deliveries", header: "Deliveries", numeric: true, hideOnSmall: true,
      cell: (r) => r.deliveries ?? 0,
      total: (rows) => total(rows, (r) => r.deliveries) },
    { key: "collected", header: "Cash collected", numeric: true,
      cell: (r) => <Money value={r.cash_collected} />,
      total: (rows) => <Money value={total(rows, (r) => r.cash_collected)} /> },
    { key: "handed", header: "Handed over", numeric: true, hideOnSmall: true,
      cell: (r) => <Money value={r.handed_over} />,
      total: (rows) => <Money value={total(rows, (r) => r.handed_over)} /> },
    { key: "outstanding", header: "Still holding", numeric: true,
      cell: (r) => <strong><Money value={r.cash_outstanding} tone="out" /></strong>,
      total: (rows) => <Money value={total(rows, (r) => r.cash_outstanding)} tone="out" /> },
    // HOW LONG HE HAS HELD IT. A limit in days means nothing without the days,
    // and this is the figure the day rule is actually measured against - the
    // same one the rider's own phone shows him.
    { key: "held_for", header: "Held for", numeric: true, hideOnSmall: true,
      cell: (r) => (Number(r.cash_outstanding) > 0
        ? `${r.days_holding_cash ?? 0} day${(r.days_holding_cash ?? 0) === 1 ? "" : "s"}`
        : "—") },
    // WHICH LIMITS APPLY TO HIM, AND WHOSE THEY ARE - Mock 118.
    //
    // A rider on his own rules has to be visible WITHOUT opening him. A limit
    // set months ago that nobody can see is a limit nobody remembers, and the
    // office finds out about it the day he is stopped - or the day he is not,
    // and should have been.
    { key: "cash_limits", header: "Cash limits", hideOnSmall: true,
      cell: (r) => <CashLimitChip limits={r.cash_limits} /> },
    {
      key: "action", header: "Action",
      cell: (r) => (
        <Button size="sm" disabled={blocked} title={blockedWhy} onClick={() => openHandover(r)}>
          Record handover
        </Button>
      ),
    },
  ];

  // ── what has already been recorded ───────────────────────────────────────
  const ledgerColumns: Column<Row>[] = [
    { key: "paid_at", header: "Date", cell: (r) => fmtDate(r.paid_at) },
    { key: "rider", header: "Rider",
      cell: (r) => <span className="font-bold">{r.rider_name || r.rider_id || "—"}</span> },
    { key: "kind", header: "What",
      cell: (r) => (r.kind === "payout" ? "We paid the rider" : "Rider handed cash in") },
    { key: "amount", header: "Amount", numeric: true,
      cell: (r) => (
        <span className={isCancelled(r) ? "line-through text-takal-ink-soft" : ""}>
          {money(r.amount)}
        </span>
      ) },
    { key: "state", header: "State",
      cell: (r) => (isCancelled(r) ? (
        <div>
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wide
                           bg-takal-red-soft text-takal-red px-2 py-0.5 rounded-full">
            Cancelled
          </span>
          <div className="text-xs text-takal-ink-soft mt-1">
            {cancelReason(r) || "no reason recorded"}
          </div>
        </div>
      ) : (r.method || "—")) },
  ];
  if (canCancel) {
    ledgerColumns.push({
      key: "put-it-right", header: "Put it right", numeric: true,
      cell: (r) => (isCancelled(r) ? (
        <span className="text-xs text-takal-ink-soft">already cancelled</span>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setCancelTarget(r)}>
          Cancel
        </Button>
      )),
    });
  }

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <ErrorState
          message={
            <>
              <strong>Some figures did not load.</strong> {errors.join(" ")} An empty
              table below does <strong>not</strong> mean there is nothing to pay.
            </>
          }
          denied={errors.some((m) => m.includes("permission"))}
          onRetry={load}
        />
      )}

      {blocked && (
        <div className="bg-takal-orange-soft border-2 border-[#FFD2BF] text-[#C8410F] px-4 py-3 rounded-lg">
          <p className="font-bold">⚠️ These figures are incomplete — do not pay from them yet</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {incomplete.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <Button variant="danger" size="sm" className="mt-2" onClick={load}>Try again</Button>
        </div>
      )}

      {only !== "cash" && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Delivery fees owed"
            hint="The wage earned on EVERY delivery, cash or online, less what has already been paid — all-time, not for one period. For what a single pay period comes to, use Payments → By Pay Period. Cash the rider is still holding is the separate table below; the two are never mixed into one number."
            right={<Button variant="secondary" size="sm" onClick={load} loading={loading}>Refresh</Button>}
          />
          <Table
            columns={owedColumns}
            rows={owed}
            rowKey={(r) => String(r.rider_id)}
            loading={loading}
            empty={<EmptyState title="Nothing owed" message="No rider has unpaid delivery fees for this period." />}
          />
        </Card>
      )}

      {only !== "earnings" && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Cash riders are holding"
            hint="The rider hands over EVERYTHING he collected — he does not keep his wage out of the till. His wage is paid back to him separately, in the table above. This is the whole amount he collected in cash, less what he has already handed in. A rider who holds cash for too long is stopped automatically; recording the handover here is what un-stops them."
          />
          <Table
            columns={cashColumns}
            rows={cash}
            rowKey={(r) => String(r.rider_id)}
            loading={loading}
            empty={<EmptyState title="No cash outstanding" message="Every rider has handed in what they collected." />}
          />
        </Card>
      )}

      {/* ── What has already been recorded, and putting a wrong one right ── */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Money already recorded"
          hint="Every rider payment and cash hand-in ever recorded, newest first. A row typed wrongly is CANCELLED, never deleted: it stays here crossed out with the reason on it, stops counting in every total straight away, and the right amount is then recorded as a new row. Only the Main Admin can cancel one."
          right={<Button variant="secondary" size="sm" onClick={load} loading={loading}>Refresh</Button>}
        />
        <Table
          columns={ledgerColumns}
          rows={ledger}
          rowKey={(r) => `${r.kind}-${r.id}`}
          loading={loading}
          empty={<EmptyState title="Nothing recorded yet" message="No rider payment or cash hand-in has been recorded." />}
        />
      </Card>

      <CancelPaymentDialog
        open={!!cancelTarget}
        amount={money(cancelTarget?.amount)}
        what={
          cancelTarget
            ? (cancelTarget.kind === "payout"
                ? `paid to ${cancelTarget.rider_name || "this rider"}`
                : `handed in by ${cancelTarget.rider_name || "this rider"}`)
            : ""
        }
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          if (!cancelTarget?.id) {
            toast("This row has no id, so it cannot be cancelled here.", "error");
            return;
          }
          try {
            if (cancelTarget.kind === "payout") {
              await apiClient.cancelRiderPayout(String(cancelTarget.id), reason);
            } else {
              await apiClient.cancelRiderHandover(String(cancelTarget.id), reason);
            }
            toast("Cancelled. Record the right amount as a new row.", "success");
            setCancelTarget(null);
            // Cancelling a cash hand-in puts that cash back in the rider's
            // hands, which can suspend him again, so every figure is re-read
            // rather than patched up here.
            await load();
          } catch (err) {
            toast(errorMessage(err, "cancelling this row"), "error");
          }
        }}
      />

      {/* ── Record a payout ─────────────────────────────────────────────── */}
      <Modal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        lockClose={paySaving}
        title="Record a rider payout"
        hint={payTarget ? `${payTarget.name || "Rider"} — outstanding ${money(payTarget.outstanding)}` : undefined}
        size="sm"
      >
        <form onSubmit={submitPay} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Amount (Rs)</label>
            <input
              // ONE RUPEE, NOT ZERO.  (Mock 102, 21 September 2026.)
              // min="0" let a payout of Rs 0 be recorded, and the server
              // accepts it too. A Rs 0 payout is not a payout - it is a row in
              // the books that says nothing and has to be explained later. It
              // matters more now the box can open EMPTY on a week with nothing
              // to pay: without this a single stray 0 would record one.
              type="number" min="1" step="1" required autoFocus
              value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
            />
            {/* WHERE THIS AMOUNT CAME FROM.  (Mock 102.)
                Red when the window's figure could not be read - the screen must
                never quietly offer an all-time amount next to a week. The
                all-time balance is named in every case, so an old wage under a
                quiet month can never go invisible. */}
            {payWhy && (
              <p className={`mt-1 text-xs ${payWhy.bad ? "text-takal-red font-medium" : "text-takal-ink-soft"}`}>
                {payWhy.text}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Paid by</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYOUT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {periodOptions.length > 0 && (
            <div>
              <label className="block text-sm font-bold mb-1">
                Which week is this for?
              </label>
              {/* It is chosen by openPay, not here: it starts on the window the
                  amount above was built from, and on "not for one week"
                  whenever it was not. Mock 102. */}
              <select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}>
                {periodOptions.map((p, i) => (
                  <option key={`${p.from}-${p.to}`} value={String(i)}>{p.label}</option>
                ))}
                {/* A NAMED CHOICE, never an empty box. Forcing a week onto a
                    payment that is not for one week would write a period that
                    is not true, and a wrong week is worse than none - the
                    server already falls back to today's date. */}
                <option value="">Not for one week (all-time)</option>
              </select>
              <p className="text-xs text-takal-ink-soft mt-1">
                The By Pay Period screen counts this payment against the week
                named here. Get it wrong and the same money shows as owing
                twice.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPayTarget(null)} disabled={paySaving}>
              Cancel
            </Button>
            {/* The button says what it does, with the figure in it - and the
                figure is written by money() from lib/format, like every other
                amount in the panel. Writing "Rs " by hand here is exactly how
                one order came to be described two different ways. */}
            <Button type="submit" loading={paySaving}>
              Record {money(payAmount)} payout
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Record a cash handover ──────────────────────────────────────── */}
      <Modal
        open={handTarget !== null}
        onClose={() => setHandTarget(null)}
        lockClose={handSaving}
        title="Record a cash handover"
        hint={handTarget ? `${handTarget.name || "Rider"} is holding ${money(handTarget.cash_outstanding)}` : undefined}
        size="sm"
      >
        <form onSubmit={submitHandover} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Cash received (Rs)</label>
            <input
              // ONE RUPEE, NOT ZERO - same as the payout box above.
              // Found on 21 September 2026 while fixing that one. Recording a
              // hand-in of Rs 0 says nothing, clears nothing, and leaves a row
              // somebody has to explain later; the button that opens this
              // window is already off unless the rider is holding something.
              type="number" min="1" step="1" required autoFocus
              value={handAmount} onChange={(e) => setHandAmount(e.target.value)}
            />
            <p className="text-xs text-takal-ink-soft mt-1">
              Count it before you record it. Recording a handover is what clears
              an automatic cash block and lets the rider work again.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setHandTarget(null)} disabled={handSaving}>
              Cancel
            </Button>
            <Button type="submit" loading={handSaving}>
              Record {money(handAmount)} received
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
