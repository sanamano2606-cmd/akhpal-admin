"use client";

/**
 * WEBSITE → LINKS.
 *
 * The support address at the bottom of the site, and where the two app-store
 * buttons go.
 *
 * Both store links must start with https://. That is checked here so it can be
 * seen while typing, and checked again on the server because that is the check
 * that actually holds - these values end up in a link on a public page that a
 * stranger's browser will follow.
 *
 * THE LEGAL PAGES ARE NOT EDITED HERE. The Privacy Policy and all three sets of
 * Terms are already written and published, in English and Urdu, and the website
 * links to those same pages. A second copy would drift from the first, and both
 * are binding - see the note at the bottom of this screen.
 */

import { ExternalLink, FileText } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui";
import { LINK_FIELDS } from "@/lib/website-fields";
import { WordField } from "../parts-word-field";
import { SaveBar } from "../parts-save-bar";
import { useWebsiteSettings } from "../use-website-settings";

const DEFAULTS: Record<string, string> = {
  site_email: "support@takalapp.com",
  site_play_url: "https://play.google.com/store/apps/details?id=com.takal.customer",
  site_app_url: "https://apps.apple.com/app/takal",
};

const LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Customer Terms", href: "/terms/customer" },
  { label: "Vendor Terms", href: "/terms/vendor" },
  { label: "Rider Terms", href: "/terms/rider" },
];

export default function WebsiteLinksPage() {
  const { form, set, loading, saving, dirty, loadError, save } = useWebsiteSettings(LINK_FIELDS);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {loadError && (
        <ErrorState
          message={
            <>
              <strong>These are not your real links.</strong> {loadError.message} Do not
              save from this screen until it has loaded properly.
            </>
          }
          denied={loadError.denied}
          onRetry={() => window.location.reload()}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        {LINK_FIELDS.map((f) => (
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

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-takal-ink">The legal pages</h3>
            <p className="text-sm text-takal-ink-soft mt-1">
              Already written and published, in English and Urdu. The website links
              to these same pages. There is deliberately only one copy of each —
              both languages are binding, so two copies that drifted apart would be
              two different promises.
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              {LEGAL.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-takal-ink underline"
                >
                  {l.label}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
