"use client";

/**
 * SEE A PICTURE FULL SIZE (Mock 215-1, Sana 28 Oct 2026: "an approved Store
 * products picture also not viewable in full").
 *
 * Every picture in the Stores pages was shown as a small, cut square (object
 * cover) - the edges a vendor might have put a phone number on were cut off,
 * and nothing opened the whole picture. This window shows it WHOLE (object
 * contain), on a checkerboard so a see-through logo is seen as it is:
 *   * ‹ › and the arrow keys go through all the product's pictures;
 *   * the strip at the bottom jumps to one; Esc or a click outside closes;
 *   * "Open in a new tab" for the original file;
 *   * `boxes` draws RED BOXES round what was found on it - a phone number on
 *     a logo (Mock 215-2) - in the picture's own pixels, so they sit on the
 *     words at any size.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

export type FoundBox = { x0: number; y0: number; x1: number; y1: number; label?: string };

export function PictureViewer({
  pictures,
  start = 0,
  title,
  note,
  boxes,
  onClose,
}: {
  pictures: string[];
  start?: number;
  title?: string | null;
  /** A line under the title - e.g. "Phone number found: 0319 8543043". */
  note?: React.ReactNode;
  /** Red boxes per picture address (natural pixels). */
  boxes?: Record<string, FoundBox[]>;
  onClose: () => void;
}) {
  const list = pictures.filter(Boolean);
  const [i, setI] = useState(Math.min(Math.max(0, start), Math.max(0, list.length - 1)));
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = useCallback((d: number) => {
    setSize(null);
    setI((was) => (list.length ? (was + d + list.length) % list.length : 0));
  }, [list.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!list.length) return null;
  const url = list[i];
  const found = boxes?.[url] || [];

  return (
    <div data-picture-viewer role="dialog" aria-modal="true" aria-label={title || "Picture"}
      className="fixed inset-0 z-[70] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-2.5 text-white sm:px-6" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">{title || "Picture"}</b>
          <span className="text-[12px] text-[#CCC]">
            {list.length > 1 ? `Picture ${i + 1} of ${list.length} · ` : ""}
            {size ? `${size.w} × ${size.h} px` : "…"}
          </span>
          {note && <div className="mt-0.5 text-[12.5px] font-bold text-[#FF8A80]">{note}</div>}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-white/20">
          <ExternalLink className="h-4 w-4" /> Open in a new tab
        </a>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-takal-yellow text-black hover:brightness-95">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-2">
        {list.length > 1 && (
          <button type="button" aria-label="Previous picture" onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-takal-yellow">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="relative inline-block max-h-full max-w-full rounded-xl bg-[repeating-conic-gradient(#E9E9E4_0%_25%,#FFFFFF_0%_50%)] bg-[length:22px_22px]"
          onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-viewer-picture src={url} alt={title || ""}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="block max-h-[calc(100vh-170px)] max-w-[calc(100vw-120px)] rounded-xl object-contain" />
          {size && found.length > 0 && (
            <svg data-found-boxes viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full">
              {found.map((b, k) => (
                <g key={k}>
                  <rect x={b.x0 - 6} y={b.y0 - 6} width={b.x1 - b.x0 + 12} height={b.y1 - b.y0 + 12}
                    rx={6} fill="rgba(214,40,57,.14)" stroke="#D62839" strokeWidth={Math.max(3, size.w / 220)} />
                </g>
              ))}
            </svg>
          )}
        </div>
        {list.length > 1 && (
          <button type="button" aria-label="Next picture" onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-takal-yellow">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {list.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {list.map((u, k) => (
            <button key={`${u}-${k}`} type="button" onClick={() => { setSize(null); setI(k); }}
              aria-label={`Picture ${k + 1}`} aria-current={k === i}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white ${k === i ? "ring-[3px] ring-takal-yellow" : "opacity-70 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
