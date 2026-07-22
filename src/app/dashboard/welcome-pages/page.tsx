"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

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
  const [editing, setEditing] = useState<Slide | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = (await apiClient.getOnboardingSlides()) as any;
      setSlides(res?.slides || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (s: Slide) => {
    if (!window.confirm(`Delete welcome page "${s.title}"?`)) return;
    try {
      await apiClient.deleteOnboardingSlide(String(s.id));
      toast("Deleted", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome Pages</h1>
          <p className="text-slate-600 mt-1">
            The intro slides new users see on first launch. Changes re-show the
            intro to everyone on their next app open.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...blank, sort_order: slides.length + 1 })}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg font-medium"
        >
          + Add page
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="text-slate-500 bg-white rounded-lg border border-slate-200 p-8 text-center">
          No welcome pages yet. Click “Add page”.
        </div>
      ) : (
        <div className="grid gap-4">
          {slides.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-4">
              <div className="w-24 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-400 text-xs">No image</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{s.title}</div>
                <div className="text-sm text-slate-500 line-clamp-2">{s.body}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Page {s.sort_order} · {s.is_active ? <span className="text-green-600">Active</span> : <span>Hidden</span>}
                </div>
              </div>
              <button onClick={() => setEditing(s)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Edit</button>
              <button onClick={() => remove(s)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
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
    </div>
  );
}

function SlideEditor({ slide, onClose, onSaved }: { slide: Slide; onClose: () => void; onSaved: () => void }) {
  const editing = !!slide.id;
  const [f, setF] = useState<Slide>({ ...blank, ...slide });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const set = (k: string, v: any) => setF((p: Slide) => ({ ...p, [k]: v }));

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Image is over 5 MB", "error");
      return;
    }
    setUploading(true);
    try {
      const res = (await apiClient.uploadImage(file)) as any;
      if (res?.url) set("image_url", res.url);
      toast("Image uploaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
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

  const input = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">{editing ? "Edit page" : "Add page"}</h2>

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
                    ? "bg-primary-600 text-slate-900 border-primary-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
                <p className="text-sm font-medium text-slate-700">Video <span className="font-normal text-slate-400">(plays on the slide, max 100 MB)</span></p>
                <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploadingVideo ? "bg-slate-200 text-slate-500" : "bg-primary-600 hover:bg-primary-700 text-slate-900"}`}>
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
              <p className="text-sm font-medium text-slate-700">
                {f.media_type === "video" ? "Poster image" : "Image"}{" "}
                <span className="font-normal text-slate-400">
                  {f.media_type === "video" ? "(optional — shown while the video loads)" : "(shown on the slide)"}
                </span>
              </p>
              <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "bg-slate-200 text-slate-500" : "bg-primary-600 hover:bg-primary-700 text-slate-900"}`}>
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
              <label className="text-sm text-slate-600">Order</label>
              <input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-slate-900 rounded-lg">
            {saving ? "Saving…" : editing ? "Save" : "Add page"}
          </button>
        </div>
      </div>
    </div>
  );
}
