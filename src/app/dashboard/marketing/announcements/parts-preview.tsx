"use client";

/**
 * THE PREVIEW — and why it is the most important part of this screen.
 *
 * The strip this replaces had a preview too. It drew the bar in TAKAL YELLOW
 * while the customer app drew it BLACK, and it had been wrong since the day it
 * was written. Nobody noticed, because the only way to notice was to hold a
 * phone next to the screen.
 *
 * So this preview is not decoration. It is the check. It draws the announcement
 * with the same colour, the same ink, the same size, the same shape and the same
 * motion the Flutter widget will use, inside a small drawing of the real home
 * screen — the yellow header, the search bar, and the announcement below it,
 * where it actually sits.
 *
 * `announcements.test.ts` pins the values used here to the ones the server
 * sends, so the two cannot drift apart again quietly.
 */

import { useEffect, useRef, useState } from "react";
import {
  SECOND_LINE_PX, SIZES, WEIGHTS,
  announcementBackground, announcementInk, previewText,
} from "@/lib/announcements";

type Draft = Record<string, any>;

/** The px the app will use. Not "about right" — the same three numbers. */
function sizePx(size: string): number {
  return SIZES.find((s) => s.value === size)?.px ?? 12.5;
}
/** One step down the same scale, exactly as the widget does it. */
function secondLinePx(size: string): number {
  return SECOND_LINE_PX[size] ?? 11.5;
}
function weightCss(weight: string): number {
  return WEIGHTS.find((w) => w.value === weight)?.css ?? 700;
}

/** Poppins is the app's own font; Nastaliq is the one bundled for Urdu.
 *  The panel cannot carry the real Nastaliq file, so it asks for the closest
 *  thing the operator's computer has and SAYS SO underneath, rather than
 *  drawing Latin letters and pretending. */
function fontStack(font: string): string {
  if (font === "nastaliq") return "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif";
  if (font === "roboto") return "Roboto, system-ui, sans-serif";
  return "var(--font-roboto), Poppins, system-ui, sans-serif";
}

export function AnnouncementPreview({ draft }: { draft: Draft }) {
  const ink = announcementInk(draft);
  const background = announcementBackground(draft);
  const isGradient = background.startsWith("linear-gradient");

  const shape = draft.shape || "card";
  const align = draft.align || "left";
  const entrance = draft.entrance || "wave";
  const motion = draft.colour_motion || "settle";

  // `play` counts up every time the operator presses Replay or changes a
  // setting that affects motion, so the animation restarts instead of sitting
  // finished — the whole point of a preview is watching it arrive.
  const [play, setPlay] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPlay((n) => n + 1);
  }, [entrance, motion, shape, draft.bg_gradient, draft.bg_color, draft.settle_secs]);

  const settle = Math.max(0, Number(draft.settle_secs ?? 6));

  const radius = shape === "pill" ? 999 : shape === "strip" ? 0 : 16;
  const inset = shape === "strip" ? 0 : 12;

  return (
    <div>
      <div className="rounded-2xl border border-takal-line bg-[#EDEFF2] overflow-hidden">
        {/* the yellow header, drawn small — so the announcement is judged
            against the colour it will really sit under */}
        <div className="bg-takal-yellow px-3 pt-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-white border border-black/10 grid place-items-center text-[7px] font-black">
              TAKAL
            </span>
            <span className="flex-1">
              <span className="block text-[7px] font-bold tracking-wider text-takal-ink">DELIVER TO</span>
              <span className="block text-[11px] font-bold text-takal-ink">R8GR+5X5 ⌄</span>
            </span>
            <span className="w-5 h-5 rounded-full bg-black/10" />
            <span className="w-5 h-5 rounded-full bg-black" />
          </div>
          <div className="relative top-3 mx-1 rounded-xl bg-white h-9 flex items-center px-3
                          text-[11px] text-takal-disabled-text shadow-[0_3px_9px_rgba(0,0,0,.13)]">
            Search stores or products
          </div>
        </div>

        {/* THE ANNOUNCEMENT — below the search bar, where Sana asked for it.
            TWO ELEMENTS: the wrapper carries the entrance, the card inside it
            carries the colour drift. One element cannot carry both, because CSS
            has a single animation-name and the second rule silently wins. */}
        <div className="pt-6 pb-3" style={{ paddingLeft: inset, paddingRight: inset }}>
          <div key={play} className={`anim-${entrance}`}>
          <div
            className={[
              "flex items-center gap-2.5 overflow-hidden relative",
              isGradient && motion === "always" ? "drift-always"
                : isGradient && motion === "settle" ? "drift-settle" : "",
            ].join(" ")}
            style={{
              background,
              backgroundSize: isGradient ? "300% 100%" : undefined,
              color: ink,
              borderRadius: radius,
              padding: shape === "pill" ? "8px 14px" : "10px 11px",
              boxShadow: shape === "strip" ? "none" : "0 6px 17px rgba(0,0,0,.17)",
              justifyContent: align === "center" ? "center" : "flex-start",
              // "Move, then settle" stops dead at the number of seconds she set.
              animationDuration: motion === "settle" ? `${settle}s` : undefined,
            }}
          >
            {draft.icon ? (
              <span
                className="grid place-items-center shrink-0"
                style={{
                  width: 32, height: 32, borderRadius: 10, fontSize: 15,
                  background: ink === "#000000" ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.18)",
                }}
              >
                {draft.icon}
              </span>
            ) : null}

            <span className={align === "center" ? "min-w-0" : "flex-1 min-w-0"}>
              <span
                className={entrance === "ticker" ? "block whitespace-nowrap roll-words" : "block"}
                style={{
                  fontFamily: fontStack(draft.font || "poppins"),
                  fontSize: sizePx(draft.text_size || "normal"),
                  fontWeight: weightCss(draft.text_weight || "bold"),
                  lineHeight: 1.25,
                  letterSpacing: draft.uppercase ? ".04em" : undefined,
                  textAlign: align === "center" ? "center" : "left",
                }}
              >
                {previewText(draft.message || "Your message goes here", draft.uppercase)
                  || "Your message goes here"}
              </span>
              {draft.message_2 ? (
                <span
                  className="block"
                  style={{
                    fontFamily: fontStack(draft.font || "poppins"),
                    fontSize: secondLinePx(draft.text_size || "normal"),
                    opacity: 0.85, marginTop: 2, lineHeight: 1.3,
                    textAlign: align === "center" ? "center" : "left",
                  }}
                >
                  {previewText(draft.message_2, draft.uppercase)}
                </span>
              ) : null}
            </span>

            {draft.action_type && draft.action_type !== "none" ? (
              <span
                className="shrink-0 text-[9.5px] font-bold rounded-full px-2.5 py-1"
                style={{ background: ink === "#000000" ? "rgba(0,0,0,.13)" : "rgba(255,255,255,.22)" }}
              >
                Open
              </span>
            ) : null}

            {draft.dismissible ? (
              <span className="shrink-0 text-[12px] opacity-60">✕</span>
            ) : null}

            {/* The wave: one band of light, once. Drawn here so the operator can
                see exactly the motion the phone will make. */}
            {entrance === "wave" ? <span className="anim-shine" /> : null}
          </div>
          </div>
        </div>

        {/* a hint of the page below, so the card is seen sitting ON something */}
        <div className="flex gap-3 px-3 pb-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i}
              className={`w-8 h-8 rounded-full ${i === 0 ? "bg-white border-2 border-black" : "bg-[#DCE0E5]"}`} />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-takal-ink-soft">
          This is what the phone draws — the same colours, sizes and movement.
          {draft.font === "nastaliq" ? (
            <> The real Nastaliq letters are inside the app; this preview uses the
            closest font your computer has.</>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setPlay((n) => n + 1)}
          className="shrink-0 rounded-lg border border-takal-line px-3 py-1.5 text-xs font-semibold
                     text-takal-ink hover:bg-takal-page"
        >
          Play it again
        </button>
      </div>
    </div>
  );
}
