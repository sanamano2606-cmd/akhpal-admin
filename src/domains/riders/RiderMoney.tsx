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
import { money } from "@/lib/format";
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

  const [handTarget, setHandTarget] = useState<Row | null>(null);
  const [handAmount, setHandAmount] = useState("");
  const [handSaving, setHandSaving] = useState(false);

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

    try {
      const rp = (await apiClient.getRiderPayoutsReport()) as any;
      noteGaps(rp);
      setOwedRows(rp?.payouts || []);
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

    setErrors(problems);
    setIncomplete(Array.from(new Set(gaps)));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  useEffect(() => { load(); }, [load]);

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
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setPaySaving(true);
      await apiClient.recordRiderPayout(payTarget.rider_id, Number(payAmount), payMethod);
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
