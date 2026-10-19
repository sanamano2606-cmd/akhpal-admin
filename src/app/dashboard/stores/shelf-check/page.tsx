"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › SHELF CHECK.  (Mock 201, board 4, picture 3. Sana, 19 October 2026:
// "Approved. Please Build exactly the same".)
//
// Products that look like they are on the wrong shelf, GROUPED, with the
// reason: "909 prescription medicines sold as Over the Counter", "88 tissue
// rolls on Family Planning". One press moves a whole group; "Look one by one"
// lets a person check and change each product first. Medicines Takal cannot
// sort by name wait for the pharmacist's list (decision D2: until then they
// count as "needs a prescription").
//
// SAFE TO PRESS. The server saves every product's old shelf in a backup list
// BEFORE it moves anything, and "Undo history" puts a whole batch back. Which
// shelf each product belongs on is the server's answer (the shelf suggester),
// the same one the Partners app and the catalogue upload get.
//
// The rules of this screen (chips, labels, the pasted list) are in
// lib/shelves.ts, tested in tests/mock-201-shelves.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { Button, EmptyState, ErrorState, LoadingState, Modal } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { ShelfBatch, ShelfCheckItem } from "@/lib/api-stores";
import {
  SHOW_CHIPS, groupsFor, kindLook, moveLabel, pharmacistWords, shelfOptions, whenLabel,
  type CheckShow, type MoveState, type ShelfGroup, type ShelfOption,
} from "@/lib/shelves";

const IDLE: MoveState = { phase: "idle" };

export default function ShelfCheckPage() {
  const [groups, setGroups] = useState<ShelfGroup[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const [show, setShow] = useState<CheckShow>("to_check");
  const [running, setRunning] = useState(false);
  const [moves, setMoves] = useState<Record<string, MoveState>>({});
  const [looking, setLooking] = useState<ShelfGroup | null>(null);
  const [pharmacist, setPharmacist] = useState<ShelfGroup | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // The open groups and the finished ones, once: the chips filter on this
      // page, so pressing one never waits for the server.
      const [open, done] = await Promise.all([
        apiClient.getShelfCheck("to_check"),
        apiClient.getShelfCheck("done").catch(() => ({ groups: [] as any[] })),
      ]);
      const seen = new Set<string>();
      const all: ShelfGroup[] = [];
      for (const g of [...(open?.groups || []), ...((done?.groups || []).map((x: any) => ({ ...x, done: true })))]) {
        if (!g?.key || seen.has(g.key)) continue;
        seen.add(g.key);
        all.push(g as ShelfGroup);
      }
      setGroups(all);
      setRanAt(open?.ran_at || null);
    } catch (e) {
      setLoadError(readFailure(e, "the shelf check"));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAgain = async () => {
    setRunning(true);
    try {
      const res = await apiClient.runShelfCheck();
      toast(`${Number(res?.checked || 0).toLocaleString()} products checked`, "success");
      setMoves({});
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The check could not be run", "error");
    } finally {
      setRunning(false);
    }
  };

  const moveAll = async (g: ShelfGroup) => {
    setMoves((m) => ({ ...m, [g.key]: { phase: "moving" } }));
    try {
      const res = await apiClient.moveShelfCheck({ group: g.key });
      setMoves((m) => ({ ...m, [g.key]: { phase: "moved", moved: Number(res?.moved || 0), batch: String(res?.batch_id || "") } }));
      toast(`${Number(res?.moved || 0).toLocaleString()} products moved`, "success");
    } catch (e) {
      setMoves((m) => ({ ...m, [g.key]: IDLE }));
      toast(e instanceof Error ? e.message : "The group could not be moved", "error");
    }
  };

  const undoGroup = async (g: ShelfGroup, batch: string) => {
    try {
      const res = await apiClient.undoShelfCheck(batch);
      setMoves((m) => ({ ...m, [g.key]: IDLE }));
      toast(`${Number(res?.put_back || 0).toLocaleString()} products put back`, "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not put them back", "error");
    }
  };

  const shown = useMemo(() => groupsFor(groups, show), [groups, show]);

  return (
    <div className="space-y-3" data-testid="shelf-check">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold text-takal-ink">Products that look like they are on the wrong shelf</h2>
          <p className="text-[13px] text-[#555555]">
            Grouped, with the reason. Press once to move a whole group — or look one by one. Every move can be undone.
            {ranAt && <span className="text-takal-ink-soft"> Last checked {whenLabel(ranAt)}.</span>}
          </p>
        </div>
        <span className="ml-auto flex flex-none items-center gap-2">
          <Button variant="ghost" size="sm" onClick={runAgain} loading={running} title="Read every product again and regroup">
            <RefreshCw className="mr-1 inline h-4 w-4" /> Check again
          </Button>
          <button type="button" onClick={() => setHistoryOpen(true)} data-testid="undo-history"
            className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[11px] border-2 border-black bg-white px-3.5 text-[13.5px] font-bold text-black">
            <History className="h-4 w-4" /> Undo history
          </button>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {SHOW_CHIPS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setShow(key)} aria-pressed={show === key}
            className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-bold ${
              show === key ? "border-[#111111] bg-[#111111] text-white" : "border-[#D7D7D7] bg-white text-takal-ink hover:border-black"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Reading the shelf check…" />
      ) : loadError ? (
        <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={show === "done" ? "Nothing moved yet" : "Nothing to check here"}
          message={groups.length === 0
            ? "No check has been run yet. Press “Check again” to read every product."
            : "Every product in this part looks like it is on its right shelf."}
        />
      ) : (
        shown.map((g) => (
          <GroupCard key={g.key} g={g} state={moves[g.key] || IDLE}
            onMoveAll={() => moveAll(g)} onLook={() => setLooking(g)}
            onPharmacist={() => setPharmacist(g)}
            onUndo={(batch) => undoGroup(g, batch)} />
        ))
      )}

      <div className="mt-3.5 flex flex-col gap-3 md:flex-row">
        <div className="flex-1 rounded-[14px] border-2 border-dashed border-[#1F6F4A] bg-white px-4 py-3 text-[13.5px] text-[#114B31]">
          <b>Safe to press.</b> Before any product moves, its old shelf is saved in a backup list. “Undo history” puts a whole group back in one press.
        </div>
        <div className="flex-1 rounded-[14px] border-2 border-dashed border-[#004E89] bg-white px-4 py-3 text-[13.5px] text-[#0B3A63]">
          <b>Runs every month.</b> New products that look wrong show up here again, so the shelves stay clean.
        </div>
      </div>

      {looking && <LookOneByOne g={looking} onClose={() => setLooking(null)} onMoved={() => { setLooking(null); load(); }} />}
      {pharmacist && <PharmacistList g={pharmacist} onClose={() => setPharmacist(null)} onDone={() => { setPharmacist(null); load(); }} />}
      {historyOpen && <UndoHistory onClose={() => setHistoryOpen(false)} onUndone={load} />}
    </div>
  );
}

function GroupCard({ g, state, onMoveAll, onLook, onPharmacist, onUndo }: {
  g: ShelfGroup;
  state: MoveState;
  onMoveAll: () => void;
  onLook: () => void;
  onPharmacist: () => void;
  onUndo: (batch: string) => void;
}) {
  const look = kindLook(String(g.kind));
  const pharmacistOnly = g.action === "pharmacist" || g.kind === "medicine_unknown";
  // "look": Takal is not sure (or it is a small shop) - a person looks at
  // each product; there is no "Move all" for these.
  const lookOnly = g.action === "look";
  return (
    <div data-testid={`group-${g.key}`}
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-takal-line bg-white px-4 py-3.5 md:flex-nowrap">
      <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] text-[18px] font-black"
        style={{ background: look.bg, color: look.fg }}>{look.icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-extrabold text-takal-ink">{g.title}</h3>
        {g.reason && <p className="mt-0.5 text-[12.5px] text-[#555555]">{g.reason}</p>}
        {(g.from || g.to) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
            {g.from && <span className="rounded-lg bg-[#FDECEC] px-2 py-0.5 text-[#B71C1C]">{g.from}</span>}
            <span>→</span>
            {g.to && <span className="rounded-lg bg-[#E8F5E9] px-2 py-0.5 text-[#1F6F4A]">{g.to}</span>}
          </p>
        )}
        {(g.examples || []).length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {(g.examples || []).slice(0, 6).map((e) => (
              <span key={e} className="rounded-lg bg-[#F6F4EC] px-2 py-0.5 text-[12px] font-semibold text-takal-ink">{e}</span>
            ))}
          </p>
        )}
      </div>
      <div className="min-w-[90px] text-right">
        <p className="text-[28px] font-extrabold leading-none text-takal-ink">{g.count.toLocaleString()}</p>
        <p className="mt-1 text-[11.5px] font-semibold text-[#666666]">products</p>
      </div>
      <div className="flex flex-none flex-col gap-[7px]">
        {pharmacistOnly ? (
          <button type="button" onClick={onPharmacist} data-testid="upload-pharmacist"
            className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] border-2 border-black bg-white px-2.5 text-[12.5px] font-bold text-black hover:bg-takal-page">
            Upload pharmacist list
          </button>
        ) : g.done ? (
          <span className="inline-flex h-8 items-center rounded-[9px] border-2 border-[#1F6F4A] bg-[#E8F5E9] px-2.5 text-[12.5px] font-bold text-[#1F6F4A]">✓ Moved</span>
        ) : state.phase === "moved" ? (
          <span className="flex gap-2">
            <span className="inline-flex h-8 items-center whitespace-nowrap rounded-[9px] border-2 border-[#1F6F4A] bg-[#E8F5E9] px-2.5 text-[12.5px] font-bold text-[#1F6F4A]">
              {moveLabel(g, state)}
            </span>
            <button type="button" onClick={() => onUndo(state.batch)}
              className="inline-flex h-8 items-center rounded-[9px] border-2 border-black bg-white px-2.5 text-[12.5px] font-bold">Undo</button>
          </span>
        ) : (
          <>
            {!lookOnly && <button type="button" onClick={onMoveAll} disabled={state.phase === "moving"} data-testid="move-all"
              className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] border-2 px-2.5 text-[12.5px] font-bold transition ${
                state.phase === "moving"
                  ? "border-[#CFCFCF] bg-[#EDEDED] text-[#8A8A8A]"
                  : "border-[#1F6F4A] bg-[#1F6F4A] text-white hover:bg-[#14523A] active:translate-y-0.5 active:bg-[#14523A]"}`}>
              {state.phase === "moving" && (
                <span className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-[3px] border-[#BBBBBB] border-t-[#555555]" />
              )}
              {moveLabel(g, state)}
            </button>}
            <button type="button" onClick={onLook}
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] border-2 border-black bg-white px-2.5 text-[12.5px] font-bold text-black hover:bg-takal-page">
              Look one by one
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Look one by one ────────────────────────────────────────────────────────

function LookOneByOne({ g, onClose, onMoved }: { g: ShelfGroup; onClose: () => void; onMoved: () => void }) {
  const [items, setItems] = useState<ShelfCheckItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [to, setTo] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<ShelfOption[]>([]);
  const [saving, setSaving] = useState(false);
  const PAGE = 100;

  useEffect(() => {
    let alive = true;
    apiClient.getShelfTree().then((res) => { if (alive) setCats(shelfOptions(res)); }).catch(() => { /* the suggested shelf still shows */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed("");
    apiClient.getShelfCheckItems(g.key, offset, PAGE).then((res) => {
      if (!alive) return;
      const list = res?.items || [];
      setItems(list);
      setTotal(Number(res?.total || list.length));
      // Every product starts on its suggested shelf, ticked when Takal is sure.
      setTo((m) => { const n = { ...m }; for (const it of list) if (!(it.id in n)) n[it.id] = it.to_category_id || ""; return n; });
      setPicked((s) => { const n = new Set(s); for (const it of list) if (it.sure !== false && it.to_category_id) n.add(it.id); return n; });
    }).catch((e) => { if (alive) setFailed(e instanceof Error ? e.message : "The products could not be read"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [g.key, offset]);

  const chosen = items.filter((it) => picked.has(it.id) && to[it.id]);
  const move = async () => {
    setSaving(true);
    try {
      const res = await apiClient.moveShelfCheck({ items: chosen.map((it) => ({ id: it.id, to: to[it.id] })) });
      toast(`${Number(res?.moved || 0).toLocaleString()} products moved`, "success");
      onMoved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not move them", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xl" lockClose={saving}
      title={g.title}
      hint={`${total.toLocaleString()} products. Tick the ones to move; change a shelf where Takal is wrong. Every move can be undone.`}
      footer={
        <div className="flex w-full items-center gap-2">
          {total > PAGE && (
            <span className="text-sm text-takal-ink-soft">
              <button type="button" className="underline disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>‹ Back</button>
              {" "}{offset + 1}–{Math.min(offset + PAGE, total)} of {total.toLocaleString()}{" "}
              <button type="button" className="underline disabled:opacity-40" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next ›</button>
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button>
            <Button onClick={move} loading={saving} disabled={!chosen.length}>Move {chosen.length.toLocaleString()} chosen</Button>
          </span>
        </div>
      }>
      {loading ? <LoadingState /> : failed ? <p className="text-sm font-semibold text-takal-red">{failed}</p> : (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-bold uppercase tracking-wide text-[#666666]">
                <th className="px-2 py-2"><input type="checkbox" aria-label="Tick all"
                  checked={items.length > 0 && items.every((it) => picked.has(it.id))}
                  onChange={(e) => setPicked(e.target.checked ? new Set(items.map((it) => it.id)) : new Set())} /></th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Now on</th>
                <th className="px-2 py-2">Move to</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-[#F2F2EE] align-middle">
                  <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Move ${it.name}`} checked={picked.has(it.id)}
                    onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(it.id); else n.delete(it.id); return n; })} /></td>
                  <td className="px-2 py-1.5">
                    <b className="text-takal-ink">{it.name}</b>
                    {it.rx && <span className="ml-1.5 rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>}
                    {it.shop && <span className="block text-[11.5px] text-takal-ink-soft">{it.shop}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-takal-ink-soft">{it.from_shelf || "—"}</td>
                  <td className="w-[300px] px-2 py-1.5">
                    {cats.length ? (
                      <CategoryPicker options={cats} value={to[it.id] || ""} emptyLabel="Choose a shelf…" ariaLabel={`Shelf for ${it.name}`}
                        onChange={(id) => { setTo((m) => ({ ...m, [it.id]: id })); if (id) setPicked((s) => new Set(s).add(it.id)); }} />
                    ) : (
                      <span className="font-semibold text-takal-ink">{it.to_shelf || "Choose a shelf…"}</span>
                    )}
                    {it.sure === false && <span className="mt-0.5 block text-[11px] font-bold text-[#C25E00]">Not sure — please check</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ── The pharmacist's list ──────────────────────────────────────────────────

function PharmacistList({ g, onClose, onDone }: { g: ShelfGroup; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const words = useMemo(() => pharmacistWords(text), [text]);

  const send = async () => {
    setSending(true);
    try {
      const res = await apiClient.sendPharmacistList(words);
      toast(`${Number(res?.safe || 0).toLocaleString()} medicines are safe without a prescription · ${Number(res?.still_rx || 0).toLocaleString()} still need one`, "success");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The list could not be sent", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" lockClose={sending}
      title="Upload the pharmacist’s list"
      hint={`${g.count.toLocaleString()} medicines are waiting. A medicine on this list is sold without a prescription; every other medicine keeps the Rx mark (decision D2).`}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-sm text-takal-ink-soft">{words.length.toLocaleString()} name{words.length === 1 ? "" : "s"} read</span>
          <span className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button onClick={send} loading={sending} disabled={!words.length}>Send the list</Button>
          </span>
        </div>
      }>
      <p className="mb-2 text-sm text-takal-ink">
        One medicine per line - a name or a word, e.g. <b>Panadol</b>, <b>Brufen</b>, <b>ORS</b>, <b>vitamin</b>. A
        .txt or .csv file works too (the first column is read).
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} aria-label="Safe medicines"
        placeholder={"Panadol\nBrufen\nORS\nGaviscon"}
        className="w-full rounded-lg border-2 border-takal-line p-2 font-mono text-sm focus:border-takal-yellow focus:outline-none" />
      <input ref={file} type="file" accept=".txt,.csv" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); if (file.current) file.current.value = ""; }} />
      <Button variant="secondary" size="sm" className="mt-2" onClick={() => file.current?.click()}>Choose a file</Button>
    </Modal>
  );
}

// ── Undo history ───────────────────────────────────────────────────────────

function UndoHistory({ onClose, onUndone }: { onClose: () => void; onUndone: () => void }) {
  const [batches, setBatches] = useState<ShelfBatch[] | null>(null);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState("");

  const read = useCallback(() => {
    apiClient.getShelfCheckHistory().then((r) => setBatches(r?.batches || []))
      .catch((e) => setFailed(e instanceof Error ? e.message : "The history could not be read"));
  }, []);
  useEffect(() => { read(); }, [read]);

  const undo = async (b: ShelfBatch) => {
    setBusy(b.batch_id);
    try {
      const res = await apiClient.undoShelfCheck(b.batch_id);
      toast(`${Number(res?.put_back || 0).toLocaleString()} products put back`, "success");
      read();
      onUndone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not put them back", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Undo history"
      hint="Every move, newest first. Undo puts each product of that move back on the shelf it was on.">
      {failed ? <p className="text-sm font-semibold text-takal-red">{failed}</p> : !batches ? <LoadingState /> : batches.length === 0 ? (
        <EmptyState title="Nothing moved yet" message="Moves made on this page are listed here, with Undo." />
      ) : (
        <ul className="divide-y divide-[#F2F2EE]">
          {batches.map((b) => (
            <li key={b.batch_id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-takal-ink">{b.label || "Products moved"} · {b.count.toLocaleString()}</p>
                <p className="text-xs text-takal-ink-soft">
                  {whenLabel(b.moved_at)}{b.by ? ` · ${b.by}` : ""}
                  {b.undone_at ? ` · put back ${whenLabel(b.undone_at)}` : ""}
                </p>
              </div>
              {b.undone_at ? (
                <span className="text-xs font-bold text-takal-ink-soft">Put back</span>
              ) : (
                <Button variant="secondary" size="sm" loading={busy === b.batch_id} onClick={() => undo(b)}>Undo</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
