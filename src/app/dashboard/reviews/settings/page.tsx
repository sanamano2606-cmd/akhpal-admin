"use client";

/**
 * REVIEWS → SETTINGS. The switch Sana actually asked for.
 *
 * "1. After it appears. If need to check first then appear, so add this
 *  setting for reviews in the admin panel first." — 13 September 2026.
 *
 * THE SECOND SWITCH IS NOT A NICETY. With every review waiting for a person,
 * somebody has to press Approve on hundreds of empty five-star taps a week.
 * Within a fortnight nobody does, the queue stops being read, and the shop
 * pages go stale — which is worse than no checking at all, because it looks
 * like it is working. Letting plain high scores through keeps the queue down
 * to the reviews that actually need a human eye.
 */

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";

function Switch({
  on,
  busy,
  onToggle,
  label,
}: {
  on: boolean;
  busy: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={`relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-50 border ${
        on ? "bg-takal-yellow border-takal-yellow-dark" : "bg-takal-disabled-bg border-takal-line"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
          on ? "left-6 bg-takal-ink" : "left-0.5 bg-white shadow"
        }`}
      />
    </button>
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-takal-line last:border-0">
      <div>
        <div className="font-semibold text-takal-ink">{title}</div>
        <p className="text-sm text-takal-ink-soft mt-1 max-w-2xl">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export default function ReviewSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReadFailure>(null);
  const [words, setWords] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getReviewSettings()) as any;
      setSettings(res);
      setWords(String(res?.reviews_hold_words || ""));
    } catch (err) {
      setError(readFailure(err, "the review settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Record<string, any>) => {
    try {
      setSaving(true);
      await apiClient.updateReviewSettings(patch);
      setSettings((s: any) => ({ ...s, ...patch }));
      toast("Saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState message={error.message} onRetry={load} denied={error.denied} />;
  if (loading || !settings) return <div className="text-takal-ink-soft">Loading…</div>;

  const requireApproval = !!settings.reviews_require_approval;
  const autoHigh = !!settings.reviews_auto_publish_plain_high;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-takal-ink">Review settings</h2>
        <p className="text-takal-ink-soft mt-1">
          Who sees a review, and when.
        </p>
      </div>

      {Number(settings.waiting_count || 0) > 0 && (
        <div className="bg-takal-yellow rounded-lg p-4 font-semibold text-takal-ink">
          {settings.waiting_count} review{Number(settings.waiting_count) > 1 ? "s are" : " is"} waiting
          for you right now.
        </div>
      )}

      <div className="bg-white rounded-lg border border-takal-line px-5">
        <Row
          title="Check every review before customers see it"
          hint="A new review waits in “Waiting for you” until somebody presses Approve. Nothing shows in the app and no star average moves until then. This is the safe setting, and it is what Google and Apple like to see."
        >
          <Switch
            on={requireApproval}
            busy={saving}
            label="Check every review before customers see it"
            onToggle={() => save({ reviews_require_approval: !requireApproval })}
          />
        </Row>

        <Row
          title="Let plain 4 and 5 star reviews go straight through"
          hint="Only works while the switch above is on. A four or five star rating with no writing and no photo is published at once; anything with words, a photo, or 1–3 stars still waits for you. This is what keeps the waiting list short enough that somebody actually reads it."
        >
          <Switch
            on={autoHigh}
            busy={saving || !requireApproval}
            label="Let plain 4 and 5 star reviews go straight through"
            onToggle={() => save({ reviews_auto_publish_plain_high: !autoHigh })}
          />
        </Row>

        <div className="py-4">
          <div className="font-semibold text-takal-ink">Words that always wait</div>
          <p className="text-sm text-takal-ink-soft mt-1 max-w-2xl">
            Separate them with commas. A review containing any of these always
            waits for you, even a plain five-star one. Capital letters do not
            matter. Leave it empty to switch this off.
          </p>
          <div className="flex gap-2 mt-3 max-w-2xl">
            <input
              type="text"
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="fraud, cheat, rubbish"
              className="flex-1"
            />
            <button
              disabled={saving}
              onClick={() => save({ reviews_hold_words: words })}
              className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg font-semibold disabled:opacity-50 shrink-0"
            >
              Save words
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line p-5 text-sm text-takal-ink-soft space-y-2">
        <p className="font-semibold text-takal-ink">Two things worth knowing</p>
        <p>
          <b>Switching the top one off</b> publishes every new review the moment
          it is written, the way it worked before 13 September 2026. Reviews
          already waiting stay waiting until you approve them.
        </p>
        <p>
          <b>A star average only moves when you press Approve.</b> That is the
          whole point — the damage a bad review does is mostly the average, not
          the words. Hiding a review afterwards does not take its stars back
          out, because the average has no history to unpick.
        </p>
      </div>
    </div>
  );
}
