"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A CATEGORY YOU CAN SEARCH.  (Mock 134, approved 1 October 2026 - audit SM14.)
//
// Replaces one long drop-down list. Type a word or two ("wash"), see only what
// matches, with the words marked; ↑ ↓ to move, Enter to choose, Esc to close.
// The ✕ goes back to "No category" (or "All categories" on the Products tab).
// The matching rule lives in lib/category-search.ts, where it is tested.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { filterCategories, highlightParts, type CategoryOption } from "@/lib/category-search";

const SHOW_AT_MOST = 60;

export function CategoryPicker({
  options, value, onChange, emptyLabel, ariaLabel, className = "",
}: {
  options: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** What "nothing chosen" means here: "No category", "All categories". */
  emptyLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const chosen = options.find((o) => o.id === value);
  const found = useMemo(() => filterCategories(options, query), [options, query]);
  // With nothing typed, "No category" / "All categories" is the first line.
  const lines: CategoryOption[] = query.trim()
    ? found.slice(0, SHOW_AT_MOST)
    : [{ id: "", label: emptyLabel }, ...found.slice(0, SHOW_AT_MOST)];

  useEffect(() => { setCursor(0); }, [query, open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    input.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCursor((c) => Math.min(c + 1, lines.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (open && lines[cursor]) pick(lines[cursor].id); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm ${
        open ? "border-transparent ring-2 ring-takal-yellow" : "border-takal-line"}`}>
        <Search aria-hidden className="h-4 w-4 shrink-0 text-takal-ink-soft" />
        <input
          ref={input}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          value={open ? query : chosen?.label ?? ""}
          placeholder={open ? "Type to find a category…" : emptyLabel}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-takal-ink-soft"
        />
        {value && !open && (
          <button type="button" onClick={() => pick("")} aria-label={`Clear - ${emptyLabel}`} title={emptyLabel}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-takal-ink-soft hover:bg-slate-100">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div id={listId} role="listbox" aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-xl border-[1.5px] border-takal-line bg-white p-1.5 text-sm shadow-[0_12px_28px_rgba(0,0,0,.16)]">
          {query.trim() && found.length === 0 ? (
            <p className="px-2.5 py-2 text-takal-ink-soft">
              No category has “{query.trim()}”. Try another word — or choose <b>{emptyLabel}</b>.
            </p>
          ) : (
            lines.map((o, i) => (
              <button key={o.id || "__none"} type="button" role="option" aria-selected={o.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(o.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left ${
                  i === cursor ? "bg-takal-yellow font-bold text-takal-ink" : "text-takal-ink hover:bg-takal-page"}`}>
                <span>
                  {o.id === "" ? <i className="not-italic text-takal-ink-soft">{o.label}</i>
                    : highlightParts(o.label, query).map((p, k) =>
                        p.hit ? <mark key={k} className="rounded-sm bg-[#FFF59A] px-px text-inherit">{p.text}</mark>
                              : <span key={k}>{p.text}</span>)}
                </span>
                {i === cursor && <span aria-hidden className="text-xs">↵</span>}
              </button>
            ))
          )}
          {query.trim() && found.length > 0 && (
            <p className="px-2.5 pb-1 pt-1.5 text-xs text-takal-ink-soft">
              {found.length > SHOW_AT_MOST ? `First ${SHOW_AT_MOST} of ${found.length}` : `${found.length} found`}
              {" "}· ↑ ↓ to move, Enter to choose
            </p>
          )}
        </div>
      )}
    </div>
  );
}
