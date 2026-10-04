"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME SCREENS - EVERYTHING ON THEM IS EDITED HERE (Mock 149 Idea 4).
//
// Sana, 4 October 2026: "idea 4 keep it editable from admin panel too include
// all things to be editable" ... "if i want to turn off so i could from admin
// panel".
//
// For ALL screens together (the card at the top):
//   * the welcome screens on or off - off, the app opens straight on Home;
//   * Skip shown or hidden;
//   * the photo wall moving or still, and its speed;
//   * the words on the Next / Get Started / Skip buttons, English and Urdu.
// For EACH screen (the editor, with a live phone preview):
//   * headline line 1, the highlighted line 2 and the text - English and Urdu;
//   * the photo wall: up to 12 photos, added, moved and removed here;
//   * the highlight colour; on/off; or a video instead of the wall.
// Anything left empty uses the app's own words and photos.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { ConfirmDialog, ErrorState, useDialogKeys } from "@/components/ui";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";

type Slide = any;
type Settings = {
  enabled: boolean;
  show_skip: boolean;
  wall_motion: boolean;
  wall_speed: "slow" | "normal";
  next_en: string | null;
  next_ur: string | null;
  start_en: string | null;
  start_ur: string | null;
  skip_en: string | null;
  skip_ur: string | null;
};

/** The most photos one wall may have - the server and database say the same. */
const MAX_PHOTOS = 12;

/** Takal yellow: the highlight when no other colour is chosen. */
const TAKAL_YELLOW = "#FFFF00";

/** The app's own button words, shown as the hint in each empty box. */
const APP_WORDS = {
  next_en: "Next", next_ur: "اگلا",
  start_en: "Get Started", start_ur: "شروع کریں",
  skip_en: "Skip", skip_ur: "چھوڑ دیں",
};

const DEFAULT_SETTINGS: Settings = {
  enabled: true, show_skip: true, wall_motion: true, wall_speed: "slow",
  next_en: null, next_ur: null, start_en: null, start_ur: null, skip_en: null, skip_ur: null,
};

const blank = {
  title: "",
  title_ur: "",
  highlight: "",
  highlight_ur: "",
  body: "",
  body_ur: "",
  photos: [] as string[],
  highlight_color: "",
  image_url: "",
  video_url: "",
  media_type: "image",
  sort_order: 0,
  is_active: true,
};

/** Every photo a screen's wall will show from the panel: its older single
 *  photo first (if it is not already in the list), then the wall photos. */
function panelPhotos(s: Slide): string[] {
  const out: string[] = [];
  const single = String(s?.image_url || "").trim();
  if (single) out.push(single);
  for (const p of (s?.photos || []) as string[]) {
    const u = String(p || "").trim();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

export default function WelcomePagesPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
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
      setSettings({ ...DEFAULT_SETTINGS, ...(res?.settings || {}) });
    } catch (e) {
      // A FAILED READ MUST NOT BECOME A FACT ABOUT THE BUSINESS: the error is
      // kept and the empty state below is gated on it.
      setLoadError(readFailure(e, "the welcome screens"));
      toast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** Move a screen up or down and save the WHOLE order (the server rewrites
   *  them as 1, 2, 3… so two screens can never share a place). */
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
          <p className="text-takal-ink-soft mt-1 text-sm">
            The screens a customer swipes through the first time they open the app - a wall of
            photos, a headline and a button. Everything here reaches the phones without a new app.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...blank, sort_order: slides.length + 1 })}
          className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg font-medium"
        >
          + Add screen
        </button>
      </div>

      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : (
        <>
          <AllScreensCard settings={settings} onSaved={setSettings} />

          {slides.length === 0 ? (
            <div className="text-takal-ink-soft bg-white rounded-lg border border-takal-line p-8 text-center">
              No welcome screens yet - the app shows its own three. Click “Add screen” to make your own.
            </div>
          ) : (
            <div className={`grid gap-4 ${settings.enabled ? "" : "opacity-50"}`}>
              {slides.map((s, i) => {
                const photos = panelPhotos(s);
                return (
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
                    <div className="grid grid-cols-3 gap-0.5 w-24 h-28 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                      {Array.from({ length: 6 }).map((_, k) =>
                        photos[k] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={k} src={photos[k]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div key={k} className="bg-slate-200" />
                        ),
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-takal-ink">
                        {s.title}{" "}
                        {s.highlight ? (
                          <span className="px-1.5 rounded" style={{ background: s.highlight_color || TAKAL_YELLOW }}>
                            {s.highlight}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-takal-ink-soft line-clamp-2">{s.body}</div>
                      <div className="text-xs text-takal-disabled-text mt-1">
                        Screen {i + 1} · {s.is_active ? <span className="text-green-600">On</span> : <span>Hidden</span>} ·{" "}
                        {s.media_type === "video" ? "Video" : `${photos.length} of ${MAX_PHOTOS} photos`} ·{" "}
                        {s.title_ur || s.highlight_ur || s.body_ur ? "Urdu ✓" : "No Urdu yet (shows English)"}
                      </div>
                    </div>
                    <button onClick={() => setEditing(s)} className="px-3 py-1.5 text-sm border border-takal-line rounded-lg hover:bg-takal-page">Edit</button>
                    <button onClick={() => setRemoving(s)} className="px-3 py-1.5 text-sm text-takal-red hover:bg-takal-red-soft rounded-lg">Delete</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <SlideEditor
          slide={editing}
          settings={settings}
          index={Math.max(0, slides.findIndex((x) => x.id === editing.id))}
          total={Math.max(slides.length, 1)}
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
            The remaining screens move up to fill the gap. Changing these makes the app show the
            welcome screens again to everybody who has already seen them - so if you only want to
            hide this one for now, edit it and switch <strong>On</strong> off instead.
          </>
        }
      />
    </div>
  );
}

// ── THE SETTINGS FOR ALL SCREENS ────────────────────────────────────────────

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-takal-ink" : "bg-slate-300"}`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-takal-ink">{label}</span>
        {hint ? <span className="block text-xs text-takal-ink-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

function AllScreensCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [f, setF] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setF(settings), [settings]);
  const set = (k: keyof Settings, v: any) => setF((p) => ({ ...p, [k]: v }));
  const changed = JSON.stringify(f) !== JSON.stringify(settings);

  const save = async () => {
    try {
      setSaving(true);
      const payload: any = { ...f };
      for (const k of ["next_en", "next_ur", "start_en", "start_ur", "skip_en", "skip_ur"]) {
        payload[k] = String(payload[k] || "").trim();
      }
      const res = (await apiClient.updateOnboardingSettings(payload)) as any;
      onSaved({ ...DEFAULT_SETTINGS, ...(res?.settings || f) });
      toast("Saved - the phones get it the next time the app opens", "success");
    } catch (e) {
      toast(errorMessage(e, "saving the welcome settings"), "error");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";
  const words: [keyof Settings, string, boolean][] = [
    ["next_en", "Next", false], ["next_ur", "Next (Urdu)", true],
    ["start_en", "Get Started (last screen)", false], ["start_ur", "Get Started (Urdu)", true],
    ["skip_en", "Skip", false], ["skip_ur", "Skip (Urdu)", true],
  ];

  return (
    <div className="bg-white rounded-xl border border-takal-line p-5 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-takal-ink">All welcome screens</h3>
          <p className="text-xs text-takal-ink-soft">These apply to every screen.</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${f.enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>
          {f.enabled ? "ON - new customers see them" : "OFF - the app opens on Home"}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Toggle on={f.enabled} onChange={(v) => set("enabled", v)} label="Show the welcome screens"
          hint="Switch off and the app opens straight on Home for everybody." />
        <Toggle on={f.show_skip} onChange={(v) => set("show_skip", v)} label="Show the Skip button"
          hint="Off: customers swipe through every screen." />
        <Toggle on={f.wall_motion} onChange={(v) => set("wall_motion", v)} label="The photo wall moves"
          hint="The photo columns drift slowly up and down." />
        <div className={f.wall_motion ? "" : "opacity-40 pointer-events-none"}>
          <span className="block text-sm font-medium text-takal-ink mb-1">Speed</span>
          <div className="flex gap-2">
            {(["slow", "normal"] as const).map((sp) => (
              <button key={sp} type="button" onClick={() => set("wall_speed", sp)}
                className={`px-4 py-1.5 rounded-lg text-sm border ${f.wall_speed === sp ? "bg-takal-yellow border-takal-ink font-semibold" : "border-takal-line"}`}>
                {sp === "slow" ? "Slow" : "Normal"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-takal-ink mb-1">Button words <span className="font-normal text-takal-ink-soft">(leave empty for the app&rsquo;s own word)</span></span>
        <div className="grid md:grid-cols-2 gap-2">
          {words.map(([k, label, urdu]) => (
            <label key={k} className="text-xs text-takal-ink-soft">
              {label}
              <input
                value={(f[k] as string) || ""}
                maxLength={30}
                dir={urdu ? "rtl" : "ltr"}
                placeholder={(APP_WORDS as any)[k]}
                onChange={(e) => set(k, e.target.value)}
                className={input}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={!changed || saving}
          className="px-5 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:opacity-40 text-takal-ink rounded-lg font-medium">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ── THE LIVE PREVIEW ────────────────────────────────────────────────────────

/** A phone drawn the way the app draws a welcome screen: the tilted wall of
 *  photos fading into white, the headline with its highlighted line, the text,
 *  the dots and the button. Grey tiles stand for the app's own photos. */
function PhonePreview({ f, settings, urdu, index, total }: { f: Slide; settings: Settings; urdu: boolean; index: number; total: number }) {
  const pick = (k: string) => (urdu && String(f[`${k}_ur`] || "").trim()) || String(f[k] || "");
  const photos = panelPhotos(f);
  const cells = Array.from({ length: MAX_PHOTOS }, (_, k) => photos[k] || null);
  const cols: (string | null)[][] = [[], [], []];
  cells.forEach((p, k) => cols[k % 3].push(p));
  const heights = [74, 88, 80, 92, 84];
  const starts = [-20, -56, -10];
  const last = index >= total - 1;
  const word = (key: "next" | "start" | "skip") =>
    (urdu ? (settings as any)[`${key}_ur`] : (settings as any)[`${key}_en`]) || (APP_WORDS as any)[`${key}_${urdu ? "ur" : "en"}`];
  const hi = String(f.highlight_color || "") || TAKAL_YELLOW;
  return (
    <div className="mx-auto w-[240px] h-[500px] rounded-[30px] border-[6px] border-takal-ink bg-white overflow-hidden relative shadow-xl">
      <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden">
        {f.media_type === "video" ? (
          <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">▶ video plays here</div>
        ) : (
          <div className="absolute -left-1 -right-1 top-0 flex gap-1 origin-top" style={{ transform: "rotate(-4deg) scale(1.12)" }}>
            {cols.map((col, c) => (
              <div key={c} className="flex-1 flex flex-col gap-1" style={{ marginTop: starts[c] }}>
                {col.map((p, k) =>
                  p ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={p} alt="" className="w-full rounded-lg object-cover shadow" style={{ height: heights[(k + c) % 5] }} />
                  ) : (
                    <div key={k} className="w-full rounded-lg bg-slate-200 text-[8px] text-slate-500 flex items-center justify-center" style={{ height: heights[(k + c) % 5] }}>
                      app photo
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, #fff 97%)" }} />
      </div>
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
        <span className="bg-takal-yellow rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow">Takal</span>
        {settings.show_skip ? <span className="bg-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow">{word("skip")}</span> : null}
      </div>
      <div className="absolute left-4 right-4 top-[272px]" dir={urdu ? "rtl" : "ltr"}>
        <div className="text-[19px] font-extrabold leading-tight text-takal-ink">{pick("title")}</div>
        {pick("highlight") ? (
          <div className="inline-block mt-1 px-1.5 rounded-md text-[19px] font-extrabold leading-tight" style={{ background: hi }}>
            {pick("highlight")}
          </div>
        ) : null}
        <div className="mt-2 text-[10.5px] leading-snug text-slate-600">{pick("body")}</div>
      </div>
      <div className="absolute left-4 right-4 bottom-4 flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: Math.max(total, 1) }).map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full ${k === index ? "w-4 bg-takal-ink" : "w-1.5 bg-slate-300"}`} />
          ))}
        </div>
        <span className="bg-takal-yellow border-2 border-takal-ink rounded-xl px-3 py-1.5 text-[11px] font-extrabold shadow-[0_3px_0_#000]">
          {last ? word("start") : word("next")} →
        </span>
      </div>
    </div>
  );
}

// ── ONE SCREEN'S EDITOR ─────────────────────────────────────────────────────

function SlideEditor({ slide, settings, index, total, onClose, onSaved }: {
  slide: Slide; settings: Settings; index: number; total: number; onClose: () => void; onSaved: () => void;
}) {
  const editing = !!slide.id;
  const [f, setF] = useState<Slide>({
    ...blank,
    ...slide,
    photos: Array.isArray(slide?.photos) ? slide.photos : [],
  });
  const [saving, setSaving] = useState(false);
  const [urduPreview, setUrduPreview] = useState(false);
  const { upload: uploadImage, uploading } = useImageUpload();
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useDialogKeys(true, onClose, saving);

  const set = (k: string, v: any) => setF((p: Slide) => ({ ...p, [k]: v }));
  const wallCount = panelPhotos(f).length;

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (panelPhotos(f).length >= MAX_PHOTOS) {
        toast(`A screen can have at most ${MAX_PHOTOS} photos`, "error");
        break;
      }
      const url = await uploadImage(file);
      if (url) setF((p: Slide) => ({ ...p, photos: [...(p.photos || []), url].slice(0, MAX_PHOTOS) }));
    }
  };

  const movePhoto = (k: number, by: -1 | 1) => {
    const list = [...(f.photos || [])];
    const to = k + by;
    if (to < 0 || to >= list.length) return;
    [list[k], list[to]] = [list[to], list[k]];
    set("photos", list);
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
    if (!String(f.title || "").trim()) {
      toast("Headline line 1 (English) is required", "error");
      return;
    }
    const colour = String(f.highlight_color || "").trim();
    if (colour && !/^#[0-9A-Fa-f]{6}$/.test(colour)) {
      toast("The highlight colour must look like #FFFF00", "error");
      return;
    }
    const t = (v: any) => String(v || "").trim();
    const payload = {
      title: t(f.title),
      title_ur: t(f.title_ur),
      highlight: t(f.highlight),
      highlight_ur: t(f.highlight_ur),
      body: t(f.body),
      body_ur: t(f.body_ur),
      photos: (f.photos || []).map(t).filter(Boolean).slice(0, MAX_PHOTOS),
      highlight_color: colour.toUpperCase() === TAKAL_YELLOW ? "" : colour,
      image_url: t(f.image_url),
      video_url: f.media_type === "video" ? t(f.video_url) : "",
      media_type: f.media_type || "image",
      is_active: !!f.is_active,
    };
    try {
      setSaving(true);
      if (editing) await apiClient.updateOnboardingSlide(String(slide.id), payload);
      else await apiClient.createOnboardingSlide({ ...payload, sort_order: total + 1 });
      toast(editing ? "Saved" : "Added", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";
  const pair = (k: string, label: string, max: number, area = false) => (
    <div className="grid grid-cols-2 gap-2">
      {[k, `${k}_ur`].map((key, i) => (
        <label key={key} className="text-xs text-takal-ink-soft">
          {label} {i ? "(Urdu)" : "(English)"}
          {area ? (
            <textarea value={f[key] || ""} maxLength={max} rows={3} dir={i ? "rtl" : "ltr"}
              onChange={(e) => set(key, e.target.value)} className={input} />
          ) : (
            <input value={f[key] || ""} maxLength={max} dir={i ? "rtl" : "ltr"}
              onChange={(e) => set(key, e.target.value)} className={input} />
          )}
        </label>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl p-6 max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-takal-ink mb-4">{editing ? "Edit welcome screen" : "Add welcome screen"}</h2>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {pair("title", "Headline line 1", 120)}
            {pair("highlight", "Highlighted line 2", 120)}
            {pair("body", "Text under it", 400, true)}
            <p className="text-xs text-takal-ink-soft -mt-2">An empty Urdu box shows the English words to Urdu customers.</p>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-takal-ink">Highlight colour</span>
              <input type="color" value={f.highlight_color || TAKAL_YELLOW}
                onChange={(e) => set("highlight_color", e.target.value.toUpperCase())}
                className="h-9 w-12 rounded border border-takal-line" />
              <input value={f.highlight_color || ""} placeholder={TAKAL_YELLOW} maxLength={7}
                onChange={(e) => set("highlight_color", e.target.value)} className="w-28 px-2 py-1.5 border border-takal-line rounded text-sm" />
              <button type="button" onClick={() => set("highlight_color", "")} className="text-xs underline text-takal-ink-soft">Takal yellow</button>
            </div>

            <div className="flex gap-2">
              {[["image", "Photo wall"], ["video", "Video instead"]].map(([t, label]) => (
                <button key={t} type="button" onClick={() => set("media_type", t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${f.media_type === t ? "bg-takal-yellow text-takal-ink border-takal-ink" : "bg-white text-takal-ink-soft border-takal-line hover:bg-takal-page"}`}>
                  {label}
                </button>
              ))}
            </div>

            {f.media_type !== "video" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-takal-ink">
                    Photo wall <span className="font-normal text-takal-disabled-text">({wallCount} of {MAX_PHOTOS} - empty places are filled with the app&rsquo;s own photos)</span>
                  </p>
                  <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploading || wallCount >= MAX_PHOTOS ? "bg-slate-200 text-takal-ink-soft pointer-events-none" : "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink"}`}>
                    {uploading ? "Uploading…" : "＋ Add photos"}
                    <input type="file" accept="image/*" multiple disabled={uploading || wallCount >= MAX_PHOTOS} className="hidden"
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {f.image_url ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.image_url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                      <span className="absolute left-1 top-1 bg-white/90 text-[9px] px-1 rounded">first (older photo)</span>
                      <button type="button" title="Remove" onClick={() => set("image_url", "")}
                        className="absolute right-1 top-1 bg-white rounded-full p-0.5 shadow"><X className="h-3 w-3" /></button>
                    </div>
                  ) : null}
                  {(f.photos || []).map((p: string, k: number) => (
                    <div key={p + k} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="w-full h-24 object-cover rounded-lg border" />
                      <button type="button" title="Remove" onClick={() => set("photos", (f.photos || []).filter((_: string, j: number) => j !== k))}
                        className="absolute right-1 top-1 bg-white rounded-full p-0.5 shadow"><X className="h-3 w-3" /></button>
                      <div className="absolute bottom-1 inset-x-1 flex justify-between">
                        <button type="button" title="Earlier" disabled={k === 0} onClick={() => movePhoto(k, -1)}
                          className="bg-white rounded p-0.5 shadow disabled:opacity-30"><ArrowLeft className="h-3 w-3" /></button>
                        <button type="button" title="Later" disabled={k === (f.photos || []).length - 1} onClick={() => movePhoto(k, 1)}
                          className="bg-white rounded p-0.5 shadow disabled:opacity-30"><ArrowRight className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-takal-ink">Video <span className="font-normal text-takal-disabled-text">(plays in place of the wall, max 100 MB)</span></p>
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
                  <input placeholder="…or paste a video URL" value={f.video_url || ""} onChange={(e) => set("video_url", e.target.value)} className={input} />
                )}
              </div>
            )}

            <Toggle on={!!f.is_active} onChange={(v) => set("is_active", v)} label="On"
              hint="Off hides this screen without deleting it." />
          </div>

          <div>
            <div className="flex justify-center gap-2 mb-3">
              {[["English", false], ["اردو", true]].map(([label, ur]) => (
                <button key={String(label)} type="button" onClick={() => setUrduPreview(!!ur)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${urduPreview === ur ? "bg-takal-ink text-white border-takal-ink" : "border-takal-line"}`}>
                  {label}
                </button>
              ))}
            </div>
            <PhonePreview f={f} settings={settings} urdu={urduPreview} index={editing ? index : total} total={editing ? total : total + 1} />
            <p className="text-[11px] text-center text-takal-ink-soft mt-2">Live preview - on the phone the photo columns drift slowly.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg font-medium">
            {saving ? "Saving…" : editing ? "Save" : "Add screen"}
          </button>
        </div>
      </div>
    </div>
  );
}
