"use client";

/**
 * A shop's logo in a Stores list row - 30 x 30, the box the row already has
 * (Sana, 28 Oct 2026). Uploaded: the logo; click it to see it full size.
 * Not uploaded: the type sign in a DASHED RED box, "No logo yet" on hover -
 * so who has and who has not is seen down the list at a glance.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { logoThumb } from "@/lib/shop-logo";

export function ShopLogo({
  url,
  name,
  sign,
}: {
  url?: string | null;
  name?: string | null;
  /** The type sign shown when there is no logo. */
  sign: string;
}) {
  const [open, setOpen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const full = (url || "").trim();

  if (!full) {
    return (
      <span data-no-logo title="No logo yet"
        className="relative h-[30px] w-[30px] shrink-0 rounded-lg border-[1.5px] border-dashed border-[#D62839] bg-[#FFF5F5] text-center text-sm leading-[27px] opacity-90">
        <span className="opacity-60">{sign}</span>
        <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#D62839]" />
        <span className="sr-only">No logo yet</span>
      </span>
    );
  }

  // The small copy first; a picture from before the small copies (or one
  // that has none) falls back to the full one.
  const thumb = thumbFailed ? full : logoThumb(full);
  return (
    <>
      <button type="button" data-logo onClick={() => setOpen(true)}
        title="Shop logo - click to see it full size"
        aria-label={`See the logo of ${name || "this shop"} full size`}
        className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-lg border border-takal-line bg-white p-0 transition hover:ring-2 hover:ring-takal-yellow focus-visible:ring-2 focus-visible:ring-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover"
          onError={() => { if (!thumbFailed) setThumbFailed(true); }} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg"
        title={name || "Shop logo"} hint="The logo exactly as the shop uploaded it.">
        <div data-logo-full className="flex flex-col items-center gap-3">
          <div className="flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-xl border border-takal-line bg-[repeating-conic-gradient(#F2F2EE_0%_25%,#FFFFFF_0%_50%)] bg-[length:20px_20px] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={full} alt={`Logo of ${name || "the shop"}`} className="max-h-[66vh] max-w-full object-contain" />
          </div>
          <a href={full} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-takal-ink underline hover:no-underline">
            Open the picture in a new tab
          </a>
        </div>
      </Modal>
    </>
  );
}
