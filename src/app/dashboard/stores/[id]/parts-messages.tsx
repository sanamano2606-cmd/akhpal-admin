"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 237 PIECE 2 - THE SHOP'S "MESSAGES" TAB (approved by Sana 10 Nov 2026;
// "GO 237 piece 2" 12 Nov 2026).
//
// Everything Takal said to this shop, and what it did back, in ONE list,
// newest first, cut into days: the Assistant's app messages, Send back,
// WhatsApp, the vendor's "sent fixes back", office notes and "I called".
//
// Tidy, not hidden: the same Assistant message on following days is one line
// ("same message 5 times", which opens); a double press is one line. The
// server decides both (routers/shop_timeline.py) - this file only draws.
//
// "Add note" uses the office-notes door that already exists (Mock 215-3). The
// vendor never sees a note.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  FILTERS, KIND_ICON, byDay, filterCount, inFilter, repeatLine, shortText, timeOf,
  type Filter, type ShopEvent, type ShopTimeline,
} from "@/lib/shop-messages";
import { dayMonth, clock } from "@/lib/needs-today";

const TONE: Record<string, { icon: string; tag: string }> = {
  assistant: { icon: "bg-takal-yellow-soft border-[#E6E000]", tag: "bg-takal-yellow-soft text-[#6B6500]" },
  blur: { icon: "bg-takal-purple-soft border-[#C9BCE3]", tag: "bg-takal-purple-soft text-takal-purple" },
  sent_back: { icon: "bg-takal-orange-soft border-[#FFB892]", tag: "bg-takal-orange-soft text-[#C2410C]" },
  whatsapp: { icon: "bg-takal-green-soft border-[#9CD3AE]", tag: "bg-takal-green-soft text-takal-green" },
  vendor: { icon: "bg-takal-blue-soft border-[#9DB9D9]", tag: "bg-takal-blue-soft text-takal-blue" },
  note: { icon: "bg-takal-page border-takal-line", tag: "bg-takal-page text-takal-ink-soft" },
  called: { icon: "bg-takal-yellow border-takal-ink", tag: "bg-takal-yellow text-takal-ink" },
};

export function ShopMessagesTab({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<ShopTimeline | null>(null);
  const [failed, setFailed] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setData((await apiClient.getShopMessages(restaurantId)) as ShopTimeline);
      setFailed("");
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "The messages could not be read just now.");
    }
  };
  useEffect(() => { void load(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = async () => {
    const text = note.trim();
    if (text.length < 2) { toast("Write the note first.", "error"); return; }
    setSaving(true);
    try {
      await apiClient.addShopNote(restaurantId, text);
      setNote("");
      toast("Note kept. The vendor does not see it.", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "The note was not saved", "error");
    } finally {
      setSaving(false);
    }
  };

  const events = data?.events || [];
  const shown = events.filter((e) => inFilter(e, filter));
  const flip = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const line = (e: ShopEvent) => {
    const key = `${e.kind}-${e.id}-${e.at}`;
    const t = TONE[e.kind] || TONE.note;
    const long = shortText(e.text);
    const full = open[`text:${key}`];
    const rep = repeatLine(e);
    return (
      <div key={key} data-message={e.kind} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 pb-2.5">
        <span aria-hidden className={`grid h-10 w-10 place-items-center rounded-xl border-[1.5px] text-[18px] ${t.icon}`}>{KIND_ICON[e.kind]}</span>
        <div className="rounded-xl border border-takal-line bg-white px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <b className="text-[13.5px] text-takal-ink">{e.by}</b>
            <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${t.tag}`}>{e.label}</span>
            {rep && <span data-message-repeat className="rounded-md bg-takal-purple-soft px-2 py-0.5 text-[12px] font-extrabold text-takal-purple">{rep}</span>}
            <span className="ml-auto text-[12px] text-takal-ink-soft">{e.repeat > 1 ? `${dayMonth(e.at)}, ` : ""}{timeOf(e)}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-takal-ink">
            {full ? e.text : long.text}
          </p>
          {long.cut && (
            <button type="button" onClick={() => flip(`text:${key}`)} className="mt-1 text-[12.5px] font-bold text-takal-blue hover:underline">
              {full ? "Show less ▲" : "Show all ▼"}
            </button>
          )}
          {e.repeat > 1 && (
            <div className="mt-1">
              <button type="button" data-message-times onClick={() => flip(`times:${key}`)} className="text-[12.5px] font-bold text-takal-blue hover:underline">
                {e.repeat === 2
                  ? (open[`times:${key}`] ? "Hide the earlier one ▲" : "Show the earlier one ▼")
                  : (open[`times:${key}`] ? `Hide the ${e.repeat - 1} earlier ones ▲` : `Show the ${e.repeat - 1} earlier ones ▼`)}
              </button>
              {open[`times:${key}`] && (
                <ul className="mt-1 space-y-0.5 text-[12.5px] text-takal-ink-soft">
                  {e.times.slice(1).map((x) => <li key={x}>· {dayMonth(x)}, {clock(x)} - the same message</li>)}
                </ul>
              )}
            </div>
          )}
          {e.pressed_twice && (
            <p className="mt-1 text-[12.5px] text-takal-ink-soft">Pressed twice within 2 minutes - kept once here.</p>
          )}
          {e.kind === "vendor" && e.still_waiting && (
            <Link href={`/dashboard/stores/${restaurantId}/review`} className="mt-1 inline-block text-[12.5px] font-bold text-takal-blue hover:underline">
              Review again ›
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <section data-shop-messages className="rounded-2xl border border-takal-line bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-[17px] font-extrabold text-takal-ink">Messages</h3>
        <span lang="ur" dir="rtl" className="text-[15px] text-takal-ink-soft"
          style={{ fontFamily: '"Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif' }}>پیغامات</span>
        <span className="text-[13px] text-takal-ink-soft">
          Everything Takal said to this shop, and what it did - newest first. The vendor never sees office notes.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" data-message-filter={f.key} aria-pressed={on} onClick={() => setFilter(f.key)}
              className={`rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold ${on ? "border-takal-ink bg-takal-ink text-takal-yellow" : "border-takal-line bg-white text-takal-ink"}`}>
              {f.icon && <span aria-hidden className="mr-1">{f.icon}</span>}{f.label} {filterCount(events, f.key)}
            </button>
          );
        })}
      </div>

      <div className="mb-3 mt-2.5 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
          onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }}
          placeholder='Add an office note - e.g. "Called, he will add drinks on Friday"'
          className="min-w-0 flex-1 rounded-lg border-[1.5px] border-takal-line bg-takal-page px-3 py-2 text-[13.5px] outline-none focus:border-takal-ink" />
        <button type="button" onClick={addNote} disabled={saving}
          className="rounded-lg border-[1.5px] border-takal-ink bg-takal-yellow px-4 py-2 text-[13.5px] font-bold text-takal-ink disabled:opacity-60">
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>

      {failed && <p className="py-4 text-[13.5px] text-takal-red">{failed} <button type="button" onClick={load} className="font-bold underline">Try again</button></p>}
      {!data && !failed && <p className="py-4 text-[13.5px] text-takal-ink-soft">Reading the messages…</p>}
      {/* read-safe: `data` is set only by a read that worked - a failed read
          leaves it null and shows the red line above instead. */}
      {data && shown.length === 0 && (
        <p className="rounded-xl bg-takal-page px-4 py-5 text-center text-[13.5px] text-takal-ink-soft">
          {events.length === 0 ? "Nothing has been sent to this shop yet." : "Nothing of this kind yet."}
        </p>
      )}
      {byDay(shown).map(([day, list]) => (
        <div key={day}>
          <p className="mb-1.5 ml-[52px] mt-3 text-[12px] font-extrabold tracking-wide text-takal-ink-soft">{day}</p>
          {list.map(line)}
        </div>
      ))}
      {data?.more && (
        <p className="mt-2 text-center text-[12.5px] text-takal-ink-soft">Only the newest 400 are shown.</p>
      )}
    </section>
  );
}
