"use client";

// Small form pieces used all over Marketing -> App Home (Mock 244): a yellow
// switch, a row of choices, a colour box, a slider, a pair of English/Urdu
// boxes. Text never smaller than 12 px (Mock 240 look rules).

import { useState } from "react";
import { contrast, isHex, MIN_CONTRAST } from "@/lib/app-home";
import { urduFont } from "../../stores/catalogue/urdu-font";

export function Switch({ on, onChange, label, disabled }: {
  on: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 text-[13px] text-takal-ink disabled:opacity-50">
      <span className={`relative inline-block h-[20px] w-9 shrink-0 rounded-full transition ${on
        ? "bg-takal-yellow ring-[1.5px] ring-inset ring-takal-ink"
        : "bg-[#D9D9D9] ring-[1.5px] ring-inset ring-[#9A9A9A]"}`}>
        <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full transition-all ${on ? "right-[3px] bg-takal-ink" : "left-[3px] bg-white"}`} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1.5 text-[12px] font-bold uppercase tracking-wide text-takal-ink-soft">{children}</div>;
}

export function Choices<T extends string>({ value, options, onChange, testid }: {
  value: T; options: { key: T; name: string; note?: string }[]; onChange: (v: T) => void; testid?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-choices={testid}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={on}
            data-choice={o.key}
            className={`flex h-[30px] items-center gap-2 rounded-[10px] border-[1.5px] px-3 text-[13px] font-semibold ${on
              ? "border-takal-ink bg-takal-yellow-soft shadow-[inset_0_0_0_1px_#000]" : "border-takal-line bg-white"}`}>
            <span className={`h-[14px] w-[14px] shrink-0 rounded-full ${on ? "border-[5px] border-takal-ink" : "border-[1.5px] border-[#888]"}`} />
            {o.name}
            {o.note && <span className="text-[12px] font-normal text-takal-ink-soft">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A colour: a picker, the hex, and - when given a background - whether
 *  words in this colour can be read on it. */
export function ColourBox({ label, value, onChange, on, allowNone }: {
  label: string; value: string | null; onChange: (v: string | null) => void;
  on?: string[]; allowNone?: boolean;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? (value || "");
  const worst = value && on && on.length ? Math.min(...on.map((b) => contrast(value, b))) : null;
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={value || "#FFFFFF"}
          onChange={(e) => { setTyped(null); onChange(e.target.value.toUpperCase()); }}
          className="h-[32px] w-[38px] cursor-pointer rounded-md border border-takal-line bg-white p-0.5" />
        <input value={shown} placeholder={allowNone ? "none" : "#000000"} maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setTyped(v);
            if (isHex(v)) onChange(v.toUpperCase());
            if (!v && allowNone) onChange(null);
          }}
          onBlur={() => setTyped(null)}
          className="h-[32px] w-[110px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px] font-mono" />
        {allowNone && value && (
          <button type="button" onClick={() => onChange(null)} className="text-[12px] font-semibold underline text-takal-ink-soft">none</button>
        )}
      </div>
      {worst != null && (
        worst >= MIN_CONTRAST
          ? <div className="mt-1 text-[12px] font-semibold text-takal-green" data-readable="yes">✓ Easy to read ({worst})</div>
          : <div className="mt-1 text-[12px] font-bold text-takal-red" data-readable="no">✗ Hard to read ({worst}) - Publish stays off</div>
      )}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, words }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; words: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3 text-[12px] text-takal-ink-soft">
        <span>Small</span>
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-black" />
        <span>Large</span>
        <b className="min-w-[90px] text-[13px] text-takal-ink">{words}</b>
      </div>
    </div>
  );
}

/** English and Urdu side by side. The Urdu box is right-to-left, in the
 *  round school-book letters (Noto Naskh), and goes red when English is
 *  written without it - the server refuses that at Publish. */
export function WordsPair({ label, en, ur, onEn, onUr, max, placeholder, placeholderUr }: {
  label: string; en: string; ur: string; onEn: (v: string) => void; onUr: (v: string) => void;
  max: number; placeholder?: string; placeholderUr?: string;
}) {
  const missing = en.trim() !== "" && ur.trim() === "";
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      <div>
        <Label>{label} - English</Label>
        <input value={en} maxLength={max} placeholder={placeholder || "Keep the app's own words"}
          onChange={(e) => onEn(e.target.value)}
          className="h-[34px] w-full rounded-lg border-[1.5px] border-takal-line px-2.5 text-[13px]" />
      </div>
      <div>
        <Label>{label} - Urdu</Label>
        <input value={ur} maxLength={max * 2} dir="rtl" lang="ur" placeholder={placeholderUr}
          onChange={(e) => onUr(e.target.value)}
          className={`${urduFont.className} h-[34px] w-full rounded-lg border-[1.5px] px-2.5 text-[15px] ${missing ? "border-takal-red bg-takal-red-soft" : "border-takal-line"}`} />
        {missing && <div className="mt-1 text-[12px] font-bold text-takal-red">Write the Urdu too - it is needed to publish</div>}
      </div>
    </div>
  );
}

export function Section({ title, note, open, onToggle, children, testid }: {
  title: string; note?: string; open: boolean; onToggle: () => void; children: React.ReactNode; testid?: string;
}) {
  return (
    <div className={`mb-2.5 rounded-xl border bg-white ${open ? "border-takal-ink shadow-[inset_0_0_0_1px_#000]" : "border-takal-line"}`} data-section={testid}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] font-extrabold">
        <span>{open ? "▾" : "▸"}</span>{title}
        {note && <span className="text-[12.5px] font-normal text-takal-ink-soft">{note}</span>}
      </button>
      {open && <div className="border-t border-[#F0F0F0] px-3.5 pb-3.5">{children}</div>}
    </div>
  );
}
