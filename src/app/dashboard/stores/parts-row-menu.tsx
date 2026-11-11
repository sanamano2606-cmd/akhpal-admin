"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 238 (Sana 11 Nov 2026: "Approved"): ONE BUTTON + ⋯ ON EACH SHOP ROW.
//
// Review stays on the row. WhatsApp, Reject and Suspend move into this menu -
// Suspend and Reject in red at the bottom, and each still opens its own "Are
// you sure?" window, exactly as before. Nothing was taken away: the same
// buttons, one tap further.
//
// The table scrolls sideways, which would cut a normal drop-down off, so the
// menu is placed on the SCREEN (position: fixed) from the ⋯ button, opens
// upward when there is no room below (the Fix 3 lesson: every menu fits), and
// closes on Esc, a click outside, scrolling or resizing.
//
// DRAWN ON THE PAGE ITSELF (a portal into <body>), 11 Nov 2026: inside the
// table the menu was cut off at the table's edge and the next row's Review
// button was drawn over it - seen in the real-browser check, "WhatsApp" read
// "Whats" and "Suspend" read "Suspen". Outside the table nothing covers it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuSpot } from "@/lib/row-menu-spot";

export type RowMenuItem = {
  key: string;
  label: React.ReactNode;
  /** A link (WhatsApp) or an action (Reject, Suspend). */
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  /** Extra attributes, e.g. { "data-live-wa": "" } - kept for the tests. */
  data?: Record<string, string>;
};

export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !box.current) return;
    const b = btn.current.getBoundingClientRect();
    const m = box.current.getBoundingClientRect();
    const s = menuSpot(b, { width: m.width, height: m.height }, { width: window.innerWidth, height: window.innerHeight });
    setSpot({ top: s.top, left: s.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: MouseEvent) => {
      if (box.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!items.length) return null;
  const itemClass = (it: RowMenuItem) =>
    `flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm ${
      it.disabled ? "cursor-not-allowed text-[#B5B5B5]"
        : it.danger ? "font-bold text-takal-red hover:bg-takal-red-soft"
        : "text-takal-ink hover:bg-takal-yellow-soft"}`;
  const safe = items.filter((i) => !i.danger);
  const risky = items.filter((i) => i.danger);

  return (
    <>
      <button ref={btn} type="button" data-row-menu aria-haspopup="menu" aria-expanded={open}
        aria-label={`More for ${label}`} title="More"
        onClick={() => { setSpot(null); setOpen((o) => !o); }}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border-[1.5px] text-base font-black leading-none ${
          open ? "border-black bg-takal-yellow-soft" : "border-[#CFCFC8] bg-white hover:border-black hover:bg-takal-yellow-soft"}`}>
        ⋯
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={box} role="menu" aria-label={`More for ${label}`}
          style={{ position: "fixed", top: spot?.top ?? -9999, left: spot?.left ?? -9999 }}
          className="z-[60] min-w-[220px] rounded-xl border-[1.5px] border-black bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          {[safe, risky].map((group, gi) => group.length > 0 && (
            <div key={gi} className={gi === 1 && safe.length ? "mt-1 border-t border-takal-line pt-1" : ""}>
              {group.map((it) => it.href && !it.disabled ? (
                <a key={it.key} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer"
                  title={it.title} {...(it.data || {})}
                  onClick={() => { it.onClick?.(); setOpen(false); }} className={itemClass(it)}>
                  {it.label}
                </a>
              ) : (
                <button key={it.key} role="menuitem" type="button" disabled={it.disabled}
                  title={it.title} {...(it.data || {})}
                  onClick={() => { if (it.disabled) return; setOpen(false); it.onClick?.(); }}
                  className={itemClass(it)}>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
