"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › PRODUCT SORTING › SORTING LIST.  (Mock 210-5, approved by Sana
// 27 October 2026.) Teach Takal once, every shop follows.
//
// Each line says: a name that starts with TRIKAT (or has the word FEEDER in
// it) belongs on THIS shelf, with or without a prescription. Saving a line
// moves every product it matches in every shop now, and every future upload
// follows it - the vendor app, the admin upload, "Takal suggests" and the
// nightly check all ask this list first. Lines are added one by one here, or
// many at once from the pharmacist's filled-in sheet.
//
// The server keeps the list (migration 150, sorting_words.py). Until database
// step 150 is run, the page says so and changes nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Plus, Search, Upload, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog, ErrorState, LoadingState, Modal } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { SortingSheetCheck, SortingWord, SortingWordPreview } from "@/lib/api-stores";
import { shelfOptions, type ShelfOption } from "@/lib/shelves";
import { parseCsv } from "@/lib/sheet-reader";
import { whenWords } from "@/lib/product-sorting";
import {
  MATCH_CHOICES, checkCounts, cleanWord, linesToAdd, matchLabel, pileNamesCsv, sheetRows, startingRx,
  waitsForAPerson, wordProblem, type CheckedRow, type Match,
} from "@/lib/sorting-list";

const PAGE = 100;

export default function SortingListPage() {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<SortingWord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [cats, setCats] = useState<ShelfOption[]>([]);
  const [editing, setEditing] = useState<SortingWord | "new" | null>(null);
  const [removing, setRemoving] = useState<SortingWord | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    apiClient.getShelfTree().then((res) => setCats(shelfOptions(res))).catch(() => setCats([]));
  }, []);

  const load = useCallback(async (query: string, offset = 0) => {
    const mine = ++asked.current;
    setLoading(true);
    try {
      const page = await apiClient.getSortingWords(query, offset);
      if (mine !== asked.current) return;
      setLines((old) => (offset ? [...old, ...page.lines] : page.lines));
      setTotal(page.total);
      setFailed("");
    } catch (e) {
      if (mine === asked.current) setFailed(e instanceof Error ? e.message : "The Sorting list could not be read");
    } finally {
      if (mine === asked.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(q, 0); }, [q, load]);
  useEffect(() => {
    const t = setTimeout(() => setQ(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await apiClient.removeSortingWord(removing.id);
      toast(`“${removing.word.toUpperCase()}” is off the list. Products stay where they are.`, "success");
      setRemoving(null);
      load(q, 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "It could not be removed", "error");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const { names } = await apiClient.getPileNames();
      if (!names.length) {
        toast("Nothing is waiting - every product is on a proper shelf.", "success");
        return;
      }
      const blob = new Blob([pileNamesCsv(names)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Takal-not-yet-sorted-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`${names.length.toLocaleString()} names downloaded - for the pharmacist to fill in`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The list could not be made", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Saving a line (or a sheet) is one undoable batch per shelf: put back here,
  // or later from Shelf check › Undo history. The LINE stays on the list.
  const undo = async () => {
    if (!done?.batches.length) return;
    setBusy(true);
    try {
      let back = 0;
      for (const id of done.batches) back += (await apiClient.undoShelfCheck(id)).put_back || 0;
      toast(`${back.toLocaleString()} products put back. The line stays on the list - remove it if it was wrong.`, "success");
      setDone(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not put them back", "error");
    } finally {
      setBusy(false);
    }
  };

  const notYet = /database step 150|not switched on/i.test(failed);
  const btn = "inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-40";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-[11px] border-[1.5px] border-takal-line bg-white px-3.5 py-2.5 focus-within:border-takal-ink">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-takal-ink-soft" />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Find a line"
            placeholder="Find a line…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-takal-disabled-text" />
          {typed && <button type="button" aria-label="Clear" onClick={() => setTyped("")} className="text-takal-ink-soft"><X className="h-4 w-4" /></button>}
        </label>
        <button type="button" onClick={() => setEditing("new")} disabled={notYet || !cats.length}
          className={`${btn} border-takal-ink bg-takal-yellow text-takal-ink`}><Plus className="h-4 w-4" /> Add a line</button>
        <button type="button" onClick={() => setSheetOpen(true)} disabled={notYet || !cats.length}
          className={`${btn} border-black bg-black text-takal-yellow`}><Upload className="h-4 w-4" /> Upload a sheet</button>
        <button type="button" onClick={download} disabled={downloading}
          className={`${btn} border-takal-ink bg-white text-takal-ink hover:bg-takal-yellow-soft`}>
          <Download className="h-4 w-4" /> {downloading ? "Making the list…" : "Download what is not yet sorted"}
        </button>
      </div>

      {done && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-takal-green px-4 py-2.5 text-white">
          <b>{done.words}</b>
          {done.batches.length > 0 && (
            <button type="button" onClick={undo} disabled={busy}
              className="rounded-[7px] bg-white px-2.5 py-1 text-xs font-bold text-takal-ink disabled:opacity-50">Undo the move</button>
          )}
          <button type="button" aria-label="Close" onClick={() => setDone(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {notYet ? (
        <div className="rounded-xl border-2 border-takal-ink bg-takal-yellow-soft p-5 text-sm">
          <b className="block text-base">The Sorting list is not switched on yet</b>
          It needs database step 150. Nothing has been changed. Find &amp; move and Shelf check work as before.
        </div>
      ) : failed && !lines.length ? <ErrorState message={failed} onRetry={() => load(q, 0)} /> : (
        <div className="rounded-xl border border-takal-line bg-white">
          <table className="hidden w-full text-[13px] md:table">
            <thead>
              <tr className="border-b border-takal-line text-left text-[11.5px] font-bold text-takal-ink-soft">
                <th className="px-4 py-2.5">Name or word</th><th className="px-2 py-2.5">How it matches</th>
                <th className="px-2 py-2.5">Goes to shelf</th><th className="px-2 py-2.5">Prescription</th>
                <th className="px-2 py-2.5 text-right">Products</th><th className="px-2 py-2.5">Added by</th>
                <th className="px-4 py-2.5"><span className="sr-only">Change</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => (
                <tr key={ln.id} className="border-b border-takal-line last:border-0">
                  <td className="px-4 py-2.5 font-extrabold tracking-wide">{ln.word.toUpperCase()}</td>
                  <td className="px-2 py-2.5"><MatchChip m={ln.match} /></td>
                  <td className="px-2 py-2.5"><ShelfWords ln={ln} /></td>
                  <td className="px-2 py-2.5"><RxWords on={ln.needs_prescription || !!ln.shelf_rx} /></td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{ln.moved_count == null ? "-" : ln.moved_count.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-takal-ink-soft">{addedWords(ln)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setEditing(ln)} className="text-xs font-bold underline underline-offset-2">Edit</button>
                    <button type="button" onClick={() => setRemoving(ln)} className="ml-3 text-xs font-bold text-takal-red underline underline-offset-2">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden">
            {lines.map((ln) => (
              <div key={ln.id} className="border-b border-takal-line px-3.5 py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <b className="text-[15px] tracking-wide">{ln.word.toUpperCase()}</b>
                  <MatchChip m={ln.match} />
                  {(ln.needs_prescription || ln.shelf_rx) && <Rx />}
                </div>
                <div className="mt-1"><ShelfWords ln={ln} /></div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-takal-ink-soft">
                  <span>{ln.moved_count == null ? "" : `${ln.moved_count.toLocaleString()} products`}</span>
                  <span className="min-w-0 flex-1 truncate">{addedWords(ln)}</span>
                  <button type="button" onClick={() => setEditing(ln)} className="font-bold text-takal-ink underline">Edit</button>
                  <button type="button" onClick={() => setRemoving(ln)} className="font-bold text-takal-red underline">Remove</button>
                </div>
              </div>
            ))}
          </div>

          {loading && <LoadingState label="Reading the list…" />}
          {!loading && lines.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-takal-ink-soft">
              {q ? "No line has that word." : (
                <>
                  <b className="block text-base text-takal-ink">The list is empty</b>
                  Add a line - TRIKAT → Bones, Joints &amp; Muscles - or upload the pharmacist’s sheet.
                </>
              )}
            </div>
          )}
          {!loading && total !== null && lines.length < total && (
            <div className="border-t border-takal-line p-3 text-center">
              <button type="button" onClick={() => load(q, lines.length)}
                className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-[13px] font-bold hover:bg-takal-yellow">
                Show {Math.min(PAGE, total - lines.length)} more <span className="font-normal text-takal-ink-soft">({lines.length.toLocaleString()} of {total.toLocaleString()})</span>
              </button>
            </div>
          )}
          <p className="border-t border-takal-line px-4 py-2.5 text-xs text-takal-ink-soft">
            A line here is used by: every new upload (vendor app and admin), the product window’s “Takal suggests”, and the nightly
            check - in <b>every</b> shop. Takal’s own built-in rules still work; your lines always win over them.
          </p>
        </div>
      )}

      {editing && (
        <LineWindow line={editing === "new" ? null : editing} cats={cats}
          onClose={() => setEditing(null)} onSaved={(d) => { setEditing(null); setDone(d); load(q, 0); }} />
      )}
      {sheetOpen && (
        <SheetWindow cats={cats} onClose={() => setSheetOpen(false)} onDone={(d) => { setSheetOpen(false); setDone(d); load(q, 0); }} />
      )}
      <ConfirmDialog open={!!removing} busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove}
        title={`Remove “${removing?.word.toUpperCase() || ""}” from the list?`} confirmLabel="Remove the line"
        message={<>Products it already moved <b>stay where they are</b>. New uploads will no longer follow this line.</>} />
    </div>
  );
}

interface Done { words: string; batches: string[] }

function addedWords(ln: SortingWord): string {
  const when = ln.updated_at ? whenWords(ln.updated_at) : "";
  return [ln.added_by || "", when].filter(Boolean).join(" · ");
}

function MatchChip({ m }: { m: string }) {
  return <span className="whitespace-nowrap rounded-md bg-[#eef0f2] px-2 py-0.5 text-[11.5px] font-bold">{matchLabel(m)}</span>;
}

function ShelfWords({ ln }: { ln: SortingWord }) {
  if (!ln.shelf) return <span className="text-xs font-bold text-takal-red">Shelf no longer on Takal - choose another</span>;
  return (
    <span className="block leading-tight">
      <b className="block text-[13px]">{ln.shelf}</b>
      {ln.where && <span className="text-xs text-takal-ink-soft">{ln.where}</span>}
    </span>
  );
}

function Rx() {
  return <span className="rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>;
}

function RxWords({ on }: { on: boolean }) {
  return on ? <span className="inline-flex items-center gap-1.5"><Rx /> yes</span> : <span className="text-takal-ink-soft">no</span>;
}

// ── Add a line / Edit a line ─────────────────────────────────────────────────

function LineWindow({ line, cats, onClose, onSaved }: {
  line: SortingWord | null; cats: ShelfOption[]; onClose: () => void; onSaved: (d: Done) => void;
}) {
  const [word, setWord] = useState(line ? line.word.toUpperCase() : "");
  const [match, setMatch] = useState<Match>(line?.match || "starts");
  const [shelf, setShelf] = useState(line?.category_id || "");
  const [rx, setRx] = useState<boolean>(line ? line.needs_prescription : false);
  const [rxTouched, setRxTouched] = useState(!!line);
  const [preview, setPreview] = useState<SortingWordPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const asked = useRef(0);

  const opt = useMemo(() => cats.find((c) => c.id === shelf) || null, [cats, shelf]);
  const shelfForces = !!opt?.rx;
  useEffect(() => { if (opt && !rxTouched) setRx(startingRx(opt)); }, [opt, rxTouched]);
  useEffect(() => { if (shelfForces) setRx(true); }, [shelfForces]);

  const problem = word.trim() ? wordProblem(word) : "";
  useEffect(() => {
    const w = cleanWord(word);
    setPreview(null);
    if (wordProblem(w)) return;
    const mine = ++asked.current;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const p = await apiClient.previewSortingWord(w, match);
        if (mine === asked.current) setPreview(p);
      } catch {
        if (mine === asked.current) setPreview(null);
      } finally {
        if (mine === asked.current) setPreviewing(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [word, match]);

  const save = async () => {
    setSaving(true);
    try {
      const out = await apiClient.saveSortingWord({ word: cleanWord(word), match, category_id: shelf, rx }, line?.id);
      const w = cleanWord(word).toUpperCase();
      onSaved({
        words: out.moved
          ? `✓ “${w}” saved - ${out.moved.toLocaleString()} ${out.moved === 1 ? "product" : "products"} moved to ${opt?.name || "the shelf"}`
          : `✓ “${w}” saved - new uploads will follow it`,
        batches: out.batch_ids || [],
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "The line was not saved", "error");
    } finally {
      setSaving(false);
    }
  };

  const ready = !!cleanWord(word) && !problem && !!shelf && !saving;
  const n = preview?.count || 0;
  const findHref = `/dashboard/stores/sorting/find?q=${encodeURIComponent(cleanWord(word))}`;
  return (
    <Modal open onClose={onClose} lockClose={saving} title={line ? `Edit “${line.word.toUpperCase()}”` : "Add a line"} size="md"
      hint="It shows what it will move before you save."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={!ready}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-4 py-2 text-sm font-bold disabled:opacity-40">
            {saving ? "Saving…" : n ? `Save and move ${n.toLocaleString()}` : "Save"}
          </button>
        </>
      )}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[13px] font-bold">Name or word</span>
          <input value={word} onChange={(e) => setWord(e.target.value)} autoFocus maxLength={80} placeholder="TRIKAT"
            className="w-full rounded-[10px] border-2 border-takal-ink px-3.5 py-2.5 text-[16px] uppercase outline-none focus:shadow-[0_0_0_3px_#FFFF00]" />
          {problem && <span className="mt-1 block text-xs font-bold text-takal-red">{problem}</span>}
        </label>

        <div>
          <span className="mb-1 block text-[13px] font-bold">How it matches</span>
          <div role="radiogroup" aria-label="How it matches" className="grid grid-cols-2 gap-2">
            {MATCH_CHOICES.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={match === c.key} onClick={() => setMatch(c.key)}
                className={`rounded-[9px] border-[1.5px] px-3 py-2 text-sm ${match === c.key ? "border-takal-ink bg-takal-yellow font-bold" : "border-takal-line bg-white"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <span className="mt-1 block text-xs text-takal-ink-soft">{MATCH_CHOICES.find((c) => c.key === match)?.hint}</span>
        </div>

        <div>
          <span className="mb-1 block text-[13px] font-bold">Goes to shelf</span>
          <CategoryPicker options={cats} value={shelf} onChange={setShelf} emptyLabel="Choose a shelf…" ariaLabel="Goes to shelf"
            title="Which shelf does it go on?" />
        </div>

        <div>
          <span className="mb-1 block text-[13px] font-bold">Needs a prescription?</span>
          <div role="radiogroup" aria-label="Needs a prescription" className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" role="radio" aria-checked={rx === v} disabled={!v && shelfForces}
                onClick={() => { setRx(v); setRxTouched(true); }}
                className={`rounded-[9px] border-[1.5px] px-5 py-2 text-sm font-bold disabled:opacity-40 ${rx === v ? (v ? "border-takal-red bg-takal-red text-white" : "border-takal-ink bg-takal-ink text-white") : "border-takal-line bg-white"}`}>
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
          {shelfForces && <span className="mt-1 block text-xs text-takal-ink-soft">This shelf always needs a prescription.</span>}
        </div>

        <div aria-live="polite" className="min-h-[52px] rounded-[10px] border-[1.5px] border-[#e9e48a] bg-takal-yellow-soft px-3.5 py-2.5 text-[13px]">
          {previewing ? "Looking in every shop…" : !preview ? "Type a name to see what it matches." : n === 0 ? (
            <>Nothing on Takal matches it today. New uploads will follow it.</>
          ) : (
            <>
              <b>This line matches {n.toLocaleString()} {n === 1 ? "product" : "products"} now{preview.shops > 1 ? `, in ${preview.shops} shops` : ""}</b>
              {" - "}{preview.examples.slice(0, 4).map((x) => `${x.name}${x.shop ? ` (${x.shop})` : ""}`).join(", ")}
              {n > 4 ? " …" : ""}. They move when you save. <Link href={findHref} className="font-bold underline">See them</Link>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Upload a sheet ───────────────────────────────────────────────────────────

const SHOW_ROWS = 200;

function SheetWindow({ cats, onClose, onDone }: { cats: ShelfOption[]; onClose: () => void; onDone: (d: Done) => void }) {
  const [file, setFile] = useState<{ name: string; rows: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [check, setCheck] = useState<SortingSheetCheck | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setReading(true);
    setCheck(null);
    setChosen({});
    try {
      const sheet = /\.csv$|\.txt$/i.test(f.name)
        ? parseCsv(await f.text())
        : await apiClient.readSortingSheet(f);
      const rows = sheetRows(sheet);
      if (!rows.length) throw new Error("That sheet has no rows with a product name.");
      if (rows.length > 5000) throw new Error(`That sheet has ${rows.length.toLocaleString()} rows - at most 5,000 at once. Split it in two.`);
      setFile({ name: f.name, rows: rows.length });
      setCheck(await apiClient.checkSortingSheet(rows));
    } catch (e) {
      toast(e instanceof Error ? e.message : "That sheet could not be read", "error");
      setFile(null);
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  const rows = useMemo(() => check?.rows || [], [check]);
  const counts = checkCounts(rows, chosen);
  const lines = useMemo(() => linesToAdd(rows, chosen), [rows, chosen]);
  // The rows that need the person first, then the understood ones.
  const shown = useMemo(() => {
    const order = (r: CheckedRow) => (waitsForAPerson(r) ? 0 : r.state === "understood" ? 1 : 2);
    return rows.filter((r) => r.state !== "empty").sort((a, b) => order(a) - order(b) || a.row - b.row);
  }, [rows]);
  const visible = showAll ? shown : shown.slice(0, SHOW_ROWS);
  const shelfName = (id: string) => cats.find((c) => c.id === id)?.name || "";

  const apply = async () => {
    setApplying(true);
    try {
      const out = await apiClient.applySortingSheet(lines);
      onDone({
        words: `✓ ${out.lines.toLocaleString()} ${out.lines === 1 ? "line" : "lines"} added - ${out.moved.toLocaleString()} ${out.moved === 1 ? "product" : "products"} moved`,
        batches: out.batch_ids || [],
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nothing was added", "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal open onClose={onClose} lockClose={applying} size="xl" title="Upload a sheet"
      hint="The pharmacist’s filled-in sheet, or any sheet with: product name · shelf · prescription yes/no."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={applying}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={apply} disabled={!lines.length || applying}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-4 py-2 text-sm font-bold disabled:opacity-40">
            {applying ? "Adding and moving…" : `Add ${lines.length.toLocaleString()} ${lines.length === 1 ? "line" : "lines"} and move them`}
          </button>
        </>
      )}>
      <div className="space-y-4">
        <input ref={input} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" aria-label="Choose the sheet"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-takal-ink px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-takal-green text-white"><FileSpreadsheet className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{file ? file.name : reading ? "Reading…" : "No sheet chosen yet"}</b>
            <span className="text-xs text-takal-ink-soft">
              {file ? `${file.rows.toLocaleString()} rows` : ".csv or Excel - the “not yet sorted” download, filled in, reads as it is"}
            </span>
          </span>
          <button type="button" onClick={() => input.current?.click()} disabled={reading || applying}
            className="shrink-0 rounded-[8px] border-[1.5px] border-takal-ink bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40">
            {file ? "Change file" : "Choose a file"}
          </button>
        </div>

        {reading && <LoadingState label="Reading every row…" />}

        {check && !reading && (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Count n={counts.lines} words={`${counts.lines === 1 ? "line" : "lines"} ready - the shelf was found`} tone="bg-takal-green-soft text-takal-green" />
              <Count n={counts.waiting} words={`${counts.waiting === 1 ? "name waits" : "names wait"} for you - choose a shelf`} tone="bg-takal-orange-soft text-[#C2410C]" />
              <Count n={counts.empty} words={`${counts.empty === 1 ? "row" : "rows"} left empty - skipped`} tone="bg-[#f0f0f0] text-takal-ink" />
            </div>

            <div className="max-h-[46vh] overflow-auto rounded-[10px] border border-takal-line">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-takal-line text-left text-[11.5px] font-bold text-takal-ink-soft">
                    <th className="px-3 py-2">Product</th><th className="px-2 py-2">Sheet says</th>
                    <th className="px-2 py-2">Takal shelf</th><th className="px-3 py-2">Rx</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const pick = chosen[r.word];
                    const waits = waitsForAPerson(r) && !pick;
                    return (
                      <tr key={r.row} className={`border-b border-takal-line last:border-0 ${waits ? "bg-takal-orange-soft/60" : ""}`}>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-2 py-2 text-takal-ink-soft">
                          “{r.said}”
                          {r.state === "two_answers" && !pick && <span className="ml-1.5 text-[11px] font-bold text-[#C2410C]">two different answers</span>}
                        </td>
                        <td className="px-2 py-2">
                          {picking === r.word ? (
                            <CategoryPicker options={cats} value={pick || ""} autoFocus emptyLabel="Choose a shelf…"
                              ariaLabel={`Shelf for ${r.name}`} title={`Choose a shelf for ${r.word.toUpperCase()}`}
                              onClose={() => setPicking(null)}
                              onChange={(id) => { setChosen((c) => ({ ...c, [r.word]: id })); setPicking(null); }} />
                          ) : pick || (r.state === "understood" && r.category_id) ? (
                            <span className="inline-flex items-center gap-2">
                              <b>{pick ? shelfName(pick) : r.shelf}</b>
                              <button type="button" onClick={() => setPicking(r.word)} className="text-xs underline">change</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setPicking(r.word)}
                              className="rounded-[8px] border-[1.5px] border-takal-ink bg-white px-2.5 py-1 text-xs font-bold">+ Choose a shelf</button>
                          )}
                        </td>
                        <td className="px-3 py-2">{r.rx === true ? <Rx /> : r.rx === false ? "no" : <span className="text-takal-ink-soft">-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shown.length > visible.length && (
                <div className="border-t border-takal-line p-2.5 text-center">
                  <button type="button" onClick={() => setShowAll(true)} className="text-xs font-bold underline">
                    Show all {shown.length.toLocaleString()} rows
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-takal-ink-soft">
              The sheet understands plain words a pharmacist writes (“BP”, “sugar”, “epilepsy”, “antibiotic”) as well as the exact
              shelf name. Anything it cannot place waits for you - nothing is guessed. A name with no Rx answer on a Medicines shelf is
              saved as <b>needs prescription</b>, the safe side.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function Count({ n, words, tone }: { n: number; words: string; tone: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${tone}`}>
      <b className="block text-2xl tabular-nums">{n.toLocaleString()}</b>
      <span className="text-xs">{words}</span>
    </div>
  );
}
