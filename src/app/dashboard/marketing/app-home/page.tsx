"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING -> APP HOME (Mock 244, APPROVED by Sana 11 November 2026)
//
// The customer app's Home, managed from here like the big apps do:
//   🧱 Blocks       the order of Home, on/off, Mingora/Matta, dates, times
//   🗂 4 cards      style, colours, words, pictures of the 4 big cards
//   ⭕ Top tabs     style, size, order, names and pictures of the round tabs
//   🎨 Looks        Normal + dated looks (Eid, Ramadan), rain message, history
//   📚 Collections  named rows of picked products or shops, or a rule
//   📊 Taps         how much each part of Home is used
//
// Everything is saved as a DRAFT as you type. Customers see it only after
// Publish, and the server refuses to publish anything broken (unreadable
// colours, Urdu missing, a picture that is not Takal's own). "Preview on my
// phone" shows the draft on up to 3 real phones first.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { ConfirmDialog, ErrorState, Modal } from "@/components/ui";
import { TOWN_POINTS, lookOn, pkToday, type Layout } from "@/lib/app-home";
import { BlocksPart } from "./parts-blocks";
import { CardsPart } from "./parts-cards";
import { TabsPart } from "./parts-tabs";
import { LooksPart } from "./parts-looks";
import { CollectionsPart } from "./parts-collections";
import { TapsPart } from "./parts-taps";
import { PhonePreview, type PreviewData } from "./parts-preview";

type Info = {
  published_at: string | null; published_by: string; draft_saved_at: string | null;
  changed: boolean; problems: string[]; warnings: string[];
  history: { id: number; published_at: string; by: string }[];
  preview_phones: { id: string; name: string }[];
};

const PARTS = [
  { key: "blocks", name: "🧱 Blocks" }, { key: "cards", name: "🗂 4 cards" }, { key: "tabs", name: "⭕ Top tabs" },
  { key: "looks", name: "🎨 Looks & schedule" }, { key: "collections", name: "📚 Collections" }, { key: "taps", name: "📊 Taps" },
] as const;
type PartKey = (typeof PARTS)[number]["key"];

const SIZES = [{ key: 320, name: "Small" }, { key: 375, name: "Medium" }, { key: 412, name: "Large" }];
const SAVE_AFTER_MS = 1200;

/** Minutes after midnight in Pakistan (UTC+5), like the app's own clock. */
function pkMinute(now = new Date()): number {
  return Math.floor(((now.getTime() / 60000) + 300) % 1440);
}

const EMPTY_PREVIEW: PreviewData = { types: [], rows: {}, shops: [], banner: null, collections: {} };

export default function AppHomePage() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [notYet, setNotYet] = useState(false);
  const [part, setPart] = useState<PartKey>("blocks");
  const [editing, setEditing] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "waiting" | "saving" | "failed">("idle");
  const [publishing, setPublishing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [askDiscard, setAskDiscard] = useState(false);
  const [askRestore, setAskRestore] = useState<number | null>(null);
  const [phonesOpen, setPhonesOpen] = useState(false);
  const [taps, setTaps] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(375);
  const [town, setTown] = useState<"mingora" | "matta">("mingora");
  const [day, setDay] = useState(pkToday());
  const [minute, setMinute] = useState(pkMinute());
  const [preview, setPreview] = useState<PreviewData>(EMPTY_PREVIEW);
  const [previewState, setPreviewState] = useState<"loading" | "ok" | "failed">("loading");

  const latest = useRef<Layout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingNow = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    try {
      const r: any = await apiClient.getAppHome();
      latest.current = r.draft;
      setLayout(r.draft);
      setInfo({
        published_at: r.published_at, published_by: r.published_by || "", draft_saved_at: r.draft_saved_at,
        changed: !!r.changed, problems: r.problems || [], warnings: r.warnings || [],
        history: r.history || [], preview_phones: r.preview_phones || [],
      });
      setProblems(r.problems || []);
      setEditing((e) => (r.draft.looks.some((l: any) => l.id === e) ? e : r.draft.looks[0]?.id || ""));
      setFailed(null); setNotYet(false);
    } catch (e: any) {
      if (e?.status === 501) setNotYet(true);
      else setFailed(errorMessage(e, "reading App Home"));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Saving the draft: a short wait after the last change, then one save.
  const saveNow = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (savingNow.current) await savingNow.current;
    const doc = latest.current;
    if (!doc) return;
    setSaving("saving");
    const p = (async () => {
      try {
        const r: any = await apiClient.saveAppHomeDraft(doc);
        setProblems(r?.problems || []);
        setInfo((i) => (i ? { ...i, changed: true, draft_saved_at: new Date().toISOString() } : i));
        // Only "saved" if nothing changed while it was on its way.
        setSaving(latest.current === doc ? "idle" : "waiting");
      } catch (e) {
        setSaving("failed");
        throw e;
      }
    })();
    savingNow.current = p.catch(() => {}).then(() => { savingNow.current = null; });
    await p;
  }, []);

  const change = (next: Layout) => {
    latest.current = next;
    setLayout(next);
    setSaving("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveNow().catch(() => {}); }, SAVE_AFTER_MS);
  };

  // Leaving with a change not yet saved asks first.
  useEffect(() => {
    const stop = (e: BeforeUnloadEvent) => {
      if (saving === "waiting" || saving === "saving" || saving === "failed") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [saving]);

  // ── The preview's real shops and products for the chosen town.
  const pubCollections = useRef<Record<string, any>>({});
  useEffect(() => {
    let gone = false;
    setPreviewState("loading");
    const p = TOWN_POINTS[town];
    apiClient.getPublicHome(p.lat, p.lon).then((h: any) => {
      if (gone) return;
      const rows: Record<string, any[]> = {};
      for (const r of h?.type_rows || []) if (r?.type) rows[r.type] = r.products || [];
      pubCollections.current = h?.home_collections || {};
      setPreview((old) => ({
        types: Object.keys(rows), rows, shops: h?.restaurants || [],
        banner: (h?.promo_banners || [])[0] || null,
        collections: { ...pubCollections.current, ...old.collections },
      }));
      setPreviewState("ok");
    }).catch(() => { if (!gone) setPreviewState("failed"); });
    return () => { gone = true; };
  }, [town]);

  // The DRAFT's collections, as a customer in this town would get them.
  const collectionsKey = JSON.stringify(layout?.collections.map((c) => [c.id, c.fill, c.ids, c.rule]) || []);
  useEffect(() => {
    if (!layout) return;
    let gone = false;
    const t = setTimeout(async () => {
      const p = TOWN_POINTS[town];
      const got: Record<string, any> = {};
      await Promise.all(layout.collections.map(async (c) => {
        try { got[c.id] = await apiClient.appHomeCollectionRows(c, p.lat, p.lon); } catch { /* the preview leaves it out */ }
      }));
      if (!gone) setPreview((old) => ({ ...old, collections: { ...pubCollections.current, ...got } }));
    }, 700);
    return () => { gone = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionsKey, town]);

  const look = useMemo(() => layout?.looks.find((l) => l.id === editing) || layout?.looks[0], [layout, editing]);
  const onToday = layout ? lookOn(layout, pkToday()) : null;

  const publish = async () => {
    setPublishing(true);
    try {
      // The last change first - Publish sends what is SAVED as the draft.
      if (saving !== "idle" || timer.current) await saveNow();
      await apiClient.publishAppHome();
      toast("Published - customers see the new Home within about a minute", "success");
      await load();
    } catch (e: any) {
      const list = e?.detail?.problems;
      if (Array.isArray(list) && list.length) {
        setProblems(list);
        toast("Not published - fix the red list first", "error");
      } else toast(errorMessage(e, "publishing"), "error");
    } finally { setPublishing(false); }
  };

  const discard = async () => {
    setAskDiscard(false);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try { await apiClient.discardAppHomeDraft(); setSaving("idle"); toast("Back to what customers see now", "success"); await load(); }
    catch (e) { toast(errorMessage(e, "going back"), "error"); }
  };

  const restore = async (id: number) => {
    setAskRestore(null);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try { await apiClient.restoreAppHome(id); setSaving("idle"); toast("Copied into the draft - look at it, then Publish", "success"); await load(); }
    catch (e) { toast(errorMessage(e, "bringing it back"), "error"); }
  };

  if (notYet) {
    return (
      <div className="rounded-[14px] border border-takal-line bg-white p-5 text-[14px]" data-app-home-not-yet>
        <h2 className="text-[17px] font-extrabold">📱 App Home is not switched on yet</h2>
        <p className="mt-1 text-takal-ink-soft">It starts after one database change (migration 163). Until then the customer app draws Home exactly as it does today.</p>
      </div>
    );
  }
  if (failed) return <ErrorState message={failed} onRetry={load} />;
  if (!layout || !info || !look) return <div className="text-[13px] text-takal-ink-soft">Loading…</div>;

  const savedWords = saving === "saving" ? "Saving…" : saving === "waiting" ? "Changes not saved yet…"
    : saving === "failed" ? "Could not save - check your internet" : info.changed ? "Draft saved · not published yet" : "Customers see exactly this";

  return (
    <div data-app-home>
      {/* Status line: what customers see and what is waiting. */}
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-takal-line bg-white px-3 py-2.5 shadow-sm">
        <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${saving === "failed" ? "bg-takal-red-soft text-takal-red" : info.changed || saving !== "idle" ? "bg-takal-orange-soft" : "bg-takal-green-soft text-takal-green"}`} data-save-state>
          {savedWords}
        </span>
        <span className="text-[12px] text-takal-ink-soft">
          {info.published_at ? `Last published ${new Date(info.published_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${info.published_by ? ` by ${info.published_by}` : ""}` : "Never published - customers see today's Home"}
          {onToday && !onToday.normal ? ` · Look on today: ${onToday.name}` : ""}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setAskDiscard(true)} disabled={!info.changed && saving === "idle"}
            className="h-[34px] rounded-lg border border-takal-line px-3 text-[13px] font-semibold disabled:opacity-40" data-undo>↶ Undo all changes</button>
          <button type="button" onClick={() => setPhonesOpen(true)} className="h-[34px] rounded-lg border-[1.5px] border-takal-ink bg-white px-3 text-[13px] font-bold" data-preview-phones>
            📱 Preview on my phone{info.preview_phones.length ? ` (${info.preview_phones.length})` : ""}
          </button>
          <button type="button" onClick={publish} disabled={publishing || (!info.changed && saving === "idle")}
            className="h-[34px] rounded-lg border-[1.5px] border-takal-ink bg-takal-yellow px-4 text-[13px] font-extrabold disabled:opacity-40" data-publish>
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="mb-3 rounded-[14px] border border-takal-red bg-takal-red-soft p-3" data-problems>
          <div className="text-[14px] font-extrabold text-takal-red">Fix {problems.length === 1 ? "this" : `these ${problems.length}`} before Publish</div>
          <ul className="mt-1 list-disc pl-5 text-[13px]">{problems.slice(0, 12).map((p) => <li key={p}>{p}</li>)}</ul>
          {problems.length > 12 && <div className="text-[12px]">…and {problems.length - 12} more</div>}
        </div>
      )}
      {info.warnings.length > 0 && (
        <div className="mb-3 rounded-[14px] border border-takal-orange bg-takal-orange-soft p-3" data-warnings>
          <div className="text-[13px] font-extrabold">Worth a look (Publish still works)</div>
          <ul className="mt-1 list-disc pl-5 text-[13px]">{info.warnings.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
            {PARTS.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={part === p.key} onClick={() => setPart(p.key)} data-part-chip={p.key}
                className={`h-[34px] rounded-full border-[1.5px] px-3.5 text-[13px] font-bold ${part === p.key ? "border-takal-ink bg-takal-ink text-takal-yellow" : "border-takal-line bg-white"}`}>
                {p.name}
              </button>
            ))}
          </div>

          {(part === "cards" || part === "tabs") && layout.looks.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]" data-editing-look>
              <span className="font-semibold">Editing the look:</span>
              {layout.looks.map((l) => (
                <button key={l.id} type="button" onClick={() => setEditing(l.id)}
                  className={`h-[30px] rounded-lg border-[1.5px] px-3 font-semibold ${look.id === l.id ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line"}`}>{l.name}</button>
              ))}
            </div>
          )}

          {part === "blocks" && <BlocksPart layout={layout} onChange={change} taps={taps} />}
          {part === "cards" && <CardsPart look={look} onChange={(l) => change({ ...layout, looks: layout.looks.map((x) => (x.id === l.id ? l : x)) })} />}
          {part === "tabs" && <TabsPart look={look} types={preview.types} onChange={(l) => change({ ...layout, looks: layout.looks.map((x) => (x.id === l.id ? l : x)) })} />}
          {part === "looks" && <LooksPart layout={layout} onChange={change} editing={look.id} onEdit={(id) => { setEditing(id); setPart("cards"); }}
            history={info.history} onRestore={(id) => setAskRestore(id)} />}
          {part === "collections" && <CollectionsPart layout={layout} onChange={change} />}
          {part === "taps" && <TapsPart layout={layout} onTaps={setTaps} />}
        </div>

        <div className="shrink-0 xl:sticky xl:top-[64px] xl:w-[430px]" data-preview-column>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
            {SIZES.map((s) => (
              <button key={s.key} type="button" onClick={() => setWidth(s.key)}
                className={`h-[30px] rounded-lg border-[1.5px] px-2.5 font-semibold ${width === s.key ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line bg-white"}`}>{s.name}</button>
            ))}
            <select value={town} onChange={(e) => setTown(e.target.value as any)} aria-label="Town"
              className="w-auto h-[30px] rounded-lg border-[1.5px] border-takal-line px-1.5">
              <option value="mingora">Mingora</option><option value="matta">Matta</option>
            </select>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
            <span>Show it on</span>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value || pkToday())} aria-label="Day"
              className="w-auto h-[30px] rounded-lg border-[1.5px] border-takal-line px-1.5" />
            <input type="time" aria-label="Time"
              value={`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`}
              onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (!isNaN(h)) setMinute(h * 60 + (m || 0)); }}
              className="w-auto h-[30px] rounded-lg border-[1.5px] border-takal-line px-1.5" />
            <button type="button" onClick={() => { setDay(pkToday()); setMinute(pkMinute()); }} className="h-[30px] rounded-lg border border-takal-line px-2">Now</button>
          </div>
          {previewState === "failed" && <div className="mb-2 text-[12px] text-takal-red">The shops of {town === "matta" ? "Matta" : "Mingora"} could not be read - the drawing shows the design only.</div>}
          <PhonePreview layout={layout} data={preview} w={width} town={town} day={day} minute={minute} />
          <p className="mt-2 max-w-[412px] text-[12px] text-takal-ink-soft">A close drawing of the draft with today&apos;s real shops. &quot;Preview on my phone&quot; shows the real app.</p>
        </div>
      </div>

      <ConfirmDialog open={askDiscard} title="Undo all changes?" danger confirmLabel="Yes, undo them"
        message="The draft goes back to what customers see now. Your changes since the last Publish are thrown away."
        onConfirm={discard} onCancel={() => setAskDiscard(false)} />
      <ConfirmDialog open={askRestore !== null} title="Bring back this Home?" danger={false} confirmLabel="Copy into the draft"
        message="It replaces the draft. Customers see it only after you Publish."
        onConfirm={() => askRestore !== null && restore(askRestore)} onCancel={() => setAskRestore(null)} />
      {phonesOpen && <PhonesDialog current={info.preview_phones} onClose={() => setPhonesOpen(false)} onSaved={load} />}
    </div>
  );
}

function PhonesDialog({ current, onClose, onSaved }: { current: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [phones, setPhones] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (list: string[]) => {
    setBusy(true); setError("");
    try {
      await apiClient.setAppHomePreviewPhones(list);
      toast(list.length ? "Those phones now see the draft - open Home on them" : "No phone sees the draft now", "success");
      onSaved(); onClose();
    } catch (e) { setError(errorMessage(e, "saving the phones")); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="📱 Preview on my phone">
      <p className="text-[13px] text-takal-ink-soft">Up to 3 customer phone numbers. Those phones see the DRAFT on Home (after pulling down to refresh); everybody else keeps the published Home.</p>
      {current.length > 0 && (
        <div className="mt-2 text-[13px]"><span className="font-bold">Seeing the draft now:</span> {current.map((p) => p.name || "a customer").join(", ")}</div>
      )}
      <div className="mt-3 space-y-2">
        {phones.map((p, i) => (
          <input key={i} value={p} inputMode="tel" placeholder="03001234567" aria-label={`Phone ${i + 1}`}
            onChange={(e) => setPhones(phones.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-[36px] w-full rounded-lg border-[1.5px] border-takal-line px-2.5 text-[14px]" />
        ))}
      </div>
      {error && <div className="mt-2 text-[13px] font-semibold text-takal-red">{error}</div>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {current.length > 0 && <button type="button" disabled={busy} onClick={() => save([])} className="h-[34px] rounded-lg border border-takal-line px-3 text-[13px]">Stop all previews</button>}
        <button type="button" onClick={onClose} className="h-[34px] rounded-lg border border-takal-line px-3 text-[13px]">Cancel</button>
        <button type="button" disabled={busy || phones.every((p) => !p.trim())} onClick={() => save(phones.map((p) => p.trim()).filter(Boolean))}
          className="h-[34px] rounded-lg border-[1.5px] border-takal-ink bg-takal-yellow px-4 text-[13px] font-extrabold disabled:opacity-40">{busy ? "Saving…" : "Save phones"}</button>
      </div>
    </Modal>
  );
}
