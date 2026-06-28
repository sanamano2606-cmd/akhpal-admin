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
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">App Announcement Banner</h1>
        <p className="text-slate-600 mt-1">Show a message at the top of the customer app (e.g. holiday hours, promos).</p>
      </div>

      {loading ? (
        <div className="text-slate-600">Loading...</div>
      ) : (
        <form onSubmit={save} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banner message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="e.g. Closed for Eid on the 10th — back on the 11th!"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="text-sm text-slate-700">Show this banner in the app</span>
          </label>

          {/* Live preview */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Preview</p>
            {active && text ? (
              <div className="bg-primary-600 text-white text-sm px-4 py-2 rounded-lg">{text}</div>
            ) : (
              <div className="bg-slate-100 text-slate-400 text-sm px-4 py-2 rounded-lg">(banner hidden)</div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Banner"}
          </button>
        </form>
      )}
    </div>
  );
}
