"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Send } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function NotificationsPage() {
  const [role, setRole] = useState("");          // "" = everyone
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    try {
      const res = (await apiClient.getNotificationsHistory()) as any;
      setHistory(res?.broadcasts || []);
    } catch {
      setHistory([]);
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
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Send Notifications</h1>
        <p className="text-slate-600 mt-1">Broadcast an announcement (in-app + push) to a group of users.</p>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">✓ {result}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      <form onSubmit={handleSend} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          >
            <option value="">Everyone</option>
            <option value="customer">Customers only</option>
            <option value="restaurant">Restaurants only</option>
            <option value="rider">Riders only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            placeholder="e.g. Eid special discounts!"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            required
            rows={4}
            placeholder="Write your announcement..."
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? "Sending..." : "Send Notification"}
        </button>
      </form>

      {/* Sent history */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-3">Recent Announcements</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No announcements sent yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900 text-sm">{h.title}</p>
                  <span className="text-xs text-slate-400">{h.sent_at ? new Date(h.sent_at).toLocaleString() : ""}</span>
                </div>
                <p className="text-sm text-slate-600">{h.body}</p>
                <p className="text-xs text-slate-400 mt-1">Sent to {h.recipients} user(s)</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
