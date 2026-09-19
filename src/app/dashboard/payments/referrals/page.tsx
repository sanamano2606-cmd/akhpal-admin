"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REFERRALS & CUSTOMER CREDIT  (Mock 97, approved by Sana 19 September 2026)
//
// The money audit closed the holes in the referral scheme - a cap, a minimum
// first order, and a claim so two orders delivered at the same moment cannot
// pay the same referral twice. One thing stayed open and was written down as
// open: THERE WAS NO SCREEN. Nobody could see what had been handed out, so
// nobody could tell whether Rs 50 a side was bringing customers in or being
// farmed by one person with twenty phone numbers.
//
// A PAIR IS TWICE THE REWARD. Both sides are paid, so Rs 50 each is Rs 100
// out of the door. The server doubles it; this page never does arithmetic on
// money of its own.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { Card, CardHeader, Table, ErrorState, EmptyState, type Column } from "@/components/ui";

type Row = any;

/** One of the four figures at the top. `tone` is what the number MEANS, not
 *  decoration: orange is money that is still owed or still going out. */
function Tile({ label, value, note, tone = "plain" }: {
  label: string; value: string; note: string;
  tone?: "plain" | "warn" | "good";
}) {
  const skin = tone === "warn"
    ? "border-[#FFD2BF] bg-takal-orange-soft"
    : tone === "good"
      ? "border-[#BFE0CE] bg-takal-green-soft"
      : "border-takal-line bg-white";
  return (
    <div className={`rounded-lg border p-4 ${skin}`}>
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-takal-ink-soft">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-black leading-tight text-takal-ink">{value}</div>
      <div className="mt-1 text-[11.5px] text-takal-ink-soft">{note}</div>
    </div>
  );
}

function Flag({ kind, never }: { kind: string; never: number }) {
  const map: Record<string, { text: string; skin: string }> = {
    at_the_cap: { text: "At the cap", skin: "bg-takal-red-soft text-takal-red" },
    worth_a_look: { text: "Worth a look", skin: "bg-takal-orange-soft text-[#C8410F]" },
    healthy: { text: "Healthy", skin: "bg-takal-green-soft text-takal-green" },
  };
  const f = map[kind] || map.healthy;
  return (
    <div>
      <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${f.skin}`}>
        {f.text}
      </span>
      {never > 0 && kind !== "healthy" && (
        <div className="mt-1 text-xs text-takal-ink-soft">{never} never ordered</div>
      )}
    </div>
  );
}

export default function ReferralsPage() {
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData((await apiClient.getReferrals()) as Row);
    } catch (err) {
      setError(readFailure(err, "the referrals"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals ?? {};
  const rules = data?.rules ?? {};
  const top: Row[] = data?.top_referrers ?? [];
  const recent: Row[] = data?.recent ?? [];

  // The split bar. Spent has LEFT the business; unspent is money that will.
  const spent = Number(t.credit_spent || 0);
  const unspent = Number(t.credit_unspent || 0);
  const both = spent + unspent;
  const spentPct = both > 0 ? (spent / both) * 100 : 0;

  const topColumns: Column<Row>[] = [
    { key: "name", header: "Customer", cell: (r) => <span className="font-bold">{r.name}</span> },
    { key: "phone", header: "Phone", hideOnSmall: true, cell: (r) => r.phone || "—" },
    { key: "referred", header: "Referred", numeric: true, cell: (r) => r.referred },
    { key: "ordered", header: "Of those, ordered", numeric: true, hideOnSmall: true,
      cell: (r) => r.ordered },
    { key: "given", header: "Given away", numeric: true, cell: (r) => money(r.given_away) },
    { key: "flag", header: "", cell: (r) => <Flag kind={r.flag} never={r.never_ordered} /> },
  ];

  const recentColumns: Column<Row>[] = [
    { key: "when", header: "When", hideOnSmall: true,
      cell: (r) => (r.when ? new Date(r.when).toLocaleString("en-GB", {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      }) : "—") },
    { key: "by", header: "Who invited", cell: (r) => r.invited_by?.name || "—" },
    { key: "joined", header: "Who joined", cell: (r) => r.joined?.name || "—" },
    { key: "each", header: "Each side", numeric: true,
      cell: (r) => <span className="font-bold">{money(r.each_side)}</span> },
    { key: "state", header: "State", cell: (r) => (
      <div>
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
          r.status === "rewarded"
            ? "bg-takal-green-soft text-takal-green"
            : "bg-takal-orange-soft text-[#C8410F]"}`}>
          {r.status === "rewarded" ? "Paid" : "Waiting"}
        </span>
        {r.waiting_because && (
          <div className="mt-1 text-xs text-takal-ink-soft">{r.waiting_because}</div>
        )}
      </div>
    ) },
  ];

  if (error) return <ErrorState message={error.message} denied={error.denied} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Referrals &amp; customer credit</h2>
          <p className="mt-0.5 text-sm text-takal-ink-soft">
            Money Takal gives away to bring customers in — and what is still owed.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const ok = downloadCsv("referrals.csv", recent, [
                { key: "when", label: "When" },
                { key: "status", label: "State" },
                { key: "each_side", label: "Each side" },
              ]);
              if (!ok) toast("Nothing to export yet.", "info");
            }}
            className="rounded-lg border border-takal-line bg-white px-3.5 py-2 text-sm"
          >
            Download CSV
          </button>
          {/* The rules live in Settings and are CHANGED there. This page reads
              them; two places to change one number is how they drift apart. */}
          <Link
            href="/dashboard/settings"
            className="rounded-lg border border-takal-yellow-dark bg-takal-yellow px-3.5 py-2 text-sm font-bold text-takal-ink"
          >
            Change the rules
          </Link>
        </div>
      </div>

      {/* THE RULES IN FORCE, read from the server. A page that states a rule
          it does not read goes stale the first time somebody changes it. */}
      <div className="flex flex-wrap gap-2.5">
        {rules.switched_off ? (
          <span className="rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-1.5 text-xs">
            The referral scheme is <b>switched off</b> (the reward is Rs 0)
          </span>
        ) : (
          <>
            <span className="rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-1.5 text-xs">
              Reward each side <b>{money(rules.reward_each_side)}</b>
            </span>
            <span className="rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-1.5 text-xs">
              Only after a first order of <b>{money(rules.minimum_first_order)}</b> or more
            </span>
            {/* A CAP OF 0 MEANS NO CAP. REFERRAL_MAX_PER_REFERRER=0 switches
                the limit off in core_otp.py, so printing "at most 0 referrals
                per customer" would say the exact opposite of what is true -
                and somebody reading it would think the scheme was shut. */}
            <span className="rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-1.5 text-xs">
              {Number(rules.max_per_referrer) > 0
                ? <>At most <b>{rules.max_per_referrer}</b> referrals per customer</>
                : <>No limit on how many one customer may refer</>}
            </span>
            <span className="rounded-lg border border-[#F2E3B0] bg-takal-yellow-soft px-3 py-1.5 text-xs">
              Switch off: set the reward to <b>Rs 0</b>
            </span>
          </>
        )}
      </div>

      {data?.incomplete && (
        <div className="rounded-lg border-2 border-[#FFD2BF] bg-takal-orange-soft px-4 py-3">
          <p className="font-bold text-[#C8410F]">
            ⚠️ Some of these figures could not be read — they are too LOW, not wrong
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-takal-ink">
            {(data.incomplete_parts ?? []).map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Given away, all time"
          value={money(t.given_away)}
          note={`${t.rewards_paid ?? 0} rewards paid, both sides`}
        />
        <Tile
          label="Promised, not yet paid"
          value={money(t.promised)}
          note={`${t.waiting ?? 0} waiting for a first order of ${money(rules.minimum_first_order)}+`}
          tone="warn"
        />
        <Tile
          label="Credit still unspent"
          value={money(t.credit_unspent)}
          note="Money customers can spend tomorrow"
          tone="warn"
        />
        <Tile
          label="Credit already spent"
          value={money(t.credit_spent)}
          note={`Came off ${t.orders_credit_came_off ?? 0} real bills`}
          tone="good"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={`Where the ${money(t.given_away)} went`}
          hint="Credit spent is money that has already left the business. Credit unspent is money that will."
        />
        <div className="px-4 pb-5 pt-3.5">
          {both > 0 ? (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-[#EDEDED]">
                <span className="block h-full bg-takal-green" style={{ width: `${spentPct}%` }} />
                <span className="block h-full bg-takal-orange" style={{ width: `${100 - spentPct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3.5 text-[11.5px] text-takal-ink-soft">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm bg-takal-green" />
                  Spent on orders — {money(spent)}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm bg-takal-orange" />
                  Still in customers&apos; wallets — {money(unspent)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-takal-ink-soft">
              No credit has been created yet, so there is nothing to split.
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Who is referring the most"
          hint={"One person with a lot of referrals and very few real orders "
                + "behind them is the thing to look at. "
                + (Number(rules.max_per_referrer) > 0
                    ? `The cap is ${rules.max_per_referrer}.`
                    : "There is no cap at the moment.")}
        />
        <Table
          columns={topColumns}
          rows={top}
          rowKey={(r) => String(r.id)}
          loading={loading}
          empty={<EmptyState title="Nobody has referred anyone yet"
                             message="This fills in as customers start inviting each other." />}
        />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Every reward"
          hint={`Newest first. A waiting one pays out by itself when that customer's first order of ${money(rules.minimum_first_order)}+ is delivered.`}
        />
        <Table
          columns={recentColumns}
          rows={recent}
          rowKey={(r) => String(r.id)}
          loading={loading}
          empty={<EmptyState title="No referrals yet"
                             message="Nothing has been given away." />}
        />
        {data && data.total > data.shown && (
          <p className="border-t border-takal-line px-4 py-2.5 text-xs text-takal-ink-soft">
            Showing the newest {data.shown} of {data.total}.
          </p>
        )}
      </Card>
    </div>
  );
}
