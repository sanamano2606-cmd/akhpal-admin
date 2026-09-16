"use client";

/**
 * BANNER PICTURE — the banner's own picture, or live product pictures.
 *
 * Mock 79-C, approved by Sana on 16 September 2026. Two choices, each a whole
 * card you can click:
 *
 *   My own picture         the upload that was here before, unchanged
 *   Live product pictures  three real product pictures that change by
 *                          themselves, picked from what the banner opens
 *
 * The upload stays reachable in BOTH cases. With live pictures chosen, the
 * uploaded picture is what customers see whenever there is nothing live to
 * show (a section with no products yet), so it must still be settable here.
 *
 * The orange note is said in words, with what the customer will see instead,
 * because "not enough pictures" on its own reads like the banner is broken.
 */

import { PICTURE_MODES, type PictureMode, liveShortage } from "@/lib/marketing";

export type LivePreview = {
  loading: boolean;
  failed: boolean;
  pictures: string[];
  needed: number;
};

export function BannerPicture({
  mode,
  onMode,
  imageUrl,
  uploading,
  onUpload,
  onClearImage,
  onTypeImage,
  source,
  preview,
}: {
  mode: PictureMode;
  onMode: (m: PictureMode) => void;
  imageUrl: string;
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onClearImage: () => void;
  onTypeImage: (url: string) => void;
  source: string;
  preview: LivePreview;
}) {
  const shortage =
    mode === "live" && !preview.loading && !preview.failed
      ? liveShortage(source, preview.pictures.length, preview.needed)
      : null;

  const card = (value: PictureMode) =>
    `flex gap-3 rounded-xl border-2 p-3 transition-colors ${
      mode === value
        ? "border-takal-ink bg-takal-yellow-soft"
        : "cursor-pointer border-takal-line bg-white hover:border-takal-ink-soft hover:bg-takal-page"
    }`;

  const own = PICTURE_MODES[0];
  const live = PICTURE_MODES[1];

  return (
    <div className="rounded-lg border border-takal-line bg-takal-page p-3">
      <p className="mb-2 text-sm font-bold text-takal-ink">Banner picture</p>

      {/* ── My own picture ─────────────────────────────────────────────── */}
      <label className={card("own")}>
        <input
          type="radio"
          name="picture_mode"
          value="own"
          checked={mode === "own"}
          onChange={() => onMode("own")}
          className="mt-1 h-4 w-4 shrink-0 accent-takal-ink"
        />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-takal-ink">{own.label}</span>
          <span className="block text-xs text-takal-ink-soft">{own.hint}</span>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="banner"
                  className="h-12 w-24 rounded border object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onClearImage();
                  }}
                  className="text-sm text-takal-red"
                >
                  Remove picture
                </button>
              </>
            ) : null}
            {/* A span, not a label: this whole card is already a label, and a
                label inside a label is not allowed. The hidden input still
                opens the file picker because it sits inside this span. */}
            <span
              className={`relative inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                uploading
                  ? "bg-takal-page text-takal-ink-soft"
                  : "bg-takal-yellow text-takal-ink hover:bg-takal-yellow-dark"
              }`}
            >
              {uploading ? "Uploading…" : "＋ Upload"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => {
                  onUpload(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </span>
          </div>
          {!imageUrl && (
            <input
              placeholder="…or paste a picture address"
              value={imageUrl}
              onChange={(e) => onTypeImage(e.target.value)}
              className="mt-2 w-full rounded-lg border border-takal-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-takal-yellow"
            />
          )}
        </div>
      </label>

      {/* ── Live product pictures ──────────────────────────────────────── */}
      <label className={`mt-2 ${card("live")}`}>
        <input
          type="radio"
          name="picture_mode"
          value="live"
          checked={mode === "live"}
          onChange={() => onMode("live")}
          className="mt-1 h-4 w-4 shrink-0 accent-takal-ink"
        />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-takal-ink">
            {live.label}
            <span className="rounded-md bg-takal-yellow px-2 py-0.5 text-[10px] font-extrabold">
              NEW
            </span>
          </span>
          <span className="block text-xs text-takal-ink-soft">{live.hint}</span>
          <span className="mt-1.5 inline-block rounded-md bg-takal-yellow px-2 py-0.5 text-[11px] font-bold text-takal-ink">
            Pictures come from: {source} – what this banner opens
          </span>
          <span className="mt-1.5 block text-xs text-takal-ink-soft">
            Your own picture is still kept, and used whenever there is nothing
            live to show.
          </span>

          {mode === "live" && preview.loading && (
            <span className="mt-2 block text-xs text-takal-ink-soft">
              Looking for pictures…
            </span>
          )}
          {mode === "live" && preview.failed && (
            <span className="mt-2 block rounded border-l-4 border-takal-line bg-white px-3 py-2 text-xs text-takal-ink-soft">
              The pictures could not be checked just now. You can still save;
              the app picks them itself.
            </span>
          )}
          {shortage && (
            <span className="mt-2 block rounded border-l-4 border-takal-orange bg-takal-orange-soft px-3 py-2 text-xs text-takal-ink">
              {shortage}
            </span>
          )}
        </div>
      </label>
    </div>
  );
}
