"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ADD OR EDIT ONE SHOP IN THE HOME SHOPS ROW (Mock 151).
//
// Adding: search the shops, pick one. Then, for adding and editing alike:
//   * the short line on the ribbon, English and Urdu (40 letters at most -
//     the server and the database say the same);
//   * optional dates (empty = always);
//   * on / off;
//   * the logo's colour, for "Name strip: logo colour" - worked out from the
//     logo when the shop is picked, and changeable here.
// A live card shows the result with the row's current look.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDialogKeys } from "@/components/ui";
import { errorMessage } from "@/lib/api-errors";
import { ShopCardPreview, type CardLook } from "./parts-card-preview";

export const MAX_TAGLINE = 40;

export type Row = {
  id?: string;
  restaurant_id?: string;
  tagline?: string | null;
  tagline_ur?: string | null;
  logo_color?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  shop?: any;
};

/** The logo the card is filled with: the shop's logo, its cover if none. */
export function shopPicture(s: any): string {
  return String(s?.image_url || s?.cover_url || "").trim();
}

/**
 * THE LOGO'S OWN COLOUR, for the name strip. The logo is drawn small on a
 * canvas and its pixels averaged, leaving out the near-white and see-through
 * ones (a logo's background, not its colour). If the picture cannot be read
 * (another site that refuses), there is no colour and the app uses black.
 */
export function logoColour(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url || typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 24;
        const c = document.createElement("canvas");
        c.width = n;
        c.height = n;
        const g = c.getContext("2d");
        if (!g) return resolve(null);
        g.drawImage(img, 0, 0, n, n);
        const d = g.getImageData(0, 0, n, n).data;
        let r = 0, gg = 0, b = 0, count = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [pr, pg, pb, pa] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          if (pa < 128) continue;
          if (pr > 235 && pg > 235 && pb > 235) continue;
          r += pr; gg += pg; b += pb; count++;
        }
        if (!count) return resolve(null);
        const hex = (v: number) => Math.round(v / count).toString(16).padStart(2, "0");
        resolve(`#${hex(r)}${hex(gg)}${hex(b)}`.toUpperCase());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** "2026-10-04T09:00:00+00:00" -> the value a datetime-local box shows. */
function toLocalBox(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalBox(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function ShopDialog({
  row, look, taken, onClose, onSaved,
}: {
  row: Row;
  look: CardLook;
  taken: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const adding = !row.id;
  const [shops, setShops] = useState<any[]>([]);
  // The shop list's own state, so "No shop found" is only said after the
  // shops really loaded - never while loading, never after a failed read.
  const [shopsLoading, setShopsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<any>(row.shop || null);
  const [f, setF] = useState({
    tagline: row.tagline || "",
    tagline_ur: row.tagline_ur || "",
    logo_color: row.logo_color || "",
    starts_at: toLocalBox(row.starts_at),
    ends_at: toLocalBox(row.ends_at),
    is_active: row.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  useDialogKeys(true, onClose, saving);
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));

  const loadShops = () => {
    setShopsLoading(true);
    setLoadError(null);
    apiClient
      .getRestaurants()
      .then((r: any) => setShops(r?.restaurants || r?.data || []))
      .catch((e) => setLoadError(errorMessage(e, "loading the shops")))
      .finally(() => setShopsLoading(false));
  };

  useEffect(() => {
    if (adding) loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);

  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shops
      .filter((s) => s.is_approved !== false && !taken.includes(String(s.id)))
      .filter((s) => !q || String(s.name || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [shops, search, taken]);

  const pick = async (s: any) => {
    setPicked(s);
    const c = await logoColour(shopPicture(s));
    if (c) set("logo_color", c);
  };

  const save = async () => {
    if (adding && !picked) return toast("Choose a shop first", "error");
    const payload: any = {
      tagline: f.tagline.trim(),
      tagline_ur: f.tagline_ur.trim(),
      logo_color: /^#[0-9a-f]{6}$/i.test(f.logo_color) ? f.logo_color.toUpperCase() : null,
      starts_at: fromLocalBox(f.starts_at),
      ends_at: fromLocalBox(f.ends_at),
      is_active: f.is_active,
    };
    if (payload.starts_at && payload.ends_at && payload.ends_at <= payload.starts_at) {
      return toast("The end date must be after the start date", "error");
    }
    try {
      setSaving(true);
      if (adding) {
        await apiClient.addHomeShop({ ...payload, restaurant_id: String(picked.id) });
        toast(`${picked.name} added to the row`, "success");
      } else {
        await apiClient.updateHomeShop(String(row.id), payload);
        toast("Saved", "success");
      }
      onSaved();
    } catch (e) {
      toast(errorMessage(e, adding ? "adding the shop" : "saving the shop"), "error");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-takal-line">
          <h3 className="font-bold text-takal-ink">{adding ? "Add a shop to the row" : `Edit ${picked?.name || "shop"}`}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-takal-page" title="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid md:grid-cols-[1fr_270px] gap-5 p-5">
          <div className="space-y-4">
            {adding && (
              <div>
                <span className="block text-sm font-medium text-takal-ink mb-1">Shop</span>
                {picked ? (
                  <div className="flex items-center gap-3 border border-takal-line rounded-lg p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {shopPicture(picked) ? <img src={shopPicture(picked)} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-slate-200" />}
                    <span className="flex-1 font-semibold text-takal-ink">{picked.name}</span>
                    <button onClick={() => setPicked(null)} className="text-sm text-takal-ink-soft hover:underline">Change</button>
                  </div>
                ) : (
                  <>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shops by name" className={input} autoFocus />
                    <div className="mt-2 max-h-56 overflow-y-auto border border-takal-line rounded-lg divide-y divide-takal-line">
                      {loadError ? (
                        <div className="p-3 text-sm text-takal-red flex items-center justify-between gap-3">
                          <span>The shops could not be loaded. {loadError}</span>
                          <button type="button" onClick={loadShops}
                            className="shrink-0 px-3 py-1 border border-takal-line rounded-lg text-takal-ink hover:bg-takal-page">Try again</button>
                        </div>
                      ) : shopsLoading ? (
                        <div className="p-3 text-sm text-takal-ink-soft">Loading shops…</div>
                      ) : found.length === 0 ? (
                        <div className="p-3 text-sm text-takal-ink-soft">No shop found (shops already in the row are not listed).</div>
                      ) : found.map((s) => (
                        <button key={s.id} onClick={() => pick(s)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-takal-page">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {shopPicture(s) ? <img src={shopPicture(s)} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-slate-200" />}
                          <span className="flex-1 text-sm font-medium text-takal-ink">{s.name}</span>
                          <span className="text-xs text-takal-ink-soft">{s.vendor_type || ""}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs text-takal-ink-soft">
                Short line on the ribbon (English)
                <input value={f.tagline} maxLength={MAX_TAGLINE} onChange={(e) => set("tagline", e.target.value)}
                  placeholder="e.g. Buy 1 get 1 coffee" className={input} />
                <span className="block text-right">{f.tagline.length}/{MAX_TAGLINE}</span>
              </label>
              <label className="text-xs text-takal-ink-soft">
                Short line (Urdu)
                <input value={f.tagline_ur} maxLength={MAX_TAGLINE} dir="rtl" onChange={(e) => set("tagline_ur", e.target.value)}
                  placeholder="ایک کافی پر ایک مفت" className={input} />
                <span className="block text-right">{f.tagline_ur.length}/{MAX_TAGLINE}</span>
              </label>
            </div>
            <p className="text-xs text-takal-ink-soft -mt-2">Empty = no ribbon on this card. No Urdu = the English line is shown in Urdu too.</p>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs text-takal-ink-soft">
                From (optional)
                <input type="datetime-local" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} className={input} />
              </label>
              <label className="text-xs text-takal-ink-soft">
                Until (optional)
                <input type="datetime-local" value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} className={input} />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-takal-ink cursor-pointer">
                <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4" />
                On (shown in the row)
              </label>
              <label className="flex items-center gap-2 text-sm text-takal-ink">
                Logo colour
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.logo_color) ? f.logo_color : "#141414"}
                  onChange={(e) => set("logo_color", e.target.value.toUpperCase())} className="h-8 w-10 rounded border border-takal-line" />
                <span className="text-xs text-takal-ink-soft">{f.logo_color || "not set (black)"}</span>
                {picked && (
                  <button type="button" onClick={async () => { const c = await logoColour(shopPicture(picked)); if (c) set("logo_color", c); else toast("The logo's colour could not be read", "error"); }}
                    className="text-xs underline text-takal-ink-soft">from the logo</button>
                )}
              </label>
            </div>
            <p className="text-xs text-takal-ink-soft -mt-2">Used only when “Name strip” is set to <strong>Logo colour</strong>.</p>
          </div>

          <div>
            <span className="block text-sm font-medium text-takal-ink mb-2">How it looks</span>
            <ShopCardPreview
              look={look}
              shop={{
                name: picked?.name || "Shop name",
                picture: shopPicture(picked),
                tagline: f.tagline,
                rating: picked?.rating,
                ratingCount: picked?.rating_count,
                logoColor: f.logo_color,
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-takal-line">
          <button onClick={onClose} className="px-4 py-2 border border-takal-line rounded-lg text-sm hover:bg-takal-page">Cancel</button>
          <button onClick={save} disabled={saving || (adding && !picked)}
            className="px-5 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:opacity-40 text-takal-ink rounded-lg font-medium">
            {saving ? "Saving…" : adding ? "Add to the row" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
