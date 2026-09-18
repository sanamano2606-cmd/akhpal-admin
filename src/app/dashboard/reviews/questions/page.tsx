"use client";

/**
 * QUESTIONS — what customers ask about a product, before they buy it.
 *
 * Mock 93, approved by Sana on 17 September 2026, with her words:
 *   "make sure the Ask about Questions should reach to Vendor as well as
 *    Admin Panel, so the customer get answer accordingly."
 *
 * So every question arrives in TWO places at once: the shop's Partners app
 * and this page. Whoever answers first, the customer is told, and the answer
 * shows under the product for everybody (without the customer's name).
 *
 * What this page can do that the shop cannot:
 *   - answer for a shop that is slow ("Takal answered");
 *   - HIDE a question and its answer from the product page, when the words are
 *     rude or carry somebody's phone number.
 */

import { useCallback, useEffect, useState } from "react";
import { EyeOff, RotateCcw, Send, MessageCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/format";
import { ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

const FILTERS = [
  { key: "waiting", label: "Waiting for an answer" },
  { key: "answered", label: "Answered" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "Everything" },
];

export default function ProductQuestionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [filter, setFilter] = useState<string>("waiting");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getProductQuestions({ status: filter })) as any;
      setRows(res?.questions || []);
      setWaiting(Number(res?.waiting || 0));
    } catch (err) {
      setError(readFailure(err, "the product questions"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = async (q: any) => {
    const words = (drafts[q.id] ?? "").trim();
    if (!words) {
      toast("Please type an answer first", "error");
      return;
    }
    try {
      setBusyId(String(q.id));
      await apiClient.answerProductQuestion(String(q.id), words);
      toast("Answer sent — the customer has been told", "success");
      setEditing(null);
      setDrafts((d) => ({ ...d, [q.id]: "" }));
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send the answer", "error");
    } finally {
      setBusyId(null);
    }
  };

  const setHidden = async (q: any, hidden: boolean) => {
    try {
      setBusyId(String(q.id));
      await apiClient.setProductQuestionHidden(String(q.id), hidden);
      toast(
        hidden
          ? "Hidden — it is no longer on the product page"
          : "Put back on the product page",
        "success",
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change this question", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Questions about products</h2>
          <p className="text-takal-ink-soft mt-1">
            Every question also goes to the <b>shop</b>. Whoever answers first,
            the customer is told. Answer here when a shop is slow.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
              filter === f.key
                ? "bg-takal-yellow border-takal-yellow-dark text-takal-ink"
                : "bg-white border-takal-line text-takal-ink-soft hover:border-takal-ink-soft"
            }`}
          >
            {f.label}
            {f.key === "waiting" && waiting > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-takal-orange text-white">
                {waiting}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error.message} onRetry={load} denied={error.denied} />}

      <div className="space-y-3">
        {loading ? (
          <div className="text-takal-ink-soft">Loading…</div>
        ) : error ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            The questions could not be read, so none can be listed here.
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-takal-line p-8 text-center text-takal-ink-soft">
            {filter === "waiting"
              ? "No question is waiting for an answer."
              : "No questions here."}
          </div>
        ) : (
          rows.map((q) => {
            const busy = busyId === String(q.id);
            const answered = !!q.answer;
            const hidden = q.status === "hidden";
            const open = !answered || editing === String(q.id);
            return (
              <div
                key={q.id}
                data-question={q.id}
                className={`bg-white rounded-lg border p-4 ${
                  !answered && !hidden ? "border-takal-orange border-2" : "border-takal-line"
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {q.product_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.product_image}
                      alt=""
                      className="w-10 h-10 rounded-md object-cover border border-takal-line"
                    />
                  ) : (
                    <MessageCircle className="w-6 h-6 text-takal-blue" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-takal-blue truncate">
                      {q.product_name || "A product"}
                    </div>
                    <div className="text-xs text-takal-ink-soft">
                      at {q.shop_name || "—"}
                    </div>
                  </div>
                  {hidden && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-takal-disabled-bg text-takal-ink-soft">
                      Hidden
                    </span>
                  )}
                  <span className="text-xs text-takal-disabled-text ml-auto">
                    {fmtDate(q.created_at)}
                  </span>
                </div>

                <p className="text-base font-semibold text-takal-ink mt-3 whitespace-pre-wrap">
                  {q.question}
                </p>

                {answered && !open && (
                  <div className="mt-2 rounded-lg bg-takal-green-soft border border-takal-line px-3 py-2">
                    <div className="text-xs font-bold text-takal-green">
                      {q.answered_by === "takal" ? "Takal answered" : "The shop answered"}
                      {q.answered_at ? ` · ${fmtDate(q.answered_at)}` : ""}
                    </div>
                    <p className="text-sm text-takal-ink mt-0.5 whitespace-pre-wrap">{q.answer}</p>
                  </div>
                )}

                {open && !hidden && (
                  <div className="mt-3 flex gap-2 items-start flex-wrap">
                    <textarea
                      value={drafts[q.id] ?? (answered ? q.answer : "")}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      maxLength={500}
                      rows={2}
                      placeholder="Type Takal's answer…"
                      className="flex-1 min-w-[220px] rounded-lg border border-takal-line px-3 py-2 text-sm focus:outline-none focus:border-takal-blue"
                    />
                    <button
                      disabled={busy}
                      onClick={() => answer(q)}
                      className="px-4 py-2 rounded-lg text-sm font-bold bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink border border-takal-ink disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" /> Answer as Takal
                    </button>
                  </div>
                )}

                <div className="flex gap-2 mt-3 flex-wrap">
                  {answered && !open && !hidden && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(String(q.id));
                        setDrafts((d) => ({ ...d, [q.id]: q.answer }));
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-takal-line text-takal-ink-soft hover:border-takal-ink-soft disabled:opacity-50"
                    >
                      Change the answer
                    </button>
                  )}
                  {!hidden ? (
                    <button
                      disabled={busy}
                      onClick={() => setHidden(q, true)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-takal-line text-takal-ink-soft hover:border-takal-ink-soft disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <EyeOff className="w-4 h-4" /> Hide from the product page
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => setHidden(q, false)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-takal-line text-takal-ink-soft hover:border-takal-ink-soft disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" /> Put back
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
