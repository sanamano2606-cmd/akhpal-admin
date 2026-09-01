"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export default function BannerPage() {
  const [text, setText] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const s = (await apiClient.getSettings()) as any;
      setText(s?.banner_text || "");
      setActive(!!s?.banner_active);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiClient.updateSettings({ banner_text: text, banner_active: active });
      toast("Banner saved — it will show in the apps shortly.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink mb-2">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <h2 className="text-xl font-bold text-takal-ink">App Banner</h2>
        <p className="text-takal-ink-soft mt-1 text-sm">A single line of text shown inside the customer app, above everything else.</p>
      </div>

      {loading ? (
        <div className="text-takal-ink-soft">Loading...</div>
      ) : (
        <form onSubmit={save} className="bg-white rounded-lg border border-takal-line p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Banner message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="e.g. Closed for Eid on the 10th — back on the 11th!"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
            />
          </div>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="text-sm text-takal-ink">Show this banner in the app</span>
          </label>

          {/* Live preview */}
          <div>
            <p className="text-xs text-takal-ink-soft mb-1">Preview</p>
            {active && text ? (
              <div className="bg-takal-yellow text-takal-ink text-sm px-4 py-2 rounded-lg">{text}</div>
            ) : (
              <div className="bg-slate-100 text-takal-disabled-text text-sm px-4 py-2 rounded-lg">(banner hidden)</div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Banner"}
          </button>
        </form>
      )}
    </div>
  );
}
