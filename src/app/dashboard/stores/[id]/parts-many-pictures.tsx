// ─────────────────────────────────────────────────────────────────────────────
// "MANY PICTURES" - A WHOLE FOLDER OF PHOTOS AT ONCE.
// (Mock 132 picture E, approved by Sana 30 September 2026. Step 4.)
//
//   1. Choose photos (or a whole folder).
//   2. Check the matches. Each photo is matched to a product by its FILE NAME
//      (src/lib/picture-match.ts). NOTHING is saved yet. Photos that are not
//      certain wait for a person to pick the product.
//   3. Upload - three at a time, with a count. If the server says "slow
//      down" (60 pictures a minute per person), it waits and carries on.
//
// A product that already has a picture is skipped - see picture-match.ts for
// why. The page must stay open while photos go up; closing it is warned about.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, ImagePlus, Loader2, UploadCloud, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/ui";
import {
  makeMatcher, positionsFor, type NameEntry, type PhotoPlan,
} from "@/lib/picture-match";

const MAX_FILES = 3000;
const AT_ONCE = 3;
const WAIT_WHEN_BUSY_MS = 15_000;
const BUSY_RETRIES = 8;
const SHOWN_MATCHED = 60;

type Row = {
  key: number;
  file: File;
  plan: PhotoPlan;
  productId: string | null;
  productName: string;
  picked: boolean;              // a person chose the product
  status: "waiting" | "going" | "done" | "failed";
  error?: string;
  /** Its place in the product's photo list, fixed the first time it is sent,
   *  so "try again" puts a photo back where it belonged. */
  position?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A small picture of the file, made only while it is on screen.
 *
 *  NOT a blob: address. The panel's security header (next.config.js) allows
 *  pictures from 'self', data: and https: only, so a blob: preview is simply
 *  refused - found by building the panel and looking at it, 30 Sep 2026.
 *  The photo is drawn at 88 px and turned into a tiny data: picture instead,
 *  which also keeps a folder of 3,000 large photos from filling the memory. */
function Thumb({ file }: { file: File }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bmp = await createImageBitmap(file);
        const side = 88;
        const k = Math.max(side / bmp.width, side / bmp.height);
        const c = document.createElement("canvas");
        c.width = side; c.height = side;
        const g = c.getContext("2d");
        if (!g) return;
        g.drawImage(bmp, (side - bmp.width * k) / 2, (side - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
        bmp.close?.();
        if (alive) setSrc(c.toDataURL("image/jpeg", 0.7));
      } catch {
        // A file the browser cannot draw keeps the plain grey square. The
        // server decides whether it is a picture; this is only a preview.
      }
    })();
    return () => { alive = false; };
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-takal-page" />;
}

export function ManyPicturesDialog({
  restaurantId,
  shopName,
  open,
  onClose,
}: {
  restaurantId: string;
  shopName?: string;
  open: boolean;
  /** `changed` - at least one picture was added, so the list should be read again. */
  onClose: (changed: boolean) => void;
}) {
  const [step, setStep] = useState<"choose" | "check" | "upload">("choose");
  const [names, setNames] = useState<NameEntry[] | null>(null);
  const [namesError, setNamesError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const stopRef = useRef(false);
  const changedRef = useRef(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // Fresh names every time the window opens - see getProductsForPictures.
  useEffect(() => {
    if (!open) return;
    setStep("choose"); setRows([]); setFinished(false); setNames(null); setNamesError("");
    stopRef.current = false; changedRef.current = false;
    let alive = true;
    apiClient.getProductsForPictures(restaurantId)
      .then((d) => { if (alive) setNames(d.items || []); })
      .catch((e) => { if (alive) setNamesError(e instanceof Error ? e.message : "The product names could not be read."); });
    return () => { alive = false; };
  }, [open, restaurantId]);

  // Leaving the page while photos are going up would stop them half way.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const withoutPicture = useMemo(() => (names || []).filter((n) => !n.has_picture), [names]);
  // The words a person types to pick a product. A name two products share gets
  // a short tail so the two can be told apart.
  const pickLabel = useMemo(() => {
    const count = new Map<string, number>();
    withoutPicture.forEach((n) => count.set(n.name, (count.get(n.name) || 0) + 1));
    const out = new Map<string, string>();
    withoutPicture.forEach((n) => out.set(n.id, (count.get(n.name) || 0) > 1 ? `${n.name} (#${n.id.slice(0, 4)})` : n.name));
    return out;
  }, [withoutPicture]);
  const byLabel = useMemo(() => {
    const m = new Map<string, NameEntry>();
    withoutPicture.forEach((n) => m.set(pickLabel.get(n.id)!, n));
    return m;
  }, [withoutPicture, pickLabel]);

  const chosen = (list: FileList | null) => {
    if (!list || !names) return;
    let files = Array.from(list);
    if (files.length > MAX_FILES) {
      toast(`${files.length.toLocaleString()} files chosen - the first ${MAX_FILES.toLocaleString()} are used`, "error");
      files = files.slice(0, MAX_FILES);
    }
    const match = makeMatcher(names);
    setRows(files.map((file, key) => {
      const plan = match(file.name, file.type);
      return {
        key, file, plan,
        productId: plan.kind === "matched" ? plan.productId : null,
        productName: plan.kind === "matched" || plan.kind === "already" ? plan.productName : "",
        picked: false, status: "waiting",
      };
    }));
    setStep("check");
  };

  const pick = (key: number, p: NameEntry | null) =>
    setRows((rs) => rs.map((r) => (r.key === key
      ? { ...r, productId: p ? p.id : null, productName: p ? p.name : "", picked: !!p }
      : r)));

  const toUpload = rows.filter((r) => r.productId && (r.plan.kind === "matched" || r.picked));
  const needYou = rows.filter((r) => r.plan.kind === "pick" && !r.productId);
  const already = rows.filter((r) => r.plan.kind === "already");
  const notPictures = rows.filter((r) => r.plan.kind === "not_picture");
  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "failed");

  // ── The upload runner - the ONLY place in this window that writes. ───────
  const uploadOne = async (row: Row, position: number): Promise<void> => {
    setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, status: "going", error: undefined } : r)));
    try {
      let url = "";
      for (let tries = 0; ; tries += 1) {
        try {
          const up = await apiClient.uploadImage(row.file);
          url = up?.url || "";
          break;
        } catch (err) {
          // "Slow down" is not a failure: wait, then carry on by itself.
          if ((err as any)?.status === 429 && tries < BUSY_RETRIES && !stopRef.current) {
            await sleep(WAIT_WHEN_BUSY_MS);
            continue;
          }
          throw err;
        }
      }
      if (!url) throw new Error("The picture did not upload");
      await apiClient.addProductPhoto(row.productId!, url, position);
      changedRef.current = true;
      setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, status: "done" } : r)));
    } catch (err) {
      setRows((rs) => rs.map((r) => (r.key === row.key
        ? { ...r, status: "failed", error: err instanceof Error ? err.message : "Could not be uploaded" }
        : r)));
    }
  };

  const runAll = async (given: Row[]) => {
    // First time: the first photo of each product is its cover (0), then 1,
    // 2 ... A retried photo keeps the place it was given the first time.
    const fresh = positionsFor(given.map((r) => r.productId));
    const list = given.map((r, i) => ({ ...r, position: r.position ?? fresh[i] ?? 0 }));
    const placed = new Map(list.map((r) => [r.key, r.position]));
    setRows((rs) => rs.map((r) => (placed.has(r.key) ? { ...r, position: placed.get(r.key) } : r)));
    stopRef.current = false;
    setRunning(true);
    setFinished(false);
    setStep("upload");
    let next = 0;
    const worker = async () => {
      while (!stopRef.current && next < list.length) {
        const i = next;
        next += 1;
        await uploadOne(list[i], list[i].position ?? 0);
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, list.length) }, worker));
    setRunning(false);
    setFinished(true);
  };
  // ── end of upload runner ──

  const retryFailed = () => {
    runAll(rows.filter((r) => r.status === "failed"));
  };

  const close = () => {
    if (running) { toast("Pictures are still going up - press Stop first", "error"); return; }
    onClose(changedRef.current);
  };

  const pct = toUpload.length ? Math.round(((done + failed.length) / toUpload.length) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      lockClose={running}
      title={<span className="inline-flex items-center gap-2"><ImagePlus className="w-5 h-5" /> Many pictures{shopName ? ` — ${shopName}` : ""}</span>}
      hint={
        <span className="inline-flex flex-wrap gap-1.5 mt-1">
          {(["choose", "check", "upload"] as const).map((s, i) => {
            const now = step === s;
            const past = ["choose", "check", "upload"].indexOf(step) > i;
            return (
              <span key={s} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${now ? "bg-takal-yellow text-black" : past ? "bg-takal-green-soft text-takal-green" : "bg-[#F0F0F0] text-takal-ink-soft"}`}>
                {i + 1} {s === "choose" ? "Choose photos" : s === "check" ? "Check the matches" : "Upload"}{past ? " ✓" : ""}
              </span>
            );
          })}
        </span>
      }
      footer={
        step === "check" ? (
          <div className="flex items-center gap-3">
            <button onClick={() => { setRows([]); setStep("choose"); }} className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">‹ Back</button>
            <span className="ml-auto text-sm text-takal-ink-soft">
              {toUpload.length.toLocaleString()} ready{needYou.length ? ` · ${needYou.length.toLocaleString()} waiting for you` : ""}
            </span>
            <button onClick={() => runAll(toUpload)} disabled={!toUpload.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink hover:bg-takal-yellow-dark disabled:opacity-40">
              <UploadCloud className="w-4 h-4" /> Upload {toUpload.length.toLocaleString()} picture{toUpload.length === 1 ? "" : "s"}
            </button>
          </div>
        ) : step === "upload" ? (
          <div className="flex items-center gap-3">
            {running ? (
              <button onClick={() => { stopRef.current = true; }} className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Stop after these</button>
            ) : failed.length ? (
              <button onClick={retryFailed} className="rounded-lg border-2 border-takal-yellow px-4 py-2 font-bold hover:bg-takal-yellow-soft">Try the {failed.length} failed again</button>
            ) : null}
            <button onClick={close} disabled={running}
              className="ml-auto rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink hover:bg-takal-yellow-dark disabled:opacity-40">
              {running ? "Uploading…" : "Done"}
            </button>
          </div>
        ) : undefined
      }
    >
      {/* ── 1. Choose ── */}
      {step === "choose" && (
        <div className="space-y-3">
          {namesError && (
            <div role="alert" className="rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
              {namesError} Close this window and open it again.
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); chosen(e.dataTransfer.files); }}
            className="rounded-2xl border-2 border-dashed border-[#C9C600] bg-takal-yellow-soft px-6 py-10 text-center"
          >
            <UploadCloud className="mx-auto w-10 h-10 text-[#6B6900]" />
            <p className="mt-2 font-bold text-takal-ink">Drop photos here</p>
            <p className="text-sm text-takal-ink-soft">
              Name each photo after its product - <b>coca-cola-1.5L.jpg</b> goes to “Coca Cola 1.5 L”.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button disabled={!names} onClick={() => filesRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-takal-yellow px-4 py-2.5 text-sm font-bold text-black shadow-[0_2px_0_#C9C900] disabled:opacity-40">
                <ImagePlus className="w-4 h-4" /> Choose photos
              </button>
              <button disabled={!names} onClick={() => folderRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-takal-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                <FolderOpen className="w-4 h-4" /> Choose a folder
              </button>
            </div>
            {!names && !namesError && (
              <p className="mt-3 text-xs text-takal-ink-soft"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> Reading this store&apos;s product names…</p>
            )}
            {names && (
              <p className="mt-3 text-xs text-takal-ink-soft">
                {withoutPicture.length.toLocaleString()} of {names.length.toLocaleString()} products have no picture yet.
                Products that already have one are skipped.
              </p>
            )}
          </div>
          <input ref={filesRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { chosen(e.target.files); e.target.value = ""; }} />
          <input ref={folderRef} type="file" multiple className="hidden"
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => { chosen(e.target.files); e.target.value = ""; }} />
        </div>
      )}

      {/* ── 2. Check ── */}
      {step === "check" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              { n: rows.filter((r) => r.plan.kind === "matched").length, label: "matched by file name", look: "bg-takal-green-soft border-[#BFE0CF] text-takal-green" },
              { n: needYou.length, label: "need you to pick the product", look: "bg-takal-orange-soft border-[#FFC7B0] text-[#C8410F]" },
              { n: already.length, label: "product already has a picture - skipped", look: "bg-[#F4F4F4] border-takal-line text-takal-ink-soft" },
              { n: notPictures.length, label: "not a picture - skipped", look: "bg-takal-red-soft border-[#F4BCC2] text-takal-red" },
            ].map((t) => (
              <div key={t.label} className={`rounded-xl border-[1.5px] px-3.5 py-2.5 ${t.look}`}>
                <b className="block text-2xl">{t.n.toLocaleString()}</b>
                <small className="text-xs text-takal-ink-soft">{t.label}</small>
              </div>
            ))}
          </div>

          <datalist id="many-pictures-products">
            {withoutPicture.map((n) => <option key={n.id} value={pickLabel.get(n.id)} />)}
          </datalist>

          <div className="max-h-[48vh] overflow-y-auto rounded-xl border border-takal-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                <tr><th className="px-3 py-2">Photo</th><th className="px-3 py-2">File name</th><th className="px-3 py-2">Goes to product</th><th className="px-3 py-2">What happens</th></tr>
              </thead>
              <tbody>
                {/* The ones that need a person come first. */}
                {rows.filter((r) => r.plan.kind === "pick").map((r) => (
                  <tr key={r.key} className={r.productId ? "" : "bg-takal-yellow-soft"}>
                    <td className="px-3 py-1.5"><Thumb file={r.file} /></td>
                    <td className="px-3 py-1.5 font-mono text-[12.5px] break-all">{r.file.name}</td>
                    <td className="px-3 py-1.5">
                      <input list="many-pictures-products" placeholder="Type a product name…"
                        defaultValue={r.productId ? pickLabel.get(r.productId) : ""}
                        onChange={(e) => pick(r.key, byLabel.get(e.target.value) || null)}
                        className="w-full max-w-[280px] rounded-lg border-2 border-takal-ink px-2.5 py-1.5 text-sm outline-none focus:shadow-[0_0_0_3px_#FFFF00]"
                        aria-label={`Product for ${r.file.name}`} />
                      {r.plan.kind === "pick" && r.plan.candidates.length > 0 && !r.productId && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.plan.candidates.map((c) => (
                            <button key={c.id} onClick={() => pick(r.key, c)}
                              className="rounded-full border border-takal-line bg-white px-2 py-0.5 text-xs hover:border-takal-ink">
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.productId
                        ? <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-bold text-takal-green">✓ {r.productName}</span>
                        : <span className="rounded-full bg-takal-orange-soft px-2.5 py-0.5 text-xs font-bold text-[#C8410F]">
                            {r.plan.kind === "pick" && r.plan.candidates.length ? `Pick one of ${r.plan.candidates.length}` : "Pick the product"}
                          </span>}
                    </td>
                  </tr>
                ))}
                {rows.filter((r) => r.plan.kind === "matched").slice(0, SHOWN_MATCHED).map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5"><Thumb file={r.file} /></td>
                    <td className="px-3 py-1.5 font-mono text-[12.5px] break-all">{r.file.name}</td>
                    <td className="px-3 py-1.5 font-semibold">{r.productName}</td>
                    <td className="px-3 py-1.5"><span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-bold text-takal-green">✓ Matched</span></td>
                  </tr>
                ))}
                {rows.filter((r) => r.plan.kind === "matched").length > SHOWN_MATCHED && (
                  <tr><td colSpan={4} className="px-3 py-2 text-center text-xs text-takal-ink-soft">
                    …and {(rows.filter((r) => r.plan.kind === "matched").length - SHOWN_MATCHED).toLocaleString()} more matched
                  </td></tr>
                )}
                {[...already, ...notPictures].slice(0, 30).map((r) => (
                  <tr key={r.key} className="text-takal-ink-soft">
                    <td className="px-3 py-1.5">{r.plan.kind === "not_picture" ? <XCircle className="w-6 h-6 text-takal-red" /> : <Thumb file={r.file} />}</td>
                    <td className="px-3 py-1.5 font-mono text-[12.5px] break-all">{r.file.name}</td>
                    <td className="px-3 py-1.5">{r.productName || "—"}</td>
                    <td className="px-3 py-1.5 text-xs">{r.plan.kind === "already" ? "Already has a picture - skipped" : "Not a picture - skipped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-takal-ink-soft">
            Nothing is saved until you press Upload. A product that already has a picture keeps it -
            add more photos to it from its own editor.
          </p>
        </div>
      )}

      {/* ── 3. Upload ── */}
      {step === "upload" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            {running ? <Loader2 className="w-5 h-5 animate-spin text-takal-green" /> : <CheckCircle2 className="w-5 h-5 text-takal-green" />}
            <b>{(done + failed.length).toLocaleString()} of {toUpload.length.toLocaleString()}</b> done
            <span className="text-takal-ink-soft">· {done.toLocaleString()} added{failed.length ? ` · ${failed.length} failed` : ""}</span>
            <b className="ml-auto text-takal-green">{pct}%</b>
          </div>
          <div className="h-3 rounded-full border border-[#E4DF7E] bg-takal-yellow-soft overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-takal-green to-[#2FA36B] transition-all" style={{ width: `${pct}%` }} />
          </div>
          {running && (
            <p className="text-xs text-takal-ink-soft">
              Keep this page open until it finishes. If the server asks to slow down, it waits a moment and carries on by itself.
            </p>
          )}
          {!running && finished && (
            <p className="text-sm font-semibold text-takal-green">
              {done.toLocaleString()} picture{done === 1 ? "" : "s"} added. The products list will show them when you press Done.
            </p>
          )}
          {failed.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#F4BCC2] bg-takal-red-soft p-3 text-sm">
              <b className="text-takal-red">Not added:</b>
              <ul className="mt-1 space-y-0.5">
                {failed.map((r) => (
                  <li key={r.key}><span className="font-mono text-[12.5px]">{r.file.name}</span> → {r.productName}: {r.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
