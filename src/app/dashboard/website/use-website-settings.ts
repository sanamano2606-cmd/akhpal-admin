"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import type { WebsiteField } from "@/lib/website-fields";

/**
 * The shared machinery behind all three Website screens: load the current
 * wording, track what has been edited, and save only what actually changed.
 *
 * WHY ONLY WHAT CHANGED. /admin/settings saves everything it is sent. Sending
 * the whole form back would write every box on every save - so opening this
 * screen while another page had a value half-typed, and pressing Save, would
 * publish it. Sending only the changed boxes cannot do that.
 */
export function useWebsiteSettings(fields: WebsiteField[]) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<string, string>;

  const [form, setForm] = useState<Record<string, string>>(blank);
  const [saved, setSaved] = useState<Record<string, string>>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<ReadFailure>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = (await apiClient.getSettings()) as any;
        const got: Record<string, string> = {};
        for (const f of fields) got[f.key] = s?.[f.key] != null ? String(s[f.key]) : "";
        setForm(got);
        setSaved(got);
      } catch (err) {
        // A form that failed to load and a form that was never filled in look
        // identical - both are empty. Saving from the first would publish
        // blanks over real wording, so the screen has to say which it is.
        setLoadError(readFailure(err, "the website wording"));
      } finally {
        setLoading(false);
      }
    })();
    // `fields` is a module-level constant for each screen and never changes.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
  }, []);

  const changed = fields.filter((f) => (form[f.key] ?? "") !== (saved[f.key] ?? ""));
  const dirty = changed.length > 0 && !loadError;

  const save = useCallback(async () => {
    if (loadError) {
      toast("These are not your real settings. Reload the page before saving.", "error");
      return;
    }

    const payload: Record<string, string> = {};
    for (const f of changed) {
      const raw = (form[f.key] ?? "").trim();

      if (raw.length > f.max) {
        toast(`${f.label} is too long — ${raw.length} characters, the most is ${f.max}.`, "error");
        return;
      }
      if (f.link && raw !== "" && !raw.toLowerCase().startsWith("https://")) {
        toast(`${f.label} must start with https://`, "error");
        return;
      }
      payload[f.key] = raw;
    }

    if (Object.keys(payload).length === 0) {
      // Nothing went wrong. Nothing was changed. That is not an error.
      toast("Nothing has been changed, so there is nothing to save.", "info");
      return;
    }

    setSaving(true);
    try {
      await apiClient.updateSettings(payload);
      setSaved({ ...saved, ...payload });
      setForm((p) => ({ ...p, ...payload }));
      toast("Saved. The website updates within about a minute.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }, [changed, form, loadError, saved]);

  return { form, set, loading, saving, dirty, loadError, save };
}
