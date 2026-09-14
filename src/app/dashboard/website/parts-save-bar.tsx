"use client";

import { Save } from "lucide-react";

/**
 * The Save button and the one sentence that stops the most common worry about
 * this screen: "will this send my app back to Google for review?"
 *
 * It will not, and saying so here is cheaper than answering it every time.
 */
export function SaveBar({
  saving,
  dirty,
  onSave,
}: {
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className="inline-flex items-center gap-2 rounded-lg bg-takal-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save and publish"}
      </button>
      <p className="text-xs text-takal-ink-soft">
        The website changes within about a minute. No rebuild, no app update,
        and nothing is sent to Google or Apple.
      </p>
    </div>
  );
}
