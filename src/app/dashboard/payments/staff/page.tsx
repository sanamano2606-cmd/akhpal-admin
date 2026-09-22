"use client";

/**
 * STAFF PAY — the office staff who carry marketplace parcels.
 *
 * WHY THIS PAGE EXISTS
 * Takal delivers two ways and only one of them was in the money system. A food
 * order goes to a RIDER, who has a wage on every order, a cash ledger and a
 * line on the pay run. A parcel goes to a member of OFFICE STAFF, who had none
 * of those. Measured on the live database on 2 September 2026: every parcel
 * order recorded a wage of Rs 0, and Rs 15,562 of customer cash they had
 * collected was tracked on no screen at all.
 *
 * THE RULE (Sana, 2 September 2026)
 *   "Monthly salary with daily limited deliveries and when exceed so they get
 *    some for that."   "Yes they also handover all."
 *
 * TWO TABLES, TWO ACCOUNTS, NEVER ADDED TOGETHER.
 *   Salary & bonus   what Takal owes THEM
 *   Cash held        what they owe the TILL
 * Netting the two into one number is exactly how four separate screens came to
 * disagree about what a rider owed. It is not being repeated here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, Wallet, Coins, Banknote, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { newIdempotencyKey } from "@/lib/api-core";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import { money } from "@/lib/format";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { canAccess, getMyPerms } from "@/lib/perms";
import { StaffMoneyHistory } from "./parts-staff-history";
import {
  Button, Card, CardHeader, Table, Modal, Money, ErrorState, EmptyState,
  type Column,
} from "@/components/ui";

type Row = any;

/** Adds a column up across the rows ON SCREEN, so a search that narrows the
 *  table narrows its total with it. A total that ignores the filter above it
 *  is a total nobody can check by hand. */
const total = (rows: Row[], pick: (r: Row) => any) =>
  rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);

/** The months a pay change may START in: the next three, then this one, then
 *  the last twelve - newest first.
 *
 *  AHEAD OF TODAY IS A REAL CASE, not a mistake. A rise agreed in September to
 *  begin in October is normal, and the server already keeps it out of what the
 *  person is on today until that month arrives (money audit M10). Offering only
 *  past months would force the office to come back on the 1st and remember.
 *
 *  Deliberately NOT the same list as the pay-run month picker: there is no such
 *  thing as looking at next month's pay run. */
function startMonthChoices(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 3; i >= -12; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-GB", { month: "long", year: "numeric" })
             + (i > 0 ? " (not started yet)" : ""),
    });
  }
  return out;
}

/** The last 12 months, newest first, as {value,label}. */
function monthChoices(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

/** `2026-10-01` or `2026-10` -> `Oct 2026`. Empty for anything else, so a
 *  missing date shows nothing rather than "Invalid Date". */
function shortMonth(value?: string | null): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

export default function StaffPayPage() {
  const MONTHS = useMemo(monthChoices, []);
  const START_MONTHS = useMemo(startMonthChoices, []);
  const [month, setMonth] = useState(MONTHS[0].value);
  // This month, as the list above spells it. The "Starts from" box defaults
  // here - a pay change starts in the month it is made (money audit M10).
  const thisMonth = MONTHS[0].value;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  // The three windows. Only ever one open at a time.
  const [terms, setTerms] = useState<Row | null>(null);
  // Changing somebody's salary is a "settings" write, not a "payments" one.
  // The page now opens for either permission, so the raise button has to say
  // no by itself. The server refuses it too - this is the polite half.
  const maySetPay = canAccess("settings");
  const [payTarget, setPayTarget] = useState<Row | null>(null);
  const [handTarget, setHandTarget] = useState<Row | null>(null);
  // WHAT HAS MOVED BETWEEN THIS PERSON AND THE OFFICE.  (Mock 101, 21 Sep 2026.)
  // The server has answered this since the screen was built; nothing in the
  // panel had ever asked it.
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  // Cancelling a payment is Main Admin only. The server checks again - twice,
  // in fact - so this only decides whether the button is drawn.
  const [canCancelPayments, setCanCancelPayments] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pay-terms form
  const [fSalary, setFSalary] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fBonus, setFBonus] = useState("");
  const [fActive, setFActive] = useState(true);
  // WHICH MONTH THESE TERMS START IN. Money audit M10, Mock 112.
  //
  // A pay change starts in the month it is made, for the whole of that month,
  // and never touches an earlier one (Sana, 20 September 2026). It is a box
  // rather than a silent rule so a rise agreed earlier can be back-dated.
  const [fFrom, setFFrom] = useState("");

  // Payment / handover form
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  // The one-time key for whichever money window is open (Audit, 20 Sep 2026).
  const [moneyKey, setMoneyKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = (await apiClient.getStaffPay(month)) as any;
      setData(d);
    } catch (err) {
      setData(null);
      setError(readFailure(err, "the staff pay figures"));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // localStorage is only there in the browser, so this is read after mount
  // rather than during the first render - the same way the Payments page does
  // it. Cancelling a payment is Main Admin only.
  useEffect(() => { setCanCancelPayments(getMyPerms().isSuper); }, []);

  const all: Row[] = data?.staff ?? [];

  // ANYONE who could be handed a parcel is eligible for parcel pay - that has
  // to be the same test the hand-over screen uses, or somebody could be given
  // a parcel and never paid for it. But it also means the Main Admin and every
  // office clerk appear here with a row of zeros, which buries the two people
  // who actually went out. So a person with no pay terms, no parcels and no
  // money is hidden by default and the switch below brings them back - hiding
  // them outright would make a new starter impossible to set up.
  const hasSomething = (r: Row) =>
    r.terms_is_set || (r.parcels_all_time ?? 0) > 0
    || (r.cash_collected ?? 0) > 0 || (r.paid_all_time ?? 0) > 0;
  const quiet = all.filter((r) => !hasSomething(r));

  const lc = q.trim().toLowerCase();
  const rows = (showAll ? all : all.filter(hasSomething))
    .filter((r) => !lc || (r.name || "").toLowerCase().includes(lc));
  const t = data?.totals ?? {};
  // Some figures could not be read. On a page somebody pays from, an empty
  // table must never be mistaken for "nothing to pay".
  const blocked = Boolean(data?.incomplete);

  // ── actions ──────────────────────────────────────────────────────────────
  const openTerms = (r: Row) => {
    setTerms(r);
    // TODAY'S figures, not the month on screen. Money audit M10: looking at
    // August must not make Save quietly offer August's salary as the current
    // one. current_* is what they are on now; terms_* is the month being
    // viewed. On an older server current_* is absent, so terms_* is used.
    setFSalary(String(r.current_monthly_salary ?? r.terms_monthly_salary ?? 0));
    setFTarget(String(r.current_daily_delivery_target ?? r.terms_daily_delivery_target ?? 0));
    setFBonus(String(r.current_bonus_per_extra_delivery ?? r.terms_bonus_per_extra_delivery ?? 0));
    setFActive((r.current_is_active ?? r.terms_is_active) !== false);
    // The month on screen when it is one nobody wrote terms for - that is the
    // hole the office opened this form to fill. Otherwise this month, which is
    // the rule. Never a month that already has terms and is only being read.
    setFFrom(r.terms_not_recorded_for_this_month ? month : thisMonth);
  };

  const saveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) return;
    const tgt = Number(fTarget) || 0;
    const bon = Number(fBonus) || 0;
    // Said here as well as on the server, so the answer arrives before the
    // round trip rather than as a red box afterwards.
    if (bon > 0 && tgt <= 0) {
      toast("Set the parcels-per-day target as well. With a target of 0 the "
            + "bonus would be paid on every parcel, not on the extra ones.",
            "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.setStaffPayTerms(terms.user_id, {
        monthly_salary: Number(fSalary) || 0,
        daily_delivery_target: tgt,
        bonus_per_extra_delivery: bon,
        is_active: fActive,
        effective_from: fFrom || undefined,
      });
      setTerms(null);
      toast("Pay terms saved", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the pay terms"), "error");
    } finally {
      setSaving(false);
    }
  };

  const openPay = (r: Row) => {
    setPayTarget(r);
    setAmount(String(Math.max(0, Math.round(Number(r.to_pay) || 0))));
    setMethod("cash");
    setReference("");
    // One key per window, not per press of Save (Audit, 20 September 2026).
    // A second press after an unclear failure is then answered with the first
    // answer instead of paying a salary twice.
    setMoneyKey(newIdempotencyKey());
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setSaving(true);
      await apiClient.recordStaffPayout({
        user_id: payTarget.user_id,
        amount: Number(amount),
        // Salary and bonus are kept apart in the record so "how much of this
        // month was bonus" never has to be worked out again afterwards.
        kind: Number(payTarget.salary_due) > 0 ? "salary" : "bonus",
        method,
        reference: reference || undefined,
        // Stamped with the month, so paying August never changes September.
        period_from: data?.from,
        period_to: data?.to,
      }, moneyKey);
      setPayTarget(null);
      toast("Payment recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the payment"), "error");
      // The window stays open with the amount in it, so re-read the figures:
      // it may well have gone through (Audit, 20 September 2026).
      await load().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const openHandover = (r: Row) => {
    setHandTarget(r);
    setAmount(String(Math.max(0, Math.round(Number(r.cash_still_held) || 0))));
    setMethod("cash");
    setReference("");
    setMoneyKey(newIdempotencyKey());
  };

  const submitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handTarget) return;
    try {
      setSaving(true);
      await apiClient.recordStaffCashHandover({
        user_id: handTarget.user_id,
        amount: Number(amount),
        method,
        reference: reference || undefined,
      }, moneyKey);
      setHandTarget(null);
      toast("Cash handover recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the handover"), "error");
      await load().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const ok = downloadCsv(`staff-pay-${month}.csv`, rows, [
      { key: "name", label: "Staff" },
      { key: "parcels", label: "Parcels" },
      { key: "days_worked", label: "Days worked" },
      { key: "extra_deliveries", label: "Over target" },
      { key: "salary_due", label: "Salary" },
      { key: "bonus_due", label: "Bonus" },
      { key: "already_paid", label: "Already paid" },
      { key: "to_pay", label: "To pay this month" },
      { key: "paid_all_time", label: "Paid all-time" },
      { key: "cash_collected", label: "Cash collected" },
      { key: "cash_handed_in", label: "Handed in" },
      { key: "cash_still_held", label: "Still holding" },
    ]);
    if (!ok) toast("Nothing to export for this month.", "info");
  };

  // ── tables ───────────────────────────────────────────────────────────────
  const nameCell = (r: Row) => (
    <span className="font-bold text-takal-ink">
      {r.name}
      {/* whitespace-nowrap + inline-block: without them "NO PAY TERMS SET"
          broke across two lines on the live screen and pushed the row apart. */}
      {r.terms_is_set ? (
        <span className="ml-2 inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5
                         rounded bg-takal-page text-takal-ink-soft border border-takal-line
                         align-middle">
          {r.terms_daily_delivery_target}/day · {money(r.terms_bonus_per_extra_delivery)}
        </span>
      ) : (
        /* TWO DIFFERENT PROBLEMS, TWO DIFFERENT WORDS. Money audit M10.
           "No terms for this month" - they HAVE pay terms, those terms just
           started later, so this month was never priced. Back-date them if
           they really were owed.
           "No pay terms set" - nobody has ever set this person up.
           Telling the office the same thing for both sends them to the wrong
           screen, and on the older answer (no such field) it reads exactly as
           it always did. */
        <span className="ml-2 inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5
                         rounded bg-takal-orange-soft text-[#B8410F] border border-[#FFD2BF]
                         font-bold align-middle">
          {r.terms_not_recorded_for_this_month
            ? "NO TERMS FOR THIS MONTH" : "NO PAY TERMS SET"}
        </span>
      )}
      {!r.still_here && (
        <span className="block text-[11px] text-takal-red font-bold">
          No longer delivery staff
        </span>
      )}
    </span>
  );

  const payColumns: Column<Row>[] = [
    { key: "name", header: "Staff", cell: nameCell, total: () => "TOTAL" },
    { key: "parcels", header: "Parcels", numeric: true,
      cell: (r) => r.parcels ?? 0,
      total: (rs) => total(rs, (r) => r.parcels) },
    { key: "days", header: "Days", numeric: true, hideOnSmall: true,
      cell: (r) => r.days_worked ?? 0 },
    { key: "over", header: "Over target", numeric: true,
      cell: (r) => (!r.terms_is_set ? <span className="text-takal-disabled-text">—</span>
        : r.extra_deliveries > 0
          ? <strong className="text-takal-green">{r.extra_deliveries}</strong>
          : <span className="text-takal-disabled-text">0</span>),
      total: (rs) => total(rs, (r) => r.extra_deliveries) },
    { key: "salary", header: "Salary", numeric: true,
      /* WHICH TERMS THIS FIGURE CAME FROM. Money audit M10: a salary that
         changes when somebody gets a rise, with nothing saying why, is a
         salary somebody will "correct". Absent on an older server, and then
         the cell reads exactly as it always did. */
      cell: (r) => (r.terms_is_set ? (
        <>
          <Money value={r.salary_due} />
          {shortMonth(r.terms_effective_from) && (
            <span className="block text-[10px] font-normal text-takal-ink-soft whitespace-nowrap">
              in force since {shortMonth(r.terms_effective_from)}
            </span>
          )}
        </>
      ) : <span className="text-takal-disabled-text">—</span>),
      total: (rs) => <Money value={total(rs, (r) => r.salary_due)} /> },
    { key: "bonus", header: "Bonus", numeric: true,
      cell: (r) => (r.bonus_due > 0
        ? <strong className="text-takal-green"><Money value={r.bonus_due} /></strong>
        : <span className="text-takal-disabled-text">{money(0)}</span>),
      total: (rs) => <Money value={total(rs, (r) => r.bonus_due)} /> },
    { key: "paid", header: "Already paid", numeric: true, hideOnSmall: true,
      cell: (r) => <Money value={r.already_paid} />,
      total: (rs) => <Money value={total(rs, (r) => r.already_paid)} /> },
    { key: "topay", header: "To pay this month", numeric: true,
      cell: (r) => <strong className="text-takal-ink"><Money value={r.to_pay} /></strong>,
      total: (rs) => <Money value={total(rs, (r) => r.to_pay)} /> },
    { key: "alltime", header: "Paid all-time", numeric: true, hideOnSmall: true,
      cell: (r) => <span className="text-takal-ink-soft"><Money value={r.paid_all_time} /></span>,
      total: (rs) => <Money value={total(rs, (r) => r.paid_all_time)} /> },
    { key: "action", header: "", cell: (r) => (
        r.terms_is_set ? (
          <div className="flex gap-2 justify-end">
            <Button size="sm" disabled={blocked || !(r.to_pay > 0)}
              title={blocked ? "Some figures could not be read — refresh before paying"
                : !(r.to_pay > 0) ? "Nothing to pay for this month" : undefined}
              onClick={() => openPay(r)}>
              {r.to_pay > 0 ? "Record payment" : "Nothing to pay"}
            </Button>
            <Button size="sm" variant="secondary" disabled={!maySetPay}
              title={maySetPay ? undefined : "Changing pay needs the Settings permission. Ask the Main Admin."}
              onClick={() => openTerms(r)}>Terms</Button>
            {/* NEW, AND THE ONLY NEW THING ON THIS ROW. Record payment and
                Terms behave exactly as they did. Mock 101. */}
            <Button size="sm" variant="secondary"
              title="Every payment and cash hand-in for this person"
              onClick={() => setHistoryFor(r)}>History</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {/* whitespace-nowrap, measured not guessed: at 1440px and below
                this cell is narrow and the label wrapped into a 68px column
                three lines tall - "Set pay terms" already did it before the
                month was added to it, and the month made it worse. */}
            <Button size="sm" disabled={!maySetPay} className="whitespace-nowrap"
              title={maySetPay ? undefined : "Changing pay needs the Settings permission. Ask the Main Admin."}
              onClick={() => openTerms(r)}>
              {r.terms_not_recorded_for_this_month
                ? `Set terms for ${shortMonth(month)}` : "Set pay terms"}
            </Button>
            {/* Shown even with no pay terms set. Somebody with no terms can
                still have been paid - that is exactly the person whose history
                somebody needs to look at. */}
            <Button size="sm" variant="secondary" className="whitespace-nowrap"
              title="Every payment and cash hand-in for this person"
              onClick={() => setHistoryFor(r)}>History</Button>
          </div>
        )
      ) },
  ];

  const cashColumns: Column<Row>[] = [
    { key: "name", header: "Staff",
      cell: (r) => <span className="font-bold text-takal-ink">{r.name}</span>,
      total: () => "TOTAL" },
    // ALL-TIME, like every other figure in this table. It showed this MONTH's
    // count on the live screen, which made one parcel look like it was worth
    // Rs 15,562.
    { key: "parcels", header: "Parcels carried", numeric: true, hideOnSmall: true,
      cell: (r) => r.parcels_all_time ?? 0,
      total: (rs) => total(rs, (r) => r.parcels_all_time) },
    { key: "collected", header: "Cash collected", numeric: true,
      cell: (r) => <Money value={r.cash_collected} />,
      total: (rs) => <Money value={total(rs, (r) => r.cash_collected)} /> },
    { key: "handed", header: "Handed in", numeric: true, hideOnSmall: true,
      cell: (r) => <Money value={r.cash_handed_in} />,
      total: (rs) => <Money value={total(rs, (r) => r.cash_handed_in)} /> },
    { key: "held", header: "Still holding", numeric: true,
      cell: (r) => (r.cash_still_held > 0
        ? <strong><Money value={r.cash_still_held} tone="out" /></strong>
        : <span className="text-takal-disabled-text">settled</span>),
      total: (rs) => <Money value={total(rs, (r) => r.cash_still_held)} tone="out" /> },
    { key: "action", header: "", cell: (r) => (
        <div className="flex justify-end">
          <Button size="sm" disabled={blocked || !(r.cash_still_held > 0)}
            title={blocked ? "Some figures could not be read — refresh first" : undefined}
            onClick={() => openHandover(r)}>
            {r.cash_still_held > 0 ? "Record handover" : "Nothing owed"}
          </Button>
          {/* The SAME window as the pay table above: one list holding both
              the payments out and the cash hand-ins, because the question is
              "what has moved between this person and the office". */}
          <Button size="sm" variant="secondary" className="ml-2"
            title="Every payment and cash hand-in for this person"
            onClick={() => setHistoryFor(r)}>History</Button>
        </div>
      ) },
  ];

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Staff Pay</h2>
          <p className="text-takal-ink-soft mt-1 text-sm max-w-3xl">
            <strong>Answers: what do I owe the people who carry parcels?</strong>{" "}
            Salary for the month, plus a bonus for parcels above their daily
            target. Cash they collected is a separate account below — they hand
            over everything and are paid back here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
            onClick={exportCsv}>Export CSV</Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}
            onClick={load} loading={loading}>Refresh</Button>
        </div>
      </div>

      {error && (
        <ErrorState message={error.message} denied={error.denied} onRetry={load} />
      )}

      {blocked && (
        <div className="bg-takal-orange-soft border-2 border-[#FFD2BF] text-[#C8410F] px-4 py-3 rounded-lg">
          <p className="font-bold">⚠️ These figures are incomplete — do not pay from them yet</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {(data?.incomplete_parts ?? []).map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
          <p className="mt-1 text-sm">
            An empty table below does <strong>not</strong> mean there is nothing to pay.
          </p>
          <Button variant="danger" size="sm" className="mt-2" onClick={load}>Try again</Button>
        </div>
      )}

      {/* Month + search */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 border border-takal-line rounded-lg outline-none text-sm font-bold bg-white">
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search staff…"
          className="flex-1 min-w-[200px] px-4 py-2 border border-takal-line rounded-lg
                     focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
        {(quiet.length > 0 || showAll) && (
          <label className="flex items-center gap-2 text-sm text-takal-ink-soft
                            cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="w-4 h-4 accent-takal-ink" />
            Show everyone who can carry parcels
            {quiet.length > 0 && ` (${quiet.length} more)`}
          </label>
        )}
      </div>

      {/* Summary.
          THESE FOUR READ "Rs 0" AFTER A FAILED READ, on the screen somebody
          pays staff from. "Rs 0 to pay now" is a decision; "not known" is the
          truth when nothing was read. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Salary due this month</p>
          <h3 className="text-2xl font-bold text-takal-ink mt-1">{error ? "not known" : money(t.salary_due)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Bonus due this month</p>
          <h3 className="text-2xl font-bold text-takal-green mt-1">{error ? "not known" : money(t.bonus_due)}</h3>
          <p className="text-xs text-takal-ink-soft mt-1">
            {total(all, (r) => r.extra_deliveries)} parcels over target
          </p>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5" /> To pay now</p>
          <h3 className="text-2xl font-bold text-takal-orange mt-1">{error ? "not known" : money(t.to_pay)}</h3>
          <p className="text-xs text-takal-ink-soft mt-1">
            Paid all-time {money(t.paid_all_time)}
          </p>
        </div>
        {/* Their side of the books, not yours. Bordered so it reads as
            something to act on rather than another figure to admire. */}
        <div className={`bg-white rounded-lg p-5 border ${
          (t.cash_still_held ?? 0) > 0 ? "border-2 border-takal-orange" : "border-takal-line"}`}>
          <p className="text-takal-ink-soft text-xs font-medium flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Cash staff still hold</p>
          <h3 className={`text-2xl font-bold mt-1 ${
            (t.cash_still_held ?? 0) > 0 ? "text-takal-orange" : "text-takal-ink"}`}>
            {error ? "not known" : money(t.cash_still_held)}
          </h3>
          <p className="text-xs text-takal-ink-soft mt-1">Not yet handed in</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={`Salary & bonus — ${monthLabel}`}
          hint="The salary is owed for the whole month. The bonus is counted day by day, so a very busy Monday still earns its bonus even after a quiet Tuesday."
        />
        <Table
          columns={payColumns}
          rows={rows}
          rowKey={(r) => String(r.user_id)}
          loading={loading}
          empty={error ? (
            // A FAILED READ MUST NOT BECOME A FACT ABOUT WHO IS OWED MONEY.
            <EmptyState
              title="The pay figures could not be read"
              message="Do not pay from this screen until it loads. Use Try again above." />
          ) : (<EmptyState
            title="Nobody to pay for this month"
            message={showAll
              ? "No account has the delivery or orders permission, so nobody can be handed a parcel yet."
              : "Nobody with pay terms carried a parcel this month. Tick “Show everyone who can carry parcels” above to set somebody up."} />)}
        />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Cash staff are holding"
          hint="All-time, and it does NOT reset on the 1st. They hand over every rupee they collect — their salary and bonus never come out of the till, they are paid back in the table above."
        />
        <Table
          columns={cashColumns}
          rows={rows}
          rowKey={(r) => String(r.user_id)}
          loading={loading}
          empty={error ? (
            <EmptyState
              title="The cash figures could not be read"
              message="This is not proof that nobody is holding cash. Use Try again above." />
          ) : (
            <EmptyState
              title="No cash outstanding"
              message="Every staff member has handed in what they collected." />
          )}
        />
      </Card>

      {/* ── Pay terms ─────────────────────────────────────────────────────── */}
      <Modal
        open={terms !== null}
        onClose={() => setTerms(null)}
        title={`Pay terms — ${terms?.name ?? ""}`}
        hint="Parcel delivery staff"
        lockClose={saving}
        footer={
          <div className="flex items-center justify-between w-full gap-4">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={fActive}
                onChange={(e) => setFActive(e.target.checked)}
                className="w-4 h-4 accent-takal-green" />
              Currently working
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setTerms(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="staff-terms-form" loading={saving}>
                Save pay terms
              </Button>
            </div>
          </div>
        }
      >
        <form id="staff-terms-form" onSubmit={saveTerms} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1.5">Monthly salary (Rs)</label>
            <input type="number" min={0} step={1} value={fSalary}
              onChange={(e) => setFSalary(e.target.value)}
              className="w-full px-3 py-2 border border-takal-line rounded-lg
                         focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              Paid for the whole month, whatever the parcel count.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1.5">Parcels per day</label>
              <input type="number" min={0} step={1} value={fTarget}
                onChange={(e) => setFTarget(e.target.value)}
                className="w-full px-3 py-2 border border-takal-line rounded-lg
                           focus:ring-2 focus:ring-takal-yellow outline-none" />
              <p className="text-xs text-takal-ink-soft mt-1">The day&rsquo;s target.</p>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Bonus per extra parcel (Rs)</label>
              <input type="number" min={0} step={1} value={fBonus}
                onChange={(e) => setFBonus(e.target.value)}
                className="w-full px-3 py-2 border border-takal-line rounded-lg
                           focus:ring-2 focus:ring-takal-yellow outline-none" />
              <p className="text-xs text-takal-ink-soft mt-1">For each one above it.</p>
            </div>
          </div>
          {/* ── WHICH MONTH THESE TERMS START IN ──────────────────────────
              Money audit M10, Mock 112 (approved 22 September 2026).

              Before this, pay terms had no date at all: saving a rise wrote
              over the old ones and every past month was re-priced at the new
              salary. August, paid in full and settled, re-opened asking for
              the difference - with the pay button live. */}
          <div className="bg-takal-yellow-soft border border-[#F0E68C] rounded-lg p-3">
            <label className="block text-sm font-bold mb-1.5">
              Starts from
            </label>
            <select value={fFrom} onChange={(e) => setFFrom(e.target.value)}
              className="w-full px-3 py-2 border border-takal-line rounded-lg bg-white
                         focus:ring-2 focus:ring-takal-yellow outline-none">
              {START_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-takal-ink-soft mt-1.5 leading-relaxed">
              These terms apply from this month onwards. Earlier months keep the
              terms they already had, so a month you have paid never re-opens.
              Change it only to back-date a rise that was agreed earlier.
            </p>
            {/* WHAT THEY HAVE BEEN ON. The reassurance that the old figures
                were kept, not written over - which is the whole change. */}
            {Array.isArray(terms?.terms_history) && terms.terms_history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#F0E68C]">
                <p className="text-xs font-bold mb-1.5">
                  What {terms?.name?.split(" ")[0] ?? "they"} has been on
                </p>
                <ul className="text-xs text-takal-ink-soft space-y-1">
                  {terms.terms_history.slice(0, 6).map((h: any) => (
                    <li key={h.effective_from} className="flex justify-between gap-3">
                      <span>{shortMonth(h.effective_from)}</span>
                      <span className="font-bold text-takal-ink">
                        {money(h.monthly_salary)}
                        {h.is_active === false && (
                          <span className="font-normal text-takal-ink-soft"> · not working</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-takal-ink-soft mt-2">
                  Old terms are kept, never written over.
                </p>
              </div>
            )}
          </div>

          {/* Says back, in words, what was just typed in numbers. A pay rule
              nobody can read is a pay rule nobody can check. */}
          <div className="bg-takal-yellow-soft border border-[#F0E68C] rounded-lg p-3 text-sm leading-relaxed">
            <strong>So:</strong>{" "}
            <strong>from {shortMonth(fFrom) || "this month"}</strong>,{" "}
            {terms?.name ? `${terms.name.split(" ")[0]} gets` : "they get"}{" "}
            <strong>{money(fSalary)}</strong> a month
            {Number(fTarget) > 0 && Number(fBonus) > 0 ? (
              <>
                . On any day they deliver more than <strong>{Number(fTarget)}</strong>{" "}
                parcels, they earn <strong>{money(fBonus)}</strong> for each extra one.
                <span className="block text-takal-ink-soft mt-1">
                  Counted day by day — {Number(fTarget) * 2} parcels on Monday and
                  0 on Tuesday still earns {Number(fTarget)} bonuses for the Monday.
                </span>
              </>
            ) : (
              <> and no bonus, because {Number(fTarget) <= 0
                ? "no daily target is set" : "the bonus rate is Rs 0"}.</>
            )}
          </div>
        </form>
      </Modal>

      {/* ── Record a payment ──────────────────────────────────────────────── */}
      <Modal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title="Record a payment"
        hint={payTarget
          ? `${payTarget.name} — ${money(payTarget.to_pay)} due for ${monthLabel}`
          : undefined}
        lockClose={saving}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setPayTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="staff-pay-form" loading={saving}>
              Pay {money(amount)}
            </Button>
          </div>
        }
      >
        <form id="staff-pay-form" onSubmit={submitPay} className="space-y-4">
          <MoneyFields amount={amount} setAmount={setAmount} method={method}
            setMethod={setMethod} reference={reference} setReference={setReference} />
          <p className="text-xs text-takal-ink-soft">
            Stamped for <strong>{monthLabel}</strong>, so paying this month never
            changes another month&rsquo;s figure.
          </p>
        </form>
      </Modal>

      {/* ── Record a cash handover ────────────────────────────────────────── */}
      <Modal
        open={handTarget !== null}
        onClose={() => setHandTarget(null)}
        title="Record a cash handover"
        hint={handTarget
          ? `${handTarget.name} is holding ${money(handTarget.cash_still_held)}`
          : undefined}
        lockClose={saving}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setHandTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="staff-hand-form" loading={saving}>
              Record {money(amount)}
            </Button>
          </div>
        }
      >
        <form id="staff-hand-form" onSubmit={submitHandover} className="space-y-4">
          <MoneyFields amount={amount} setAmount={setAmount} method={method}
            setMethod={setMethod} reference={reference} setReference={setReference} />
          <p className="text-xs text-takal-ink-soft">
            This is money coming <strong>in</strong>. Their salary and bonus are
            paid separately and never come out of it.
          </p>
        </form>
      </Modal>

      {/* ── What has moved between this person and the office ─────────────── */}
      <StaffMoneyHistory
        person={historyFor}
        canCancel={canCancelPayments}
        onClose={() => setHistoryFor(null)}
        // A cancellation moves "already paid" and "to pay" on the table behind
        // this window. Without this the screen underneath goes on showing the
        // mistake as money paid until somebody presses Refresh.
        onChanged={() => { load(); }}
      />
    </div>
  );
}

/** The three fields both money windows need. Written once so the payment and
 *  the handover can never drift into asking for different things. */
function MoneyFields({ amount, setAmount, method, setMethod, reference, setReference }: {
  amount: string; setAmount: (v: string) => void;
  method: string; setMethod: (v: string) => void;
  reference: string; setReference: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-bold mb-1.5">Amount (Rs)</label>
        <input type="number" min={0} step={1} value={amount} required
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 border border-takal-line rounded-lg
                     focus:ring-2 focus:ring-takal-yellow outline-none" />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1.5">How</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-full px-3 py-2 border border-takal-line rounded-lg
                     focus:ring-2 focus:ring-takal-yellow outline-none bg-white">
          {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-bold mb-1.5">
          Reference <span className="font-normal text-takal-ink-soft">(optional)</span>
        </label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
          placeholder="Transaction number, slip number…"
          className="w-full px-3 py-2 border border-takal-line rounded-lg
                     focus:ring-2 focus:ring-takal-yellow outline-none" />
      </div>
    </>
  );
}
