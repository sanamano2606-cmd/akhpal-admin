"use client";

/**
 * SENDING A MESSAGE TO EVERY CUSTOMER.
 *
 * REBUILT 2026-09-03. This is the only action in the whole panel that cannot
 * be taken back, and until today the only thing standing in front of it was
 * `window.confirm("Send this notification to ALL users?")` — a grey browser box
 * that could not show the message, could not say how many people would get it,
 * and in a browser with dialogs switched off silently did nothing at all.
 *
 * Three things changed:
 *   1. The window shows the message the way a phone will show it, and carries
 *      the real number of people on the button.
 *   2. The sending happens outside the web request now, in pages, so it cannot
 *      stop half way through five thousand customers with nothing recorded.
 *   3. Every send is written down BEFORE anything goes out — the words, the
 *      time, who pressed it, how many it reached — so a second admin can see
 *      that a message already went out this morning.
 *
 * Nothing has ever been sent on this database. That is exactly why it is worth
 * fixing now rather than on the day the list is real.
 */

import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";
import { ErrorState, Modal, Button, Badge } from "@/components/ui";

const AUDIENCES = [
  { value: "customer", label: "Customers only" },
  { value: "rider", label: "Riders only" },
  { value: "restaurant", label: "Shops only" },
  { value: "", label: "Everyone — customers, riders and shops" },
];

export default function NotificationsPage() {
  const [role, setRole] = useState("customer");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [audience, setAudience] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState("");

  const loadHistory = async () => {
    try {
      setHistoryError("");
      const res = (await apiClient.getBroadcasts()) as any;
      setHistory(res?.broadcasts || []);
    } catch (err) {
      // This used to swallow the failure and render "no history", so a
      // permission refusal looked like "nothing has ever been sent".
      setHistory([]);
      setHistoryError(errorMessage(err, "the messages already sent"));
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  /** Ask how many people this would reach, THEN open the window. The number
   *  has to be on the button, and it cannot be guessed at from here. */
  const askFirst = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult("");
    setAudience(null);
    setConfirming(true);
    setChecking(true);
    try {
      const res = (await apiClient.getBroadcastAudience(role || null)) as any;
      setAudience(res);
    } catch (err) {
      setAudience({ failed: errorMessage(err, "how many people this reaches") });
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    try {
      setSending(true);
      const res = (await apiClient.broadcastNotification({
        role: role || null,
        title,
        body,
        type: "announcement",
      })) as any;
      setResult(res?.message || "Sending.");
      setTitle("");
      setBody("");
      setConfirming(false);
      loadHistory();
    } catch (err) {
      setError(errorMessage(err, "sending the message"));
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  const people = audience?.people;
  const canSend = !checking && !audience?.failed && Number(people || 0) > 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Send a message</h2>
        <p className="mt-1 text-sm text-takal-ink-soft">
          One message, straight to everybody&apos;s phone. It cannot be taken back.
        </p>
      </div>

      {result && (
        <div className="rounded-lg border border-takal-green bg-takal-green-soft px-4 py-3 text-takal-green">
          ✓ {result} — it appears in the list below as it goes out.
        </div>
      )}
      {error && <ErrorState message={error} />}

      <form
        onSubmit={askFirst}
        className="space-y-4 rounded-lg border border-takal-line bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-takal-ink">
            Who gets it
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-takal-line px-4 py-2 outline-none focus:ring-2 focus:ring-takal-yellow"
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-takal-ink">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            placeholder="Eid Mubarak from Takal"
            className="w-full rounded-lg border border-takal-line px-4 py-2 outline-none focus:ring-2 focus:ring-takal-yellow"
          />
          <p className="mt-1 text-xs text-takal-ink-soft">
            {title.length}/80 — a phone shows about 40 letters of this.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-takal-ink">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            required
            rows={4}
            placeholder="20% off every order this weekend with code EID25."
            className="w-full rounded-lg border border-takal-line px-4 py-2 outline-none focus:ring-2 focus:ring-takal-yellow"
          />
          <p className="mt-1 text-xs text-takal-ink-soft">{body.length}/300</p>
        </div>

        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-takal-yellow px-5 py-2 font-medium text-takal-ink transition hover:bg-takal-yellow-dark disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Check and send…
        </button>
      </form>

      {/* THE WINDOW THAT REPLACES THE GREY BOX. */}
      <Modal
        open={confirming}
        onClose={() => !sending && setConfirming(false)}
        title="Send to everybody"
        size="lg"
        lockClose={sending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={send}
              loading={sending}
              disabled={!canSend}
            >
              {checking
                ? "Checking…"
                : canSend
                  ? `Send to ${Number(people).toLocaleString()} ${Number(people) === 1 ? "person" : "people"}`
                  : "Cannot send"}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 sm:grid-cols-[210px_1fr]">
          {/* The message as a phone will show it. */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
              On the phone
            </p>
            <div className="overflow-hidden rounded-[26px] border-[9px] border-takal-ink bg-white">
              <div className="h-4 bg-takal-ink" />
              <div className="min-h-[150px] bg-takal-page p-3">
                <div className="rounded-xl bg-white px-3 py-2.5 shadow">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-sm border border-takal-ink bg-takal-yellow" />
                    <span className="text-[10px] font-bold text-takal-ink-soft">
                      Takal · now
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-black leading-snug text-takal-ink">
                    {title || "Title"}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-takal-ink-soft">
                    {body}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <dl className="rounded-lg bg-takal-page p-4 text-sm">
              <Row
                label="Goes to"
                value={AUDIENCES.find((a) => a.value === role)?.label ?? "Everyone"}
              />
              <Row
                label="How many"
                value={
                  checking
                    ? "counting…"
                    : audience?.failed
                      ? "could not count"
                      : `${Number(people ?? 0).toLocaleString()} ${Number(people) === 1 ? "person" : "people"}`
                }
              />
              <Row
                label="Of those, phones reachable"
                value={
                  checking || audience?.failed
                    ? "—"
                    : String(audience?.reachable ?? 0)
                }
              />
              <Row
                label="Last message sent"
                value={
                  audience?.last_sent?.created_at
                    ? fmtDateTime(audience.last_sent.created_at)
                    : "never"
                }
              />
              <Row label="Can this be taken back" value="No" strong />
            </dl>

            {audience?.failed && (
              <p className="rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-3 py-2 text-sm">
                <strong>Nothing has been sent.</strong> {audience.failed} — and
                a message must not go out without knowing how many people it
                reaches.
              </p>
            )}

            {!checking && !audience?.failed && Number(people || 0) === 0 && (
              <p className="rounded-lg bg-takal-page px-3 py-2 text-sm text-takal-ink-soft">
                There is nobody in this group yet, so there is nothing to send.
              </p>
            )}

            {audience?.last_sent?.created_at && (
              <p className="text-xs text-takal-ink-soft">
                The last message was &ldquo;{audience.last_sent.title}&rdquo;. Check
                somebody else has not already sent this today.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* WHAT HAS ALREADY BEEN SENT. */}
      <div className="rounded-lg border border-takal-line bg-white p-6">
        <h3 className="mb-3 font-semibold text-takal-ink">Messages already sent</h3>
        {historyError ? (
          <p className="text-sm text-[#C8410F]">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-takal-ink-soft">
            Nothing has ever been sent to everybody.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((h: any) => (
              <div
                key={h.id}
                className="border-b border-takal-line pb-3 last:border-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-takal-ink">{h.title}</p>
                  <div className="flex items-center gap-2">
                    {h.status && h.status !== "sent" && (
                      <Badge tone={h.status === "sending" ? "busy" : "warn"}>
                        {h.status === "sending"
                          ? "Sending…"
                          : h.status === "part_sent"
                            ? "Part sent"
                            : "Failed"}
                      </Badge>
                    )}
                    <span className="text-xs text-takal-ink-soft">
                      {h.created_at ? fmtDateTime(h.created_at) : ""}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-takal-ink-soft">{h.body}</p>
                <p className="mt-1 text-xs text-takal-ink-soft">
                  {/* WHAT LANDED, not what was hoped for. */}
                  Reached {Number(h.delivered || 0).toLocaleString()} of{" "}
                  {Number(h.intended || 0).toLocaleString()} ·{" "}
                  {Number(h.pushed || 0).toLocaleString()} phones
                  {h.sent_by_name ? ` · sent by ${h.sent_by_name}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        strong ? "mt-1.5 border-t border-takal-ink pt-2.5 font-bold" : ""
      }`}
    >
      <dt className="text-takal-ink-soft">{label}</dt>
      <dd className="text-takal-ink">{value}</dd>
    </div>
  );
}
