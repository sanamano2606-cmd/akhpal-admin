"use client";

/**
 * THE SUPPORT INBOX — the list.
 *
 * Plan 52, Mock 53, approved by Sana on 10 September 2026.
 *
 * WHAT THIS PAGE IS FOR, in one line: so that nobody who wrote to Takal is
 * left waiting without anybody knowing it.
 *
 * That is why the page is built the way it is:
 *
 *   - The people waiting on us are FIRST, and tinted, and their wait is
 *     written out in plain words ("waiting 41m"). A support list sorted by
 *     newest hides exactly the person it must not hide: the one who wrote
 *     three hours ago and has not been answered.
 *   - The sort happens on the SERVER, not here. Sorting a page of fifty in the
 *     browser looks identical today and quietly puts the oldest unanswered
 *     customer on page four the moment there are more than fifty.
 *   - The three numbers at the top are counted across everything, not across
 *     this page.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Image as ImageIcon, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { Badge, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

/** How long somebody has been waiting, in words a person reads at a glance. */
function waitedFor(iso: any): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** The three words a conversation can be in, and the colour each one wears. */
function statusChip(t: any) {
  const status = String(t?.status || "open");
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  if (t?.unread_for_takal) return <Badge tone="bad">Waiting</Badge>;
  if (status === "answered") return <Badge tone="good">Answered</Badge>;
  return <Badge tone="warn">Open</Badge>;
}

export default function SupportPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "open" | "answered" | "closed">("");

  const fetchThreads = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getSupportThreads(
        only ? { status: only } : {}
      )) as any;
      setThreads(res?.threads || []);
      setWaiting(Number(res?.waiting) || 0);
    } catch (err) {
      setError(readFailure(err, "the support inbox"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only]);

  // THE SEARCH IS DONE HERE, ON THE PAGE THAT IS ALREADY LOADED.
  // The server can search too, and does, but typing a letter at a time should
  // not be fifty calls to a free-tier backend. When somebody genuinely cannot
  // find a conversation on this page, the answer is the status filter above,
  // which does go to the server.
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? threads.filter(
        (t) =>
          (t.customer_name || "").toLowerCase().includes(needle) ||
          (t.customer_phone || "").toLowerCase().includes(needle) ||
          (t.subject || "").toLowerCase().includes(needle)
      )
    : threads;

  const answered = threads.filter(
    (t) => t.status === "answered" && !t.unread_for_takal
  ).length;
  const closed = threads.filter((t) => t.status === "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Support Inbox</h2>
          <p className="text-takal-ink-soft mt-1">
            Messages customers sent to Takal from inside the app.
          </p>
        </div>
        <button
          onClick={fetchThreads}
          className="flex items-center gap-2 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* The three numbers. `waiting` is everybody waiting, not everybody
          waiting on this page — it is the number the team works from. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOnly(only === "open" ? "" : "open")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
            only === "open"
              ? "bg-takal-red-soft text-takal-red ring-[#F3C2C7]"
              : "bg-white text-takal-ink ring-takal-line hover:bg-takal-page"
          }`}
        >
          {waiting} waiting
        </button>
        <button
          onClick={() => setOnly(only === "answered" ? "" : "answered")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
            only === "answered"
              ? "bg-takal-green-soft text-takal-green ring-[#BFE0D2]"
              : "bg-white text-takal-ink ring-takal-line hover:bg-takal-page"
          }`}
        >
          {answered} answered
        </button>
        <button
          onClick={() => setOnly(only === "closed" ? "" : "closed")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
            only === "closed"
              ? "bg-slate-200 text-takal-ink ring-takal-line"
              : "bg-white text-takal-ink ring-takal-line hover:bg-takal-page"
          }`}
        >
          {closed} closed
        </button>
        {only !== "" && (
          <button
            onClick={() => setOnly("")}
            className="text-sm font-medium text-takal-ink-soft hover:underline"
          >
            Show all
          </button>
        )}
      </div>

      {error && (
        <ErrorState
          message={error.message}
          onRetry={fetchThreads}
          denied={error.denied}
        />
      )}

      <div className="bg-white rounded-lg border border-takal-line p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-takal-disabled-text" />
          <input
            type="text"
            placeholder="Search name, phone or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Subject</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Waiting</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={5} />
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-takal-ink-soft">
                    The support inbox could not be read, so nothing can be listed
                    here. Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-takal-ink-soft">
                    {threads.length === 0
                      ? "Nobody has written to Takal Support yet."
                      : "No conversation matches what you typed."}
                  </td>
                </tr>
              ) : (
                shown.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-takal-line hover:bg-takal-page ${
                      t.unread_for_takal ? "bg-[#FFF7F4]" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/support/${t.id}`}
                        className="font-semibold text-takal-ink hover:underline"
                      >
                        {t.customer_name || "Customer"}
                      </Link>
                      <div className="text-takal-ink-soft">{t.customer_phone || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/support/${t.id}`}
                        className="text-takal-ink hover:underline"
                      >
                        {t.subject || "(no subject)"}
                      </Link>
                      <div className="flex items-center gap-1 text-takal-ink-soft">
                        <span className="font-medium">
                          {t.last_message_from === "takal" ? "Takal:" : "Customer:"}
                        </span>
                        <span className="truncate max-w-[22rem]">
                          {t.last_message_body || "—"}
                        </span>
                        {t.has_image && (
                          <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" aria-label="has a photo" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {t.order_id ? (
                        <Link
                          href={`/dashboard/orders?order=${t.order_id}`}
                          className="text-takal-blue hover:underline"
                        >
                          #{String(t.order_id).slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-takal-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {t.unread_for_takal ? (
                        <span className="font-semibold text-takal-red">
                          {waitedFor(t.last_message_at)}
                        </span>
                      ) : (
                        <span className="text-takal-ink-soft">
                          {waitedFor(t.last_message_at)} ago
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{statusChip(t)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
