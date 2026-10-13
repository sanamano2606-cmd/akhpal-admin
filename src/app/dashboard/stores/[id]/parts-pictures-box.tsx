"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE PICTURES BOX.  (Mock 187, approved by Sana 13 October 2026: "i want the
// picture upload easier as much as you can, direct from the product list.")
//
// Click a product's picture in the list and this opens - ONLY its pictures,
// big, with nothing else to scroll past:
//   * add many at once: the + square, a drop anywhere on the box, or Ctrl+V
//     of a copied picture (or of a picture's https link);
//   * drag to change the order, ★ Make cover, ✕ remove (with Undo);
//   * EVERY CHANGE SAVES BY ITSELF - there is no Save button to forget.
//
// Safe with a picture imported from a spreadsheet (lib/product-pictures.ts):
// it is shown as photo 1 and never lost by adding another.
//
// Changes go one after another, never two at once: the server's photo list
// REPLACES what was there, so two overlapping saves could finish in the wrong
// order and leave the older list behind.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Pencil, RotateCcw, Star, UploadCloud, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDialogKeys } from "@/components/ui";
import { isPictureLink, makeCover, movePhoto } from "@/lib/photo-order";
import {
  picturesOf, sendPictures, splitPictures, withAdded, withRemoved,
} from "@/lib/product-pictures";

type Saving = "idle" | "saving" | "saved" | "failed";

export function PicturesBox({
  product,
  onClose,
  onChanged,
  onOpenEditor,
  startWithLink = false,
}: {
  product: { id: string; name: string };
  onClose: () => void;
  /** After every save: the list row shows the new cover and count. */
  onChanged: (list: string[]) => void;
  /** "Name, description, options" - the full ✏️ Edit form. */
  onOpenEditor: () => void;
  /** Opened from "Paste a picture link": the link box is ready to type in. */
  startWithLink?: boolean;
}) {
  const [list, setList] = useState<string[]>([]);
  const listRef = useRef<string[]>([]);
  const imported = useRef<string | null>(null);
  const [read, setRead] = useState<"loading" | "ok" | "failed">("loading");
  const [readKey, setReadKey] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState<Saving>("idle");
  const [retry, setRetry] = useState<string[] | null>(null);
  const [undo, setUndo] = useState<{ list: string[]; words: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [filesOver, setFilesOver] = useState(false);
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useDialogKeys(true, onClose, uploading > 0);

  // ── Read what the product REALLY has (never trust the list row) ──────────
  useEffect(() => {
    let gone = false;
    setRead("loading");
    (async () => {
      try {
        const full = (await apiClient.getProduct(String(product.id))) as any;
        if (gone) return;
        const r = picturesOf(full);
        imported.current = r.imported;
        listRef.current = r.list;
        setList(r.list);
        setRead("ok");
      } catch {
        // A list this box could not read is NEVER sent back: sending it would
        // replace the real photos with nothing.
        if (!gone) setRead("failed");
      }
    })();
    return () => { gone = true; };
  }, [product.id, readKey]);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // ── The one way a change is saved ────────────────────────────────────────
  const commit = useCallback((next: string[], undoWords?: string) => {
    const before = listRef.current;
    listRef.current = next;
    setList(next);
    if (undoWords) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({ list: before, words: undoWords });
      undoTimer.current = setTimeout(() => setUndo(null), 8000);
    }
    chain.current = chain.current.then(async () => {
      setSaving("saving");
      try {
        await sendPictures(apiClient, String(product.id), next, imported.current);
        // From now on the imported picture is either in the list or removed.
        imported.current = null;
        setRetry(null);
        setSaving("saved");
        onChanged(next);
      } catch (err) {
        setRetry(next);
        setSaving("failed");
        toast(err instanceof Error ? err.message : "The pictures were not saved - try again", "error");
      }
    });
  }, [product.id, onChanged]);

  // ── Adding: files (picked, dropped or pasted) and links ──────────────────
  const addFiles = useCallback(async (files: File[]) => {
    if (read !== "ok") return;
    const { ok, notPictures } = splitPictures(files);
    if (notPictures.length) toast(`${notPictures.join(", ")} - not a picture, left out`, "error");
    if (!ok.length) return;
    setUploading((n) => n + ok.length);
    const urls: string[] = [];
    for (const f of ok) {
      try {
        // uploadImage shrinks a big photo first and applies the server's own
        // size limit (lib/picture-upload.ts) - one too-big photo is named and
        // the others still go.
        const up = await apiClient.uploadImage(f);
        if (up?.url) urls.push(up.url);
      } catch (err) {
        toast(`${f.name}: ${err instanceof Error ? err.message : "could not be uploaded"}`, "error");
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
    if (urls.length) commit(withAdded(listRef.current, urls));
  }, [read, commit]);

  const addLink = (text: string) => {
    const t = text.trim();
    if (!isPictureLink(t)) {
      toast("Paste a full picture address that starts with https://", "error");
      return false;
    }
    commit(withAdded(listRef.current, [t]));
    return true;
  };

  // Ctrl+V anywhere while the box is open: a copied picture, or its link.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;   // typing a link
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) { e.preventDefault(); addFiles(files); return; }
      const text = e.clipboardData?.getData("text") || "";
      if (/^https?:\/\//i.test(text.trim())) { e.preventDefault(); addLink(text); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // addLink only calls commit, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addFiles, commit]);

  const ready = read === "ok";
  useEffect(() => { if (ready && startWithLink) linkRef.current?.focus(); }, [ready, startWithLink]);
  const busy = uploading > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog" aria-modal="true" aria-label={`Pictures of ${product.name}`}
        data-pictures-box
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { if (ready && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setFilesOver(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setFilesOver(false); }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setFilesOver(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`relative w-full max-w-[760px] max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border-[1.5px] ${
          filesOver ? "border-takal-blue ring-4 ring-takal-blue-soft" : "border-takal-ink"}`}
      >
        {/* ── Heading ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[21px] font-bold text-takal-ink leading-tight truncate">
              Pictures · <span className="font-extrabold">{product.name}</span>
            </h2>
            <p className="mt-1 text-[13px] text-takal-ink-soft">
              The first is the cover customers see. Drag to change the order. <b>Every change saves by itself.</b>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving === "saving" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F3F3] px-3 py-1 text-[12.5px] font-bold text-takal-ink-soft">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </span>
            )}
            {saving === "saved" && (
              <span data-saved className="inline-flex items-center gap-1.5 rounded-full bg-takal-green-soft px-3 py-1 text-[12.5px] font-bold text-takal-green">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {saving === "failed" && retry && (
              <button type="button" onClick={() => commit(retry)}
                className="inline-flex items-center gap-1.5 rounded-full bg-takal-red-soft px-3 py-1 text-[12.5px] font-bold text-takal-red hover:underline">
                <RotateCcw className="w-3.5 h-3.5" /> Not saved - try again
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-takal-ink-soft hover:bg-takal-page disabled:opacity-40">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── The pictures ── */}
        {read === "loading" && (
          <div className="mt-5 flex gap-3.5">
            {[0, 1, 2].map((k) => <div key={k} className="w-[124px] h-[124px] rounded-2xl bg-[#F1F1EC] animate-pulse" />)}
          </div>
        )}
        {read === "failed" && (
          <div className="mt-5 rounded-xl border-[1.5px] border-takal-red bg-takal-red-soft px-4 py-3 text-[13.5px] text-takal-red">
            <b>This product&apos;s pictures could not be read just now.</b> Nothing was changed.{" "}
            <button type="button" onClick={() => setReadKey((k) => k + 1)} className="font-bold underline">Try again</button>
          </div>
        )}
        {ready && (
          <div className="mt-5 flex flex-wrap gap-3.5">
            {list.map((url, i) => (
              <div
                key={`${url}-${i}`}
                draggable
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); e.stopPropagation(); setDragOver(i); } }}
                onDrop={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault(); e.stopPropagation();
                  if (dragFrom !== i) commit(movePhoto(listRef.current, dragFrom, i));
                  setDragFrom(null); setDragOver(null);
                }}
                title={i === 0 ? "The cover" : "Drag to move"}
                className={`group relative w-[124px] h-[124px] rounded-2xl cursor-grab bg-[#F6F6F2] ${
                  dragFrom === i ? "opacity-35 border-2 border-dashed border-[#999999]"
                    : dragOver === i ? "border-[2.5px] border-dashed border-takal-blue"
                      : i === 0 ? "border-2 border-takal-ink" : "border border-takal-line hover:ring-[3px] hover:ring-takal-yellow"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Picture ${i + 1}`} draggable={false} className="w-full h-full object-cover rounded-[14px]" />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 text-[11px] font-extrabold text-takal-ink-soft">⠿ {i + 1}</span>
                {i === 0 ? (
                  <span className="absolute inset-x-0 bottom-0 rounded-b-[14px] bg-takal-ink py-1 text-center text-[11px] font-extrabold text-takal-yellow">★ Cover</span>
                ) : (
                  <button type="button" onClick={() => commit(makeCover(listRef.current, i))}
                    className="absolute inset-x-0 bottom-0 rounded-b-[14px] bg-white/95 py-1 text-center text-[11px] font-bold text-takal-ink border-t border-takal-line hover:bg-takal-yellow">
                    <Star className="inline w-3 h-3 -mt-0.5" /> Make cover
                  </button>
                )}
                <button type="button"
                  onClick={() => commit(withRemoved(listRef.current, i), `Picture ${i + 1} removed.`)}
                  aria-label={`Remove picture ${i + 1}`} title="Remove"
                  className="absolute -right-2 -top-2 w-7 h-7 rounded-full bg-takal-red text-white border-2 border-white flex items-center justify-center shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, k) => (
              <div key={`up-${k}`} aria-label="Uploading"
                className="w-[124px] h-[124px] rounded-2xl border-2 border-takal-line bg-[#F6F6F2] flex flex-col items-center justify-center gap-2 text-[11.5px] font-bold text-takal-ink-soft">
                <Loader2 className="w-7 h-7 animate-spin text-takal-green" /> Uploading…
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-[124px] h-[124px] rounded-2xl border-[2.5px] border-dashed border-[#C9C600] bg-takal-yellow-soft text-[#5A5800] flex flex-col items-center justify-center gap-1 hover:bg-takal-yellow hover:border-solid transition">
              <ImagePlus className="w-7 h-7" />
              <span className="text-[13px] font-extrabold">Add photos</span>
              <span className="text-[11px] font-semibold">many at once</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; addFiles(fs); }} />
          </div>
        )}

        {ready && (
          <>
            {filesOver && (
              <div className="mt-4 rounded-xl border-[2.5px] border-dashed border-takal-blue bg-takal-blue-soft py-3 text-center text-[13.5px] font-extrabold text-takal-blue">
                <UploadCloud className="inline w-4 h-4 -mt-0.5" /> Drop them here - all of them are added
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <input ref={linkRef} value={link} onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (addLink(link)) setLink(""); } }}
                placeholder="or paste a link to a picture  https://…" aria-label="Link to a picture"
                className="flex-1 min-w-[220px] rounded-xl border-[1.5px] border-takal-line px-3.5 py-2.5 text-[14px] focus:border-takal-ink focus:outline-none" />
              <button type="button" onClick={() => { if (addLink(link)) setLink(""); }}
                className="rounded-xl bg-takal-yellow px-4 py-2.5 text-[14px] font-extrabold text-takal-ink hover:bg-takal-yellow-dark">
                Add this picture
              </button>
            </div>
            <p className="mt-2 text-[12px] text-takal-ink-soft">
              Tip: copy a picture anywhere and press <b>Ctrl+V</b> here. Or drop photos from a folder onto this box.
            </p>
          </>
        )}

        {undo && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-takal-ink px-4 py-2.5 text-[13.5px] font-bold text-white">
            <span>{undo.words}</span>
            <button type="button" onClick={() => { commit(undo.list); setUndo(null); }}
              className="font-extrabold text-takal-yellow hover:underline">Undo</button>
          </div>
        )}

        {/* ── The rest of the product ── */}
        <div className="mt-5 pt-4 border-t border-takal-line flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onOpenEditor} disabled={busy}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-takal-ink-soft hover:text-takal-ink disabled:opacity-40">
            <Pencil className="w-3.5 h-3.5" /> Name, description, options - open Edit
          </button>
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-xl bg-takal-ink px-5 py-2.5 text-[14px] font-extrabold text-takal-yellow disabled:opacity-40">
            {busy ? "Uploading…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
