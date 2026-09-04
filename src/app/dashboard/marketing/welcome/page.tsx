"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { ConfirmDialog, ErrorState, useDialogKeys } from "@/components/ui";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";

type Slide = any;

const blank = {
  title: "",
  body: "",
  image_url: "",
  video_url: "",
  media_type: "image",
  sort_order: 0,
  is_active: true,
};

export default function WelcomePagesPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [removing, setRemoving] = useState<Slide | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await apiClient.getOnboardingSlides()) as any;
      setSlides(res?.slides || []);
    } catch (e) {
      // // A FAILED READ MUST NOT BECOME A FACT ABOUT THE BUSINESS.
      // Fixed 3 September 2026. This used to catch, show a toast that
      // vanishes in three and a half seconds, and then render the empty
      // state — telling the office something about the world that was not
      // true. The error is kept, and the empty state below is gated on it.
      setLoadError(readFailure(e, "the welcome screens"));
      toast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * Move a screen up or down and save the WHOLE order.
   *
   * Positions used to be a number typed into a box on the editor, with nothing
   * stopping two screens claiming the same one — and two screens on the same
   * number appear in whatever order the database happens to return, which can
   * change between reads. The server rewrites them as 1, 2, 3…
   */
  const move = async (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[index], next[to]] = [next[to], next[index]];
    setSlides(next);
    try {
      setBusy(true);
      const res = (await apiClient.reorderOnboardingSlides(
        next.map((x) => String(x.id)),
      )) as any;
      setSlides(res?.slides || next);
    } catch (e) {
      toast(errorMessage(e, "saving the new order"), "error");
      load();
    } finally {
      setBusy(false);
    }
  };

  // Not window.confirm. The browser's grey box cannot say that the app re-shows
  // the welcome screens to everybody when they change — which it does, because
  // the app watches a version stamp built from these rows.
  const remove = async () => {
    if (!removing) return;
    try {
      setBusy(true);
      await apiClient.deleteOnboardingSlide(String(removing.id));
      toast("Deleted", "success");
      setRemoving(null);
      load();
    } catch (e) {
      toast(errorMessage(e, "deleting the welcome screen"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Welcome Screens</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">The pages a customer swipes through the first time they open the app.</p>
        </div>
        <button
          onClick={() => setEditing({ ...blank, sort_order: slides.length + 1 })}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg font-medium"
        >
          + Add page
        </button>
      </div>

      {/* THE ERROR COMES FIRST, AND THE EMPTY STATE IS GATED ON IT.
          An empty state is a claim about the world. It may only be made
          when the world was actually read. */}
      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : loadError ? (
        <ErrorState
          message={loadError.message}
          onRetry={load}
          denied={loadError.denied}
        />
      ) : slides.length === 0 ? (
        <div className="text-takal-ink-soft bg-white rounded-lg border border-takal-line p-8 text-center">
          No welcome pages yet. Click “Add page”.
        </div>
      ) : (
        <div className="grid gap-4">
          {slides.map((s, i) => (
            <div key={s.id} className="bg-white rounded-xl border border-takal-line p-3 flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || busy}
                  title="Move up"
                  className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === slides.length - 1 || busy}
                  title="Move down"
                  className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-24 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-takal-disabled-text text-xs">No image</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-takal-ink">{s.title}</div>
                <div className="text-sm text-takal-ink-soft line-clamp-2">{s.body}</div>
                <div className="text-xs text-takal-disabled-text mt-1">
                  Page {s.sort_order} · {s.is_active ? <span className="text-green-600">Active</span> : <span>Hidden</span>}
                </div>
              </div>
              <button onClick={() => setEditing(s)} className="px-3 py-1.5 text-sm border border-takal-line rounded-lg hover:bg-takal-page">Edit</button>
              <button onClick={() => setRemoving(s)} className="px-3 py-1.5 text-sm text-takal-red hover:bg-takal-red-soft rounded-lg">Delete</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SlideEditor
          slide={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        busy={busy}
        title={`Delete "${removing?.title ?? ""}"?`}
        confirmLabel="Delete it"
        message={
          <>
            The remaining screens move up to fill the gap. Changing these makes
            the app show the welcome screens again to everybody who has already
            seen them — so if you only want to hide this one for now, edit it
            and untick <strong>Active</strong> instead.
          </>
        }
      />
    </div>
  );
}

function SlideEditor({ slide, onClose, onSaved }: { slide: Slide; onClose: () => void; onSaved: () => void }) {
  const editing = !!slide.id;
  const [f, setF] = useState<Slide>({ ...blank, ...slide });
  const [saving, setSaving] = useState(false);
  const { upload: uploadImage, uploading } = useImageUpload();
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Escape closes it and the page behind stops scrolling - the two things
  // the shared Modal does and these hand-built windows never did.
  useDialogKeys(true, onClose, saving);

  const set = (k: string, v: any) => setF((p: Slide) => ({ ...p, [k]: v }));

  // Was a private copy of this, byte for byte identical to the one on the other
  // page. Now one shared hook - see lib/hooks/useImageUpload.ts.
  const upload = async (file: File | null) => {
    const url = await uploadImage(file);
    if (url) set("image_url", url);
  };

  const uploadVid = async (file: File | null) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast("Video is over 100 MB", "error");
      return;
    }
    setUploadingVideo(true);
    try {
      const res = (await apiClient.uploadVideo(file)) as any;
      if (res?.video_url) set("video_url", res.video_url);
      toast("Video uploaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Video upload failed", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  const save = async () => {
    if (!f.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    const payload = {
      title: f.title.trim(),
      body: f.body?.trim() || "",
      image_url: f.image_url?.trim() || "",
      video_url: f.media_type === "video" ? f.video_url?.trim() || "" : "",
      media_type: f.media_type || "image",
      sort_order: parseInt(String(f.sort_order)) || 0,
      is_active: !!f.is_active,
    };
    try {
      setSaving(true);
      if (editing) await apiClient.updateOnboardingSlide(String(slide.id), payload);
      else await apiClient.createOnboardingSlide(payload);
      toast(editing ? "Saved" : "Added", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-takal-ink mb-4">{editing ? "Edit page" : "Add page"}</h2>

        <div className="space-y-3">
          <input placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} className={input} />
          <textarea placeholder="Body text" value={f.body} onChange={(e) => set("body", e.target.value)} rows={3} className={input} />

          {/* Media type */}
          <div className="flex gap-2">
            {["image", "video"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("media_type", t)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                  f.media_type === t
                    ? "bg-takal-yellow text-takal-ink border-takal-yellow"
                    : "bg-white text-takal-ink-soft border-takal-line hover:bg-takal-page"
                }`}
              >
                {t === "image" ? "🖼️ Image" : "🎬 Video"}
              </button>
            ))}
          </div>

          {/* Video upload (when media type = video) */}
          {f.media_type === "video" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-takal-ink">Video <span className="font-normal text-takal-disabled-text">(plays on the slide, max 100 MB)</span></p>
                <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploadingVideo ? "bg-slate-200 text-takal-ink-soft" : "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink"}`}>
                  {uploadingVideo ? "Uploading…" : "＋ Upload video"}
                  <input type="file" accept="video/*" disabled={uploadingVideo} className="hidden" onChange={(e) => { uploadVid(e.target.files?.[0] || null); e.target.value = ""; }} />
                </label>
              </div>
              {f.video_url ? (
                <div className="flex items-center gap-2">
                  <video src={f.video_url} className="w-32 h-20 rounded border bg-black object-cover" muted controls />
                  <button type="button" onClick={() => set("video_url", "")} className="text-sm text-red-600">Remove video</button>
                </div>
              ) : (
                <input placeholder="…or paste a video URL" value={f.video_url} onChange={(e) => set("video_url", e.target.value)} className={input} />
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-takal-ink">
                {f.media_type === "video" ? "Poster image" : "Image"}{" "}
                <span className="font-normal text-takal-disabled-text">
                  {f.media_type === "video" ? "(optional — shown while the video loads)" : "(shown on the slide)"}
                </span>
              </p>
              <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "bg-slate-200 text-takal-ink-soft" : "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink"}`}>
                {uploading ? "Uploading…" : "＋ Upload"}
                <input type="file" accept="image/*" disabled={uploading} className="hidden" onChange={(e) => { upload(e.target.files?.[0] || null); e.target.value = ""; }} />
              </label>
            </div>
            {f.image_url ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.image_url} alt="" className="w-20 h-28 object-cover rounded border" />
                <button type="button" onClick={() => set("image_url", "")} className="text-sm text-red-600">Remove</button>
              </div>
            ) : (
              <input placeholder="…or paste an image URL" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} className={input} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-takal-ink-soft">Order</label>
              <input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="w-20 px-2 py-1.5 border border-takal-line rounded text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-takal-ink">
              <input type="checkbox" checked={!!f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg">
            {saving ? "Saving…" : editing ? "Save" : "Add page"}
          </button>
        </div>
      </div>
    </div>
  );
}
