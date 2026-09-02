"use client";

/**
 * HOW TAKAL ITSELF IS REACHED — changeable any time.
 *
 * Sana, 2 September 2026: "Add in the setting where i can change the Takal's
 * phone and email any time."
 *
 * WHY THESE TWO DETAILS MATTER MORE THAN THEY LOOK. Sana's own privacy rule
 * (docs/PRIVACY-AND-CONTACT-RULES.md, section 3) says a customer never gets a
 * shop's number and a shop never gets a customer's — both sides reach the
 * other THROUGH Takal. So this number and this email are the only way those
 * two sides can ever be put in touch, and they are printed on every delivery
 * slip that leaves the office.
 *
 * They used to be written into the panel's code, which meant changing a phone
 * number needed a developer and a deploy — and slips already printed would
 * disagree with the code. They are saved with the rest of the settings now.
 *
 * AN EMPTY BOX REMOVES THE DETAIL, and nothing is ever invented to fill the
 * gap: everything that prints these leaves the line out entirely when there is
 * nothing here. A wrong number on a real slip is worse than no number, because
 * somebody rings it, gets nothing, and stops trusting the slip.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

type Fields = { support_phone: string; support_email: string; support_whatsapp: string };

const EMPTY: Fields = { support_phone: "", support_email: "", support_whatsapp: "" };

const BOXES: { key: keyof Fields; label: string; hint: string; placeholder: string }[] = [
  {
    key: "support_phone",
    label: "Phone number",
    hint: "Printed on every delivery slip. A customer or a shop rings this, never each other.",
    placeholder: "0946 712 330",
  },
  {
    key: "support_email",
    label: "Email address",
    hint: "Printed on the slip and shown on the privacy and terms pages.",
    placeholder: "help@takal.pk",
  },
  {
    key: "support_whatsapp",
    label: "WhatsApp (optional)",
    hint: "Only used where a WhatsApp link makes sense. Leave empty if it is the same number.",
    placeholder: "0333 445 9910",
  },
];

export function TakalContact() {
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
        support_phone: s?.support_phone ?? "",
        support_email: s?.support_email ?? "",
        support_whatsapp: s?.support_whatsapp ?? "",
      };
      setForm(next);
      setSaved(next);
    } catch (err) {
      setError(errorMessage(err, "the contact details"));
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
    const email = form.support_email.trim();
    // Caught here as well as on the server, so the mistake is named before the
    // trip rather than after it. It goes on paper that leaves the building.
    if (email && !email.includes("@")) {
      toast(`"${email}" is not an email address.`, "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateSettings({
        support_phone: form.support_phone.trim(),
        support_email: email,
        support_whatsapp: form.support_whatsapp.trim(),
      });
      toast("Saved. New slips will carry these details.", "success");
      await load();
    } catch (err) {
      toast(errorMessage(err, "the contact details"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="How Takal itself is reached"
        hint="Printed on every delivery slip. Change it here any time — no release needed."
      />
      <CardBody className="space-y-4">
        <div className="rounded-r-lg border-l-4 border-takal-blue bg-takal-blue-soft px-4 py-3 text-sm leading-relaxed text-takal-blue">
          A customer never gets a shop&rsquo;s number and a shop never gets a
          customer&rsquo;s — both sides reach the other through Takal. These
          details are the only way that happens, so keep them working.
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
              Undo
            </Button>
          ) : null}
          <p className="text-xs text-takal-ink-soft">
            {form.support_phone.trim() || form.support_email.trim()
              ? "Empty a box to take that detail off the slips."
              : "Nothing is set, so the slip prints no way of reaching Takal at all."}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
