"use client";

// A PHARMACY'S LICENCE ON ITS STORE PAGE  (Mock 208-4, Sana 26 October 2026)
//
// For a pharmacy only. The shops already live before the rule (Shah Pharmacy,
// Helath Mart Pharmacy) show "Licence missing" until the office adds theirs
// here; a licence that has run out shows red, and 30 days before it does,
// amber. The server is the rule (backend/routers/shop_licences.py):
//   * number, valid-until and photo are all required
//   * "I have checked the real licence" needs the Approve shops permission
//   * a CHANGED licence saved without that tick loses its old OK - a new,
//     unchecked photo never rides on an old check

import { useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { LICENCE_STATE, licenceDate, missingForNewPharmacy, type ShopLicence } from "@/lib/shop-licence";

/** The chip in the store's header line. Nothing for a licence that is fine. */
export function LicenceChip({ licence, onOpen }: { licence: ShopLicence | null; onOpen: () => void }) {
  if (!licence?.needs_licence) return null;
  const st = LICENCE_STATE[licence.state];
  if (!st?.label || licence.state === "ok") return null;
  return (
    <button type="button" onClick={onOpen} data-licence-chip={licence.state}
      title="Open Settings - Pharmacy licence"
      className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold hover:underline ${st.tone}`}>
      {licence.state === "missing" || licence.state === "expired" ? "⚠ " : ""}{st.label}
    </button>
  );
}

export function LicenceCard({ restaurantId, licence, mayApprove, onSaved }: {
  restaurantId: string;
  /** undefined while it is being read; null when it could not be read. */
  licence: ShopLicence | null | undefined;
  /** Main Admin, or "Approve shops" - the server checks it again. */
  mayApprove: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(licence?.number || "");
  const [until, setUntil] = useState(licence?.valid_until || "");
  const [photo, setPhoto] = useState("");           // a NEW photo's path; empty = keep the one there
  const [ok, setOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (licence === undefined) {
    return (
      <div className="rounded-xl border border-takal-line p-5 text-sm text-takal-ink-soft">
        <h3 className="mb-1 font-semibold text-takal-ink">Pharmacy licence</h3>
        Reading…
      </div>
    );
  }
  if (!licence) {
    return (
      <div className="rounded-xl border border-takal-line p-5 text-sm text-takal-ink-soft">
        <h3 className="mb-1 font-semibold text-takal-ink">Pharmacy licence</h3>
        The licence could not be read just now. Reload the page to try again.
      </div>
    );
  }
  const st = LICENCE_STATE[licence.state];

  const start = () => {
    setNumber(licence.number || ""); setUntil(licence.valid_until || "");
    setPhoto(""); setOk(false); setProblem(""); setEditing(true);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await apiClient.uploadLicencePhoto(file);
      setPhoto(r.licence_photo);
    } catch (err) {
      toast(err instanceof Error ? err.message : "The licence photo could not be uploaded", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    // The same three things the server needs; an old photo already there counts.
    const gap = missingForNewPharmacy({ number, until, photo })
      .filter((g) => !(g === "Licence photo" && licence.has_photo));
    if (gap.length) { setProblem(`Please add: ${gap.join(", ")}.`); return; }
    setSaving(true); setProblem("");
    try {
      await apiClient.saveShopLicence(restaurantId, { number: number.trim(), valid_until: until, ...(photo ? { photo } : {}), ok });
      toast(ok ? "Licence saved and marked OK" : "Licence saved - it still needs checking", "success");
      setEditing(false);
      onSaved();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The licence could not be saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-licence-card className="rounded-xl border-[1.5px] border-black p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-takal-ink">Pharmacy licence</h3>
        {st?.label && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${st.tone}`}>{st.label}</span>}
        {!editing && (
          <button type="button" onClick={start}
            className="ml-auto rounded-lg border-[1.5px] border-black bg-takal-yellow px-3 py-1 text-[13px] font-bold text-black hover:bg-takal-yellow-dark">
            {licence.state === "missing" ? "Add licence" : "Change licence"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap items-start gap-4 text-sm">
          {licence.photo_link
            // eslint-disable-next-line @next/next/no-img-element
            ? <a href={licence.photo_link} target="_blank" rel="noopener noreferrer"><img src={licence.photo_link} alt="The pharmacy licence" className="h-24 w-36 rounded-lg border border-takal-line object-cover" /></a>
            : <span className="flex h-24 w-36 items-center justify-center rounded-lg bg-takal-red-soft px-2 text-center text-xs font-bold text-takal-red">
                {licence.has_photo ? "Photo could not be opened - reload" : "No photo"}
              </span>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-takal-ink-soft">Number</dt><dd className="font-semibold">{licence.number || "—"}</dd>
            <dt className="text-takal-ink-soft">Valid until</dt><dd className="font-semibold">{licenceDate(licence.valid_until) || "—"}</dd>
            <dt className="text-takal-ink-soft">Checked</dt>
            <dd className="font-semibold">{licence.ok_at ? `Yes · ${licenceDate(String(licence.ok_at).slice(0, 10))}` : "Not yet"}</dd>
          </dl>
          <p className="basis-full text-[12px] text-takal-ink-soft">
            {licence.state === "missing"
              ? "This pharmacy was live before licences were required. Customers still see it - add its licence so Takal has it on record."
              : "The photo is private: only the Takal office can open it, and the link stops working after 10 minutes."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-takal-ink">Licence number</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60}
              placeholder="e.g. 07-321-0045-123456D"
              className="w-full rounded-lg border border-takal-line px-3 py-2 focus:border-takal-ink focus:outline-none" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-takal-ink">Valid until</span>
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-lg border border-takal-line px-3 py-2 focus:border-takal-ink focus:outline-none" />
          </label>
          <div className="sm:col-span-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className={`w-full rounded-lg border-2 border-dashed px-3 py-3 text-sm font-bold ${
                photo ? "border-takal-green text-takal-green" : "border-takal-orange text-takal-ink"}`}>
              {uploading ? "Uploading…" : photo ? "✓ New licence photo added · Change"
                : licence.has_photo ? "＋ Replace the licence photo (optional)" : "＋ Add licence photo"}
            </button>
          </div>
          <label className={`flex items-start gap-2 text-sm sm:col-span-2 ${mayApprove ? "" : "opacity-60"}`}>
            <input type="checkbox" checked={ok} disabled={!mayApprove} onChange={(e) => setOk(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-black" />
            <span>
              <b>I have checked the real licence - it is right.</b>{" "}
              {mayApprove ? "This is the same as marking it OK on the Review page."
                : "Only somebody who may approve shops can tick this. Save it, and ask them."}
            </span>
          </label>
          {problem && <p role="alert" className="text-sm font-semibold text-takal-red sm:col-span-2">{problem}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={save} disabled={saving || uploading}
              className="rounded-lg border-[1.5px] border-black bg-takal-yellow px-4 py-2 text-sm font-bold text-black hover:bg-takal-yellow-dark disabled:opacity-60">
              {saving ? "Saving…" : "Save licence"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving}
              className="rounded-lg border-[1.5px] border-black bg-white px-4 py-2 text-sm font-bold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
