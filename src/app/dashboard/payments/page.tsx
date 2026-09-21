"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { newIdempotencyKey } from "@/lib/api-core";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";

// This page was 724 lines. The three "record a payment" windows were lifted out
// on 2026-08-30; the page keeps its address and its default export.
import { PayStoreDialog } from "./parts-store-dialog";
import { RestaurantBalancesTab } from "./parts-tab-restaurants";
import { RiderMoney } from "@/domains/riders/RiderMoney";
import { PaymentHistoryTab } from "./parts-tab-history";
import { CancelPaymentDialog } from "./parts-cancel-dialog";
import { liveTotal } from "@/lib/money-void";
import { getMyPerms } from "@/lib/perms";
import { money, signed, signedTone } from "./money";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";
import {
  DEFAULT_WINDOW_VALUE, daysParam, monthWindows, parseWindow, sameDates,
  windowLabel, type MoneyWindow,
} from "@/lib/money-window";


export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  // Warnings the SERVER sends when part of a money figure could not be read.
  // A payouts page whose "already paid" column failed to load shows the FULL
  // amount as still owing — which is how a vendor or rider gets paid twice.
  // The server now says so; this is where we show it.
  const [incomplete, setIncomplete] = useState<string[]>([]);
  // Parts of the page that failed on their own. Kept separate from `error`,
  // which means the whole page failed.
  const [partErrors, setPartErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<"restaurants" | "riders" | "history">("restaurants");
  // WHICH STRETCH OF TIME THIS SCREEN IS LOOKING AT.  (Mock 102, 21 Sep 2026.)
  // One value, not three. It used to be a rolling day count AND an index into
  // the pay periods, and every place that needed to know which was chosen had
  // to ask both; adding months would have made it three. See lib/money-window.
  const [windowValue, setWindowValue] = useState<string>(DEFAULT_WINDOW_VALUE);
  const [q, setQ] = useState("");
  // Real pay periods (this week / last week / your 10-day cycle), read from
  // the payout settings so this dropdown always matches how you actually pay.
  const [payPeriods, setPayPeriods] = useState<
    { label: string; from: string; to: string }[]
  >([]);

  // What each shop earned, was paid, and is still owed INSIDE the chosen
  // window - empty unless a pay period or a month is chosen. This is the whole
  // point of Mock 102: the amount offered in the pay window has to come from
  // the same stretch of time as the week it names.
  const [winFigures, setWinFigures] = useState<Record<string, any>>({});
  // Set when the window figures could NOT be read. The pay box then falls back
  // to the all-time balance and SAYS SO - it must never quietly offer an
  // all-time amount while a week is showing, which is the exact fault being
  // fixed here.
  const [winFailed, setWinFailed] = useState(false);

  // Cancel-a-payment window. Money audit M3: a payment typed wrong used to be
  // uncorrectable - no edit, no delete, and a minus refused by the server AND
  // the database. Main Admin only; the check is repeated on the server.
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [canCancelPayments, setCanCancelPayments] = useState(false);

  // Record-payment modal
  const [payTarget, setPayTarget] = useState<any | null>(null);
  /** Index into `periodOptions`, or "" for a payment that is not for one week. */
  const [payPeriod, setPayPeriod] = useState<string>("");
  /** The grey (or red) line under the Amount box, explaining where it came from. */
  const [payWhy, setPayWhy] = useState<{ text: string; bad?: boolean } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  // The one-time key for the window that is open now (Audit, 20 Sep 2026).
  const [payKey, setPayKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Rider figures are still LOADED here, because the summary cards at the top
  // ("You owe Riders", "Cash still with Riders") and the CSV export both need
  // them. What is gone is the second copy of the rider TABLES and the two
  // "record it" windows - those live in one shared component now, used by both
  // this page and the Riders section. See domains/riders/RiderMoney.tsx.
  const [riderRows, setRiderRows] = useState<any[]>([]);
  const [cashRows, setCashRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const p = (await apiClient.getSettlementPeriods()) as any;
        setPayPeriods(p?.periods ?? []);
      } catch {
        /* pay periods are a convenience; the rolling windows still work */
      }
    })();
  }, []);

  // localStorage is only there in the browser, so this is read after mount
  // rather than during the first render.
  useEffect(() => {
    setCanCancelPayments(getMyPerms().isSuper);
  }, []);

  // The two months are worked out once per mount, in Pakistan time. Doing it
  // on every render would make a new object each time and restart the fetch
  // below for ever.
  const months = useMemo(() => monthWindows(), []);
  const chosen: MoneyWindow = parseWindow(windowValue, payPeriods, months);

  // `chosen` is rebuilt on every render, so depending on the OBJECT would loop.
  // Depend on what it SAYS instead - the same trick RiderMoney already uses.
  const chosenKey = JSON.stringify(chosen);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const dParam = daysParam(chosen);
      const gaps: string[] = [];
      // Parts of this page can fail on their own without the whole page
      // failing. Collect those so the operator is told which figures are
      // missing, instead of reading a blank tab as "nothing to pay".
      const partFailures: string[] = [];
      const noteGaps = (r: any) => {
        if (r?.incomplete && r?.incomplete_warning) gaps.push(r.incomplete_warning);
      };
      const recon = (await apiClient.getRestaurantPayoutReconciliation(dParam)) as any;
      noteGaps(recon);
      setRows(recon?.restaurants || []);
      // These three used to turn ANY failure into an empty list. On the page
      // where somebody decides who gets paid, "no payouts recorded yet" and
      // "we could not load the payouts" must never look the same.
      try {
        const hist = (await apiClient.getPayoutHistory()) as any;
        setHistory(hist?.history || []);
      } catch (err) {
        setHistory([]);
        partFailures.push(errorMessage(err, "the payout history"));
      }
      try {
        const rp = (await apiClient.getRiderPayoutsReport()) as any;
        noteGaps(rp);
        setRiderRows(rp?.payouts || []);
      } catch (err) {
        setRiderRows([]);
        partFailures.push(errorMessage(err, "what riders are owed"));
      }
      try {
        // Was called with no arguments, so the Cash (COD) tab ignored the
        // period dropdown completely and always showed all-time figures.
        const cash = (await apiClient.getRiderCashReconciliation(
          chosen.kind === "dates" ? undefined : dParam,
          chosen.kind === "dates" ? chosen.from : undefined,
          chosen.kind === "dates" ? chosen.to : undefined,
        )) as any;
        noteGaps(cash);
        setCashRows(cash?.riders || []);
      } catch (err) {
        setCashRows([]);
        partFailures.push(errorMessage(err, "rider cash"));
      }
      // ── WHAT THIS WINDOW OWES, per shop.  (Mock 102.) ────────────────
      // Only asked when a real stretch of time is chosen. On "All time" and
      // the rolling windows nothing extra is asked and this screen behaves
      // exactly as it did before, which is why those paths cannot regress.
      if (chosen.kind === "dates") {
        try {
          const st = (await apiClient.getStoreSettlements({
            from: chosen.from, to: chosen.to,
          })) as any;
          const byId: Record<string, any> = {};
          for (const row of st?.stores || []) byId[String(row.store_id)] = row;
          setWinFigures(byId);
          setWinFailed(false);
        } catch (err) {
          // NOT a page failure. The balances above are real and still usable;
          // what is lost is the ability to offer a per-week amount, and
          // openPay() below says so in red rather than quietly offering the
          // all-time figure next to a week.
          setWinFigures({});
          setWinFailed(true);
          partFailures.push(errorMessage(err, "what this period owes"));
        }
      } else {
        setWinFigures({});
        setWinFailed(false);
      }
      setIncomplete(Array.from(new Set(gaps)));
      setPartErrors(partFailures);
    } catch (err) {
      setError(readFailure(err, "the payment figures"));
    } finally {
      setLoading(false);
    }
  };

  // THE WEEKS THE PAY WINDOW IS ALLOWED TO NAME.
  //
  // The pay periods the server lists, plus the chosen window itself when that
  // is a MONTH - a month is a perfectly good thing to pay for, and it is not
  // in the server's pay-period list. Put first so it is the one found below.
  const periodOptions = useMemo(() => {
    if (chosen.kind !== "dates") return payPeriods;
    if (payPeriods.some((p) => sameDates(chosen, p))) return payPeriods;
    return [{ label: chosen.label, from: chosen.from, to: chosen.to }, ...payPeriods];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriods, chosenKey]);

  /** Where the chosen window sits in that list, or "" if it is not a window. */
  const chosenOptionValue = (() => {
    if (chosen.kind !== "dates") return "";
    const i = periodOptions.findIndex((p) => sameDates(chosen, p));
    return i >= 0 ? String(i) : "";
  })();

  const openPay = (r: any) => {
    setPayTarget(r);
    setMethod("cash");
    setReference("");
    // ONE KEY PER WINDOW, NOT PER PRESS OF SAVE.  (Audit, 20 September 2026.)
    // Made here so that pressing Save a second time after an unclear failure
    // is answered by the server with the FIRST answer, instead of paying
    // again. See requestOnce in api-core.ts.
    setPayKey(newIdempotencyKey());
    // ── THE AMOUNT AND THE WEEK MUST COME FROM THE SAME STRETCH OF TIME ──
    //
    // Mock 102, approved by Sana on 21 September 2026. This replaces the
    // stop-gap of 20 September, which emptied the week box because the amount
    // was always the ALL-TIME balance and naming a week for it was a lie.
    //
    // Khan Restaurant owed Rs 47,500 across six weeks. Paying that with "Last
    // period" showing marked ONE week paid Rs 47,500 against Rs 8,200 earned,
    // left the other five still owing, and they were paid again on the next
    // run. The server ties a payment that names a week to that week ALONE, so
    // a wrong week is worse than no week.
    //
    // Now the two agree: choose a week or a month and the amount becomes that
    // window's figure, so the week can safely fill itself in again.
    const allTime = Math.max(0, Math.round(Number(r.outstanding) || 0));
    const win = chosen.kind === "dates"
      ? winFigures[String(r.restaurant_id)]
      : undefined;

    if (chosen.kind !== "dates") {
      // A rolling window or All time. There is no week to name, and the
      // all-time balance is the right offer.
      setAmount(String(allTime));
      setPayPeriod("");
      setPayWhy(null);
    } else if (winFailed) {
      // CASE 3, AND THE ONE THAT MATTERS. Falling back to the all-time amount
      // while still showing a week is the exact fault being fixed. So the week
      // goes back to "not for one week" AND the screen says why, in red.
      setAmount(String(allTime));
      setPayPeriod("");
      setPayWhy({
        bad: true,
        text: "The figure for this period could not be read, so the all-time "
            + "balance is shown instead and no week is named.",
      });
    } else {
      const toPay = Math.max(0, Math.round(Number(win?.to_pay) || 0));
      const earned = Math.round(Number(win?.earned) || 0);
      setAmount(toPay > 0 ? String(toPay) : "");
      // Naming the week is only honest when the amount came from it. With
      // nothing to pay there is no payment, so no week is named either.
      setPayPeriod(toPay > 0 ? chosenOptionValue : "");
      if (toPay > 0) {
        setPayWhy({
          text: `What ${r.name || "this shop"} earned between ${chosen.from} and `
              + `${chosen.to}, less what has already been paid for it. `
              + `All-time balance ${money(allTime)} — choose "All time" above `
              + `to pay that instead.`,
        });
      } else if (earned <= 0) {
        // CASE 1: nothing earned in this window, but the shop may still be owed.
        setPayWhy({
          text: `Nothing was earned between ${chosen.from} and ${chosen.to}. `
              + `All-time balance ${money(allTime)} — choose "All time" above `
              + `to pay that.`,
        });
      } else {
        // CASE 2: the window is settled. Nobody pays a week twice by holding
        // the button down.
        setPayWhy({
          text: `This period is settled — ${money(earned)} earned and already `
              + `paid. All-time balance ${money(allTime)} — choose "All time" `
              + `above to pay that.`,
        });
      }
    }
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      setSaving(true);
      // periodOptions, NOT payPeriods: when a month is chosen it is the first
      // entry of that list and exists nowhere else, so reading the old list
      // here would send the wrong dates or none at all.
      const _p = payPeriod === "" ? null : periodOptions[Number(payPeriod)];
      await apiClient.recordRestaurantPayout({
        restaurant_id: payTarget.restaurant_id,
        amount: Number(amount),
        method,
        reference: reference || undefined,
        // THE WEEK IT PAYS FOR. A payment that names its period counts
        // against that period and no other, so paying Monday for last week
        // no longer leaves last week still asking for the money.
        ...(_p ? { period_from: _p.from, period_to: _p.to } : {}),
      }, payKey);
      setPayTarget(null);
      toast("Payment recorded", "success");
      await fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record payment", "error");
      // RE-READ THE FIGURES AFTER A FAILURE.  (Audit, 20 September 2026.)
      // The window stays open with the amount still in it, so the balance
      // behind it must not stay as it was before the attempt - it may well
      // have gone through. The key above makes a second press safe either way.
      await fetchData().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = rows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const riderOutstanding = riderRows.reduce((s, r) => s + (Number(r.outstanding) || 0), 0);
  const commissionEarned = rows.reduce((s, r) => s + (Number(r.commission) || 0), 0);
  const cashOutstanding = cashRows.reduce((s, r) => s + (Number(r.cash_outstanding) || 0), 0);

  // Search filters (per active tab) + payment-method breakdown
  const lc = q.toLowerCase();
  const fRows = rows.filter((r) => (r.name || "").toLowerCase().includes(lc));
  const fRiderRows = riderRows.filter((r) => (r.name || "").toLowerCase().includes(lc) || (r.phone || "").includes(q));
  const fCashRows = cashRows.filter((r) => (r.name || "").toLowerCase().includes(lc) || (r.phone || "").includes(q));
  const fHistory = history.filter((h) => (h.restaurant_name || "").toLowerCase().includes(lc) || (h.method || "").toLowerCase().includes(lc));
  // CANCELLED PAYMENTS ARE STILL LISTED, BUT THEY ARE NOT MONEY, so they are
  // left out of these totals. liveTotal does the skipping in one place so the
  // rule cannot drift between here and the server. Money audit M3.
  const methodTotals = Array.from(
    new Set(history.map((h) => h.method || "other")),
  ).reduce((acc: Record<string, number>, m) => {
    const forThisMethod = history.filter((h) => (h.method || "other") === m);
    const total = liveTotal(forThisMethod);
    if (total > 0 || forThisMethod.some((h) => !h.voided_at)) acc[m] = total;
    return acc;
  }, {});

  const exportCurrent = () => {
    // downloadCsv returns false when the current tab has no rows. Say so out
    // loud - a button that appears to do nothing reads as a broken button.
    let done = false;
    if (tab === "riders") {
      // Rider payouts and rider cash are one tab now, so the export covers
      // both - it used to be two separate downloads for one conversation.
      const owedOk = downloadCsv("rider-payouts.csv", fRiderRows, [
        { key: "name", label: "Rider" }, { key: "phone", label: "Phone" },
        { key: "owed", label: "Owed" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
      const cashOk = downloadCsv("rider-cash.csv", fCashRows, [
        { key: "name", label: "Rider" }, { key: "deliveries", label: "Deliveries" },
        { key: "cash_collected", label: "Cash Collected" }, { key: "handed_over", label: "Handed Over" },
        { key: "cash_outstanding", label: "Cash Still Held" },
      ]);
      done = owedOk || cashOk;
    }
    else if (tab === "history")
      done = downloadCsv("payout-history.csv", fHistory, [
        { key: "paid_at", label: "Date" }, { key: "restaurant_name", label: "Restaurant" },
        { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "reference", label: "Reference" },
        // A spreadsheet that does not say a payment was cancelled adds it up
        // as real money the moment somebody drags the Amount column.
        { key: "voided_at", label: "Cancelled On" },
        { key: "void_reason", label: "Cancelled Because" },
      ]);
    else
      done = downloadCsv("restaurant-balances.csv", fRows, [
        { key: "name", label: "Restaurant" }, { key: "orders", label: "Orders" },
        { key: "food_sales", label: "Food Sales" }, { key: "commission", label: "Commission" },
        { key: "payout_due", label: "Payout Due" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" },
      ]);
    if (!done) toast("Nothing to export on this tab.", "info");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Named "Payouts" in the sidebar: this page is money going OUT to
              stores and riders, not payments coming in from customers. */}
          <h2 className="text-xl font-bold text-takal-ink">Balances &amp; Payments</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            <strong>Answers: what does this shop or rider owe, all-time?</strong>{" "}
            Use this to record a payment. For what a single pay period comes to,
            use the <strong>By Pay Period</strong> tab.
          </p>
          <p className="text-takal-ink-soft mt-1">
            What you owe stores and riders, and what you have already paid.
            Balances are all-time; the filter below changes the activity shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCurrent}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchData} denied={error.denied} />
      )}

      {/* Part of the figures below could not be read. Say so before anyone
          pays from them, and take the pay buttons away until it is refreshed —
          a warning nobody has to act on is a warning people learn to skip. */}
      {/* A tab that failed to load shows an empty table, which on THIS page
          reads as "nothing to pay". Say which figures are actually missing. */}
      {partErrors.length > 0 && (
        <div className="bg-takal-orange-soft border-2 border-[#FFD2BF] text-[#C8410F] px-4 py-3 rounded-lg">
          <p className="font-semibold">⚠️ Some figures on this page did not load</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {partErrors.map((m, i) => (<li key={i}>{m}</li>))}
          </ul>
          <p className="mt-1 text-sm">
            An empty tab below does <strong>not</strong> mean there is nothing to pay.
          </p>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-takal-red hover:brightness-110 text-white rounded text-sm font-bold"
          >
            Try again
          </button>
        </div>
      )}

      {incomplete.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 px-4 py-3 rounded-lg">
          <p className="font-semibold">⚠️ These figures are incomplete — do not pay from them yet</p>
          <ul className="mt-1 list-disc list-inside text-sm">
            {incomplete.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary.
          FIVE CARDS THAT READ "Rs 0" AFTER A FAILED READ.
          Rs 0 next to "You owe Stores" is a decision, not a blank: it says the
          shops are square. When the figures could not be read the truth is
          "not known", and these now say so. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Colour means something here: amber = you owe it and must pay out,
            green = money you earned, red = your money still out with riders.
            These were all red before, which read as if every figure was an
            error. */}
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">You owe Stores</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(totalOutstanding, "text-amber-600")}`}>
            {error ? "not known" : signed(totalOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">You owe Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(riderOutstanding, "text-amber-600")}`}>
            {error ? "not known" : signed(riderOutstanding)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Commission you earned</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : "text-emerald-600"}`}>{error ? "not known" : money(commissionEarned)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Cash still with Riders</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : signedTone(cashOutstanding, "text-red-600")}`}>
            {error ? "not known" : signed(cashOutstanding)}
          </h3>
        </div>
        {/* This figure was already being worked out on every page load and then
            thrown away - the card that was meant to show it was never added.
            Slate, not amber or red: it is settled money, nothing to act on. */}
        <div className="bg-white rounded-lg border border-takal-line p-5">
          <p className="text-takal-ink-soft text-xs font-medium">Already paid to Stores</p>
          <h3 className={`text-2xl font-bold mt-1 ${error ? "text-takal-ink-soft text-base" : "text-takal-ink"}`}>{error ? "not known" : money(totalPaid)}</h3>
        </div>
      </div>

      {/* Toolbar: search + period */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm"
        />
        <select
          value={windowValue}
          onChange={(e) => setWindowValue(e.target.value)}
          className="px-3 py-2 border border-takal-line rounded-lg outline-none text-sm"
        >
          {payPeriods.length > 0 && (
            <optgroup label="Pay periods">
              {payPeriods.map((p, i) => (
                <option key={`pp-${i}`} value={`pp:${i}`}>
                  {p.label} ({p.from} to {p.to})
                </option>
              ))}
            </optgroup>
          )}
          {/* MONTHS.  (Sana, 21 September 2026.)  "Last 30 days" is not
              September: it moves every day, so two people opening this on
              different days see different money and neither is wrong. A month
              has a first and a last day, and it is what shops are paid on. */}
          <optgroup label="Months">
            {months.map((m, i) => (
              <option key={`m-${i}`} value={`m:${i}`}>
                {m.kind === "dates" ? `${m.label} (${m.from} to ${m.to})` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Rolling windows">
            <option value="d:7">Last 7 days</option>
            <option value="d:30">Last 30 days</option>
            <option value="d:90">Last 90 days</option>
            <option value="d:all">All time</option>
          </optgroup>
        </select>
      </div>
      {chosen.kind === "dates" && (
        <p className="text-xs text-takal-ink-soft -mt-1">
          Showing {windowLabel(chosen)}. The balances in the table below are
          always <strong>all-time</strong> — a debt does not disappear because
          you changed the date filter. What changes is the amount the
          <strong> Pay</strong> button offers, which is what this window owes.
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-takal-line">
        {([
          ["restaurants", "Store Payouts"],
          // "Rider Payouts" and "Cash (COD)" used to be two separate tabs here,
          // each with its own copy of a table and a dialog. They are one tab
          // now, drawn by the SAME component the Riders section uses - so a
          // rider's figures cannot read one way here and another way there.
          ["riders", "Rider Payouts & Cash"],
          ["history", "History"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? "border-takal-yellow text-takal-ink"
                : "border-transparent text-takal-ink-soft hover:text-takal-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Restaurant payouts tab */}
      {tab === "restaurants" && (
        <RestaurantBalancesTab
          fRows={fRows}
          incomplete={incomplete}
          loading={loading}
          openPay={openPay}
        />
      )}

      {/* Rider payouts AND cash, from the one shared component. It loads its
          own figures from the same two endpoints this page used to call, and
          carries its own two "record it" windows. */}
      {tab === "riders" && (
        <RiderMoney
          period={
            chosen.kind === "dates"
              // The LABEL travels too (Mock 102). Without it the rider pay
              // window could only call a month by its two dates, and the week
              // it names would read "2026-09-01 to 2026-09-30" instead of
              // "This month - September 2026".
              ? { kind: "period", label: chosen.label, from: chosen.from, to: chosen.to }
              : { kind: "days", days: chosen.days }
          }
          search={q}
        />
      )}

      {/* Payout history tab */}
      {tab === "history" && (
        <PaymentHistoryTab
          fHistory={fHistory}
          methodTotals={methodTotals}
          canCancel={canCancelPayments}
          onCancel={(row) => setCancelTarget(row)}
        />
      )}

      {/* Record payment modal */}
      <PayStoreDialog
        payPeriods={periodOptions}
        payPeriod={payPeriod}
        setPayPeriod={setPayPeriod}
        payWhy={payWhy}
        amount={amount}
        method={method}
        money={money}
        payTarget={payTarget}
        reference={reference}
        saving={saving}
        setAmount={setAmount}
        setMethod={setMethod}
        setPayTarget={setPayTarget}
        setReference={setReference}
        submitPay={submitPay}
      />

      {/* Cancel a payment recorded wrongly. Money audit M3. */}
      <CancelPaymentDialog
        open={!!cancelTarget}
        amount={money(cancelTarget?.amount)}
        what={cancelTarget?.restaurant_name ? `to ${cancelTarget.restaurant_name}` : ""}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          if (!cancelTarget?.id) {
            toast("This payment has no id, so it cannot be cancelled here.", "error");
            return;
          }
          try {
            await apiClient.cancelRestaurantPayout(String(cancelTarget.id), reason);
            toast("Payment cancelled. Record the right amount as a new payment.", "success");
            setCancelTarget(null);
            // Every balance on this page was built on that payment, so they
            // are all re-read rather than patched up here.
            await fetchData();
          } catch (err) {
            toast(errorMessage(err, "cancelling this payment"), "error");
          }
        }}
      />

    </div>
  );
}
