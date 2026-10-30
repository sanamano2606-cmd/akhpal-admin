// READ THE WRITING ON A PICTURE, AND SAY IF THE PICTURE IS POOR  (Mock 215-2
// and 215-4, Sana 28 Oct 2026: "Can The shop logo be detected auto and
// highlighted when there is website or phone number" ... "Add 11, 9, 8, 1, 4").
//
// Runs IN THE REVIEWER'S BROWSER - on the review page, and (migration 152)
// quietly in the background for new product pictures
// (hooks/useBackgroundPictureReader) - so the server (0.5 of a CPU) and the
// apps are never slowed, and it costs nothing. The reading
// files (about 7 MB, once, then kept by the browser) are the panel's own, in
// public/ocr - nothing is fetched from anybody else.
//
// Tested on all 92 real logos (28 Oct 2026): it found 11 of the 13 that carry
// a phone number (Irfan Jewellers, Khyber Chemical, Hassan Tent, Horain
// Traders ...); the 2 it missed have tiny writing in a night photo. It is a
// helper: the reviewer still looks.
//
// What it gives back for a picture:
//   hits    - phone numbers / websites / WhatsApp read off it (lib/contact-info)
//   boxes   - where on the picture they are, in the picture's own pixels, so
//             the full-size view draws a red box round each one
//   quality - SMALL (short side under 400 px) or REALLY DARK (even its
//             brightest parts are dark). Tested on 100 real product photos
//             (28 Oct 2026): "blurry" and "dark on average" flagged good
//             photos - soft-focus mint leaves, a pizza on a black table - so
//             only these two, which never did, are used. 5 of the 100 were
//             small; none was really dark.

import type { FoundBox } from "@/components/PictureViewer";
import { findContactInfo, westernDigits, type ContactHit } from "./contact-info.ts";

export type PictureQuality = { width: number; height: number; tiny: boolean; dark: boolean };
export type PictureCheck = {
  url: string;
  hits: ContactHit[];
  boxes: FoundBox[];
  quality: PictureQuality | null;
  /** The picture could not be read (gone, or not a picture). */
  failed?: string;
};

export const TINY_SIDE = 400;      // px - the short side of a product photo
export const DARK_BELOW = 100;     // 0-255 - how bright its brightest 5% is

/** Poor-photo words, for the badges and the risk line. */
export function qualityWords(q: PictureQuality | null | undefined): string[] {
  if (!q) return [];
  const out: string[] = [];
  if (q.dark) out.push("Too dark");
  if (q.tiny) out.push(`Small (${q.width} × ${q.height})`);
  return out;
}

// ── the number behind "really dark" (a plain sum, easy to test) ───────────
/** How bright the brightest 5% of grey pixels are, 0-255. A black-background
 *  product shot still has a bright product (high); a photo taken in the dark
 *  has nothing bright at all (low). */
export function brightTop(grey: ArrayLike<number>): number {
  if (!grey.length) return 0;
  const count = new Array(256).fill(0);
  for (let i = 0; i < grey.length; i++) count[Math.max(0, Math.min(255, Math.round(grey[i])))]++;
  let seen = 0;
  const want = grey.length * 0.05;
  for (let v = 255; v >= 0; v--) { seen += count[v]; if (seen >= want) return v; }
  return 0;
}

export function judgeQuality(width: number, height: number, top: number): PictureQuality {
  return { width, height, tiny: Math.min(width, height) < TINY_SIDE, dark: top < DARK_BELOW };
}

/** Which words read off the picture make up each hit -> boxes round them. */
export function boxesFor(hits: ContactHit[], words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[]): FoundBox[] {
  const out: FoundBox[] = [];
  for (const h of hits) {
    const digits = westernDigits(h.text).replace(/\D/g, "");
    const low = h.text.toLowerCase();
    for (const w of words) {
      const wt = westernDigits(w.text || "");
      const wd = wt.replace(/\D/g, "");
      const wl = wt.toLowerCase().replace(/[^\p{L}\p{N}.@/]/gu, "");
      // A phone: a word that is PART of the number ("0344", "2712112"), or a
      // word that holds the WHOLE number with more stuck to it - Dawood's
      // signboard reads as one word, "0344-2712112:/2800" (30 Oct 2026).
      const part = h.kind === "phone"
        ? (wd.length >= 3 && digits.includes(wd)) || (digits.length >= 7 && wd.includes(digits))
        : wl.length >= 3 && (low.includes(wl) || wl.includes(low));
      if (part && !out.some((b) => b.x0 === w.bbox.x0 && b.y0 === w.bbox.y0)) out.push({ ...w.bbox, label: h.text });
    }
  }
  return out;
}

// ── in the browser ─────────────────────────────────────────────────────────
let reader: Promise<any> | null = null;

/** The reading library is the panel's OWN file (public/ocr/tesseract.min.js,
 *  tesseract.js 5.1.1, Apache-2.0 - its licence sits beside it), added to the
 *  page only the first time a picture is read. No package to install, and no
 *  other page of the panel ever loads it. */
function loadReaderScript(): Promise<any> {
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "/ocr/tesseract.min.js";
    s.async = true;
    s.onload = () => (w.Tesseract ? ok(w.Tesseract) : bad(new Error("The picture reader did not start")));
    s.onerror = () => bad(new Error("The picture reader could not be loaded"));
    document.head.appendChild(s);
  });
}

/** One reader for the whole page, made the first time it is needed. */
function getReader(): Promise<any> {
  if (!reader) {
    reader = (async () => {
      const T = await loadReaderScript();
      return T.createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        // The panel's safety rules let a worker come only from the panel
        // itself (worker-src 'self') - so no blob: worker.
        workerBlobURL: false,
      });
    })().catch((e) => { reader = null; throw e; });
  }
  return reader;
}

function loadPicture(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => bad(new Error("The picture could not be opened"));
    // Its own address, so a copy the page already showed without permission
    // to read it is never the one read here. A picture made in this browser
    // (data:, Mock 219's blurred copy) is read as it is.
    img.src = url.startsWith("data:") || url.startsWith("blob:") ? url : url + (url.includes("?") ? "&" : "?") + "check=1";
  });
}

function greyCanvas(img: HTMLImageElement, longest: number, contrast: boolean) {
  const s = longest / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);   // a see-through logo on white
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const grey = new Uint8ClampedArray(w * h);
  let lo = 255, hi = 0;
  for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
    const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    grey[j] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  if (contrast && hi > lo) {
    const k = 255 / (hi - lo);
    for (let j = 0; j < grey.length; j++) grey[j] = (grey[j] - lo) * k;
  }
  for (let i = 0, j = 0; i < d.data.length; i += 4, j++) { d.data[i] = d.data[i + 1] = d.data[i + 2] = grey[j]; }
  ctx.putImageData(d, 0, 0);
  return { canvas: c, grey, w, h, scale: s };
}

/** Read one picture. `deep` (the logo): a second, plain reading when the
 *  enlarged one finds nothing. Never throws - a failure is in `failed`. */
export async function checkPicture(url: string, deep = false): Promise<PictureCheck> {
  try {
    const img = await loadPicture(url);
    const small = greyCanvas(img, 512, false);
    const quality = judgeQuality(img.naturalWidth, img.naturalHeight, brightTop(small.grey));
    const r = await getReader();
    // Small writing reads far better enlarged, in grey, with full contrast.
    const passes: { longest: number; contrast: boolean }[] = [{ longest: 2400, contrast: true }];
    if (deep) passes.push({ longest: Math.min(1600, Math.max(img.naturalWidth, img.naturalHeight)), contrast: false });
    let hits: ContactHit[] = [];
    let boxes: FoundBox[] = [];
    for (const p of passes) {
      const g = greyCanvas(img, p.longest, p.contrast);
      const { data } = await r.recognize(g.canvas);
      const found = findContactInfo(data.text || "", { fromPicture: true });
      if (!found.length) continue;
      const words = (data.words || []).map((w: any) => ({
        text: w.text,
        bbox: { x0: w.bbox.x0 / g.scale, y0: w.bbox.y0 / g.scale, x1: w.bbox.x1 / g.scale, y1: w.bbox.y1 / g.scale },
      }));
      hits = found;
      boxes = boxesFor(found, words);
      break;
    }
    return { url, hits, boxes, quality };
  } catch (e) {
    return { url, hits: [], boxes: [], quality: null, failed: e instanceof Error ? e.message : "Could not be read" };
  }
}


// ── MOCK 219 - BLURRED BY TAKAL (Sana 30 Oct 2026: "A blur" - "Approved") ──
// The number is covered where it was found: each box is grown a little (the
// reader's box hugs the digits), shrunk to a few pixels and drawn back large
// (pixels nobody can read), then blurred on top so it looks soft, not
// blocky. Only those spots change; the rest of the picture is untouched. The
// copy is READ AGAIN by the caller before it is used - blurring is trusted
// only when nothing can be read on the result.

/** A box grown on every side by a share of its height, kept on the picture. */
export function grownBox(b: FoundBox, width: number, height: number): FoundBox {
  const pad = Math.max(6, Math.round((b.y1 - b.y0) * 0.45));
  return {
    x0: Math.max(0, Math.floor(b.x0 - pad)), y0: Math.max(0, Math.floor(b.y0 - pad)),
    x1: Math.min(width, Math.ceil(b.x1 + pad)), y1: Math.min(height, Math.ceil(b.y1 + pad)),
  };
}

/** Grown boxes that touch or overlap become one - a number read as two
 *  words ("0328" "2236600") is covered by one smooth patch, not two. */
export function joinedBoxes(boxes: FoundBox[]): FoundBox[] {
  const out = boxes.map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) {
          out[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

/** How soft the blur over a box is - stronger for bigger writing. */
export function blurRadius(b: FoundBox): number {
  return Math.max(8, Math.round((b.y1 - b.y0) * 0.6));
}

/** PNG stays PNG (a see-through logo); everything else becomes JPEG. */
export function blurredType(url: string): "image/png" | "image/jpeg" {
  return /\.png(\?|$)/i.test(url) ? "image/png" : "image/jpeg";
}

/** The picture with every box covered. Throws when it cannot be opened. */
export async function blurPicture(url: string, boxes: FoundBox[]): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadPicture(url);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  // Each box grown, then those that touch joined; the blur strength follows
  // the tallest writing inside.
  const radius = Math.max(8, ...boxes.map((b) => blurRadius(b)));
  for (const b of joinedBoxes(boxes.map((raw) => grownBox(raw, w, h)))) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw < 2 || bh < 2) continue;
    // 1. pixels nobody can read
    const tiny = document.createElement("canvas");
    tiny.width = Math.max(1, Math.round(bw / 12)); tiny.height = Math.max(1, Math.round(bh / 12));
    const t = tiny.getContext("2d")!;
    t.drawImage(c, b.x0, b.y0, bw, bh, 0, 0, tiny.width, tiny.height);
    ctx.save();
    ctx.beginPath(); ctx.rect(b.x0, b.y0, bw, bh); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, b.x0, b.y0, bw, bh);
    // 2. soft on top (browsers without canvas filters keep step 1 - still unreadable)
    if ("filter" in ctx) {
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(c, b.x0, b.y0, bw, bh, b.x0, b.y0, bw, bh);
      ctx.filter = "none";
    }
    ctx.restore();
  }
  const type = blurredType(url);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, type, 0.9));
  if (!blob) throw new Error("The blurred picture could not be made");
  return { blob, width: w, height: h };
}

/** Read a picture made in this browser (the blurred copy). Never throws. */
/** Read a picture made in this browser (the blurred copy).
 *
 *  As a data: address, NOT a blob: one. The panel's security header
 *  (next.config.js) lets pictures come only from 'self', data: and https: -
 *  a blob: picture is refused, the read fails, and every blurred copy was
 *  thrown away. That is what happened on the first live day (30 Oct 2026).
 *  data: is already allowed, so the header is left exactly as it is. */
export async function checkBlob(blob: Blob): Promise<PictureCheck> {
  return checkPicture(await asDataUrl(blob), true);
}

export function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(new Error("The blurred copy could not be read"));
    r.readAsDataURL(blob);
  });
}

/** How many times a copy is blurred and read again before giving up. */
export const BLUR_TRIES = 3;

/** Blur, read the copy again, and if the reader now sees something more
 *  (a number it missed the first time, a "TikTok" under it) blur THAT too -
 *  always starting again from the vendor's original, never blurring a blur.
 *  A picture read before boxes were stored (29 Oct) is read once first.
 *  Gives back the clean copy, or null when one cannot be made - then the
 *  picture is left exactly as it was. */
export async function blurUntilClean(url: string, found: FoundBox[], use: {
  read: typeof checkPicture; blur: typeof blurPicture; readCopy: typeof checkBlob;
} = { read: checkPicture, blur: blurPicture, readCopy: checkBlob }): Promise<null | {
  blob: Blob; width: number; height: number; check: PictureCheck; boxes: FoundBox[];
}> {
  let boxes = [...found];
  if (!boxes.length) {
    const first = await use.read(url, true);
    if (first.failed || !first.boxes.length) return null;
    boxes = [...first.boxes];
  }
  for (let i = 0; i < BLUR_TRIES; i++) {
    const { blob, width, height } = await use.blur(url, boxes);
    const check = await use.readCopy(blob);
    if (check.failed) return null;
    if (!check.hits.length) return { blob, width, height, check, boxes };
    if (!check.boxes.length) return null;      // something is read but nobody can say where
    boxes = boxes.concat(check.boxes);
  }
  return null;
}
