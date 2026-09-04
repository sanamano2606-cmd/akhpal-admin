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
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import { money } from "@/lib/format";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { canAccess } from "@/lib/perms";
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

export default function StaffPayPage() {
  const MONTHS = useMemo(monthChoices, []);
  const [month, setMonth] = useState(MONTHS[0].value);
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
  const [saving, setSaving] = useState(false);

  // Pay-terms form
  const [fSalary, setFSalary] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fBonus, setFBonus] = useState("");
  const [fActive, setFActive] = useState(true);

  // Payment / handover form
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

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
    setFSalary(String(r.terms_monthly_salary ?? 0));
    setFTarget(String(r.terms_daily_delivery_target ?? 0));
    setFBonus(String(r.terms_bonus_per_extra_delivery ?? 0));
    setFActive(r.terms_is_active !== false);
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
      });
      setPayTarget(null);
      toast("Payment recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the payment"), "error");
    } finally {
      setSaving(false);
    }
  };

  const openHandover = (r: Row) => {
    setHandTarget(r);
    setAmount(String(Math.max(0, Math.round(Number(r.cash_still_held) || 0))));
    setMethod("cash");
    setReference("");
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
      });
      setHandTarget(null);
      toast("Cash handover recorded", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the handover"), "error");
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
        <span className="ml-2 inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5
                         rounded bg-takal-orange-soft text-[#B8410F] border border-[#FFD2BF]
                         font-bold align-middle">
          NO PAY TERMS SET
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
      cell: (r) => (r.terms_is_set ? <Money value={r.salary_due} />
        : <span className="text-takal-disabled-text">—</span>),
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
          </div>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" disabled={!maySetPay}
              title={maySetPay ? undefined : "Changing pay needs the Settings permission. Ask the Main Admin."}
              onClick={() => openTerms(r)}>Set pay terms</Button>
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
          {/* Says back, in words, what was just typed in numbers. A pay rule
              nobody can read is a pay rule nobody can check. */}
          <div className="bg-takal-yellow-soft border border-[#F0E68C] rounded-lg p-3 text-sm leading-relaxed">
            <strong>So:</strong>{" "}
            {terms?.name?.split(" ")[0] ?? "They"} get{" "}
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
