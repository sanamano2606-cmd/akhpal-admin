"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › PRODUCT SORTING › PHOTO CHECK.  (Mock 236, Sana 9 November 2026:
// "Approved".)
//
// Products whose photo does not match their name, store by store. The office
// fixes each one here: Rename, Change photo (or Add photo when it has none),
// It is correct. A fixed one can be put back with Undo. The vendor is never
// told - sub-admins added these stores.
//
// The list comes from the photo audit of 9 November 2026 and the weekly
// check. The server does every change (backend photo_checks.py); the rules
// for what this screen SHOWS are in lib/photo-check.ts, tested in
// tests/mock-236-photo-check.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { Button, EmptyState, ErrorState, LoadingState, Modal } from "@/components/ui";
import {
  SHOW_CHIPS, actionsFor, byStore, isOpen, nameProblem, picsFor, tagFor, wasName, weeklyWords,
  type PhotoCheckItem, type PhotoCheckList, type PhotoShow, type PhotoSuggestion,
} from "@/lib/photo-check";

const EMPTY: PhotoCheckList = { items: [], counts: { open: 0, fixed: 0, all: 0 }, stores: [], last_weekly: null };

function Pic({ src, removed, faint, red }: { src: string | null; removed?: boolean; faint?: boolean; red?: boolean }) {
  if (!src) {
    return (
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[10px] border-2 border-dashed border-takal-line bg-takal-page text-[11px] font-semibold text-takal-ink-soft">
        No photo
      </div>
    );
  }
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy"
        className={`h-[72px] w-[72px] rounded-[10px] object-cover ${red ? "ring-2 ring-inset ring-takal-red" : ""} ${faint ? "opacity-50 grayscale-[60%]" : ""}`} />
      {removed && (
        <span className="absolute bottom-1 left-1 rounded bg-takal-red px-1 text-[10px] font-bold text-white">removed</span>
      )}
    </div>
  );
}

export default function PhotoCheckPage() {
  const [data, setData] = useState<PhotoCheckList>(EMPTY);
  const [show, setShow] = useState<PhotoShow>("open");
  const [shop, setShop] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const [notYet, setNotYet] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ ids: string[]; name: string } | null>(null);
  const [photoFor, setPhotoFor] = useState<PhotoCheckItem | null>(null);

  // Every item once; the chips, the store box and the search filter here, so
  // pressing one never waits for the server.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.getPhotoChecks("all");
      setData(res || EMPTY);
      setNotYet(null);
    } catch (e: any) {
      if (e?.status === 501) setNotYet(e?.message || "Photo check is not switched on yet.");
      else setLoadError(readFailure(e, "the photo check"));
      setData(EMPTY);
    } finally {
      setLoading(false);
      setPicked(new Set());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.items.filter((i) =>
      (show === "all" || (show === "open" ? isOpen(i) : !isOpen(i)))
      && (!shop || i.shop_id === shop)
      && (!t || `${i.shop} ${i.name} ${i.old_name || ""}`.toLowerCase().includes(t)));
  }, [data.items, show, shop, q]);
  const cards = useMemo(() => byStore(shown), [shown]);

  const run = async (key: string, fn: () => Promise<any>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done, "success");
      await load();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "That did not work. Nothing was changed.", "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const saveRename = async () => {
    if (!renaming) return;
    const bad = nameProblem(renaming.name);
    if (bad) { toast(bad, "error"); return; }
    const ids = renaming.ids;
    const ok = ids.length === 1
      ? await run("rename", () => apiClient.renamePhotoCheck(ids[0], renaming.name), "Renamed")
      : await run("rename", async () => {
          const res = await apiClient.bulkPhotoCheck(ids, "rename", renaming.name);
          if (res?.failed?.length) toast(`${res.failed.length} not renamed: ${res.failed[0].why}`, "error");
        }, `${ids.length} renamed`);
    if (ok) setRenaming(null);
  };

  const markManyCorrect = () =>
    run("bulk", async () => {
      const res = await apiClient.bulkPhotoCheck([...picked], "correct");
      if (res?.failed?.length) toast(`${res.failed.length} not changed: ${res.failed[0].why}`, "error");
    }, `${picked.size} marked correct`);

  const shopName = data.stores.find((s) => s.id === shop)?.name;
  const weekly = weeklyWords(data.last_weekly);

  return (
    <div className="space-y-3 pb-20">
      <div className="flex flex-wrap items-center gap-2">
        {SHOW_CHIPS.map((c) => (
          <button key={c.key} type="button" onClick={() => { setShow(c.key); setPicked(new Set()); }}
            aria-pressed={show === c.key}
            className={`rounded-full border px-3 py-1.5 text-[13.5px] font-semibold ${c.tone} ${show === c.key ? "border-2 border-black bg-takal-yellow-soft" : "border-takal-line bg-white hover:border-black"}`}>
            {c.key !== "all" && <span aria-hidden="true">● </span>}{c.label(data.counts)}
          </button>
        ))}
        <span className="flex-1" />
        <select id="photo-check-store" aria-label="Store" value={shop} onChange={(e) => setShop(e.target.value)}
          className="w-full rounded-[10px] border border-takal-line bg-white px-3 py-2 text-[13.5px] sm:w-56">
          <option value="">All stores</option>
          {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}{s.open ? ` (${s.open})` : ""}</option>)}
        </select>
        <input id="photo-check-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search a store or product" aria-label="Search a store or product"
          className="w-full rounded-[10px] border border-takal-line bg-white px-3 py-2 text-[13.5px] sm:w-64" />
        <Button variant="primary" size="sm" onClick={load} disabled={loading}
          className="!bg-black !text-takal-yellow">Check again now</Button>
      </div>

      <div className="rounded-[14px] bg-takal-yellow px-4 py-3">
        <p className="text-[17px] font-bold text-takal-ink">Photo and name do not match</p>
        <p className="text-[13.5px] text-takal-ink">
          Found by {weekly ? `the weekly check (last: ${weekly})` : "the photo audit of 9 November 2026"} and by hand.
          Fix each one here: the vendor is not told.
        </p>
      </div>

      {loading ? <LoadingState label="Reading the photo check…" />
        : notYet ? <EmptyState title="Not switched on yet" message={notYet} />
        : loadError ? <ErrorState message={loadError.message} onRetry={load} denied={loadError.denied} />
        : cards.length === 0 ? (
          <EmptyState title={q || shop ? "Nothing matches" : show === "open" ? "Nothing needs work" : "Nothing here yet"}
            message={q || shop ? `Nothing in ${shopName || "this list"} matches "${q}".`
              : show === "open" ? "Every photo checked so far matches its name." : undefined} />
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <section key={c.id} className="overflow-hidden rounded-[14px] border border-takal-line bg-white">
                <h3 className="flex flex-wrap items-center gap-2 border-b border-takal-line bg-takal-page px-4 py-2.5 text-base font-bold text-takal-ink">
                  {c.name}
                  {c.open > 0 && <span className="rounded-full bg-takal-red-soft px-2 py-0.5 text-xs font-semibold text-takal-red">{c.open} need work</span>}
                  {c.fixed > 0 && <span className="rounded-full bg-takal-green-soft px-2 py-0.5 text-xs font-semibold text-takal-green">{c.fixed} fixed</span>}
                  <Link href={`/dashboard/stores/${c.id}?tab=products`} className="ml-auto text-[13px] font-semibold text-takal-blue hover:underline">Open store ›</Link>
                </h3>
                {c.items.map((i) => {
                  const pics = picsFor(i);
                  const tag = tagFor(i);
                  const was = wasName(i);
                  const on = picked.has(i.id);
                  return (
                    <div key={i.id} data-photo-check={i.id}
                      className={`grid grid-cols-[20px_auto_minmax(0,1fr)] items-center gap-3.5 border-t border-[#f0f0ea] px-4 py-3 first-of-type:border-t-0 xl:grid-cols-[20px_auto_minmax(0,1fr)_auto] ${on ? "bg-takal-yellow-soft shadow-[inset_4px_0_0_#000]" : "hover:bg-takal-blue-soft/40"}`}>
                      {isOpen(i)
                        ? <input type="checkbox" checked={on} onChange={() => toggle(i.id)} aria-label={`Tick ${i.name}`}
                            className="h-[18px] w-[18px] accent-black" />
                        : <span />}
                      <div className="flex items-center gap-1.5">
                        {pics.arrow && <Pic src={pics.old} removed={pics.removed} faint={pics.removed} red />}
                        {pics.arrow && <span className="text-takal-ink-soft" aria-hidden="true">→</span>}
                        <Pic src={pics.now} />
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="break-words text-[15px] font-bold text-takal-ink">{i.name}</span>
                        {was && <span className="break-words text-[12.5px] text-takal-ink-soft line-through">was: {was}</span>}
                        <span className="text-[13.5px] text-takal-ink">
                          <b className="font-semibold text-takal-red">{isOpen(i) ? "What is wrong:" : "What was wrong:"}</b> {i.why}
                        </span>
                        <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${tag.tone === "red" ? "bg-takal-red-soft text-takal-red" : "bg-takal-green-soft text-takal-green"}`}>
                          {tag.text}{!isOpen(i) && i.fixed_by ? ` · ${i.fixed_by}` : ""}
                        </span>
                      </div>
                      <div className="col-span-2 col-start-2 flex flex-wrap justify-start gap-1.5 xl:col-span-1 xl:col-start-auto xl:justify-end">
                        {actionsFor(i).map((a) => {
                          const label = { add_photo: "Add photo", rename: "Rename", change_photo: "Change photo", correct: "It is correct", undo: "Undo" }[a];
                          const yellow = a === "add_photo";
                          const click = () => {
                            if (a === "rename") setRenaming({ ids: [i.id], name: i.name });
                            else if (a === "add_photo" || a === "change_photo") setPhotoFor(i);
                            else if (a === "correct") run(i.id, () => apiClient.markPhotoCheckCorrect(i.id), "Marked correct");
                            else run(i.id, () => apiClient.undoPhotoCheck(i.id), "Put back as it was");
                          };
                          return (
                            <button key={a} type="button" onClick={click} disabled={busy !== null}
                              className={`whitespace-nowrap rounded-[10px] border-[1.5px] border-black px-3 py-2 text-[13.5px] font-semibold transition hover:-translate-y-px hover:shadow-[0_0_0_3px_#004E89] disabled:opacity-50 ${yellow ? "bg-takal-yellow" : "bg-white"}`}>
                              {busy === i.id && (a === "correct" || a === "undo") ? "Saving…" : label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}

      {picked.size > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-[14px] bg-black px-3.5 py-2.5 text-white">
          <b>{picked.size} selected</b>
          <button type="button" onClick={() => setRenaming({ ids: [...picked], name: "" })}
            className="rounded-[10px] border-[1.5px] border-white bg-white px-3 py-2 text-[13.5px] font-semibold text-black">Rename…</button>
          <button type="button" onClick={markManyCorrect} disabled={busy !== null}
            className="rounded-[10px] border-[1.5px] border-white bg-takal-yellow px-3 py-2 text-[13.5px] font-semibold text-black disabled:opacity-50">It is correct</button>
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto font-semibold text-takal-yellow">Clear</button>
        </div>
      )}

      <Modal open={renaming !== null} onClose={() => setRenaming(null)}
        title={renaming && renaming.ids.length > 1 ? `Rename ${renaming.ids.length} products` : "Rename"}
        hint="Write what the photo really shows. Example: “Green Embroidered Party Frock”."
        footer={<>
          <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
          <Button onClick={saveRename} disabled={busy !== null}>{busy === "rename" ? "Saving…" : "Save name"}</Button>
        </>}>
        <label htmlFor="photo-check-name" className="mb-1 block text-sm font-semibold">New name</label>
        <input id="photo-check-name" value={renaming?.name || ""} maxLength={150} autoFocus
          onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
          onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
          className="w-full rounded-[10px] border border-takal-line px-3 py-2" />
        {renaming && renaming.ids.length > 1 && (
          <p className="mt-2 text-[13px] text-takal-ink-soft">Every ticked product gets this same name.</p>
        )}
      </Modal>

      {photoFor && (
        <PhotoWindow item={photoFor} onClose={() => setPhotoFor(null)}
          onDone={async () => { setPhotoFor(null); await load(); }} />
      )}
    </div>
  );
}

function PhotoWindow({ item, onClose, onDone }: { item: PhotoCheckItem; onClose: () => void; onDone: () => void }) {
  const [suggest, setSuggest] = useState<PhotoSuggestion[] | null>(null);
  const [choice, setChoice] = useState<{ from?: string; file?: File; preview?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // A failed read is not "no photos found": it says so instead.
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const adding = item.problem === "no_photo";

  useEffect(() => {
    let live = true;
    apiClient.getPhotoCheckSuggestions(item.id)
      .then((r) => { if (live) setSuggest(r?.items || []); })
      .catch(() => { if (live) { setError(true); setSuggest([]); } });
    return () => { live = false; };
  }, [item.id]);

  // The panel's security header refuses blob: pictures, so the preview is a
  // data: picture (CLAUDE.md §84).
  const takeFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setChoice({ file: f, preview: String(r.result || "") });
    r.readAsDataURL(f);
  };

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    try {
      if (choice.file) {
        const up = await apiClient.uploadImage(choice.file);
        await apiClient.setPhotoCheckPhoto(item.id, { url: up.url });
      } else if (choice.from) {
        await apiClient.setPhotoCheckPhoto(item.id, { from_product: choice.from });
      }
      toast(adding ? "Photo added" : "Photo changed", "success");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The photo could not be saved. Nothing was changed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" lockClose={saving}
      title={`${adding ? "Add photo" : "Change photo"} · ${item.name}`}
      hint={`${item.shop} · the old photo is kept, so you can undo.`}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={!choice || saving}>{saving ? "Saving…" : "Use this photo"}</Button>
      </>}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); takeFile(e.dataTransfer.files?.[0]); }}
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm ${choice?.file ? "border-black bg-takal-yellow-soft" : "border-[#bbb]"}`}>
        {choice?.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={choice.preview} alt="Chosen photo" className="mx-auto mb-2 h-28 w-28 rounded-lg object-cover" />
        ) : null}
        Drop a photo here, or{" "}
        <button type="button" className="font-semibold underline" onClick={() => fileRef.current?.click()}>choose a file</button>
        <br /><small className="text-takal-ink-soft">Best: a real photo taken in the shop</small>
        <input ref={fileRef} id="photo-check-file" type="file" accept="image/*" className="hidden"
          onChange={(e) => takeFile(e.target.files?.[0])} />
      </div>
      <p className="mb-2 mt-4 text-[13.5px] font-semibold">Or use a photo already in Takal that shows the same thing</p>
      {suggest === null ? <LoadingState label="Looking for photos…" />
        : error ? <p className="text-[13px] text-takal-red">Could not look for photos just now. You can still choose a file.</p>
        : suggest.length === 0 ? <p className="text-[13px] text-takal-ink-soft">No product in Takal has a name close enough.</p>
        : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {suggest.map((s) => {
              const on = choice?.from === s.product_id;
              return (
                <button key={s.product_id} type="button" onClick={() => setChoice({ from: s.product_id })}
                  aria-pressed={on}
                  className={`rounded-[10px] border p-1.5 text-left text-[11px] ${on ? "border-[2.5px] border-black bg-takal-yellow-soft" : "border-takal-line hover:border-black"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photo} alt="" className="aspect-square w-full rounded-md object-cover" />
                  <span className="mt-1 block font-semibold leading-tight">{s.name}</span>
                  <span className="block text-takal-ink-soft">{s.shop}</span>
                </button>
              );
            })}
          </div>
        )}
      <p className="mt-3 rounded border-l-[3px] border-takal-orange bg-takal-orange-soft px-2.5 py-2 text-[12.5px]">
        Pick only a photo that really shows <b>{item.name}</b>. If none does, a product with no photo is better than a wrong one.
      </p>
    </Modal>
  );
}
