"use client";

/**
 * ANNOUNCEMENTS — the strip at the top of the three apps.
 *
 * WHAT THIS REPLACES
 * ------------------
 * `/dashboard/marketing/app-banner`: one text box, one on/off switch, and a
 * preview that drew the strip in TAKAL YELLOW while the customer app drew it in
 * BLACK. Colour, font, size, shape, timing and position were all written inside
 * customer_app/lib/widgets/app_banner.dart, so changing any of them meant a
 * developer, a build, and a Play Store release.
 *
 * Sana, 4 September 2026, after rejecting four designs I offered her:
 *
 *   "I want full modification setting in admin panel for that banner where i
 *    can add more change colour, Font, size, Style, design, and when to appear
 *    and how to and how long should stay on top and if there are more the after
 *    how many time should they change/appear next one."
 *
 * She was right to reject them. Choosing a look for her is a decision that has
 * to be made again every time the business changes; giving her the controls is
 * a decision made once.
 */

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure, errorMessage } from "@/lib/api-errors";
import { Button, ConfirmDialog, ErrorState } from "@/components/ui";
import {
  STATUS, announcementBackground, announcementInk, appsLine,
  previewText, tapRate, timingLine, whenLine,
} from "@/lib/announcements";
import { AnnouncementEditor, BLANK } from "./parts-editor";

type Row = Record<string, any>;

/** The database keeps timestamps with an offset; <input type="datetime-local">
 *  wants "YYYY-MM-DDTHH:mm" with none. Converting in both directions in one
 *  place is the only way the two stay honest. */
function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
       + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [rotate, setRotate] = useState(6);
  const [rotateDraft, setRotateDraft] = useState("6");
  const [loading, setLoading] = useState(true);
  // A FAILED READ MUST NOT BECOME A FACT ABOUT THE ANNOUNCEMENTS.
  // "No announcements yet" would send her off to write one she already has.
  const [loadError, setLoadError] = useState<ReadFailure>(null);

  const [draft, setDraft] = useState<Row | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = (await apiClient.getAnnouncements()) as any;
      setRows(res?.announcements || []);
      const secs = Number(res?.rotate_secs ?? 6);
      setRotate(secs);
      setRotateDraft(String(secs));
    } catch (e) {
      setLoadError(readFailure(e, "the announcements"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setDraft({ ...BLANK });
  };

  const openEdit = (row: Row) => {
    setEditingId(String(row.id));
    setDraft({
      ...BLANK, ...row,
      starts_at: toLocalInput(row.starts_at),
      ends_at: toLocalInput(row.ends_at),
      days: Array.isArray(row.days) ? row.days : [],
    });
  };

  const save = async () => {
    if (!draft) return;
    const payload: Row = {
      ...draft,
      starts_at: fromLocalInput(draft.starts_at),
      ends_at: fromLocalInput(draft.ends_at),
    };
    // The server checks all of this too, and the database checks it again. This
    // is only so the answer arrives before the round trip rather than as a red
    // box afterwards.
    if (!String(payload.name || "").trim()) {
      toast("Give it a name, so you can find it in the list later.", "error");
      return;
    }
    if (!String(payload.message || "").trim()) {
      toast("Type the message customers will read.", "error");
      return;
    }
    if (!payload.for_customer && !payload.for_rider && !payload.for_vendor) {
      toast("Choose at least one app, or nobody will ever see it.", "error");
      return;
    }
    try {
      setSaving(true);
      if (editingId) await apiClient.updateAnnouncement(editingId, payload);
      else await apiClient.createAnnouncement(payload);
      toast(editingId ? "Announcement saved" : "Announcement created", "success");
      setDraft(null);
      setEditingId(null);
      await load();
    } catch (e) {
      toast(errorMessage(e, "saving the announcement"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    try {
      setBusy(true);
      await apiClient.deleteAnnouncement(String(row.id));
      toast("Announcement deleted", "success");
      setDeleting(null);
      await load();
    } catch (e) {
      toast(errorMessage(e, "deleting the announcement"), "error");
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, by: number) => {
    const next = [...rows];
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);                       // move it on screen at once
    try {
      await apiClient.reorderAnnouncements(next.map((r) => String(r.id)));
    } catch (e) {
      toast(errorMessage(e, "saving the new order"), "error");
      await load();                      // put it back the way the server has it
    }
  };

  const saveRotate = async () => {
    const secs = Number(rotateDraft);
    if (!Number.isFinite(secs) || secs < 2 || secs > 120) {
      toast("How often they change must be between 2 and 120 seconds.", "error");
      return;
    }
    try {
      await apiClient.setAnnouncementRotate(secs);
      setRotate(secs);
      toast(`They will change every ${secs} seconds`, "success");
    } catch (e) {
      toast(errorMessage(e, "saving how often they change"), "error");
    }
  };

  const liveCount = rows.filter((r) => r.status === "live").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Announcements
          </h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            The strip below the search bar in your apps. Add as many as you like —
            they take turns.
          </p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>New announcement</Button>
      </div>

      {loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : null}

      {!loadError ? (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="text-takal-ink-soft">
            <b className="text-takal-ink">{rows.length}</b>{" "}
            {rows.length === 1 ? "announcement" : "announcements"} ·{" "}
            <b className="text-takal-ink">{liveCount}</b> showing now
          </span>
          <span className="text-takal-disabled-text">·</span>
          <label className="flex items-center gap-2 text-takal-ink-soft">
            they change every
            <input type="number" min={2} max={120} value={rotateDraft}
              onChange={(e) => setRotateDraft(e.target.value)}
              onBlur={() => { if (Number(rotateDraft) !== rotate) saveRotate(); }}
              className="w-16 py-1 text-center" />
            seconds
          </label>
        </div>
      ) : null}

      {loading ? (
        <p className="text-takal-ink-soft">Loading…</p>
      ) : loadError ? null : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-takal-line bg-white p-8 text-center">
          <p className="font-bold text-takal-ink">No announcements yet</p>
          <p className="text-sm text-takal-ink-soft mt-1">
            Nothing shows at the top of the apps. Press <b>New announcement</b> to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, i) => {
            const status = STATUS[row.status] || STATUS.off;
            const ink = announcementInk(row);
            const rate = tapRate(row);
            return (
              <div key={String(row.id)}
                className={`rounded-xl border bg-white p-3 flex items-center gap-3 flex-wrap
                  ${editingId === String(row.id) ? "border-2 border-takal-ink" : "border-takal-line"}`}>
                <div className="flex flex-col gap-0.5 text-takal-disabled-text">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    aria-label="Move up" className="disabled:opacity-25 text-[10px]">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                    aria-label="Move down" className="disabled:opacity-25 text-[10px]">▼</button>
                </div>

                {/* the real thing, small — the same colours the phone paints */}
                <div className="w-[168px] shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-extrabold
                                truncate"
                  style={{ background: announcementBackground(row), color: ink }}>
                  {row.icon ? `${row.icon} ` : ""}
                  {previewText(row.message || "", row.uppercase) || "—"}
                </div>

                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-bold text-takal-ink flex items-center gap-2 flex-wrap">
                    {row.name}
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${status.tone}`}>
                      {status.word}
                    </span>
                  </p>
                  <p className="text-[11px] text-takal-ink-soft mt-0.5">
                    {appsLine(row)} · {whenLine(row)} · {timingLine(row)}
                  </p>
                  <p className="text-[11px] text-takal-ink-soft">
                    {row.goes_to}
                    {" · "}
                    {Number(row.shown_count || 0)} shown
                    {rate !== null ? ` · ${row.tap_count} tapped (${rate}%)` : ""}
                  </p>
                  {row.colour_warning ? (
                    <p className="text-[11px] font-bold text-[#C8410F] mt-0.5">{row.colour_warning}</p>
                  ) : null}
                </div>

                <div className="flex gap-3 text-sm font-bold">
                  <button className="text-takal-ink hover:underline"
                    onClick={() => openEdit(row)}>Edit</button>
                  <button className="text-takal-red hover:underline"
                    onClick={() => setDeleting(row)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft ? (
        <AnnouncementEditor
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          onCancel={() => { setDraft(null); setEditingId(null); }}
          saving={saving}
          isNew={!editingId}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        onCancel={() => setDeleting(null)}
        title="Delete this announcement?"
        confirmLabel="Yes, delete it"
        message={
          <>
            <b>{deleting?.name}</b> will be removed, along with the record of how
            many times it was shown and tapped. This cannot be undone. If you only
            want to stop showing it, edit it and switch it off instead.
          </>
        }
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  );
}
