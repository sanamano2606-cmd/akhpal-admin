"use client";

/**
 * THE BANNER'S OWN COLOURS, SET BY HAND.
 *
 * Sana, 3 September 2026: "Make the colour of writing and bar editable from
 * Admin panel."
 *
 * Two colours and a tag shape. The bar colour is the important one — the
 * photograph fades into it, so it is what makes the card read as one tag
 * rather than as a picture with a strip stuck underneath.
 *
 * THE COLOUR IS SUGGESTED, NEVER IMPOSED. Uploading a picture reads its bottom
 * edge and fills the box in; every preset and the colour picker overwrite it.
 * Nothing is ever refused — three of her four photographs are warm food and
 * fabric, so reading the colour out of them gives three beiges, and the whole
 * point of the presets is that she can say no to that.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  BAR_PRESETS,
  TAG_STYLES,
  HEX,
  inkFor,
  barColourFromImage,
} from "@/lib/marketing";

export function BannerColours({
  imageUrl,
  barColor,
  textColor,
  tagStyle,
  onChange,
}: {
  imageUrl?: string;
  barColor?: string | null;
  textColor?: string | null;
  tagStyle?: string | null;
  onChange: (patch: {
    bar_color?: string | null;
    text_color?: string | null;
    tag_style?: string | null;
  }) => void;
}) {
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState("");

  const bar = barColor && HEX.test(barColor) ? barColor : "";
  const suggested = inkFor(bar || null);
  const style = tagStyle || "notch";

  const readFromPhoto = async () => {
    if (!imageUrl) return;
    setReading(true);
    setFailed("");
    const found = await barColourFromImage(imageUrl);
    setReading(false);
    if (found) onChange({ bar_color: found });
    // Null means the picture could not be read — a broken address, or a host
    // that will not allow it. It never means "here is a guess".
    else setFailed("That picture could not be read. Pick a colour below instead.");
  };

  return (
    <div className="space-y-4 rounded-lg border border-takal-line bg-takal-page p-3">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-takal-ink">Bar colour</p>
          <button
            type="button"
            onClick={readFromPhoto}
            disabled={!imageUrl || reading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-takal-line bg-white px-2.5 py-1.5 text-xs font-medium text-takal-ink hover:bg-takal-page disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {reading ? "Reading…" : "Take it from the picture"}
          </button>
        </div>

        <p className="mb-2.5 text-xs text-takal-ink-soft">
          The picture fades into this colour, so the card reads as one tag
          instead of a photo with a strip under it. Light colours work best —
          the writing on them is black.
        </p>

        <div className="flex flex-wrap gap-2">
          {BAR_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              onClick={() => onChange({ bar_color: p.hex })}
              className={`h-9 w-14 rounded-lg border-2 transition ${
                bar.toUpperCase() === p.hex ? "border-takal-ink" : "border-transparent"
              }`}
              style={{ background: p.hex, boxShadow: "inset 0 0 0 1px rgba(20,22,25,.10)" }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={bar || "#FFE566"}
            onChange={(e) => onChange({ bar_color: e.target.value.toUpperCase() })}
            className="h-9 w-12 rounded border"
            title="Any other colour"
          />
          <input
            value={bar}
            onChange={(e) => onChange({ bar_color: e.target.value.toUpperCase() })}
            placeholder="#FFE566"
            className="w-28 rounded-lg border border-takal-line px-2.5 py-2 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-takal-yellow"
          />
          {bar && (
            <button
              type="button"
              onClick={() => onChange({ bar_color: null, text_color: null })}
              className="text-xs text-takal-ink-soft underline"
            >
              Clear
            </button>
          )}
        </div>

        {failed && <p className="mt-2 text-xs text-[#C8410F]">{failed}</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-takal-ink">Writing colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* AUTOMATIC IS THE RIGHT ANSWER NEARLY ALWAYS, so it is first and it
              is what an empty box means. Black on a light bar, white on a dark
              one — which is the Brand Kit rule anyway. */}
          <button
            type="button"
            onClick={() => onChange({ text_color: null })}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              !textColor
                ? "border-takal-ink bg-white text-takal-ink"
                : "border-takal-line bg-white text-takal-ink-soft"
            }`}
          >
            Work it out ({suggested === "#000000" ? "black" : "white"})
          </button>
          <button
            type="button"
            onClick={() => onChange({ text_color: "#000000" })}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              textColor === "#000000" ? "border-takal-ink" : "border-takal-line"
            } bg-black text-white`}
          >
            Black
          </button>
          <button
            type="button"
            onClick={() => onChange({ text_color: "#FFFFFF" })}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              textColor === "#FFFFFF" ? "border-takal-ink" : "border-takal-line"
            } bg-white text-takal-ink`}
          >
            White
          </button>
          <input
            type="color"
            value={textColor && HEX.test(textColor) ? textColor : suggested}
            onChange={(e) => onChange({ text_color: e.target.value.toUpperCase() })}
            className="h-9 w-12 rounded border"
            title="Any other colour"
          />
        </div>
        <p className="mt-2 text-xs text-takal-ink-soft">
          Leave it on <b>Work it out</b> unless you have a reason. It picks
          whichever of black or white can actually be read on the bar.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-takal-ink">Tag shape</p>
        <div className="flex flex-wrap gap-2">
          {TAG_STYLES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ tag_style: t.value })}
              title={t.hint}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                style === t.value
                  ? "border-takal-ink bg-white text-takal-ink"
                  : "border-takal-line bg-white text-takal-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-takal-ink-soft">
          {TAG_STYLES.find((t) => t.value === style)?.hint}
        </p>
      </div>
    </div>
  );
}
