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
 *
 * THE COLOURS (approved by Sana, 7 September 2026: "add setting(small box) for
 * writing colour change", "Everything on the page").
 *
 * Every part of the printed page gets its own small colour box. An EMPTY
 * colour box does NOT mean black — it means "leave it as it was designed".
 * Somebody clearing a box they did not understand must not repaint the page.
 *
 * A colour too pale to read on WHITE PAPER is refused by the server, in words.
 * That check cannot live only here: a screen is not paper, so #FFFF00 looks
 * perfectly fine in this panel and comes out of the printer blank.
 *
 * There is deliberately no BACKGROUND colour. Paper is white, and a coloured
 * background is a full page of ink on every single sheet.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

type Fields = {
  business_name: string;
  business_tagline: string;
  business_tagline_2: string;
  business_office_1: string;
  business_office_2: string;
  business_region: string;
  business_ink_name: string;
  business_ink_line1: string;
  business_ink_line2: string;
  business_ink_address: string;
  business_ink_body: string;
  business_ink_footer: string;
};

const EMPTY: Fields = {
  business_name: "",
  business_tagline: "",
  business_tagline_2: "",
  business_office_1: "",
  business_office_2: "",
  business_region: "",
  business_ink_name: "",
  business_ink_line1: "",
  business_ink_line2: "",
  business_ink_address: "",
  business_ink_body: "",
  business_ink_footer: "",
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
    label: "Slogan — line 1",
    hint: "Printed bold, under the name.",
    placeholder: "SMART PEOPLE, SMART SWAT",
  },
  {
    key: "business_tagline_2",
    label: "Slogan — line 2",
    hint: "Smaller and lighter, under line 1. Empty means it is not printed.",
    placeholder: "All Essentials In One Click",
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

/**
 * The colour boxes. `fallback` is the colour that part of the page is printed
 * in TODAY, and it is what the swatch shows while the box is empty — so the
 * screen always says what will actually come out of the printer, rather than
 * an empty square that says nothing.
 */
const INKS: {
  key: keyof Fields;
  label: string;
  fallback: string;
  hint: string;
}[] = [
  { key: "business_ink_name", label: "The name", fallback: "#000000",
    hint: "The big word at the top." },
  { key: "business_ink_line1", label: "Slogan line 1", fallback: "#000000",
    hint: "The bold line under the name." },
  { key: "business_ink_line2", label: "Slogan line 2", fallback: "#4A4A4A",
    hint: "The lighter line under that." },
  { key: "business_ink_address", label: "The address block", fallback: "#000000",
    hint: "Offices, phone and email, top right." },
  { key: "business_ink_body", label: "The letter itself", fallback: "#000000",
    hint: "What you type. Black is what a bank or an office expects." },
  { key: "business_ink_footer", label: "The bottom line", fallback: "#4A4A4A",
    hint: "The region line along the foot of the page." },
];

/** Is this something the colour picker and the swatch can actually show? */
function isHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v.trim());
}

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
        business_tagline_2: s?.business_tagline_2 ?? "",
        business_office_1: s?.business_office_1 ?? "",
        business_office_2: s?.business_office_2 ?? "",
        business_region: s?.business_region ?? "",
        business_ink_name: s?.business_ink_name ?? "",
        business_ink_line1: s?.business_ink_line1 ?? "",
        business_ink_line2: s?.business_ink_line2 ?? "",
        business_ink_address: s?.business_ink_address ?? "",
        business_ink_body: s?.business_ink_body ?? "",
        business_ink_footer: s?.business_ink_footer ?? "",
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

        {/* ── The writing colours ─────────────────────────────────────── */}
        <div className="border-t border-takal-line pt-5">
          <h3 className="text-sm font-bold text-takal-ink">Writing colour</h3>
          <p className="mt-1 text-xs leading-relaxed text-takal-ink-soft">
            Each part of the printed page can have its own colour. Leave a box
            empty to keep the colour it has now — empty does <b>not</b> mean
            black. A colour too pale to read on white paper is refused when you
            save, because the screen you are looking at is not paper.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {INKS.map((c) => {
              const typed = form[c.key].trim();
              const shown = isHex(typed) ? typed : c.fallback;
              const usingDefault = typed === "";
              return (
                <div key={c.key} className="flex items-start gap-3">
                  <input
                    type="color"
                    aria-label={`${c.label} colour`}
                    value={shown}
                    disabled={loading}
                    onChange={(e) =>
                      setForm({ ...form, [c.key]: e.target.value.toUpperCase() })
                    }
                    className="mt-1 h-9 w-9 shrink-0 cursor-pointer rounded-lg border-2 border-takal-line bg-white p-0.5 disabled:cursor-not-allowed"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      className="text-sm font-bold text-takal-ink"
                      htmlFor={`${c.key}-hex`}
                    >
                      {c.label}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id={`${c.key}-hex`}
                        value={form[c.key]}
                        disabled={loading}
                        onChange={(e) =>
                          setForm({ ...form, [c.key]: e.target.value })
                        }
                        placeholder={c.fallback}
                        spellCheck={false}
                        className="w-28 rounded-lg border-2 border-takal-line px-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-takal-yellow disabled:bg-takal-page"
                      />
                      {usingDefault ? (
                        <span className="text-xs text-takal-ink-soft">
                          using {c.fallback}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, [c.key]: "" })}
                          className="text-xs font-medium text-takal-blue underline underline-offset-2"
                        >
                          put back
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-takal-ink-soft">{c.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-takal-ink-soft">
            There is no background colour on purpose. Paper is white, and a
            coloured background means a full page of ink on every sheet.
          </p>
        </div>

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
