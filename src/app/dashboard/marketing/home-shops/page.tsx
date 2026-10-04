"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HOME SHOPS - the shops that slide above the four big cards on Home
// (Mock 151, style D).
//
// Sana, 4 October 2026: "now i want some stores To Show just above the 4
// cards. The Shops cards should be sliding as Home Banners. i want the setting
// in Admin Panel." Then style D, "a little Taller", "and add the similar
// design and styling options so i can chose from there too".
//
// On this page:
//   * THE ROW: shown or not, slides by itself or not, how fast;
//   * LOOK OF THE CARDS: ribbon style and colour, name strip colour, what the
//     strip shows, card height, corners - with a live preview;
//   * SHOPS IN THE ROW: which shops, in which order, each with its short line
//     (English + Urdu), optional dates and on/off.
// A shop a customer cannot order from right now (closed, or too far for a
// rider) is left out for that customer by the server - Sana: "Hide". No shops
// = no row at all. Changes reach the phones without a new app.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";
import { RowPreview, TAKAL_YELLOW, type CardLook } from "./parts-card-preview";
import { ShopDialog, shopPicture, type Row } from "./parts-shop-dialog";

type Settings = CardLook & {
  enabled: boolean;
  auto_slide: boolean;
  interval_seconds: number;
};

const DEFAULT_SETTINGS: Settings = {
  enabled: true, auto_slide: true, interval_seconds: 4,
  ribbon_style: "corner", ribbon_color: TAKAL_YELLOW, strip_color: "black",
  strip_shows: "rating", card_height: "normal", corners: "round",
};

/** The speeds offered - the server accepts 2 to 30 seconds. */
const SPEEDS = [3, 4, 6, 8];

/** Ready colours for the ribbon; "Any colour" opens a picker. */
const RIBBON_COLOURS: [string, string][] = [
  ["Yellow", TAKAL_YELLOW], ["Red", "#E53935"], ["Black", "#141414"], ["White", "#FFFFFF"],
];

/** Every choice in "Look of the cards", in words. */
const LOOK_CHOICES: { key: keyof CardLook; label: string; options: [string, string][] }[] = [
  { key: "ribbon_style", label: "Ribbon", options: [["corner", "Across the corner"], ["band", "Straight band"], ["tag", "Small tag"]] },
  { key: "strip_color", label: "Name strip", options: [["black", "Black"], ["yellow", "Yellow"], ["white", "White"], ["logo", "Logo colour"]] },
  { key: "strip_shows", label: "Strip shows", options: [["rating", "Name + rating"], ["time", "Name + delivery time"], ["name", "Name only"]] },
  { key: "card_height", label: "Card height", options: [["normal", "Normal"], ["tall", "Tall"]] },
  { key: "corners", label: "Corners", options: [["round", "Round"], ["soft", "Soft"]] },
];

/** What a row's status pill says, in the order a customer would meet it. */
function statusOf(r: Row, now = new Date()): [string, string] {
  if (r.is_active === false) return ["Off", "bg-slate-200 text-slate-700"];
  if (r.starts_at && new Date(r.starts_at) > now) return ["Waiting for its date", "bg-slate-100 text-slate-700"];
  if (r.ends_at && new Date(r.ends_at) <= now) return ["Ended", "bg-slate-200 text-slate-700"];
  const s = r.shop || {};
  if (s.is_approved !== true || s.suspended_at) return ["Hidden - shop not live", "bg-red-50 text-red-700"];
  if (!s.open_now) return ["Hidden - closed now", "bg-amber-50 text-amber-800"];
  return ["On", "bg-green-100 text-green-800"];
}

function dateWords(r: Row): string {
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (r.starts_at && r.ends_at) return `${d(r.starts_at)} – ${d(r.ends_at)}`;
  if (r.starts_at) return `From ${d(r.starts_at)}`;
  if (r.ends_at) return `Until ${d(r.ends_at)}`;
  return "Always";
}

export default function HomeShopsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [maxShops, setMaxShops] = useState(20);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  // The look being chosen, before it is saved - the previews follow it.
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await apiClient.getHomeShops()) as any;
      setRows(res?.shops || []);
      const s = { ...DEFAULT_SETTINGS, ...(res?.settings || {}) };
      setSettings(s);
      setDraft(s);
      if (res?.max_shops) setMaxShops(res.max_shops);
    } catch (e) {
      // A FAILED READ MUST NOT BECOME A FACT ABOUT THE BUSINESS: the error is
      // kept and the empty state below is gated on it.
      setLoadError(readFailure(e, "the Home shops"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof Settings, v: any) => setDraft((p) => ({ ...p, [k]: v }));
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);

  const saveSettings = async () => {
    try {
      setBusy(true);
      const res = (await apiClient.updateHomeShopsSettings(draft)) as any;
      const s = { ...DEFAULT_SETTINGS, ...(res?.settings || draft) };
      setSettings(s);
      setDraft(s);
      toast("Saved - the phones get it the next time Home opens", "success");
    } catch (e) {
      toast(errorMessage(e, "saving the Home shops settings"), "error");
    } finally {
      setBusy(false);
    }
  };

  /** Move a shop up or down and save the WHOLE order (1, 2, 3…). */
  const move = async (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);
    try {
      setBusy(true);
      const res = (await apiClient.reorderHomeShops(next.map((x) => String(x.id)))) as any;
      setRows(res?.shops || next);
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
      await apiClient.removeHomeShop(String(removing.id));
      toast("Removed from the row", "success");
      setRemoving(null);
      load();
    } catch (e) {
      toast(errorMessage(e, "removing the shop"), "error");
    } finally {
      setBusy(false);
    }
  };

  const previewShops = rows
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      name: r.shop?.name || "Shop",
      picture: shopPicture(r.shop),
      tagline: r.tagline || "",
      rating: r.shop?.rating,
      ratingCount: r.shop?.rating_count,
      logoColor: r.logo_color,
    }));
  const full = rows.length >= maxShops;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Home Shops</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">
            Shops that slide above the 4 big cards on Home. A shop a customer cannot order from right
            now (closed or too far) is hidden for that customer. No shops = no row.
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          disabled={loading || !!loadError || full}
          title={full ? `The row holds at most ${maxShops} shops` : undefined}
          className="shrink-0 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:opacity-40 text-takal-ink rounded-lg font-medium"
        >
          + Add shop
        </button>
      </div>

      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : (
        <>
          {/* ── THE ROW ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-takal-line p-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-takal-ink">The row</h3>
                <p className="text-xs text-takal-ink-soft">These apply to the whole row.</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${draft.enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`}>
                {draft.enabled ? "ON - shown on Home" : "OFF - not on Home"}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Toggle on={draft.enabled} onChange={(v) => set("enabled", v)} label="Show the shops row"
                hint="Off: the row disappears from Home." />
              <Toggle on={draft.auto_slide} onChange={(v) => set("auto_slide", v)} label="Slides by itself"
                hint="Off: customers swipe it themselves." />
            </div>
            <div className={draft.auto_slide ? "" : "opacity-40 pointer-events-none"}>
              <span className="block text-sm font-medium text-takal-ink mb-1">Next card every</span>
              <div className="flex flex-wrap gap-2">
                {SPEEDS.map((sec) => (
                  <Chip key={sec} on={draft.interval_seconds === sec} onClick={() => set("interval_seconds", sec)}>
                    {sec} sec
                  </Chip>
                ))}
              </div>
            </div>
            <p className="text-xs text-takal-ink-soft">Saved with <strong>Save settings</strong> under “Look of the cards”.</p>
          </div>

          {/* ── LOOK OF THE CARDS ───────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-takal-line p-5">
            <div className="mb-4">
              <h3 className="font-bold text-takal-ink">Look of the cards</h3>
              <p className="text-xs text-takal-ink-soft">
                The logo always fills the card. Choose the ribbon and the name strip - the phone on the right changes as you choose.
              </p>
            </div>
            <div className="grid lg:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-4">
                {LOOK_CHOICES.slice(0, 1).map((c) => (
                  <ChoiceRow key={c.key} label={c.label} options={c.options} value={draft[c.key] as string} onPick={(v) => set(c.key, v)} />
                ))}
                <div>
                  <span className="block text-sm font-medium text-takal-ink mb-1">Ribbon colour</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {RIBBON_COLOURS.map(([label, hex]) => (
                      <Chip key={hex} on={draft.ribbon_color.toUpperCase() === hex} onClick={() => set("ribbon_color", hex)}>
                        <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 mr-1.5 align-[-2px]" style={{ background: hex }} />
                        {label}
                      </Chip>
                    ))}
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border cursor-pointer ${RIBBON_COLOURS.some(([, h]) => h === draft.ribbon_color.toUpperCase()) ? "border-takal-line" : "bg-takal-yellow border-takal-ink font-semibold"}`}>
                      <input type="color" value={draft.ribbon_color} onChange={(e) => set("ribbon_color", e.target.value.toUpperCase())} className="h-5 w-6 border-0 p-0 bg-transparent" />
                      Any colour
                    </label>
                  </div>
                </div>
                {LOOK_CHOICES.slice(1).map((c) => (
                  <ChoiceRow key={c.key} label={c.label} options={c.options} value={draft[c.key] as string} onPick={(v) => set(c.key, v)} />
                ))}
                {draft.strip_color === "logo" && (
                  <p className="text-xs text-takal-ink-soft">
                    Each shop&rsquo;s colour is read from its logo when it is added - change it in that shop&rsquo;s Edit. No colour = black.
                  </p>
                )}
                <button type="button" onClick={() => setDraft({ ...draft, ...pickLook(DEFAULT_SETTINGS) })}
                  className="text-xs underline text-takal-ink-soft">Back to the approved look (style D)</button>
              </div>
              <div>
                <span className="block text-sm font-medium text-takal-ink mb-2 text-center">On the phone</span>
                <RowPreview look={pickLook(draft)} shops={previewShops} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              {changed && <span className="text-xs text-takal-ink-soft">Not saved yet</span>}
              {changed && (
                <button onClick={() => setDraft(settings)} className="px-4 py-2 border border-takal-line rounded-lg text-sm hover:bg-takal-page">Undo</button>
              )}
              <button onClick={saveSettings} disabled={!changed || busy}
                className="px-5 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:opacity-40 text-takal-ink rounded-lg font-medium">
                {busy ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>

          {/* ── SHOPS IN THE ROW ─────────────────────────────────────── */}
          <div className={`bg-white rounded-xl border border-takal-line p-5 ${settings.enabled ? "" : "opacity-60"}`}>
            <h3 className="font-bold text-takal-ink mb-3">
              Shops in the row <span className="font-normal text-sm text-takal-ink-soft">(in this order · {rows.length} of {maxShops})</span>
            </h3>
            {/* read-safe: this whole block is drawn only after the shops
                loaded - a failed read shows <ErrorState> above instead. */}
            {rows.length === 0 ? (
              <div className="text-takal-ink-soft border border-dashed border-takal-line rounded-lg p-8 text-center text-sm">
                No shops yet - Home shows no row. Click “Add shop” to start.
              </div>
            ) : (
              <div className="grid gap-3">
                {rows.map((r, i) => {
                  const [word, tone] = statusOf(r);
                  const pic = shopPicture(r.shop);
                  return (
                    <div key={r.id} className="border border-takal-line rounded-xl p-3 flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => move(i, -1)} disabled={i === 0 || busy} title="Move up"
                          className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy} title="Move down"
                          className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="w-28 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> : null}
                        {r.logo_color ? (
                          <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white" style={{ background: r.logo_color }} title={`Logo colour ${r.logo_color}`} />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-takal-ink truncate">{r.shop?.name || "A shop that no longer exists"}</div>
                        <div className="text-sm text-takal-ink-soft truncate">
                          Short line: {r.tagline || "—"}
                          {r.tagline_ur ? <> · <span dir="rtl">{r.tagline_ur}</span></> : null}
                        </div>
                        <div className="text-xs text-takal-ink-soft">Dates: {dateWords(r)}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${tone}`}>{word}</span>
                      <button onClick={() => setEditing(r)} className="px-3 py-1.5 text-sm border border-takal-line rounded-lg hover:bg-takal-page">Edit</button>
                      <button onClick={() => setRemoving(r)} className="px-3 py-1.5 text-sm border border-takal-line text-takal-red hover:bg-takal-red-soft rounded-lg">Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {editing && (
        <ShopDialog
          row={editing}
          look={pickLook(draft)}
          taken={rows.map((r) => String(r.restaurant_id))}
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
        title={`Remove ${removing?.shop?.name ?? "this shop"} from the row?`}
        confirmLabel="Remove it"
        message={
          <>
            Only the card goes - the shop itself is not touched. To hide it for a while instead,
            open <strong>Edit</strong> and switch it off.
          </>
        }
      />
    </div>
  );
}

function pickLook(s: Settings): CardLook {
  return {
    ribbon_style: s.ribbon_style, ribbon_color: s.ribbon_color, strip_color: s.strip_color,
    strip_shows: s.strip_shows, card_height: s.card_height, corners: s.corners,
  };
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm border ${on ? "bg-takal-yellow border-takal-ink font-semibold" : "border-takal-line hover:bg-takal-page"}`}>
      {children}
    </button>
  );
}

function ChoiceRow({ label, options, value, onPick }: { label: string; options: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="block text-sm font-medium text-takal-ink mb-1">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, words]) => (
          <Chip key={v} on={value === v} onClick={() => onPick(v)}>{words}</Chip>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-takal-ink" : "bg-slate-300"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-takal-ink">{label}</span>
        {hint ? <span className="block text-xs text-takal-ink-soft">{hint}</span> : null}
      </span>
    </label>
  );
}
