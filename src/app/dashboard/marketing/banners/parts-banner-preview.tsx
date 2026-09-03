"use client";

/**
 * SEEING THE BANNER THE WAY THE CUSTOMER SEES IT.
 *
 * REBUILT 2026-09-03 as the tag card (mock-up 23, approved). A photograph on
 * top, a light coloured bar underneath, and the picture DISSOLVING into that
 * colour so there is no join to see.
 *
 * WHY THE FADE IS DONE HERE AND NOT LEFT TO THE APP.
 * It is not done "here" at all — both this preview and the phone paint the
 * same three things from the same three saved values: the colour, the fade,
 * and the tag shape. Nothing is worked out twice. That is the whole reason the
 * colours are columns on the banner rather than something either side guesses.
 *
 * Before this, the only way to find out how a banner looked was to save it and
 * open the app on a phone. Four banners went live on 14 July with two colour
 * pairs that barely faded and nobody could have known without going to look.
 *
 * IT WARNS, IT NEVER REFUSES. The colours are Sana's choice.
 */

import { inkFor, textWarning, HEX } from "@/lib/marketing";

export function BannerPreview({
  title,
  subtitle,
  cta,
  imageUrl,
  barColor,
  textColor,
  tagStyle,
  badge,
}: {
  title: string;
  subtitle?: string;
  cta?: string;
  imageUrl?: string;
  barColor?: string | null;
  textColor?: string | null;
  tagStyle?: string | null;
  badge?: string;
}) {
  const bar = barColor && HEX.test(barColor) ? barColor : null;
  const ink = textColor && HEX.test(textColor) ? textColor : inkFor(bar);
  const warning = textWarning(bar, textColor);
  const style = tagStyle || "notch";

  // The page colour behind the card. The notch and the cut corner are painted
  // in it, so they read as holes rather than as grey shapes.
  const PAGE = "#EDEFF2";

  return (
    <div>
      {/* The phone. 236px wide is roughly a 360px screen at the size this card
          sits at, so what fits here is what fits there. */}
      <div className="mx-auto w-[236px] overflow-hidden rounded-[26px] border-[9px] border-takal-ink bg-white">
        <div className="h-4 bg-takal-ink" />
        <div className="p-2.5" style={{ background: PAGE }}>
          <div
            className="relative overflow-hidden rounded-[13px]"
            style={{
              background: bar ?? "#DCE0E6",
              boxShadow: "0 4px 14px rgba(20,22,25,.12), 0 1px 2px rgba(20,22,25,.07)",
            }}
          >
            {/* The picture. */}
            <div className="relative h-[84px]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-takal-page text-[10px] text-takal-ink-soft">
                  no picture yet
                </div>
              )}

              {/* THE JOIN. The bottom of the picture fades into the bar colour,
                  so there is no line anywhere to find. Without this the card is
                  a photograph with a strip stuck underneath it. */}
              {bar && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[36px]"
                  style={{ background: `linear-gradient(to bottom, ${bar}00, ${bar})` }}
                />
              )}

              {badge && (
                <span
                  className="absolute left-2 top-2 rounded-[5px] bg-white px-1.5 py-[3px] text-[7px] font-black tracking-wide text-takal-ink"
                  style={{ boxShadow: "0 1px 3px rgba(20,22,25,.2)" }}
                >
                  {badge}
                </span>
              )}
            </div>

            {/* The bar. */}
            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
              <div className="min-w-0">
                <div
                  className="truncate text-[11px] font-black leading-tight"
                  style={{ color: ink }}
                >
                  {title || "Title"}
                </div>
                {subtitle && (
                  <div
                    className="truncate text-[8px] leading-tight"
                    style={{ color: ink, opacity: 0.62 }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[7.5px] font-black"
                style={{ background: ink, color: bar ?? "#FFFFFF" }}
              >
                {cta || "Order Now"}
              </span>
            </div>

            {/* The tag shape. Painted in the page colour so it reads as a hole
                cut out of the card, not as a shape sitting on it. */}
            {style === "notch" && (
              <>
                <span
                  className="absolute left-[-6px] top-[78px] h-3 w-3 rounded-full"
                  style={{ background: PAGE }}
                />
                <span
                  className="absolute right-[-6px] top-[78px] h-3 w-3 rounded-full"
                  style={{ background: PAGE }}
                />
              </>
            )}
            {style === "swing" && (
              <>
                <span
                  className="absolute right-0 top-0 h-6 w-6"
                  style={{
                    background: `linear-gradient(225deg, ${PAGE} 50%, transparent 50.5%)`,
                  }}
                />
                <span
                  className="absolute right-[9px] top-[9px] h-[8px] w-[8px] rounded-full"
                  style={{ background: PAGE, boxShadow: "0 0 0 1.5px rgba(255,255,255,.6)" }}
                />
              </>
            )}
          </div>

          <div className="mt-2 flex justify-center gap-1">
            <span className="h-[5px] w-3.5 rounded-full bg-takal-ink" />
            <span className="h-[5px] w-[5px] rounded-full bg-takal-line" />
            <span className="h-[5px] w-[5px] rounded-full bg-takal-line" />
          </div>
          <div className="mt-2 h-10 rounded-[9px] bg-white" />
        </div>
      </div>

      {!bar && (
        <p className="mt-3 rounded-lg border-l-4 border-takal-line bg-takal-page px-3 py-2 text-xs text-takal-ink-soft">
          No bar colour set, so this banner is still drawn the old way in the
          app — words on top of the picture. Pick a colour to turn it into a tag.
        </p>
      )}

      {warning && (
        <p className="mt-3 rounded-lg border-l-4 border-takal-orange bg-takal-orange-soft px-3 py-2 text-xs text-[#C8410F]">
          {warning} You can save it anyway — this is only a warning.
        </p>
      )}
    </div>
  );
}
