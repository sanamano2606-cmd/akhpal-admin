"use client";
/* eslint-disable @next/next/no-img-element -- images are unoptimized (next.config.js); the card pictures are the panel's own or Takal's */

// 🗂 THE 4 CARDS (Mock 244): places, on/off, one style for all four, and for
// each card its picture, colours, words (English + Urdu) and symbol. Where a
// card GOES when tapped never changes - only how it looks and what it says.

import { useState } from "react";
import {
  CARD_NAMES, CARD_STYLES, POSITIONS, SYMBOLS, cardBackgrounds, cardReadable, defaultCard, type Card, type CardKey, type Look, CARD_NAMES_UR, CARD_LINES_UR, CARD_LINES, CARD_PHOTOS,
  AUTO_SECONDS, liveFit, liveShown, type LivePictures,
} from "@/lib/app-home";
import { Choices, ColourBox, Label, Section, Switch, WordsPair } from "./parts-fields";
import { PictureChooser } from "./parts-picture";

/** What a card's picture is, in a few words, for the list (Mock 246). */
export function pictureWords(c: Card, live: LivePictures | null | undefined): string {
  if (c.pic.source === "auto") {
    if (live === undefined) return "✨ Live pictures";
    if (live === null) return "✨ Live pictures · could not be read now";
    const n = (live.cards[c.key] || []).length;
    // Short, so it fits the row; the whole sentence is on the row's hover.
    return liveShown(c.pic, live.cards[c.key], live.min).length
      ? `✨ ${n} live picture${n === 1 ? "" : "s"} now`
      : `Only ${n} live now - fixed picture`;
  }
  if (c.pic.source === "takal") return "Takal's fixed picture";
  return c.pic.source === "live" ? "Live products you chose" : "Your own pictures";
}

export function CardsPart({ look, onChange, live, town = "mingora" }: {
  look: Look; onChange: (l: Look) => void;
  /** Mock 246: what Takal would pick now (undefined = reading, null = failed). */
  live?: LivePictures | null; town?: "mingora" | "matta";
}) {
  const place = town === "matta" ? "Matta" : "Mingora";
  const [chosen, setChosen] = useState<CardKey>("food");
  const [open, setOpen] = useState<Record<string, boolean>>({ picture: true, colours: true, words: true, symbol: false });
  const items = look.cards.items;
  const setItems = (next: Card[]) => onChange({ ...look, cards: { ...look.cards, items: next } });
  const i = Math.max(0, items.findIndex((c) => c.key === chosen));
  const card = items[i];
  const set = (p: Partial<Card>) => setItems(items.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [c] = next.splice(from, 1);
    next.splice(to, 0, c);
    setItems(next);
  };
  const read = cardReadable(look.cards.style, card);
  const bgs = cardBackgrounds(look.cards.style, card);
  const style = look.cards.style;

  return (
    <div data-part="cards">
      <div className="mb-3 rounded-[14px] border border-takal-line bg-white p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
          The 4 cards <span className="rounded-full bg-[#F2F2EF] px-2.5 py-0.5 text-[12px] font-semibold">the arrows change places · the switch hides a card · tap one to edit it</span>
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-x-4 md:grid-cols-2">
          {items.map((c, j) => (
            <div key={c.key} data-card-row={c.key}
              className={`flex items-center gap-2.5 rounded-lg border-t border-[#F0F0F0] p-2 text-[13px] ${c.key === chosen ? "bg-takal-yellow-soft" : ""}`}>
              <button type="button" onClick={() => setChosen(c.key)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                {/* The card's own colour with its picture - what the phone shows,
                    not two letters of its name. */}
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px]"
                  style={{ background: style === "blend" ? `linear-gradient(135deg, ${c.bg1}, ${c.bg2})` : c.bg1 }}>
                  <img src={(c.pic.source === "auto" ? liveShown(c.pic, live?.cards[c.key], live?.min)[0]?.url
                    : (c.pic.source !== "takal" && c.pic.items[0]?.url)) || CARD_PHOTOS[c.key]} alt=""
                    className="h-8 w-8 rounded-full bg-white" style={{ objectFit: c.pic.source === "auto" ? liveFit(c.key) : "cover" }} />
                </span>
                <span className="min-w-0">
                  <b className="block truncate">{c.name_en || CARD_NAMES[c.key]}</b>
                  <span className="block truncate text-[12px] text-takal-ink-soft">Place {j + 1} · {POSITIONS[j]}{c.name_en ? ` · opens ${CARD_NAMES[c.key]}` : ""}</span>
                  <span className="block truncate text-[12px] text-takal-ink-soft" data-card-picture-words
                    title={`${pictureWords(c, live)} in ${place} - Takal picks real product photos of shops open now`}>{pictureWords(c, live)}</span>
                </span>
              </button>
              <Switch on={c.on} onChange={(v) => setItems(items.map((x) => (x.key === c.key ? { ...x, on: v } : x)))} />
              <div className="flex">
                <button type="button" aria-label="Move up" onClick={() => move(j, j - 1)} disabled={j === 0}
                  className="h-8 w-8 rounded-l-lg border border-takal-line disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(j, j + 1)} disabled={j === items.length - 1}
                  className="h-8 w-8 rounded-r-lg border border-l-0 border-takal-line disabled:opacity-30">↓</button>
              </div>
            </div>
          ))}
        </div>
        {items.some((c) => c.pic.source !== "auto") && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <button type="button" data-all-live
              onClick={() => setItems(items.map((c) => ({ ...c, pic: { ...c.pic, source: "auto",
                change_seconds: c.pic.change_seconds || AUTO_SECONDS } })))}
              className="h-[32px] rounded-lg border-[1.5px] border-takal-ink bg-takal-yellow px-3 text-[13px] font-bold">✨ Use live pictures on all 4 cards</button>
            <span className="text-[12.5px] text-takal-ink-soft">One tap. Each card then picks its own pictures.</span>
          </div>
        )}
        <Label>Style for all 4</Label>
        <Choices value={style} onChange={(v) => onChange({ ...look, cards: { ...look.cards, style: v } })}
          options={CARD_STYLES} testid="card-style" />
        {style === "blend" && <div className="mt-1.5 text-[12px] text-takal-ink-soft">Colour blend cards are a little taller than today&apos;s, so the picture and button always fit.</div>}
      </div>

      <div className="rounded-[14px] border border-takal-line bg-white p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <b className="text-[15px]">{card.name_en || CARD_NAMES[card.key]}</b>
          {card.name_en && <span className="text-[12px] text-takal-ink-soft">still opens {CARD_NAMES[card.key]}</span>}
          <button type="button" onClick={() => set({ ...defaultCard(card.key), on: card.on })}
            className="ml-auto h-[30px] rounded-lg border border-takal-line px-2.5 text-[12px] font-semibold">Reset this card to today&apos;s</button>
        </div>
        <Section title="🖼 Picture" note="where from, one or changing, size, style" open={open.picture}
          onToggle={() => setOpen({ ...open, picture: !open.picture })} testid="picture">
          <PictureChooser pic={card.pic} onChange={(pic) => set({ pic })} card={card.key}
            deptName={CARD_NAMES[card.key]} town={town}
            live={live === undefined ? undefined : live === null ? null : (live.cards[card.key] || [])} />
        </Section>
        <Section title="🎨 Colours" note={style === "bigpic" ? "this style uses white words on a dark fade" : "background, name, small line"} open={open.colours}
          onToggle={() => setOpen({ ...open, colours: !open.colours })} testid="colours">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <ColourBox label="Background - start" value={card.bg1} onChange={(v) => set({ bg1: v || "#F6F6F3", ...(style !== "blend" ? { bg2: v || "#F6F6F3" } : {}) })} />
            {style === "blend" && <ColourBox label="Background - end (blend)" value={card.bg2} onChange={(v) => set({ bg2: v || card.bg1 })} />}
            <ColourBox label="Name" value={card.name_color} on={bgs} onChange={(v) => set({ name_color: v || "#000000" })} />
            <ColourBox label="Small line" value={card.line_color} on={bgs} onChange={(v) => set({ line_color: v || "#6E6E68" })} />
          </div>
          {bgs.length > 0 && (read.ok
            ? <div className="mt-2 inline-flex rounded-lg bg-takal-green-soft px-2.5 py-1.5 text-[12.5px] font-bold text-takal-green">✓ Easy to read - name {read.name}, small line {read.line}</div>
            : <div className="mt-2 inline-flex rounded-lg bg-takal-red-soft px-2.5 py-1.5 text-[12.5px] font-bold text-takal-red">✗ Hard to read - Publish stays off until the words can be read</div>)}
        </Section>
        <Section title="✍️ Words" note="English and Urdu" open={open.words} onToggle={() => setOpen({ ...open, words: !open.words })} testid="words">
          <WordsPair label="Name" en={card.name_en} ur={card.name_ur} max={24}
            onEn={(v) => set({ name_en: v })} onUr={(v) => set({ name_ur: v })} placeholder={CARD_NAMES[card.key]} placeholderUr={CARD_NAMES_UR[card.key]} />
          <WordsPair label="Small line" en={card.line_en} ur={card.line_ur} max={48}
            onEn={(v) => set({ line_en: v })} onUr={(v) => set({ line_ur: v })}
            placeholder={CARD_LINES[card.key]} placeholderUr={CARD_LINES_UR[card.key]} />
          <WordsPair label="Button words (empty = no button)" en={card.button_en} ur={card.button_ur} max={16}
            onEn={(v) => set({ button_en: v })} onUr={(v) => set({ button_ur: v })} placeholder="e.g. Order now" placeholderUr="مثلاً آرڈر کریں" />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <div><Label>Text size</Label><Choices value={card.text_size} onChange={(v) => set({ text_size: v })}
              options={[{ key: "normal", name: "Normal" }, { key: "big", name: "Big" }]} /></div>
            <div><Label>Name</Label><Choices value={card.bold ? "bold" : "plain"} onChange={(v) => set({ bold: v === "bold" })}
              options={[{ key: "bold", name: "Bold" }, { key: "plain", name: "Plain" }]} /></div>
            <div><Label>Words sit</Label><Choices value={card.words_at} onChange={(v) => set({ words_at: v })}
              options={[{ key: "top", name: "Top" }, { key: "bottom", name: "Bottom" }]} /></div>
          </div>
          <div className="mt-2 text-[12px] text-takal-ink-soft">Empty boxes keep the app&apos;s own words (already in Urdu). The name always stays on one line - a long name gets a little smaller, never cut.</div>
        </Section>
        <Section title="🔣 Symbol" note="a small round pin beside the name" open={open.symbol} onToggle={() => setOpen({ ...open, symbol: !open.symbol })} testid="symbol">
          <div className="flex flex-wrap gap-2">
            {SYMBOLS.map((s) => (
              <button key={s.key} type="button" onClick={() => set({ symbol: s.key, pin_place: s.key === "none" ? "none" : (card.pin_place === "none" ? "tl" : card.pin_place) })}
                className={`h-[34px] min-w-[44px] rounded-[10px] border-[1.5px] px-2 text-[14px] ${card.symbol === s.key ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line"}`}>{s.icon}</button>
            ))}
          </div>
          {card.symbol !== "none" && (
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <ColourBox label="Pin colour" value={card.pin_color} onChange={(v) => set({ pin_color: v || "#FFFFFF" })} />
              <div><Label>Pin place</Label><Choices value={card.pin_place} onChange={(v) => set({ pin_place: v })}
                options={[{ key: "tl", name: "Before the name" }, { key: "tr", name: "After the name" }, { key: "none", name: "Hidden" }]} /></div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
