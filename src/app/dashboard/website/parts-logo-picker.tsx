"use client";

/**
 * THE TAKAL LOGO, picked from this computer.
 *
 * Asked for by Sana on 14 September 2026: "I want The TAKAL LOGO TOO And Must
 * Be Changeable from admin panel."
 *
 * It uses the SAME upload the Home Banners and Welcome Screens pages use, so
 * there is one size limit and one set of messages, not a third copy that drifts
 * away from the other two.
 *
 * WHY THE PREVIEW HAS TWO BACKGROUNDS. The logo appears at the top of the
 * website on white, and at the bottom on near-black. A logo with a white edge
 * looks fine on one and shows a pale halo on the other, and there is no way to
 * see that until you look at both. So both are shown, side by side, before it
 * is saved.
 */

import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { MAX_PICTURE_MB } from "@/lib/picture-upload";

export function LogoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileBox = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload();

  const pick = async (file: File | null) => {
    const url = await upload(file);
    if (url) onChange(url);
    // Clear the box, so choosing the SAME file again still counts as a change.
    if (fileBox.current) fileBox.current.value = "";
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-takal-ink">The Takal logo</label>
      <p className="text-xs text-takal-ink-soft mt-1">
        Shown at the top and the bottom of takalapp.com. A PNG with a see-through
        background works best. Up to {MAX_PICTURE_MB} MB.
      </p>

      {value ? (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* On white, as the top of the website shows it */}
          <div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-center h-[76px] w-[170px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="max-h-[46px] max-w-full object-contain" />
            </div>
            <p className="text-[11px] text-takal-ink-soft mt-1.5 text-center">at the top</p>
          </div>

          {/* On near-black, as the bottom of the website shows it */}
          <div>
            <div className="rounded-lg border border-gray-800 p-3 flex items-center justify-center h-[76px] w-[170px]"
                 style={{ background: "#0B0C0E" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="max-h-[46px] max-w-full object-contain" />
            </div>
            <p className="text-[11px] text-takal-ink-soft mt-1.5 text-center">at the bottom</p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileBox.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              <ImagePlus className="w-4 h-4" />
              {uploading ? "Uploading…" : "Choose a different one"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => fileBox.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-5 py-4 text-sm font-semibold text-takal-ink-soft disabled:opacity-40"
          >
            <ImagePlus className="w-5 h-5" />
            {uploading ? "Uploading…" : "Choose the logo picture"}
          </button>
          {/* An empty box is not a fault, so it must not read like one. */}
          <p className="text-xs text-takal-ink-soft mt-2">
            No logo set. The website shows a yellow <b>T</b> mark until one is chosen.
          </p>
        </div>
      )}

      <input
        ref={fileBox}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
