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

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
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
  | { kind: "period"; from: string; to: string };

/** The ways a payout can be paid. It used to be typed out TWICE, in two
 *  dialogs, so switching a provider off in Settings removed it from neither. */
export const PAYOUT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

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
  const openPay = (r: Row) => {
    setPayTarget(r);
    setPayAmount(String(Math.max(0, Math.round(Number(r.outstanding) || 0))));
    setPayMethod("cash");
    // START ON THE PERIOD WHOSE FIGURE THE PERSON JUST READ. A blank that has
    // to be chosen every time is a blank that gets skipped, and a skipped
    // week is the whole fault. When the screen is on a rolling window instead
    // (last 30 days), there IS no week, and "" says so.
    const i = period.kind === "period"
      ? payPeriods.findIndex((p) => p.from === period.from && p.to === period.to)
      : -1;
    setPayPeriod(i >= 0 ? String(i) : "");
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setPaySaving(true);
      const _p = payPeriod === "" ? null : payPeriods[Number(payPeriod)];
      await apiClient.recordRiderPayout(
        payTarget.rider_id, Number(payAmount), payMethod,
        _p ? { from: _p.from, to: _p.to } : undefined);
      setPayTarget(null);
      toast("Rider payout recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the payout"), "error");
    } finally {
      setPaySaving(false);
    }
  };

  const openHandover = (r: Row) => {
    setHandTarget(r);
    setHandAmount(String(Math.max(0, Math.round(Number(r.cash_outstanding) || 0))));
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
      });
      setHandTarget(null);
      toast("Cash handover recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the handover"), "error");
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
              type="number" min="0" step="1" required autoFocus
              value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Paid by</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYOUT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {payPeriods.length > 0 && (
            <div>
              <label className="block text-sm font-bold mb-1">
                Which week is this for?
              </label>
              <select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}>
                {payPeriods.map((p, i) => (
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
              type="number" min="0" step="1" required autoFocus
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
