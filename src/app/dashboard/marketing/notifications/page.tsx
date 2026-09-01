"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Send } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

export default function NotificationsPage() {
  const [role, setRole] = useState("");          // "" = everyone
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const [historyError, setHistoryError] = useState("");

  const loadHistory = async () => {
    try {
      setHistoryError("");
      const res = (await apiClient.getNotificationsHistory()) as any;
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult("");
    const audience = role ? `all ${role}s` : "ALL users";
    if (!window.confirm(`Send this notification to ${audience}?`)) return;
    try {
      setSending(true);
      const res = (await apiClient.broadcastNotification({
        role: role || null,
        title,
        body,
        type: "announcement",
      })) as any;
      setResult(res?.message || "Notification sent.");
      setTitle("");
      setBody("");
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink mb-2">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <h2 className="text-xl font-bold text-takal-ink">Send a Notification</h2>
        <p className="text-takal-ink-soft mt-1 text-sm">A push message to everyone, or to just customers, shops or riders.</p>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">✓ {result}</div>
      )}
      {error && (
        <ErrorState message={error} />
      )}

      <form onSubmit={handleSend} className="bg-white rounded-lg border border-takal-line p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-takal-ink mb-1">Audience</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          >
            <option value="">Everyone</option>
            <option value="customer">Customers only</option>
            <option value="restaurant">Restaurants only</option>
            <option value="rider">Riders only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-takal-ink mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            placeholder="e.g. Eid special discounts!"
            className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-takal-ink mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            required
            rows={4}
            placeholder="Write your announcement..."
            className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-5 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? "Sending..." : "Send Notification"}
        </button>
      </form>

      {/* Sent history */}
      <div className="bg-white rounded-lg border border-takal-line p-6">
        <h3 className="font-semibold text-takal-ink mb-3">Recent Announcements</h3>
        {historyError ? (
          // "No announcements sent yet" was shown whenever this failed to
          // load - including when the real reason was a missing permission.
          <p className="text-sm text-[#C8410F]">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-takal-ink-soft">No announcements sent yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="border-b border-takal-line pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-takal-ink text-sm">{h.title}</p>
                  <span className="text-xs text-takal-disabled-text">{h.sent_at ? fmtDateTime(h.sent_at) : ""}</span>
                </div>
                <p className="text-sm text-takal-ink-soft">{h.body}</p>
                <p className="text-xs text-takal-disabled-text mt-1">Sent to {h.recipients} user(s)</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
