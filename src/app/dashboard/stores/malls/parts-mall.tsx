"use client";

// A mall's logo, the same everywhere in the panel (Mock 172-6).
import { Store } from "lucide-react";

export function MallLogo({ url, size = 40 }: { url: string | null | undefined; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-takal-yellow-soft text-xl"
      style={{ width: size, height: size }}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <Store className="h-5 w-5 text-takal-ink-soft" />}
    </span>
  );
}
