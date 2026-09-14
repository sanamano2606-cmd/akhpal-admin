"use client";

/**
 * THE COLOUR OF THE BAR ACROSS THE TOP OF THE WEBSITE.
 *
 * Asked for by Sana on 14 September 2026: "Make The Top Bar Yellow #FFFF00,
 * where the Takal and get the app written. And Make It Changeable from Admin
 * Panel."
 *
 * WHY THERE IS NO SECOND BOX FOR THE WRITING COLOUR. Only the bar colour is
 * chosen here. The writing, the hairline, the logo mark and the "Get the app"
 * button are all worked out from it. Two boxes would be one careless afternoon
 * away from yellow writing on a yellow bar, on the front page of the company.
 * With one box that cannot happen, whatever colour is picked.
 *
 * WHY THE PREVIEW IS A REAL BAR AND NOT A COLOURED SQUARE. A square tells you
 * the colour. It does not tell you whether the logo still stands out on it, or
 * whether the button disappears into it. Those are the two things that actually
 * go wrong, so the preview shows the real thing.
 */

import { barInk, expand, SUGGESTED_BAR_COLOURS } from "@/lib/bar-ink";

export function ColourPicker({
  value,
  logoUrl,
  onChange,
}: {
  value: string;
  logoUrl: string;
  onChange: (hex: string) => void;
}) {
  // An empty box means "use what the website ships with", which is Takal
  // yellow. The preview has to show that, not a white bar.
  const chosen = expand(value) ?? "#FFFF00";
  const ink = barInk(chosen);
  const typedButNotAColour = value.trim() !== "" && expand(value) === null;

  return (
    <div>
      <label className="block text-sm font-semibold text-takal-ink">
        The colour of the bar at the top
      </label>
      <p className="text-xs text-takal-ink-soft mt-1">
        The bar with the Takal logo and the <b>Get the app</b> button. The writing
        on it changes to black or white on its own, whichever is easier to read —
        there is nothing else to set.
      </p>

      {/* THE PREVIEW — the real bar, at the real height */}
      <div
        className="mt-3 rounded-lg overflow-hidden border border-gray-200"
        aria-label="How the top of the website will look"
      >
        <div
          className="flex items-center gap-3 px-4"
          style={{
            background: ink.background,
            borderBottom: `1px solid ${ink.line}`,
            height: 60,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-[30px] w-auto max-w-[110px] object-contain" />
          ) : (
            <span
              className="grid place-items-center rounded-[10px] text-[14px] font-extrabold"
              style={{ width: 30, height: 30, background: ink.buttonBackground, color: ink.buttonText }}
            >
              T
            </span>
          )}
          <span className="text-[17px] font-extrabold tracking-tight" style={{ color: ink.text }}>
            Takal
          </span>
          <span className="hidden sm:inline text-[12px] font-semibold" style={{ color: ink.muted }}>
            What you can order
          </span>
          <span className="flex-1" />
          <span
            className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
            style={{ background: ink.buttonBackground, color: ink.buttonText }}
          >
            Get the app
          </span>
        </div>
        {/* A strip of the dark area underneath, so the join can be judged too */}
        <div style={{ background: "#0B0C0E", height: 26 }} />
      </div>

      {/* THE ONE-CLICK CHOICES */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_BAR_COLOURS.map((c) => {
          const picked = expand(value) === c.hex || (value.trim() === "" && c.hex === "#FFFF00");
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                picked ? "border-takal-ink ring-2 ring-takal-yellow" : "border-gray-300"
              }`}
            >
              <span
                className="w-4 h-4 rounded border border-gray-300"
                style={{ background: c.hex }}
              />
              {c.name}
            </button>
          );
        })}
      </div>

      {/* ANY OTHER COLOUR */}
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={chosen}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-14 rounded border border-gray-300 bg-white p-1"
          aria-label="Pick any other colour"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFFF00"
          maxLength={7}
          spellCheck={false}
          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          aria-label="The colour written out"
        />
        {value.trim() !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-semibold text-takal-ink-soft underline"
          >
            Back to Takal yellow
          </button>
        )}
      </div>

      {typedButNotAColour && (
        <p className="text-xs text-red-600 mt-2">
          <b>{value.trim()}</b> is not a colour. Write it as # and six letters or
          numbers, like <b>#FFFF00</b>. Saving will be refused until this is fixed.
        </p>
      )}
    </div>
  );
}
