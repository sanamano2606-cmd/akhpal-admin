"use client";

// 🎨 LOOKS & SCHEDULE (Mock 244): saved designs of the 4 cards and the top
// tabs. "Normal" is always there; any other look has a first and a last day
// and replaces Normal for those days, then Home goes back by itself. Also
// here: the rain / busy message, and the published versions that can be
// brought back.

import { useMemo, useState } from "react";
import {
  RAIN_KINDS, READY_TIMES, newLook, pkToday, type Layout, type Look, type Rain,
} from "@/lib/app-home";
import { Choices, Label, Switch, WordsPair } from "./parts-fields";

const COLOURS = ["#1F6F4A", "#004E89", "#6A3FA0", "#B3122E", "#0F7B8A", "#FF6B35"];

export function LooksPart({ layout, onChange, editing, onEdit, history, onRestore }: {
  layout: Layout; onChange: (l: Layout) => void; editing: string; onEdit: (id: string) => void;
  history: { id: number; published_at: string; by: string }[]; onRestore: (id: number) => void;
}) {
  const today = pkToday();
  const setLooks = (looks: Look[]) => onChange({ ...layout, looks });
  const patchLook = (id: string, p: Partial<Look>) => setLooks(layout.looks.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const add = () => {
    const n = newLook(`Look ${layout.looks.length + 1}`);
    const base = layout.looks.find((l) => l.normal);
    if (base) { n.cards = JSON.parse(JSON.stringify(base.cards)); n.tabs = JSON.parse(JSON.stringify(base.tabs)); }
    setLooks([...layout.looks, n]);
    onEdit(n.id);
  };
  const copy = (l: Look) => {
    const n = { ...JSON.parse(JSON.stringify(l)), id: newLook("x").id, name: `${l.name} copy`, normal: false, from_date: "", to_date: "" };
    setLooks([...layout.looks, n]);
  };

  // The calendar: the next 8 weeks, a row per look that has dates.
  const days = useMemo(() => {
    const out: string[] = [];
    const start = new Date(today + "T00:00:00Z");
    for (let i = 0; i < 56; i++) out.push(new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
    return out;
  }, [today]);
  const dated = layout.looks.filter((l) => !l.normal && l.from_date && l.to_date);

  return (
    <div data-part="looks">
      <div className="mb-3 flex flex-wrap gap-3">
        {layout.looks.map((l, i) => {
          const on = l.normal ? !dated.some((d) => today >= d.from_date && today <= d.to_date) : today >= l.from_date && today <= l.to_date;
          return (
            <div key={l.id} data-look={l.id}
              className={`w-full rounded-[14px] border bg-white p-3 sm:w-[calc(50%-6px)] ${editing === l.id ? "border-takal-ink shadow-[inset_0_0_0_1px_#000]" : "border-takal-line"}`}>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: l.normal ? "#1F6F4A" : COLOURS[i % COLOURS.length] }} />
                <input value={l.name} maxLength={30} aria-label="Look name" disabled={l.normal}
                  onChange={(e) => patchLook(l.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-transparent px-1 text-[15px] font-extrabold hover:border-takal-line disabled:bg-transparent" />
                {on ? <span className="rounded-full bg-takal-green-soft px-2 py-0.5 text-[12px] font-bold text-takal-green">● On today</span>
                  : l.from_date ? <span className="rounded-full bg-takal-purple-soft px-2 py-0.5 text-[12px] font-bold text-takal-purple">Scheduled</span>
                  : <span className="rounded-full bg-[#F2F2EF] px-2 py-0.5 text-[12px] font-bold">{l.normal ? "Not today" : "No dates yet"}</span>}
              </div>
              {l.normal ? (
                <div className="mt-1.5 text-[12px] text-takal-ink-soft">Every day that no other look has.</div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                  <input type="date" value={l.from_date} aria-label="First day" onChange={(e) => patchLook(l.id, { from_date: e.target.value })}
                    className="w-auto h-[30px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
                  –
                  <input type="date" value={l.to_date} aria-label="Last day" onChange={(e) => patchLook(l.id, { to_date: e.target.value })}
                    className="w-auto h-[30px] rounded-lg border-[1.5px] border-takal-line px-1.5 text-[13px]" />
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onEdit(l.id)}
                  className={`h-[30px] rounded-lg border-[1.5px] px-3 text-[13px] font-bold ${editing === l.id ? "border-takal-ink bg-takal-yellow" : "border-takal-ink bg-white"}`}>
                  {editing === l.id ? "✓ Editing this look" : "Edit its cards and tabs"}
                </button>
                <button type="button" onClick={() => copy(l)} className="h-[30px] rounded-lg border border-takal-line px-3 text-[13px] font-semibold">Copy</button>
                {!l.normal && (
                  <button type="button" onClick={() => { setLooks(layout.looks.filter((x) => x.id !== l.id)); if (editing === l.id) onEdit(layout.looks[0].id); }}
                    className="h-[30px] rounded-lg border border-takal-red px-3 text-[13px] font-semibold text-takal-red">Remove</button>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={add} className="h-[44px] self-center rounded-xl border-2 border-dashed border-[#b5b5b5] px-4 text-[13px] font-bold">+ New look (e.g. Eid, Ramadan)</button>
      </div>

      <div className="mb-3 rounded-[14px] border border-takal-line bg-white p-4">
        <h3 className="text-[15px] font-extrabold">What customers will see - the next 8 weeks</h3>
        <p className="mb-2 text-[12px] text-takal-ink-soft">A look goes live and ends by itself, on Pakistan days. When it ends, Home goes back to Normal. Ramadan and Eid dates are set when the moon is announced.</p>
        <div className="overflow-x-auto">
          <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${days.length}, minmax(9px, 1fr))`, gap: 2, minWidth: 620 }} className="items-center text-[12px]">
            <div />
            {days.map((d, i) => <div key={d} className="text-center text-takal-ink-soft">{i % 7 === 0 ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</div>)}
            {[{ id: "normal", name: "Normal" }, ...dated].map((l, i) => (
              <Row key={l.id} name={l.name} days={days} colour={l.id === "normal" ? "#1F6F4A" : COLOURS[(i) % COLOURS.length]}
                on={(d) => l.id === "normal" ? !dated.some((x) => d >= x.from_date && d <= x.to_date) : d >= (l as Look).from_date && d <= (l as Look).to_date} />
            ))}
          </div>
        </div>
      </div>

      <RainPart rain={layout.rain} onChange={(rain) => onChange({ ...layout, rain })} />

      <div className="mb-3 rounded-[14px] border border-takal-line bg-white p-4">
        <h3 className="text-[15px] font-extrabold">🌙 Ready times</h3>
        <p className="mb-2 text-[12px] text-takal-ink-soft">Pick one in a block&apos;s 🕒 time (🧱 Blocks) instead of typing hours every day. Sehri and iftar follow Swat&apos;s own sun, day by day.</p>
        <div className="flex flex-wrap gap-2">{READY_TIMES.map((r) => <span key={r.key} className="rounded-[10px] border border-takal-line px-2.5 py-1 text-[13px] font-semibold">{r.name}</span>)}</div>
      </div>

      <div className="rounded-[14px] border border-takal-line bg-white p-4" data-history>
        <h3 className="text-[15px] font-extrabold">Published before</h3>
        <p className="mb-2 text-[12px] text-takal-ink-soft">&quot;Bring back&quot; copies an older Home into the draft - look at it, then Publish.</p>
        {history.length === 0 && <div className="text-[13px] text-takal-ink-soft">Nothing published yet.</div>}
        {history.slice(0, 10).map((h, i) => (
          <div key={h.id} className="flex items-center gap-2 border-t border-[#F0F0F0] py-1.5 text-[13px]">
            <span className="flex-1">{new Date(h.published_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{h.by ? ` · ${h.by}` : ""}{i === 0 ? " · live now" : ""}</span>
            {i > 0 && <button type="button" onClick={() => onRestore(h.id)} className="h-[30px] rounded-lg border border-takal-line px-2.5 text-[12px] font-semibold">Bring back</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ name, days, colour, on }: { name: string; days: string[]; colour: string; on: (d: string) => boolean }) {
  return (
    <>
      <div className="truncate font-bold">{name}</div>
      {days.map((d) => <div key={d} title={d} style={{ height: 16, borderRadius: 3, background: on(d) ? colour : "#F2F2EF" }} />)}
    </>
  );
}

function RainPart({ rain, onChange }: { rain: Rain; onChange: (r: Rain) => void }) {
  const [open, setOpen] = useState(rain.on);
  const set = (p: Partial<Rain>) => onChange({ ...rain, ...p });
  return (
    <div className="mb-3 rounded-[14px] border border-takal-line bg-white p-4" data-rain>
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-extrabold">🌧 Rain or busy message</h3>
        <div className="ml-auto"><Switch on={rain.on} onChange={(v) => { set({ on: v }); setOpen(true); }} label={rain.on ? "On" : "Off"} /></div>
      </div>
      <p className="mt-0.5 text-[12px] text-takal-ink-soft">One calm blue line on top of Home, until you switch it off or its end time passes. It still needs Publish.</p>
      {(open || rain.on) && (
        <>
          <Label>Ready messages</Label>
          <div className="flex flex-wrap gap-2">
            {RAIN_KINDS.map((k) => (
              <button key={k.key} type="button" onClick={() => set({ kind: k.key, text_en: k.en, text_ur: k.ur })}
                className={`h-[30px] rounded-[10px] border-[1.5px] px-3 text-[13px] font-semibold ${rain.kind === k.key ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line"}`}>{k.name}</button>
            ))}
          </div>
          <WordsPair label="Message" en={rain.text_en} ur={rain.text_ur} max={120} placeholder="Heavy rain in Swat - delivery may take a little longer."
            onEn={(v) => set({ text_en: v })} onUr={(v) => set({ text_ur: v })} />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <div>
              <Label>Switch off by itself at (Pakistan time)</Label>
              <input type="datetime-local" value={rain.until} onChange={(e) => set({ until: e.target.value })}
                className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]" />
              {rain.until && <button type="button" onClick={() => set({ until: "" })} className="ml-2 text-[12px] underline">no end time</button>}
            </div>
            <div>
              <Label>Where</Label>
              <Choices value={rain.where} onChange={(v) => set({ where: v })}
                options={[{ key: "all", name: "Everywhere" }, { key: "mingora", name: "Mingora" }, { key: "matta", name: "Matta" }]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
