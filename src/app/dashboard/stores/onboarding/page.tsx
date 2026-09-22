"use client";

/**
 * BRINGING A VENDOR ON BOARD.  (Mock 109, approved by Sana 22 September 2026.)
 *
 * WHY THIS PAGE EXISTS
 *
 * Sana hired Muhammad Ilyas Khan on 22 September 2026 for one job: bringing
 * vendors on board. Nothing in the panel was built for that job. He could
 * create a shop and add products, and then he was on his own:
 *
 *   * "All Stores" lists every shop in Swat, which tells him nothing about his
 *     own work;
 *   * nothing said when a shop was FINISHED, so half-made shops arrived in
 *     Sana's Pending list, went back, and were handled twice;
 *   * the Pending list never said who sent a shop, or when.
 *
 * IT GIVES HIM NO NEW POWER. Every call here answers the one permission he was
 * given - "Stores -> Add & edit shops". It shows him what he is already
 * allowed to see, in the shape of the job.
 *
 * AND IT APPROVES NOTHING. "Send for approval" records a hand-over, with a
 * name and a time. Approving stays on Stores -> Approve shops, behind
 * stores.approve, which he does not have: the person who signs a vendor up is
 * never the person who approves him.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Send, Store } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  Badge, Button, Card, CardBody, CardHeader,
  EmptyState, ErrorState, LoadingState,
} from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { DateText } from "@/components/ui";

type Step = { key: string; label: string; done: boolean; note: string };

type MyShop = {
  id: string;
  name: string;
  vendor_type?: string;
  created_at?: string;
  is_approved: boolean;
  submitted_at?: string | null;
  done: number;
  total: number;
  ready: boolean;
  what_is_left: string[];
  products: number;
  products_without_photo: number;
};

type Checklist = {
  id: string;
  name: string;
  is_approved: boolean;
  submitted_at?: string | null;
  steps: Step[];
  done: number;
  total: number;
  ready: boolean;
  what_is_left: string[];
  products: number;
  products_without_photo: number;
};

/** The progress bar. Green only when every check is done - an almost-finished
 *  shop is not a finished shop, and a green bar at 6 of 7 says it is. */
function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const colour =
    done === 0 ? "bg-takal-disabled-bg"
      : done === total ? "bg-takal-green"
        : "bg-takal-orange";
  return (
    <div className="w-32">
      <p className="text-xs text-takal-ink-soft mb-1">
        {done} of {total}
      </p>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [shops, setShops] = useState<MyShop[]>([]);
  const [loading, setLoading] = useState(true);
  // A FAILED READ MUST NEVER BECOME "you have not started any shops".
  // One is about the connection; the other is a statement about his work.
  const [error, setError] = useState<ReadFailure>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [list, setList] = useState<Checklist | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out: any = await apiClient.getMyIntakeShops();
      setShops(Array.isArray(out?.shops) ? out.shops : []);
    } catch (e) {
      setShops([]);
      setError(readFailure(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openShop = async (id: string) => {
    if (openId === id) { setOpenId(null); setList(null); return; }
    setOpenId(id);
    setList(null);
    setListLoading(true);
    try {
      const out: any = await apiClient.getShopChecklist(id);
      setList(out);
    } catch (e: any) {
      toast(e?.message || "Could not open that shop just now.", "error");
      setOpenId(null);
    } finally {
      setListLoading(false);
    }
  };

  const send = async (id: string, name: string) => {
    setSending(true);
    try {
      const out: any = await apiClient.submitShopForApproval(id);
      toast(out?.message || `${name} has been sent for approval.`, "success");
      // Both the list and the open checklist are now out of date.
      await load();
      const fresh: any = await apiClient.getShopChecklist(id);
      setList(fresh);
    } catch (e: any) {
      // The server's refusal NAMES what is still missing. That sentence is the
      // whole point of the button, so it is shown exactly as it arrives.
      toast(e?.message || "Could not send it just now.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-takal-ink">Bringing a vendor on board</h1>
        <p className="text-sm text-takal-ink-soft mt-1">
          Only the shops you started. Seven things make a shop finished, and the
          list below says which are missing.
        </p>
      </div>

      {/* ── A. My shops ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="My shops" hint="Newest first. A shop a vendor signed up for himself is not here — nobody brought it in." />
        <CardBody>
          {loading ? (
            <LoadingState label="Reading your shops…" />
          ) : error ? (
            <ErrorState message={error.message} denied={error.denied}
                        onRetry={error.denied ? undefined : load} />
          ) : shops.length === 0 ? (
            <EmptyState
              icon={<Store className="w-10 h-10" />}
              title="No shops yet"
              message={
                "Shops you create from Stores → All Stores → Create store will " +
                "appear here. Shops made before 22 September 2026 are not " +
                "listed: who created them was never recorded, and guessing " +
                "would be worse than saying nothing."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                    <th className="px-4 py-3">SHOP</th>
                    <th className="px-4 py-3">STARTED</th>
                    <th className="px-4 py-3">DONE</th>
                    <th className="px-4 py-3">WHAT IS LEFT</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s) => (
                    <tr key={s.id} className="border-t border-takal-line align-middle">
                      <td className="px-4 py-4">
                        <span className="font-medium text-takal-ink">{s.name}</span>
                        {s.is_approved && (
                          <span className="ml-2 align-middle">
                            <Badge tone="good">Live</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-takal-ink-soft">
                        <DateText value={s.created_at} />
                      </td>
                      <td className="px-4 py-4">
                        <Bar done={s.done} total={s.total} />
                      </td>
                      <td className="px-4 py-4">
                        {s.is_approved ? (
                          <span className="text-takal-ink-soft">Already live</span>
                        ) : s.submitted_at ? (
                          <span className="text-takal-blue">
                            Sent for approval — waiting for the Main Admin
                          </span>
                        ) : s.ready ? (
                          <span className="text-takal-green">Nothing — ready</span>
                        ) : (
                          <span className="text-takal-ink">
                            {s.what_is_left.slice(0, 2).join(", ")}
                            {s.what_is_left.length > 2
                              ? `, and ${s.what_is_left.length - 2} more`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant={s.ready && !s.submitted_at && !s.is_approved
                            ? "primary" : "secondary"}
                          onClick={() => openShop(s.id)}
                        >
                          {openId === s.id ? "Hide" : "Open"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── B. Is this shop finished? ─────────────────────────────────── */}
      {openId && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title={list?.name || "Loading…"} />
            <CardBody>
              {listLoading || !list ? (
                <LoadingState label="Checking this shop…" />
              ) : (
                <>
                  <div className="mb-4">
                    <Badge tone={list.ready ? "good" : "warn"}>
                      {list.done} of {list.total} done
                    </Badge>
                  </div>

                  <ul className="space-y-3">
                    {list.steps.map((st) => (
                      <li key={st.key} className="flex gap-3">
                        {st.done ? (
                          <CheckCircle2 className="w-5 h-5 text-takal-green flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-takal-orange flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-takal-ink">{st.label}</p>
                          {st.note && (
                            <p className={`text-xs ${st.done ? "text-takal-ink-soft" : "text-takal-orange"}`}>
                              {st.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {list.is_approved ? (
                      <Badge tone="good">This shop is already live</Badge>
                    ) : list.submitted_at ? (
                      <Badge tone="busy">
                        Sent for approval — waiting for the Main Admin
                      </Badge>
                    ) : (
                      <>
                        <Button
                          onClick={() => send(list.id, list.name)}
                          loading={sending}
                          disabled={!list.ready}
                        >
                          <Send className="w-4 h-4 mr-2 inline" />
                          Send for approval
                        </Button>
                        {!list.ready && (
                          <span className="text-sm text-takal-ink-soft">
                            {list.what_is_left.length} thing
                            {list.what_is_left.length === 1 ? "" : "s"} left
                          </span>
                        )}
                      </>
                    )}
                    <Link
                      href={`/dashboard/stores/${list.id}`}
                      className="text-sm font-medium text-takal-ink underline underline-offset-4"
                    >
                      Open the shop
                    </Link>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What “Send for approval” does" />
            <CardBody>
              <div className="rounded-lg border border-takal-yellow bg-takal-yellow-soft p-4 text-sm text-takal-ink space-y-3">
                <p>
                  <strong>It approves nothing.</strong> It puts the shop in the
                  Main Admin&apos;s Pending list and records who sent it and when.
                </p>
                <p>
                  Approving stays on <strong>Stores → Approve shops</strong>. The
                  person who signs a vendor up is never the person who approves
                  him — and never the person who sets his commission.
                </p>
              </div>
              <div className="mt-4 text-sm text-takal-ink-soft space-y-2">
                <p>
                  <strong className="text-takal-ink">Why the button stays off.</strong>{" "}
                  A half-made shop reaching the Pending list means it is handled
                  twice — once to send it back, once to do it properly. There is
                  no way past the checks, on purpose.
                </p>
                <p>
                  <strong className="text-takal-ink">The map pin matters most.</strong>{" "}
                  A shop without one is invisible to every customer in range, and
                  nothing on the vendor&apos;s screen says so. He would wait for
                  orders that could never arrive.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
