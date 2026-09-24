"use client";

/**
 * THE MONEY BOX ON A SUPPORT CONVERSATION.
 * (Mock 117 FINAL, approved by Sana on 24 September 2026.)
 *
 * The ONLY new thing on that screen. Everything under it is Support exactly as
 * it already was - a complaint does not get a second inbox, and the pictures
 * both ways were not rebuilt.
 *
 * FOUR ANSWERS BEFORE APPROVE. Sana: "who is was responsible for this and the
 * amount deduct from him with a short reason/message saved." The button stays
 * dead until all four are there, and the sentence under it names the ONE thing
 * still missing.
 *
 * THE SERVER IS THE REAL GATE. Everything checked here is checked again there,
 * and the ceiling is a CHECK in the database on top of that. What this file
 * buys is that the office is told while they are still looking at the field.
 */
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import {
  COMPLAINT_PAYERS, MAX_DECISION_NOTE, moneyWhole,
  problemWithDecision, riderKeepsHisEarning, suggestedCharge,
  type MoneyLine, type MoneyOrder,
} from "@/lib/complaint-money";

interface Complaint {
  id: string;
  reason: string;
  wants: string;
  customer_words?: string | null;
  ceiling_amount?: number | string | null;
  status: string;
  who_pays?: string | null;
  decided_amount?: number | string | null;
  charge_amount?: number | string | null;
  decided_note?: string | null;
}

const REASON_WORDS: Record<string, string> = {
  never_arrived: "The order never arrived",
  item_problem: "An item was wrong, bad or missing",
  rider_late: "The rider was late",
  damaged: "It was spilled or damaged",
  other: "Something else",
};

const PAYER_WORDS: Record<string, string> = {
  shop: "The restaurant",
  rider: "The rider",
  takal: "Takal",
  customer: "The customer",
};

// THE ONE MONEY FORMAT. Not a second spelling of it - format.ts owns how an
// amount is written, and tests/format.test.ts holds every screen to it.
const rs = (v: unknown) => money(moneyWhole(v));

export default function ComplaintMoneyBox(
  { complaintId, onDecided }: { complaintId: string; onDecided?: () => void },
) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [order, setOrder] = useState<MoneyOrder>({});
  const [ticked, setTicked] = useState<MoneyLine[]>([]);
  const [tickedWords, setTickedWords] = useState<string[]>([]);
  const [riderEarned, setRiderEarned] = useState<number | null>(null);

  const [whoPays, setWhoPays] = useState<string | null>(null);
  const [refund, setRefund] = useState("");
  const [charge, setCharge] = useState("");
  const [note, setNote] = useState("");
  const [overEarning, setOverEarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverSaid, setServerSaid] = useState("");

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [complaintId]);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await apiClient.getComplaint(complaintId) as any;
      const c = data?.complaint as Complaint;
      setComplaint(c ?? null);
      setOrder((data?.order ?? {}) as MoneyOrder);
      const rows = Array.isArray(data?.ticked) ? data.ticked : [];
      setTickedWords(rows.map((r: any) => `${r?.name ?? ""} — ${rs(r?.you_paid)}`));
      // The office screen only ever needs the SHAPE of the ticked lines to
      // work a figure out, and the server already sent what each one cost.
      setTicked(rows.map((r: any) => ({ price: r?.you_paid, base_price: r?.you_paid, quantity: 1 })));
      setRiderEarned(data?.rider_earned ?? null);
      // Start at what the complaint allows. The office may lower it.
      setRefund(String(moneyWhole(c?.ceiling_amount ?? 0)));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 text-sm text-[#4A4A4A]">Loading the complaint…</div>;
  }
  if (loadFailed || !complaint) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <p className="text-sm text-[#4A4A4A]">This complaint could not be read.</p>
        <button type="button" onClick={() => void load()}
          className="mt-2 rounded-lg border-2 border-[#FFFF00] bg-white px-4 py-2 text-sm font-semibold text-black">
          Try again
        </button>
      </div>
    );
  }

  const wants = complaint.wants || "part";
  const refundNum = refund.trim() === "" ? null : Number(refund);
  const chargeNum = charge.trim() === "" ? null : Number(charge);

  const problem = problemWithDecision({
    order: { ...order, total_amount: order.total_amount },
    picked: ticked,
    wants,
    refund: refundNum,
    charge: chargeNum,
    whoPays,
    note,
    riderEarning: riderEarned,
    overEarningAllowed: overEarning,
  });

  // The ceiling the SERVER froze onto the complaint wins over anything worked
  // out here: a delivery fee edited since is not allowed to move a decision.
  const frozenCeiling = moneyWhole(complaint.ceiling_amount ?? 0);
  const aboveFrozen = refundNum != null && refundNum > frozenCeiling;
  const stop = aboveFrozen
    ? `This complaint allows at most ${rs(frozenCeiling)}. It can be lowered, never raised.`
    : problem;

  const needsMainAdmin = whoPays === "rider" && chargeNum != null
    && riderEarned != null && chargeNum > riderEarned;

  async function decide(approve: boolean) {
    if (saving) return;
    if (approve && stop) return;
    if (!approve && !note.trim()) {
      setServerSaid("Write a short reason for refusing it.");
      return;
    }
    setSaving(true);
    setServerSaid("");
    try {
      await apiClient.decideComplaint(complaintId, {
        approve,
        refund: approve ? refundNum : null,
        charge: approve ? chargeNum : null,
        who_pays: approve ? whoPays : null,
        note: note.trim(),
        charge_rider_past_his_earning: approve && overEarning,
      });
      onDecided?.();
      await load();
    } catch (e: any) {
      setServerSaid(e?.message || "That could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── already decided ───────────────────────────────────────────────────────
  if (complaint.status !== "waiting") {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4A4A4A]">
          {complaint.status === "approved" ? "Refund agreed" : "Refused"}
        </p>
        {complaint.status === "approved" && (
          <p className="mt-1 text-base font-semibold text-black">
            {rs(complaint.decided_amount)} back to the customer
            {complaint.who_pays
              ? ` · ${rs(complaint.charge_amount)} off ${PAYER_WORDS[complaint.who_pays] ?? complaint.who_pays}`
              : ""}
          </p>
        )}
        {complaint.decided_note && (
          <p className="mt-1 text-sm text-[#4A4A4A]">“{complaint.decided_note}”</p>
        )}
      </div>
    );
  }

  // ── waiting for a decision ────────────────────────────────────────────────
  return (
    <div className="rounded-xl border-2 border-black bg-[#FFFDE0] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#4A4A4A]">
        Waiting for you
      </p>

      {/* 1 - what the customer gets back */}
      <div className="mt-3 grid gap-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <span className="text-[#4A4A4A]">What the customer says</span>
          <span className="font-semibold text-black">
            {REASON_WORDS[complaint.reason] ?? complaint.reason}
          </span>
        </div>
        {tickedWords.length > 0 && (
          <div className="flex flex-wrap gap-x-2">
            <span className="text-[#4A4A4A]">Which ones</span>
            <span className="font-semibold text-black">{tickedWords.join(", ")}</span>
          </div>
        )}
        {complaint.customer_words && (
          <p className="text-[#4A4A4A]">“{complaint.customer_words}”</p>
        )}
        <div className="flex flex-wrap gap-x-2">
          <span className="text-[#4A4A4A]">Most that may be given back</span>
          <span className="font-semibold text-black">{rs(frozenCeiling)}</span>
        </div>
      </div>

      <label className="mt-3 block text-sm font-semibold text-black" htmlFor="cm-refund">
        1. What the customer gets back
      </label>
      <input id="cm-refund" type="number" min={0} value={refund}
        onChange={(e) => setRefund(e.target.value)} disabled={saving}
        className="mt-1 w-40 rounded-lg border-2 border-black bg-white px-3 py-2 text-black" />

      {/* 2 - who was responsible */}
      <p className="mt-4 text-sm font-semibold text-black">
        2. Who was responsible? <span className="font-normal text-[#4A4A4A]">you choose, after looking into it</span>
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {COMPLAINT_PAYERS.filter((p) => p !== "customer").map((p) => (
          <button key={p} type="button" disabled={saving}
            onClick={() => {
              setWhoPays(p);
              setOverEarning(false);
              setCharge(String(moneyWhole(
                suggestedCharge(order, ticked, wants, p, refundNum ?? 0))));
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              whoPays === p
                ? "border-2 border-black bg-[#FFFF00] text-black"
                : "border border-[#E5E5E5] bg-white text-black"}`}>
            {PAYER_WORDS[p]}
          </button>
        ))}
      </div>
      {whoPays === "shop" && (
        <p className="mt-1 text-xs text-[#4A4A4A]">
          The shop does not get that order’s money. The rider is still paid in
          full, and Takal carries his fee.
        </p>
      )}
      {whoPays === "rider" && !riderKeepsHisEarning(whoPays, wants) && (
        <p className="mt-1 text-xs text-[#4A4A4A]">
          He earns nothing for this trip, and the shop is untouched.
        </p>
      )}

      {/* 3 - how much comes off him */}
      <label className="mt-4 block text-sm font-semibold text-black" htmlFor="cm-charge">
        3. How much comes off him? <span className="font-normal text-[#4A4A4A]">a separate figure</span>
      </label>
      <input id="cm-charge" type="number" min={0} value={charge}
        onChange={(e) => setCharge(e.target.value)} disabled={saving}
        className="mt-1 w-40 rounded-lg border-2 border-black bg-white px-3 py-2 text-black" />

      {needsMainAdmin && (
        <label className="mt-2 flex items-start gap-2 rounded-lg border-2 border-[#D62839] bg-[#FBE7E9] p-2 text-sm text-black">
          <input type="checkbox" checked={overEarning} disabled={saving}
            onChange={(e) => setOverEarning(e.target.checked)} className="mt-1" />
          <span>
            That is more than the {rs(riderEarned)} he earned on this order.
            Only the Main Admin may go higher, and it is written down.
          </span>
        </label>
      )}

      {/* 4 - why */}
      <label className="mt-4 block text-sm font-semibold text-black" htmlFor="cm-note">
        4. Why? <span className="font-normal text-[#4A4A4A]">saved, and shown to him</span>
      </label>
      <textarea id="cm-note" rows={2} value={note} maxLength={MAX_DECISION_NOTE}
        onChange={(e) => setNote(e.target.value)} disabled={saving}
        className="mt-1 w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-black" />

      {(stop || serverSaid) && (
        <p className="mt-2 text-sm font-semibold text-[#D62839]">
          {serverSaid || stop}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => void decide(false)}
          className="rounded-lg border-2 border-[#FFFF00] bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
          Refuse
        </button>
        <button type="button" disabled={saving || stop !== ""}
          onClick={() => void decide(true)}
          className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm font-bold text-black disabled:bg-[#D9D9D9] disabled:text-[#8A8A8A]">
          {saving ? "Saving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
