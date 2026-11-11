"use client";

// MOCK 240 (Sana 11 Nov 2026): the ONE mark for a department, on every page -
// its emoji on a soft square of its own colour (lib/shelves.ts).
import { deptColour, deptEmoji } from "@/lib/shelves";

export function DeptMark({ slug, size = 32 }: { slug?: string | null; size?: number }) {
  const [, bright] = deptColour(slug);
  return (
    <span aria-hidden data-dept-mark={slug || ""}
      className="inline-grid flex-none place-items-center rounded-[10px]"
      style={{ width: size, height: size, background: `${bright}38`, fontSize: Math.round(size * 0.55) }}>
      {deptEmoji(slug)}
    </span>
  );
}
