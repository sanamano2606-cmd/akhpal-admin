"use client";
/* eslint-disable @next/next/no-img-element -- the panel shows pictures with a plain <img>: images are unoptimized (next.config.js) and come from Takal's own picture store or the panel itself */

// ⭕ THE TOP TABS (Mock 244): their order, which ones show, which opens first,
// one style for all, the chosen tab's colours, the photo size, shrinking, and
// for each tab its name (English + one short Urdu word) and pictures.

import { useState } from "react";
import {
  TAB_NAMES_UR, TAB_STYLES, defaultPic, defaultTabs, type Look, type TabItemLook, type Tabs,
  tabName, liveFit, tabLiveShown, type LivePictures,
} from "@/lib/app-home";
import { Choices, ColourBox, Label, Section, Slider, Switch, WordsPair } from "./parts-fields";
import { PictureChooser } from "./parts-picture";

/** Every tab in the order the phone draws them: the office's first, then the
 *  rest in the app's own order. */
export function tabRows(tabs: Tabs, types: string[]): TabItemLook[] {
  const listed = tabs.items.map((t) => t.code);
  return [
    ...tabs.items,
    ...types.filter((c) => !listed.includes(c)).map((code) => ({ code, on: true, name_en: "", name_ur: "", pic: defaultPic(true) })),
  ];
}

/** A tab's picture in a few words (Mock 246). */
function tabPictureWords(tabs: Tabs, t: TabItemLook, live: LivePictures | null | undefined): string {
  if (t.pic.source === "live") return "Live products you chose";
  if (t.pic.source === "own") return "Your own pictures";
  if (t.pic.source === "takal" || tabs.pics !== "auto") return "Fixed picture";
  if (live === undefined) return "✨ Live pictures";
  if (live === null) return "✨ Live pictures · could not be read now";
  const n = (live.tabs[t.code] || []).length;
  return tabLiveShown(tabs, t.pic, live.tabs[t.code], live.min).length
    ? `✨ ${n} live picture${n === 1 ? "" : "s"} now`
    : `Only ${n} live now - fixed picture`;
}

export function TabsPart({ look, onChange, types, live, town = "mingora" }: {
  look: Look; onChange: (l: Look) => void; types: string[];
  live?: LivePictures | null; town?: "mingora" | "matta";
}) {
  const tabs = look.tabs;
  const rows = tabRows(tabs, types);
  const [chosen, setChosen] = useState<string>(rows[0]?.code || "restaurant");
  const [open, setOpen] = useState<Record<string, boolean>>({ all: true, one: true });
  const setTabs = (p: Partial<Tabs>) => onChange({ ...look, tabs: { ...tabs, ...p } });
  const setRows = (next: TabItemLook[]) => setTabs({ items: next });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [t] = next.splice(from, 1);
    next.splice(to, 0, t);
    setRows(next);
  };
  const i = Math.max(0, rows.findIndex((t) => t.code === chosen));
  const tab = rows[i];
  const setTab = (p: Partial<TabItemLook>) => setRows(rows.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const tiled = tabs.style === "tile" || tabs.style === "chip";
  const firstOptions = rows.filter((t) => t.on);

  return (
    <div data-part="tabs">
      <div className="mb-3 rounded-[14px] border border-takal-line bg-white p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
          Tabs and their order <span className="rounded-full bg-[#F2F2EF] px-2.5 py-0.5 text-[12px] font-semibold">the arrows move · the switch hides a tab · tap one to edit it</span>
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-x-4 md:grid-cols-2">
          {rows.map((t, j) => (
            <div key={t.code} data-tab-row={t.code}
              className={`flex items-center gap-2.5 rounded-lg border-t border-[#F0F0F0] p-2 text-[13px] ${t.code === tab?.code ? "bg-takal-yellow-soft" : ""}`}>
              <button type="button" onClick={() => setChosen(t.code)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                {(() => {
                  const lv = t.pic.source === "auto" ? tabLiveShown(tabs, t.pic, live?.tabs[t.code], live?.min)[0]?.url : undefined;
                  const own = (t.pic.source === "live" || t.pic.source === "own") ? t.pic.items[0]?.url : undefined;
                  return <img src={lv || own || `/app-home/round/${t.code}_1.jpg`} alt=""
                    className="h-9 w-9 shrink-0 rounded-full border border-takal-line bg-white"
                    style={{ objectFit: lv ? liveFit(live?.tab_card[t.code]) : "cover" }} />;
                })()}
                <span className="min-w-0">
                  <b className="block truncate">{t.name_en || tabName(t.code)}</b>
                  <span className="block truncate text-[12px] text-takal-ink-soft">{(tabs.first || "restaurant") === t.code ? "Opens first ✓" : "Shop type"}</span>
                  <span className="block truncate text-[12px] text-takal-ink-soft" data-tab-picture-words>{tabPictureWords(tabs, t, live)}</span>
                </span>
              </button>
              <Switch on={t.on} onChange={(v) => setRows(rows.map((x) => (x.code === t.code ? { ...x, on: v } : x)))} />
              <div className="flex">
                <button type="button" aria-label="Move up" onClick={() => move(j, j - 1)} disabled={j === 0}
                  className="h-8 w-8 rounded-l-lg border border-takal-line disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(j, j + 1)} disabled={j === rows.length - 1}
                  className="h-8 w-8 rounded-r-lg border border-l-0 border-takal-line disabled:opacity-30">↓</button>
              </div>
            </div>
          ))}
        </div>
        <Label>Opens first</Label>
        <select value={tabs.first || ""} onChange={(e) => setTabs({ first: e.target.value })} aria-label="Opens first"
          className="h-[32px] w-[240px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]">
          <option value="">Food (as today)</option>
          {firstOptions.map((t) => <option key={t.code} value={t.code}>{t.name_en || tabName(t.code)}</option>)}
        </select>
        <div className="mt-2 text-[12px] text-takal-ink-soft">A shop type with no shops near the customer has no tab on their phone, wherever it is in this list.</div>
      </div>

      <div className="rounded-[14px] border border-takal-line bg-white p-3.5">
        <Section title="⭕ All tabs" note="style, the chosen tab, size" open={open.all} onToggle={() => setOpen({ ...open, all: !open.all })} testid="all-tabs">
          <Label>Style for all tabs</Label>
          <Choices value={tabs.style} onChange={(v) => setTabs({ style: v })} options={TAB_STYLES} testid="tab-style" />
          <Label>The chosen tab</Label>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <ColourBox label={tiled ? "Tile colour when chosen" : "Name pill when chosen"} value={tabs.chosen_fill} onChange={(v) => setTabs({ chosen_fill: v || "#FFFF00" })} />
            <ColourBox label="Words when chosen" value={tabs.chosen_words} on={[tabs.chosen_fill]} onChange={(v) => setTabs({ chosen_words: v || "#000000" })} />
            {!tiled && <ColourBox label="Ring around the photo" value={tabs.ring} onChange={(v) => setTabs({ ring: v || "#000000" })} />}
            {!tiled && <Slider label="Ring thickness" value={tabs.ring_width} min={0} max={5} step={1} onChange={(v) => setTabs({ ring_width: v })} words={`${tabs.ring_width}`} />}
          </div>
          <Label>The other tabs</Label>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {tiled && <ColourBox label="Tile colour" value={tabs.tile} allowNone on={["#000000"]}
              onChange={(v) => setTabs({ tile: v })} />}
            {!tiled && <ColourBox label="Line around the photo" value={tabs.line_color} onChange={(v) => setTabs({ line_color: v || "#E5E5E5" })} />}
          </div>
          <Label>Pictures on the round tabs <span className="ml-1 rounded-full bg-takal-ink px-1.5 text-[12px] font-extrabold text-takal-yellow">NEW</span></Label>
          <div className="mb-1 text-[12px] text-takal-ink-soft">One choice for the whole row. A tab you gave your own pictures keeps them.</div>
          <Choices value={tabs.pics} onChange={(v) => setTabs({ pics: v })} testid="tab-pics"
            options={[{ key: "auto", name: "✨ Takal picks live pictures" }, { key: "takal", name: "Takal's fixed pictures (as before)" }]} />
          {tabs.pics === "auto" && (
            <>
              <Label>Change the picture every</Label>
              <Choices value={String(tabs.pics_seconds) as any} onChange={(v) => setTabs({ pics_seconds: Number(v) })} testid="tab-pics-seconds"
                options={[{ key: "0", name: "Never" }, { key: "4", name: "4 s" }, { key: "8", name: "8 s" }, { key: "15", name: "15 s" }]} />
              <div className="mt-1.5 text-[12px] text-takal-ink-soft">&quot;Never&quot; is best for tabs: a row of pictures all moving at once is busy and slows old phones. Each tab still opens on a fresh picture whenever Home is rebuilt (every few minutes).</div>
            </>
          )}
          <Slider label="Photo size" value={tabs.size} min={0.6} max={0.9} step={0.01} onChange={(v) => setTabs({ size: v })}
            words={`${Math.round(tabs.size * 100)}% of the tile`} />
          <div className="mt-3 flex flex-wrap gap-4">
            <Switch on={tabs.shrink} onChange={(v) => setTabs({ shrink: v })} label="Tabs shrink when the customer scrolls" />
            <Switch on={tabs.stick} onChange={(v) => setTabs({ stick: v })} label="Stay stuck at the top" />
          </div>
          <button type="button" onClick={() => onChange({ ...look, tabs: { ...defaultTabs(), items: tabs.items } })}
            className="mt-3 h-[30px] rounded-lg border border-takal-line px-2.5 text-[12px] font-semibold">Reset the look to today&apos;s (keeps order and names)</button>
        </Section>
        {tab && (
          <Section title={`${tab.name_en || tabName(tab.code)} tab`} note="name, Urdu word, pictures" open={open.one}
            onToggle={() => setOpen({ ...open, one: !open.one })} testid="one-tab">
            <WordsPair label="Name" en={tab.name_en} ur={tab.name_ur} max={14} placeholder={tabName(tab.code)} placeholderUr={TAB_NAMES_UR[tab.code]}
              onEn={(v) => setTab({ name_en: v })} onUr={(v) => setTab({ name_ur: v })} />
            <div className="mt-1 text-[12px] text-takal-ink-soft">Keep the Urdu to one short word, like کھانا - it sits under a small photo.</div>
            <PictureChooser forTab pic={tab.pic} onChange={(pic) => setTab({ pic })} town={town}
              rowLive={tabs.pics === "auto"} card={live?.tab_card[tab.code]}
              deptName={`${tab.name_en || tabName(tab.code)}`}
              live={live === undefined ? undefined : live === null ? null : (live.tabs[tab.code] || [])} />
          </Section>
        )}
      </div>
    </div>
  );
}
