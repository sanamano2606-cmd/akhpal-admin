"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ONE SIMPLE SHELF CHOOSER - used by every category box in the panel.
// (Mock 210-1 / 210-2, approved by Sana 27 October 2026.)
//
// Replaces Mock 134's drop-down, whose lines began with the long path
// ("Health & Pharmacy › Medicines › Ast…") so the shelf itself was cut off,
// in one list of 315 lines. Now:
//   * the CLOSED box shows the shelf name first, big, and where it sits on a
//     small second line - never cut, it wraps in a narrow box;
//   * pressing it opens a WINDOW: Department → Group → Shelf in three short
//     columns (two on a tablet, one step at a time on a phone);
//   * or type any word - a shelf, a group or a department (Sana: "Searching
//     name of a shelf category or department is a good idea").
//   * "Takal suggests" and "Used lately" are one press each.
//
// The props are the same as before, so no screen had to change what it
// sends. The column rules live in lib/shelf-chooser.ts, where they are tested;
// the matching rule is still lib/category-search.ts.
// (Old version: DELETE-AFTER-TESTING/claude-mock210-2026-10-27/deprecated-CategoryPicker.tsx)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { filterCategories, highlightParts, shortLabel, wordsOf, type CategoryOption } from "@/lib/category-search";
import { deptColour } from "@/lib/shelves";
import {
  boxWords, buildDepartments, placeOf, rankFound, readRecent, rememberRecent, slugOf,
  type ChooserOption, type Department,
} from "@/lib/shelf-chooser";

// Every match is shown; a few hundred cards are nothing for the browser.
const SHOW_AT_MOST = 400;

type Step = "dept" | "group" | "shelf";

const storage = () => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

export function CategoryPicker({
  options, value, onChange, emptyLabel, ariaLabel, className = "", autoFocus = false, onClose, onMissing,
  suggested, compact = false, title,
}: {
  options: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** What "nothing chosen" means here: "No category", "All categories". */
  emptyLabel: string;
  ariaLabel: string;
  className?: string;
  /** Open at once (a table cell that turns into the chooser when pressed). */
  autoFocus?: boolean;
  /** Told when the window closes without a choice (Escape, Cancel, ✕, outside). */
  onClose?: () => void;
  /** Offered as "+ Add “…” as a new shelf" when the shelf is missing. Left
   *  out = no such line (the filters on the Products tab). */
  onMissing?: (typed: string) => void;
  /** Shelf ids Takal suggests for this product - shown first, one press each. */
  suggested?: string[];
  /** One line only (a narrow filter box): the shelf name, the path on hover. */
  compact?: boolean;
  /** The window's heading. Default: "Choose a shelf". */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const [deptName, setDeptName] = useState("");
  const [groupName, setGroupName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("dept");
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const opts = options as ChooserOption[];
  const byId = useMemo(() => new Map(opts.map((o) => [o.id, o])), [opts]);
  const depts = useMemo(() => buildDepartments(opts), [opts]);
  const chosen = byId.get(value);
  const words = boxWords(chosen);

  const dept: Department | undefined = depts.find((d) => d.name === deptName) || depts[0];
  const group = dept?.groups.find((g) => g.name === groupName) || dept?.groups[0];

  const found = useMemo(() => rankFound(filterCategories(opts.filter((o) => o.id), query), wordsOf(query)), [opts, query]);
  const results = found.slice(0, SHOW_AT_MOST);

  const openWindow = () => {
    setPending(value);
    // Nothing chosen yet: open where Takal's suggestion sits, so it is in view.
    const here = byId.get(value) || byId.get((suggested || [])[0] || "");
    const p = here ? placeOf(here) : null;
    if (p) {
      setDeptName(p.dept);
      // A lone group line ("Health & Pharmacy › Medicines") is that group.
      setGroupName(p.depth === 2 && depts.find((d) => d.name === p.dept)?.groups.some((g) => g.self?.id === here!.id) ? p.shelf : p.group);
      setStep("shelf");
    } else {
      setDeptName(depts[0]?.name || "");
      setGroupName(null);
      setStep("dept");
    }
    setQuery("");
    setCursor(0);
    setRecent(readRecent(storage()));
    setOpen(true);
  };

  useEffect(() => {
    if (autoFocus) openWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open) setTimeout(() => search.current?.focus(), 0); }, [open]);
  useEffect(() => { setCursor(0); }, [query]);
  // Escape closes the window wherever the keyboard is.
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") shut(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shut = (picked: boolean) => {
    setOpen(false);
    setQuery("");
    if (!picked) onClose?.();
  };
  const choose = (id: string) => {
    onChange(id);
    if (id) setRecent(rememberRecent(storage(), id));
    shut(true);
  };

  const pickDept = (d: Department) => {
    setDeptName(d.name);
    setGroupName(null);
    // One group only: straight on to its shelves.
    setStep(d.groups.length <= 1 ? "shelf" : "group");
  };
  const pickGroup = (name: string) => { setGroupName(name); setStep("shelf"); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); shut(false); return; }
    if (!query.trim()) {
      if (e.key === "Enter" && pending && pending !== value) { e.preventDefault(); choose(pending); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[cursor]) choose(results[cursor].id); }
  };

  const chips = (ids: string[] | undefined) => (ids || []).map((id) => byId.get(id)).filter(Boolean) as ChooserOption[];
  const sugg = chips(suggested).slice(0, 2);
  const used = chips(recent).filter((o) => !sugg.some((s) => s.id === o.id));
  const pend = byId.get(pending);
  const pendWords = boxWords(pend);

  return (
    <div className={`relative ${className}`}>
      {/* ── THE CLOSED BOX ── */}
      {compact ? (
        <button type="button" onClick={openWindow} aria-label={ariaLabel} title={chosen?.label || emptyLabel}
          className="flex w-full items-center gap-2 rounded-lg border border-takal-line bg-white px-3 py-2 text-left text-sm hover:border-takal-ink">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-takal-ink-soft" />
          <span className={`min-w-0 flex-1 truncate ${chosen ? "font-bold text-takal-ink" : "text-takal-ink-soft"}`}>
            {chosen ? words.main : emptyLabel}
          </span>
          {value && (
            <span role="button" tabIndex={0} aria-label={`Clear - ${emptyLabel}`} title={emptyLabel}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-takal-ink-soft hover:bg-slate-100">
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      ) : chosen ? (
        <div className="flex w-full items-center gap-2.5 rounded-[10px] border-[1.5px] border-takal-line bg-white px-3 py-2">
          <button type="button" onClick={openWindow} aria-label={`${ariaLabel}: ${chosen.label}`} title={chosen.label}
            className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold leading-snug text-takal-ink">
              {words.main}
              {chosen.rx && <span className="ml-1.5 rounded-md bg-takal-red px-1.5 py-px align-middle text-[10px] font-extrabold text-white">Rx</span>}
              {chosen.isNew && <span className="ml-1.5 rounded-md bg-black px-1.5 py-px align-middle text-[10px] font-extrabold text-takal-yellow">NEW</span>}
            </span>
            {words.where && <span className="block text-xs leading-snug text-takal-ink-soft">{words.where}</span>}
          </button>
          <button type="button" onClick={openWindow}
            className="shrink-0 rounded-[7px] border-[1.5px] border-takal-ink bg-white px-2.5 py-1 text-xs font-bold text-takal-ink hover:bg-takal-yellow">
            Change
          </button>
        </div>
      ) : (
        <button type="button" onClick={openWindow} aria-label={ariaLabel}
          className="w-full rounded-[10px] border-[1.5px] border-dashed border-takal-ink bg-white px-3 py-2.5 text-left text-sm font-bold text-takal-ink hover:bg-takal-yellow-soft">
          + {emptyLabel}
        </button>
      )}
      {/* Kept for screen readers and older tests: the one-line words. */}
      <span className="sr-only">{shortLabel(chosen)}</span>

      {/* ── THE WINDOW ── */}
      {/* Drawn on the page itself (a portal): inside the product window, a
          "fixed" box would otherwise be held inside that window's frame. */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-0 sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) shut(false); }}>
          <div role="dialog" aria-modal="true" aria-label={title || ariaLabel}
            className="flex h-full w-full flex-col overflow-hidden bg-takal-card text-takal-ink shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:h-auto sm:max-h-[90vh] sm:max-w-[1000px] sm:rounded-2xl">
            {/* Heading */}
            <div className="flex items-center gap-2 px-4 pb-2 pt-4 sm:px-5">
              {step !== "dept" && !query.trim() && (
                <button type="button" aria-label="Back" onClick={() => setStep(step === "shelf" && (dept?.groups.length || 0) > 1 ? "group" : "dept")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-takal-page sm:hidden">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <b className="flex-1 text-lg">{title || "Choose a shelf"}</b>
              <button type="button" aria-label="Close" onClick={() => shut(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-takal-ink-soft hover:bg-takal-page">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 sm:px-5">
              <label className={`flex items-center gap-2.5 rounded-[11px] border-[1.5px] bg-white px-3.5 py-2.5 ${
                query.trim() ? "border-takal-ink shadow-[0_0_0_3px_#FFFF00]" : "border-[#cfcfcf]"}`}>
                <Search aria-hidden className="h-4 w-4 shrink-0 text-takal-ink-soft" />
                <input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
                  role="combobox" aria-expanded={!!query.trim()} aria-controls={listId} aria-label={`Search - ${ariaLabel}`}
                  placeholder="Search a shelf, a group or a department"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-takal-disabled-text" />
                {query.trim() && <span className="shrink-0 text-xs text-takal-ink-soft">{found.length} found</span>}
              </label>
            </div>

            {query.trim() ? (
              /* ── Typed: every match as a card, under its department ── */
              <div id={listId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-5">
                {results.length === 0 && (
                  <p className="px-1 py-3 text-sm text-takal-ink-soft">
                    Nothing has “{query.trim()}”. Try another word — a shelf, a group or a department.
                  </p>
                )}
                {results.map((o, i) => {
                  const p = placeOf(o);
                  const w = boxWords(o);
                  const head = i === 0 || placeOf(results[i - 1]).dept !== p.dept;
                  return (
                    <div key={o.id}>
                      {head && (
                        <p className="mb-1.5 mt-3 flex items-center gap-2 text-[12.5px] font-bold">
                          <DeptMark name={p.dept} slug={(o as ChooserOption).dept} size={20} />{p.dept}
                        </p>
                      )}
                      <button type="button" role="option" aria-selected={i === cursor}
                        onMouseEnter={() => setCursor(i)} onClick={() => choose(o.id)}
                        className={`mb-1.5 flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left ${
                          i === cursor ? "border-2 border-takal-ink bg-takal-yellow" : "border-[1.5px] border-takal-line bg-white hover:border-takal-ink"}`}>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {marked(w.main, query)}
                            {o.rx && <span className="ml-1.5 rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>}
                            {o.isNew && <span className="ml-1.5 rounded-md bg-black px-1.5 py-px text-[10px] font-extrabold text-takal-yellow">NEW</span>}
                          </span>
                          {w.where && <span className="block text-xs text-takal-ink-soft">{marked(w.where, query)}</span>}
                        </span>
                        {i === cursor && <span aria-hidden className="shrink-0 text-xs text-takal-ink-soft">↵ Enter</span>}
                      </button>
                    </div>
                  );
                })}
                <p className="mt-2 text-xs text-takal-ink-soft">
                  {found.length > SHOW_AT_MOST ? `First ${SHOW_AT_MOST} of ${found.length} · ` : ""}↑ ↓ to move · Enter to choose
                  {onMissing && (
                    <>{" · "}
                      <button type="button" onClick={() => { const t = query.trim(); shut(true); onMissing(t); }}
                        className="font-bold text-takal-ink underline-offset-2 hover:underline">
                        + Add “{query.trim()}” as a new shelf
                      </button>
                    </>
                  )}
                </p>
              </div>
            ) : (
              <>
                {/* ── One-press chips ── */}
                {(sugg.length > 0 || used.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
                    {sugg.length > 0 && <span className="text-[11.5px] font-black tracking-wide text-takal-green">TAKAL SUGGESTS</span>}
                    {sugg.map((o) => (
                      <button key={o.id} type="button" onClick={() => choose(o.id)}
                        className="rounded-full border-[1.5px] border-takal-green bg-takal-green-soft px-3 py-1 text-[12.5px] font-bold hover:bg-takal-yellow">
                        ✓ {boxWords(o).main} <span className="font-normal text-takal-ink-soft">· {placeOf(o).group || placeOf(o).dept}</span>
                      </button>
                    ))}
                    {used.length > 0 && <span className="ml-2 text-[11.5px] font-black tracking-wide text-takal-ink-soft">USED LATELY</span>}
                    {used.map((o) => (
                      <button key={o.id} type="button" onClick={() => choose(o.id)} title={o.label}
                        className="rounded-full border border-[#ddd] bg-white px-3 py-1 text-[12.5px] hover:border-takal-ink">
                        {boxWords(o).main}
                      </button>
                    ))}
                  </div>
                )}

                {/* Phone: where you are - each chip takes you back */}
                <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:hidden">
                  {step !== "dept" && dept && (
                    <button type="button" onClick={() => setStep("dept")}
                      className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${step === "group" || (dept.groups.length <= 1) ? "bg-black text-takal-yellow" : "bg-[#F0F0F0]"}`}>
                      {dept.name}
                    </button>
                  )}
                  {step === "shelf" && group && dept && dept.groups.length > 1 && (
                    <button type="button" onClick={() => setStep("group")} className="rounded-full bg-black px-3 py-1 text-[12.5px] font-bold text-takal-yellow">
                      {group.title}
                    </button>
                  )}
                </div>

                {/* ── The columns ── */}
                <div className="mt-3 flex min-h-0 flex-1 border-t border-takal-line sm:h-[560px] sm:flex-none">
                  {/* 1 · Department */}
                  <div className={`${step === "dept" ? "flex" : "hidden"} w-full flex-col overflow-y-auto border-r border-takal-line p-2.5 sm:flex sm:w-[42%] lg:w-[31%]`}>
                    <p className="px-2 pb-1.5 pt-1 text-[11px] font-black tracking-wide text-takal-ink-soft">1 · DEPARTMENT</p>
                    {depts.map((d, i) => {
                      const on = d.name === dept?.name;
                      const head = d.own && i === 0 ? "THIS SHOP SELLS"
                        : !d.own && (i === 0 || depts[i - 1].own) && depts.some((x) => x.own) ? "ALL OTHER DEPARTMENTS" : "";
                      return (
                        <div key={d.name}>
                          {head && (
                            <p className={`px-2 pb-1 pt-2 text-[10.5px] font-black ${d.own ? "text-takal-green" : "mt-1 border-t border-dashed border-takal-line text-takal-disabled-text"}`}>{head}</p>
                          )}
                          <button type="button" onClick={() => pickDept(d)} aria-pressed={on}
                            className={`flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left ${on ? "bg-black text-takal-yellow" : "hover:bg-takal-page"}`}>
                            <DeptMark name={d.name} slug={d.slug} size={24} />
                            <span className={`min-w-0 flex-1 text-[14px] ${on ? "font-bold" : "font-medium"}`}>{d.name}</span>
                            <span className={`text-[11.5px] ${on ? "text-takal-yellow" : "text-takal-disabled-text"}`}>{d.count}</span>
                            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 opacity-60" />
                          </button>
                          {/* Tablet: the groups open under their department */}
                          {on && d.groups.length > 1 && (
                            <div className="hidden pb-1 sm:block lg:hidden">
                              {d.groups.map((g) => (
                                <button key={g.name} type="button" onClick={() => pickGroup(g.name)}
                                  className={`my-0.5 ml-8 block w-[calc(100%-2rem)] rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
                                    g.name === group?.name ? "border-[1.5px] border-takal-ink bg-takal-yellow font-bold" : "hover:bg-takal-page"}`}>
                                  {g.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {d0Self(dept, pending, setPending)}
                  </div>

                  {/* 2 · Group (laptop column; a step on a phone) */}
                  <div className={`${step === "group" ? "flex sm:hidden" : "hidden"} w-full flex-col overflow-y-auto border-r border-takal-line p-2.5 lg:flex lg:w-[24%]`}>
                    <p className="px-2 pb-1.5 pt-1 text-[11px] font-black tracking-wide text-takal-ink-soft">2 · GROUP</p>
                    {dept?.groups.map((g) => {
                      const on = g.name === group?.name;
                      return (
                        <button key={g.name} type="button" onClick={() => pickGroup(g.name)} aria-pressed={on}
                          className={`mb-1 flex w-full items-center justify-between rounded-[9px] px-2.5 py-2.5 text-left ${
                            on ? "border-[1.5px] border-takal-ink bg-takal-yellow" : "border-[1.5px] border-transparent hover:bg-takal-page"}`}>
                          <span className={`text-[14px] ${on ? "font-bold" : "font-medium"}`}>{g.title}</span>
                          <span className="text-xs text-takal-ink-soft">{g.shelves.length} ›</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3 · Shelf */}
                  <div className={`${step === "shelf" ? "flex" : "hidden"} min-w-0 flex-1 flex-col overflow-y-auto p-2.5 sm:flex`}>
                    <p className="px-2 pb-1.5 pt-1 text-[11px] font-black tracking-wide text-takal-ink-soft">3 · SHELF</p>
                    {group?.self && (
                      <button type="button" onClick={() => setPending(group.self!.id)} onDoubleClick={() => choose(group.self!.id)}
                        className={`mb-1.5 w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] ${
                          pending === group.self.id ? "border-2 border-takal-ink bg-takal-yellow font-bold" : "border-[1.5px] border-dashed border-takal-ink font-bold hover:bg-takal-yellow-soft"}`}>
                        Everything in {group.title}
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {[...(group?.shelves || [])].sort(byShelfName).map((o) => {
                        const on = o.id === pending;
                        return (
                          <button key={o.id} type="button" role="option" aria-selected={on}
                            onClick={() => setPending(o.id)} onDoubleClick={() => choose(o.id)}
                            className={`rounded-[9px] px-2.5 py-2 text-left text-[13px] leading-tight ${
                              on ? "border-2 border-takal-ink bg-takal-yellow font-bold" : "border-[1.5px] border-takal-line bg-white font-medium hover:border-takal-ink hover:bg-takal-yellow-soft"}`}>
                            {placeOf(o).shelf}
                            {o.rx && <span className="ml-1 rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>}
                            {o.isNew && <span className="ml-1 rounded-md bg-black px-1.5 py-px text-[10px] font-extrabold text-takal-yellow">NEW</span>}
                            {on && " ✓"}
                          </button>
                        );
                      })}
                    </div>
                    {!group && <p className="px-2 text-sm text-takal-ink-soft">Choose a department first.</p>}
                  </div>
                </div>

                {/* ── What is chosen, in full, before pressing Choose ── */}
                <div className="flex flex-wrap items-center gap-2.5 border-t border-takal-line bg-takal-page px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-takal-ink-soft">CHOSEN</p>
                    <p className="text-[15px] font-bold">
                      {pend ? pendWords.main : <span className="font-normal text-takal-ink-soft">Nothing yet</span>}
                      {pendWords.where && <span className="text-[13px] font-normal text-takal-ink-soft"> · {pendWords.where}</span>}
                    </p>
                  </div>
                  {/* Back to "nothing chosen" - only where that means something
                      ("All categories", "Keep its category"), never "Choose…". */}
                  {value && !/^choose/i.test(emptyLabel) && (
                    <button type="button" onClick={() => choose("")}
                      className="text-xs font-bold text-takal-ink-soft underline-offset-2 hover:underline">
                      {emptyLabel === "Category" ? "All categories" : emptyLabel}
                    </button>
                  )}
                  <button type="button" onClick={() => shut(false)}
                    className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-3.5 py-2 text-[13px] font-bold">Cancel</button>
                  <button type="button" disabled={!pend} onClick={() => pend && choose(pend.id)}
                    className="rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-3.5 py-2 text-[13px] font-bold disabled:border-[#d6d6d6] disabled:bg-[#e7e7e7] disabled:text-[#888]">
                    Choose this shelf
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** "Everything in Health & Pharmacy" - only when the caller lets a whole
 *  department be chosen (the Products tab's filter). */
function d0Self(dept: Department | undefined, pending: string, setPending: (id: string) => void) {
  if (!dept?.self) return null;
  const on = pending === dept.self.id;
  return (
    <button type="button" onClick={() => setPending(dept.self!.id)}
      className={`mt-2 w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] font-bold ${
        on ? "border-2 border-takal-ink bg-takal-yellow" : "border-[1.5px] border-dashed border-takal-ink hover:bg-takal-yellow-soft"}`}>
      Everything in {dept.name}
    </button>
  );
}

/** A to Z, the way people look for a word - "Allergy" before "Diabetes". */
const byShelfName = (a: CategoryOption, b: CategoryOption) =>
  placeOf(a).shelf.localeCompare(placeOf(b).shelf, undefined, { sensitivity: "base", numeric: true });

/** The department's own colour and first letter - the customer app's colours. */
function DeptMark({ name, slug, size }: { name: string; slug?: string; size: number }) {
  const [deep] = deptColour(slug || slugOf(name));
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-[7px] font-black text-white"
      style={{ width: size, height: size, background: deep, fontSize: Math.round(size * 0.5) }}>
      {(name || "?").replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "•"}
    </span>
  );
}

/** The text with the typed words marked. */
function marked(text: string, query: string) {
  return highlightParts(text, query).map((p, k) =>
    p.hit ? <mark key={k} className="rounded-sm bg-[#FFF59A] px-px text-inherit">{p.text}</mark>
          : <span key={k}>{p.text}</span>);
}

