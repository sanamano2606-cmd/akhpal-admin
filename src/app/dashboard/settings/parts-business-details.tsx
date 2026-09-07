"use client";

/**
 * THE BUSINESS'S OWN DETAILS — the ones that print on a letterhead.
 *
 * Sana, 4 September 2026, approving Mock 7:
 *   "Add setting in admin panel from where i can change the Email and contact
 *    number any time and can edit the Letter head if possible?"
 *
 * The phone and the email are NOT here. They already exist one card up, in
 * TakalContact, and the letterhead reads those. Two copies of a phone number
 * are two phone numbers, and the day one is changed and the other is not, a
 * letter and a delivery slip disagree about how to reach the business — on
 * exactly the two pieces of paper a stranger holds.
 *
 * What IS here is everything else the top of a letter needs: the name, the
 * line under it, the offices and the region.
 *
 * AN EMPTY BOX REMOVES THE LINE. Nothing is invented to fill a gap. Close the
 * Matta office, empty that box, and it stops printing — the same rule the
 * phone number already follows.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

type Fields = {
  business_name: string;
  business_tagline: string;
  business_office_1: string;
  business_office_2: string;
  business_region: string;
};

const EMPTY: Fields = {
  business_name: "",
  business_tagline: "",
  business_office_1: "",
  business_office_2: "",
  business_region: "",
};

const BOXES: { key: keyof Fields; label: string; hint: string; placeholder: string }[] = [
  {
    key: "business_name",
    label: "Business name",
    hint: "Printed large at the top of every letter.",
    placeholder: "Takal",
  },
  {
    key: "business_tagline",
    label: "One line under the name",
    hint: "What the business does, in a few words.",
    placeholder: "Delivery · Swat",
  },
  {
    key: "business_office_1",
    label: "Office 1",
    hint: "The main office address.",
    placeholder: "Takal Office, Mingora, Swat",
  },
  {
    key: "business_office_2",
    label: "Office 2 (optional)",
    hint: "Leave empty if there is one office. Empty means it is not printed.",
    placeholder: "Takal Office, Matta, Swat",
  },
  {
    key: "business_region",
    label: "Line along the bottom",
    hint: "Sits in the footer of the page.",
    placeholder: "Swat, Khyber Pakhtunkhwa, Pakistan",
  },
];

export function BusinessDetails() {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [saved, setSaved] = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const s = (await apiClient.getSettings()) as any;
      const next: Fields = {
        business_name: s?.business_name ?? "",
        business_tagline: s?.business_tagline ?? "",
        business_office_1: s?.business_office_1 ?? "",
        business_office_2: s?.business_office_2 ?? "",
        business_region: s?.business_region ?? "",
      };
      setForm(next);
      setSaved(next);
    } catch (err) {
      setError(errorMessage(err, "the business details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = (Object.keys(EMPTY) as (keyof Fields)[]).some(
    (k) => form[k].trim() !== saved[k].trim()
  );

  const save = async () => {
    try {
      setSaving(true);
      const body: Record<string, string> = {};
      (Object.keys(EMPTY) as (keyof Fields)[]).forEach((k) => {
        body[k] = form[k].trim();
      });
      await apiClient.updateSettings(body);
      toast("Saved. Every letter printed from now on uses these.", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the business details"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Business details for the letterhead"
        hint="The name, offices and footer printed at the top and bottom of a letter."
      />
      <CardBody className="space-y-4">
        <div className="rounded-r-lg border-l-4 border-takal-yellow bg-takal-yellow-wash px-4 py-3 text-sm leading-relaxed text-takal-ink">
          The phone number and email come from the card above, so they are typed
          once and printed everywhere. Change them there and every letter
          printed afterwards follows.
        </div>

        {error ? (
          <p className="rounded-lg bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
            {error}
          </p>
        ) : null}

        {BOXES.map((b) => (
          <div key={b.key} className="grid gap-1 md:grid-cols-[200px_1fr] md:gap-6">
            <label className="pt-2 text-sm font-bold text-takal-ink" htmlFor={b.key}>
              {b.label}
            </label>
            <div>
              <input
                id={b.key}
                value={form[b.key]}
                disabled={loading}
                onChange={(e) => setForm({ ...form, [b.key]: e.target.value })}
                placeholder={loading ? "Reading…" : b.placeholder}
                className="w-full max-w-md rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow disabled:bg-takal-page"
              />
              <p className="mt-1 text-xs text-takal-ink-soft">{b.hint}</p>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 border-t border-takal-line pt-4">
          <Button onClick={save} loading={saving} disabled={loading || !changed}>
            Save
          </Button>
          {changed ? (
            <Button variant="secondary" onClick={() => setForm(saved)} disabled={saving}>
              Undo my changes
            </Button>
          ) : null}
          <a
            href="/dashboard/settings/letterhead"
            className="text-sm font-medium text-takal-blue underline underline-offset-2"
          >
            Write and print a letter →
          </a>
        </div>
      </CardBody>
    </Card>
  );
}
