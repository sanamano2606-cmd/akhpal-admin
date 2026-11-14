"use client";
/* eslint-disable @next/next/no-img-element -- the panel shows pictures with a plain <img>: images are unoptimized (next.config.js) and come from Takal's own picture store or the panel itself */

// THE PICTURE OF A CARD OR A TAB (Mock 244). Sana, 11 Nov 2026: "the picture
// selection from live or my own like home banner, if i want to show one
// picture at a time or change every few seconds, the size of a picture in a
// card the style change of the picture in a card".
//
// Where it comes from: Takal picks (today's), chosen live products, or the
// office's own uploads - mixed is fine. An upload is READ for phone numbers
// and websites first, like every shop picture; one that has any, or that
// cannot be read, is not used.

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { checkPicture } from "@/lib/picture-check";
import { AUTO_MIN, AUTO_SECONDS, liveFit, liveShown, type CardKey, type LivePicture, type Pic } from "@/lib/app-home";
import { Choices, ColourBox, Label, Slider, Switch } from "./parts-fields";

const MAX = 6;

export function PictureChooser({ pic, onChange, forTab = false, live, card, deptName, town = "mingora", rowLive = true }: {
  pic: Pic; onChange: (p: Pic) => void; forTab?: boolean;
  /** Mock 246: what Takal would pick now (undefined = still being read, null = could not be read). */
  live?: LivePicture[] | null;
  /** The card (or the tab's card) - decides whether live pictures fill or show whole. */
  card?: CardKey;
  /** "Food & Drinks shops" / "Pharmacy shops" - who the pictures come from. */
  deptName?: string;
  town?: "mingora" | "matta";
  /** A tab: is the whole row on live pictures? */
  rowLive?: boolean;
}) {
  const set = (patch: Partial<Pic>) => onChange({ ...pic, ...patch });
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<any[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const find = async () => {
    setLooking(true);
    try {
      const res = (await apiClient.searchAppHomeProducts(search)) as any;
      setFound(res?.products || []);
    } catch (e) {
      toast(errorMessage(e, "the live products"), "error");
    } finally {
      setLooking(false);
    }
  };

  const add = (item: { product_id?: string; url?: string }) => {
    if (pic.items.length >= MAX) {
      toast(`At most ${MAX} pictures`, "error");
      return;
    }
    if (item.product_id && pic.items.some((x) => x.product_id === item.product_id)) return;
    set({ items: [...pic.items, item] });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await apiClient.uploadImage(file);
      const read = await checkPicture(url);
      if (read.failed) {
        toast("The picture could not be checked for phone numbers - please try again", "error");
        return;
      }
      if (read.hits.length) {
        toast("This picture has a phone number or website on it - please choose another", "error");
        return;
      }
      add({ url });
    } catch (e) {
      toast(errorMessage(e, "uploading the picture"), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-picture-chooser>
      <Label>Where the picture comes from</Label>
      <Choices value={pic.source}
        onChange={(v) => set({ source: v, ...(v === "auto" && !forTab && !pic.change_seconds ? { change_seconds: AUTO_SECONDS } : {}) })}
        testid="pic-source"
        options={[
          { key: "auto", name: forTab ? "✨ Live pictures (as the row says)" : "✨ Takal picks live pictures" },
          { key: "takal", name: "Takal's fixed picture" },
          { key: "live", name: "I choose from live products" },
          { key: "own", name: "I upload my own" },
        ]} />

      {pic.source === "auto" && (
        <AutoPart pic={pic} set={set} forTab={forTab} live={live} card={card} deptName={deptName}
          town={town} rowLive={rowLive} />
      )}

      {(pic.source === "live" || pic.source === "own") && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pic.items.map((it, i) => (
              <div key={(it.product_id || it.url || "") + i} className="relative h-[54px] w-[54px] overflow-hidden rounded-[10px] border-[1.5px] border-takal-line bg-[#F2F2EF]">
                {it.url ? <img src={it.url} alt="" className="h-full w-full object-cover" /> :
                  <span className="grid h-full place-items-center text-[12px] text-takal-ink-soft">product</span>}
                <span className="absolute bottom-0.5 left-0.5 rounded-md bg-black px-1.5 text-[12px] font-extrabold text-takal-yellow">{i + 1}</span>
                <button type="button" aria-label="Take this picture out"
                  onClick={() => set({ items: pic.items.filter((_, j) => j !== i) })}
                  className="absolute right-0.5 top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-black text-[12px] text-white">✕</button>
              </div>
            ))}
            {pic.items.length < MAX && pic.source === "own" && (
              <label className={`grid h-[54px] w-[54px] cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-[#b5b5b5] text-[20px] text-[#666] ${uploading ? "opacity-50" : ""}`}
                title="Upload a picture">
                {uploading ? "…" : "+"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
          {pic.source === "live" && (
            <div className="mt-2">
              <div className="flex gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Find a live product…"
                  onKeyDown={(e) => { if (e.key === "Enter") find(); }}
                  className="h-[32px] min-w-0 flex-1 rounded-lg border-[1.5px] border-takal-line px-2.5 text-[13px]" />
                <button type="button" onClick={find} disabled={looking}
                  className="h-[32px] rounded-lg border-[1.5px] border-takal-ink px-3 text-[13px] font-bold">{looking ? "Finding…" : "Find"}</button>
              </div>
              {found && (
                <div className="mt-2 grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {found.length === 0 && <div className="text-[12px] text-takal-ink-soft">No live product with a picture has that name.</div>}
                  {found.map((p) => (
                    <button key={p.id} type="button" onClick={() => add({ product_id: p.id, url: p.image_url })}
                      className="flex items-center gap-2 rounded-lg border border-takal-line p-1.5 text-left hover:bg-takal-yellow-soft">
                      <img src={p.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-bold">{p.name}</span>
                        <span className="block truncate text-[12px] text-takal-ink-soft">{p.store_name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {pic.source === "own" && (
            <div className="mt-1.5 text-[12px] text-takal-ink-soft">Your own pictures are checked for phone numbers and websites, like shop pictures.</div>
          )}

          <Label>One picture or changing</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Choices value={pic.change_seconds ? "change" : "one"}
              onChange={(v) => set({ change_seconds: v === "one" ? 0 : Math.max(pic.change_seconds, 4) })}
              options={[{ key: "one", name: "One picture - stays" }, { key: "change", name: "Change every few seconds" }]} />
            {pic.change_seconds > 0 && (
              <>
                <input type="number" min={2} max={30} value={pic.change_seconds} aria-label="Seconds"
                  onChange={(e) => set({ change_seconds: Math.max(2, Math.min(30, Number(e.target.value) || 4)) })}
                  className="h-[30px] w-[60px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px] font-bold" />
                <span className="text-[13px]">seconds</span>
                <Choices value={pic.motion} onChange={(v) => set({ motion: v })}
                  options={[{ key: "fade", name: "Fade" }, { key: "slide", name: "Slide" }]} />
              </>
            )}
          </div>
          {pic.change_seconds > 0 && pic.items.length < 2 && (
            <div className="mt-1 text-[12px] text-takal-ink-soft">Add at least 2 pictures for them to change.</div>
          )}
        </>
      )}

      <Slider label="Size of the picture" value={pic.size} min={forTab ? 0.6 : 0.3} max={forTab ? 0.9 : 0.6} step={0.01}
        onChange={(v) => set({ size: v })} words={`${Math.round(pic.size * 100)}% of the ${forTab ? "tile" : "card"}`} />

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <div>
          <Label>How it fits</Label>
          {pic.source === "auto"
            ? <div className="text-[12.5px] text-takal-ink-soft" data-auto-fit>Live pictures: food and grocery fill the space, a medicine box or a dress shows whole.</div>
            : <Choices value={pic.fit} onChange={(v) => set({ fit: v })}
                options={[{ key: "cover", name: "Fill (cut a little)" }, { key: "contain", name: "Show whole" }]} />}
        </div>
        <div>
          <Label>Shape</Label>
          <Choices value={pic.shape} onChange={(v) => set({ shape: v })}
            options={[{ key: "circle", name: "Circle" }, { key: "round", name: "Round corners" }, { key: "square", name: "Square" }]} />
        </div>
        {!forTab && (
          <div>
            <Label>Where it sits</Label>
            <Choices value={pic.place} onChange={(v) => set({ place: v })}
              options={[{ key: "br", name: "Bottom right" }, { key: "tr", name: "Top right" }, { key: "left", name: "Left" }]} />
          </div>
        )}
        {!forTab && (
          <div>
            <Label>Line, shadow, fade</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Switch on={pic.line} onChange={(v) => set({ line: v })} label="Line" />
              <Switch on={pic.shadow} onChange={(v) => set({ shadow: v })} label="Shadow" />
              <Switch on={pic.fade} onChange={(v) => set({ fade: v })} label="Dark fade" />
            </div>
          </div>
        )}
      </div>
      {!forTab && pic.line && (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <ColourBox label="Line colour" value={pic.line_color} onChange={(v) => set({ line_color: v || "#FFFFFF" })} />
          <Slider label="Line thickness" value={pic.line_width} min={0} max={4} step={1}
            onChange={(v) => set({ line_width: v })} words={`${pic.line_width}`} />
        </div>
      )}
    </div>
  );
}

/** Mock 246: "Takal picks live pictures" - nothing to choose; the rules, how
 *  often it changes, and what Takal picks right now. */
function AutoPart({ pic, set, forTab, live, card, deptName, town, rowLive }: {
  pic: Pic; set: (p: Partial<Pic>) => void; forTab: boolean; live?: LivePicture[] | null;
  card?: CardKey; deptName?: string; town: "mingora" | "matta"; rowLive: boolean;
}) {
  const place = town === "matta" ? "Matta" : "Mingora";
  const shown = liveShown(forTab ? { ...pic, fewer: "fixed" } : pic, live || undefined);
  const shops = new Set((live || []).map((p) => p.shop_id || p.shop)).size;
  const fit = liveFit(card);
  return (
    <div data-auto-part>
      {forTab && !rowLive && (
        <div className="mt-2 rounded-lg bg-takal-yellow-soft px-3 py-2 text-[12.5px] font-semibold" data-row-fixed>
          The whole row is on Takal&apos;s fixed pictures (⭕ All tabs → Pictures on the round tabs), so this tab shows its fixed picture too.
        </div>
      )}
      <div className="mt-3 rounded-[12px] bg-[#F8F8F5] px-3.5 py-3" data-auto-rules>
        <div className="text-[13.5px] font-bold">Takal picks real product photos - nothing to choose</div>
        <ul className="mt-1 list-disc pl-5 text-[12.5px] leading-[1.7] text-[#333]">
          <li>From {deptName ? <b>{deptName}</b> : "this card's"} shops that are <b>open</b> and can <b>deliver to that customer now</b></li>
          <li>Only products <b>on sale</b> that have a photo - <b>one per shop</b>, so no shop takes over</li>
          <li>Up to <b>6</b> pictures. New products and new shops come in by themselves</li>
          <li>A product hidden by Takal, or with a phone number on its photo, is never used</li>
        </ul>
      </div>
      {!forTab && (
        <>
          <Label>Change the picture every</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input type="range" min={2} max={30} step={1} value={pic.change_seconds || AUTO_SECONDS} aria-label="Seconds"
              data-auto-seconds onChange={(e) => set({ change_seconds: Number(e.target.value) })}
              className="w-[220px] accent-black" />
            <b className="text-[13px]">{pic.change_seconds || AUTO_SECONDS} s</b>
            <Choices value={pic.motion} onChange={(v) => set({ motion: v })}
              options={[{ key: "fade", name: "Fade" }, { key: "slide", name: "Slide" }]} />
          </div>
        </>
      )}
      <Label>What Takal picks in {place} · now</Label>
      {live === undefined && <div className="text-[12.5px] text-takal-ink-soft">Looking at the shops of {place}…</div>}
      {live === null && <div className="text-[12.5px] text-takal-red">The live pictures could not be read just now - the phones still get them.</div>}
      {live && live.length > 0 && (
        <div className="flex flex-wrap gap-2" data-auto-thumbs>
          {live.map((p, i) => (
            <div key={p.url + i} className="w-[66px] text-center">
              <div className="relative h-[62px] w-[62px] overflow-hidden rounded-[10px] border border-takal-line bg-white">
                <img src={p.url} alt="" className="h-full w-full" style={{ objectFit: fit }} />
                <span className="absolute bottom-0.5 left-0.5 rounded-md bg-black px-1.5 text-[12px] font-extrabold text-takal-yellow">{i + 1}</span>
              </div>
              <div className="mt-0.5 truncate text-[12px] text-takal-ink-soft" title={p.shop}>{p.shop}</div>
            </div>
          ))}
        </div>
      )}
      {/* read-safe: `live` is null when the read failed (said above in red),
          so inside this branch the pictures WERE read. */}
      {live && (shown.length > 0
        ? <div className="mt-2 inline-flex rounded-lg bg-takal-green-soft px-2.5 py-1.5 text-[12.5px] font-bold text-takal-green" data-auto-ok>
            ✓ {live.length} picture{live.length === 1 ? "" : "s"} from {shops} shop{shops === 1 ? "" : "s"}</div>
        : <div className="mt-2 inline-flex rounded-lg bg-takal-yellow-soft px-2.5 py-1.5 text-[12.5px] font-bold" data-auto-few>
            {live.length === 0 ? `No open shop has a picture here now` : `Only ${live.length} live picture`} - shows the fixed picture</div>)}
      {!forTab && (
        <>
          <Label>When there are not enough pictures</Label>
          <Choices value={pic.fewer} onChange={(v) => set({ fewer: v })} testid="pic-fewer"
            options={[{ key: "fixed", name: "Show Takal's fixed picture" }, { key: "any", name: "Show what there is, even 1" }]} />
          <div className="mt-1.5 text-[12px] text-takal-ink-soft">
            Matta or late at night may have fewer open shops. With fewer than {AUTO_MIN} live pictures the card shows its fixed picture, so it is never empty.
          </div>
        </>
      )}
    </div>
  );
}
