"use client";

// 🧱 BLOCKS (Mock 244): the parts of Home in order. Drag ⋮⋮ (or use the
// arrows) to move, the switch hides, and each one can be aimed at Mingora or
// Matta and at dates, hours or a ready time (Breakfast, Iftar, Jumma ...).
// A block with nothing to show hides itself on the phone.

import { useState } from "react";
import {
  BLOCK_NAMES, FIXED_BOTTOM, FIXED_TOP, READY_TIMES, blockName, whenWords,
  type Block, type Layout, type When,
} from "@/lib/app-home";
import { Label, Switch } from "./parts-fields";

export function BlocksPart({ layout, onChange, taps }: {
  layout: Layout; onChange: (l: Layout) => void; taps: Record<string, number>;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const blocks = layout.blocks;
  const setBlocks = (b: Block[]) => onChange({ ...layout, blocks: b });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [b] = next.splice(from, 1);
    next.splice(to, 0, b);
    setBlocks(next);
  };
  const patch = (i: number, p: Partial<Block>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)));

  return (
    <div className="rounded-[14px] border border-takal-line bg-white p-4" data-part="blocks">
      <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
        Home blocks <span className="rounded-full bg-[#F2F2EF] px-2.5 py-0.5 text-[12px] font-semibold">drag ⋮⋮ or use the arrows to change the order</span>
      </h3>
      <p className="mb-2 mt-0.5 text-[12px] text-takal-ink-soft">
        Top to bottom, as the customer sees Home. A block with nothing to show hides itself - customers never see an empty space.
      </p>
      {FIXED_TOP.map((f) => (
        <div key={f.name} className="flex items-center gap-2.5 border-t border-[#F0F0F0] py-2 text-[13px]">
          <span className="w-6" />
          <div className="min-w-0 flex-1"><b>{f.name}</b><div className="truncate text-[12px] text-takal-ink-soft">{f.note}</div></div>
          <span className="rounded-full border border-[#D9D9D9] px-2.5 py-0.5 text-[12px] font-semibold text-takal-ink-soft">🔒 Fixed</span>
        </div>
      ))}
      {blocks.map((b, i) => {
        const isCollection = b.key.startsWith("collection:");
        const n = taps[b.key];
        const note = BLOCK_NAMES[b.key]?.note || "Your own collection - fill it in 📚 Collections";
        return (
          <div key={b.key}>
            <div draggable onDragStart={() => setDragging(i)} onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragging != null) move(dragging, i); setDragging(null); }}
              data-block-row={b.key}
              className={`flex flex-wrap items-center gap-2.5 border-t border-[#F0F0F0] py-2 text-[13px] ${dragging === i ? "opacity-50" : ""} ${isCollection ? "bg-takal-yellow-soft" : ""}`}>
              <span className="w-6 cursor-grab select-none text-center text-[16px] tracking-[-2px] text-[#9a9a9a]" title="Drag to move">⋮⋮</span>
              <div className="min-w-[160px] flex-1">
                <b>{blockName(b.key, layout)}</b>
                <div className="truncate text-[12px] text-takal-ink-soft">{note}{n != null ? <> · <b className="text-takal-ink">{n.toLocaleString()} taps</b> this week</> : null}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
              <select value={b.where} aria-label="Where" onChange={(e) => patch(i, { where: e.target.value as Block["where"] })}
                className={`w-auto h-[30px] rounded-full border px-2 py-0 text-[12px] font-semibold ${b.where === "all" ? "border-takal-line bg-[#F2F2EF]" : "border-takal-blue bg-takal-blue-soft text-takal-blue"}`}>
                <option value="all">📍 Everywhere</option>
                <option value="mingora">📍 Mingora only</option>
                <option value="matta">📍 Matta only</option>
              </select>
              <button type="button" onClick={() => setEditing(editing === b.key ? null : b.key)}
                className={`h-[30px] rounded-full border px-2.5 text-[12px] font-semibold ${whenWords(b.when) === "Always" ? "border-takal-line bg-[#F2F2EF]" : "border-takal-purple bg-takal-purple-soft text-takal-purple"}`}>
                🕒 {whenWords(b.when)}
              </button>
              <Switch on={b.on} onChange={(v) => patch(i, { on: v })} />
              <div className="flex">
                <button type="button" aria-label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}
                  className="h-8 w-8 rounded-l-lg border border-takal-line text-[13px] disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1}
                  className="h-8 w-8 rounded-r-lg border border-l-0 border-takal-line text-[13px] disabled:opacity-30">↓</button>
              </div>
              </div>
            </div>
            {editing === b.key && <WhenEditor when={b.when} onChange={(w) => patch(i, { when: w })} onDone={() => setEditing(null)} />}
          </div>
        );
      })}
      <div className="flex items-center gap-2.5 border-t border-[#F0F0F0] py-2 text-[13px]">
        <span className="w-6" />
        <div className="min-w-0 flex-1"><b>{FIXED_BOTTOM.name}</b><div className="truncate text-[12px] text-takal-ink-soft">{FIXED_BOTTOM.note}</div></div>
        <span className="rounded-full border border-[#D9D9D9] px-2.5 py-0.5 text-[12px] font-semibold text-takal-ink-soft">🔒 Fixed</span>
      </div>
    </div>
  );
}

export function WhenEditor({ when, onChange, onDone }: { when: When; onChange: (w: When) => void; onDone: () => void }) {
  const set = (p: Partial<When>) => {
    const next: When = { ...when, ...p };
    (Object.keys(next) as (keyof When)[]).forEach((k) => { if (!next[k]) delete next[k]; });
    onChange(next);
  };
  return (
    <div className="mb-2 rounded-xl border border-takal-purple bg-takal-purple-soft/40 p-3" data-when-editor>
      <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
        <div>
          <Label>Dates (Pakistan)</Label>
          <div className="flex items-center gap-1.5 text-[13px]">
            <input type="date" value={when.from_date || ""} onChange={(e) => set({ from_date: e.target.value })} aria-label="First day"
              className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
            –
            <input type="date" value={when.to_date || ""} onChange={(e) => set({ to_date: e.target.value })} aria-label="Last day"
              className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
          </div>
        </div>
        <div>
          <Label>Hours every day</Label>
          <div className="flex items-center gap-1.5 text-[13px]">
            <input type="time" value={when.from_time || ""} onChange={(e) => set({ from_time: e.target.value })} aria-label="From"
              className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
            –
            <input type="time" value={when.to_time || ""} onChange={(e) => set({ to_time: e.target.value })} aria-label="To"
              className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
          </div>
        </div>
        <div>
          <Label>Or a ready time</Label>
          <select value={when.ready || ""} onChange={(e) => set({ ready: e.target.value })} aria-label="Ready time"
            className="h-[32px] w-full rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]">
            <option value="">None</option>
            {READY_TIMES.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[12px] text-takal-ink-soft">
        Everything set must be true at once. Empty = always.
        <button type="button" onClick={() => onChange({})} className="font-semibold underline">Always</button>
        <button type="button" onClick={onDone} className="ml-auto h-[30px] rounded-lg border-[1.5px] border-takal-ink px-3 font-bold text-takal-ink">Done</button>
      </div>
    </div>
  );
}
