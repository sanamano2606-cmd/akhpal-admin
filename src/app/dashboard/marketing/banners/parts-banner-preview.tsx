"use client";

/**
 * SEEING THE BANNER THE WAY THE CUSTOMER SEES IT.
 *
 * Before this, the only way to find out how a banner looked was to save it and
 * open the app on a phone. So four banners went live on 14 July with two
 * colour pairs that barely fade — #1e00ff → #001eff is the same blue twice —
 * and nobody could have known without going to look.
 *
 * IT WARNS, IT NEVER REFUSES. The colours are Sana's choice and the Brand Kit
 * does not cover banner art. This says what a customer will see and gets out
 * of the way.
 */

import { readableInk, colourWarning } from "@/lib/marketing";

export function BannerPreview({
  title,
  subtitle,
  emoji,
  cta,
  color1,
  color2,
  imageUrl,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  cta?: string;
  color1: string;
  color2: string;
  imageUrl?: string;
}) {
  // Over a photograph the ink is always white with a shadow, the same as the
  // app does it — the photo's own colours are unknowable from here.
  const ink = imageUrl ? "#FFFFFF" : readableInk(color1);
  const warning = imageUrl ? "" : colourWarning(color1, color2);

  return (
    <div>
      {/* The phone. 236px wide is roughly a 360px screen at the size this
          card sits at, so what fits here is what fits there. */}
      <div className="mx-auto w-[236px] overflow-hidden rounded-[26px] border-[9px] border-takal-ink bg-white">
        <div className="h-4 bg-takal-ink" />
        <div className="p-2.5">
          <div
            className="flex h-[86px] flex-col justify-center rounded-[10px] px-3 py-2"
            style={
              imageUrl
                ? {
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: ink,
                    textShadow: "0 1px 3px rgba(0,0,0,.45)",
                  }
                : {
                    background: `linear-gradient(120deg, ${color1}, ${color2})`,
                    color: ink,
                  }
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-black leading-tight">
                  {title || "Title"}
                </div>
                {subtitle && (
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight opacity-95">
                    {subtitle}
                  </div>
                )}
              </div>
              {emoji && <div className="shrink-0 text-[26px] leading-none">{emoji}</div>}
            </div>
            {cta && (
              <div
                className="mt-2 inline-block self-start rounded-full px-2.5 py-[3px] text-[9px] font-black"
                style={{ background: ink, color: ink === "#000000" ? "#FFFFFF" : "#000000" }}
              >
                {cta}
              </div>
            )}
          </div>

          {/* The rest of the home screen, greyed, so the banner is judged in
              its place rather than on its own. */}
          <div className="mt-2 flex justify-center gap-1">
            <span className="h-[5px] w-[5px] rounded-full bg-takal-line" />
            <span className="h-[5px] w-[5px] rounded-full bg-takal-line" />
            <span className="h-[5px] w-3.5 rounded-full bg-takal-ink" />
          </div>
          <div className="mt-2 h-12 rounded-[10px] bg-takal-page" />
          <div className="mt-2 h-12 rounded-[10px] bg-takal-page" />
        </div>
      </div>

      {warning && (
        <p className="mt-3 rounded-lg border-l-4 border-takal-orange bg-takal-orange-soft px-3 py-2 text-xs text-[#C8410F]">
          {warning} You can save it anyway — this is only a warning.
        </p>
      )}
    </div>
  );
}
