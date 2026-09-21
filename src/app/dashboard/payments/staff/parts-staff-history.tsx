"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WHAT HAS MOVED BETWEEN ONE MEMBER OF STAFF AND THE OFFICE.
//
// Mock 101, approved by Sana on 21 September 2026.
//
// Until today the staff pay screen had two buttons - Record payment and
// Cash in - and nothing else. No list of what had already been paid, and no
// way back from a mistake. You mean Rs 500, your finger slips, you record
// Rs 5,000, and the only way out is editing the database by hand.
//
// TWO THINGS THIS SCREEN IS CAREFUL ABOUT
//
//  1. A CANCELLED ROW IS STILL SHOWN. Struck through, marked, carrying the
//     reason and the name of whoever cancelled it. Books are not rubbed out -
//     hiding a cancellation hides the mistake and whoever made it.
//
//  2. THE TOTALS LEAVE CANCELLED ROWS OUT. liveTotal does that in the one
//     place the whole panel shares, so this screen cannot drift away from the
//     server's own answer.
//
// Both lists come from one call, because the question somebody actually asks
// is "what has moved between this person and the office", and answering it
// from two screens is how the two get compared wrongly.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money, fmtDate } from "@/lib/format";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { liveTotal, isCancelled } from "@/lib/money-void";
import { Button, Modal, ErrorState, EmptyState } from "@/components/ui";
import { CancelPaymentDialog } from "@/app/dashboard/payments/parts-cancel-dialog";

type Row = any;

/** One line of the history: a payment out, or cash handed back in. */
type Entry = Row & { _kind: "payout" | "handover" };

export function StaffMoneyHistory({
  person,
  canCancel,
  onClose,
  onChanged,
}: {
  /** The staff row the History button was pressed on, or null for closed. */
  person: Row | null;
  /** Main Admin only. The server checks again; this only hides the button. */
  canCancel: boolean;
  onClose: () => void;
  /** Called after a cancellation, so the pay run behind this reloads - the
   *  "already paid" and "to pay" figures both move the moment one is made. */
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReadFailure>(null);
  const [cancelTarget, setCancelTarget] = useState<Entry | null>(null);

  const userId = person?.user_id;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const d = (await apiClient.getStaffMoneyHistory(userId)) as any;
      const payouts: Entry[] = (d?.payouts || []).map((r: Row) => ({ ...r, _kind: "payout" }));
      const handovers: Entry[] = (d?.handovers || []).map((r: Row) => ({ ...r, _kind: "handover" }));
      // One list, newest first. Two tables side by side is how somebody reads
      // a payment as a hand-in and decides the person is square when they are
      // not.
      setRows([...payouts, ...handovers].sort(
        (a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")),
      ));
    } catch (err) {
      // A REFUSED OR FAILED READ IS NOT "NOTHING HAS BEEN PAID".
      // On the screen where somebody decides what is still owed, those two
      // must never look the same.
      setRows([]);
      setError(readFailure(err, "this person's payment history"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const paid = liveTotal(rows.filter((r) => r._kind === "payout"));
  const handed = liveTotal(rows.filter((r) => r._kind === "handover"));

  return (
    <>
      <Modal
        open={!!person}
        onClose={onClose}
        title={person ? `${person.name || "Staff"} — payment history` : ""}
        hint="Every payment out and every cash hand-in, newest first. Cancelled rows are still listed; they are left out of the totals."
      >
        {error ? (
          <ErrorState message={error.message} denied={error.denied} onRetry={load} />
        ) : loading ? (
          <p className="py-6 text-center text-sm text-takal-ink-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            message="No payment and no cash hand-in has been recorded for this person."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-takal-line px-3 py-2">
                <div className="text-xs text-takal-ink-soft">Paid out, all-time</div>
                <div className="text-lg font-bold">{money(paid)}</div>
              </div>
              <div className="rounded-lg border border-takal-line px-3 py-2">
                <div className="text-xs text-takal-ink-soft">Cash handed in, all-time</div>
                <div className="text-lg font-bold">{money(handed)}</div>
              </div>
            </div>

            <ul className="divide-y divide-takal-line">
              {rows.map((r) => {
                const off = isCancelled(r);
                return (
                  <li key={`${r._kind}-${r.id}`}
                      className={`py-3 flex items-start gap-3 ${off ? "bg-takal-red-soft/40 -mx-2 px-2 rounded" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${off ? "line-through text-takal-ink-soft" : "text-takal-ink"}`}>
                          {money(r.amount)}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-takal-page text-takal-ink-soft">
                          {r._kind === "payout" ? "Paid out" : "Cash handed in"}
                        </span>
                        {off && (
                          <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-takal-red-soft text-takal-red">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-takal-ink-soft mt-1">
                        {fmtDate(r.paid_at)}
                        {r.method ? ` · ${r.method}` : ""}
                        {r.reference ? ` · ref ${r.reference}` : ""}
                      </div>
                      {off && (
                        // THE REASON IS THE POINT OF KEEPING THE ROW. Six
                        // months later this is what tells a typing slip from a
                        // payment somebody quietly made disappear.
                        <div className="text-xs text-takal-red mt-1">
                          Cancelled {fmtDate(r.voided_at)} — “{r.void_reason || "no reason recorded"}”
                        </div>
                      )}
                    </div>
                    {canCancel && !off && (
                      <Button size="sm" variant="secondary"
                        onClick={() => setCancelTarget(r)}>Cancel</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Modal>

      {/* The SAME window the shop and rider payments use. One way to cancel a
          payment, one set of words, one place the reason is insisted on. */}
      <CancelPaymentDialog
        open={!!cancelTarget}
        amount={money(cancelTarget?.amount)}
        what={person?.name ? `to ${person.name}` : ""}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason: string) => {
          if (!cancelTarget?.id) {
            toast("This row has no id, so it cannot be cancelled here.", "error");
            return;
          }
          try {
            if (cancelTarget._kind === "payout") {
              await apiClient.cancelStaffPayout(String(cancelTarget.id), reason);
            } else {
              await apiClient.cancelStaffHandover(String(cancelTarget.id), reason);
            }
            toast("Cancelled. It no longer counts as money paid.", "success");
            setCancelTarget(null);
            // BOTH have to be re-read, and in this order. This list is where
            // the cancellation shows; the pay run behind it is where "already
            // paid" and "to pay" move. Leaving the second out means the screen
            // underneath still shows the mistake as money paid.
            await load();
            onChanged();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Could not cancel it", "error");
            // The figures here may already have moved, so they are re-read
            // even on a failure - deciding from a stale list is the fault this
            // whole screen exists to prevent.
            await load().catch(() => {});
          }
        }}
      />
    </>
  );
}
