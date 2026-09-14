"use client";

/**
 * WEBSITE → FRONT PAGE.
 *
 * The words at the top of takalapp.com. Every box may be left empty, and empty
 * means "use the wording already built into the website" - so this screen can
 * never accidentally publish a blank headline.
 */

import { ErrorState, LoadingState } from "@/components/ui";
import { FRONT_PAGE_FIELDS } from "@/lib/website-fields";
import { WordField } from "./parts-word-field";
import { SaveBar } from "./parts-save-bar";
import { useWebsiteSettings } from "./use-website-settings";

/** What the website falls back to. Shown as the grey placeholder so the box is
 *  never a mystery: what you see is what the public sees today. */
const DEFAULTS: Record<string, string> = {
  site_headline: "Everything in Mingora,",
  site_headline_accent: "delivered.",
  site_subline:
    "Food, grocery, pharmacy, fashion and electronics - from the shops you already know, brought to your door in 15 to 45 minutes.",
  site_live_line: "Now delivering in Mingora",
  site_promise: "15-45 minutes",
};

export default function WebsiteFrontPage() {
  const { form, set, loading, saving, dirty, loadError, save } =
    useWebsiteSettings(FRONT_PAGE_FIELDS);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState
          message={
            <>
              <strong>This is not your real wording.</strong> {loadError.message} Do not
              save from this screen until it has loaded properly.
            </>
          }
          denied={loadError.denied}
          onRetry={() => window.location.reload()}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        {FRONT_PAGE_FIELDS.map((f) => (
          <WordField
            key={f.key}
            field={f}
            value={form[f.key] ?? ""}
            onChange={(v) => set(f.key, v)}
            placeholder={DEFAULTS[f.key] ?? ""}
          />
        ))}
        <SaveBar saving={saving} dirty={dirty} onSave={save} />
      </div>
    </div>
  );
}
