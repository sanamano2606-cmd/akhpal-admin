/**
 * A PRODUCT VIDEO: at most 15 seconds and 10 MB (Sana, 19 October 2026).
 *
 * The same numbers as the server (backend/routers/uploads.py,
 * MAX_PRODUCT_VIDEO_BYTES / MAX_PRODUCT_VIDEO_SECONDS) and the Partners app
 * (item_editor_media.dart). The Partners app makes a video smaller by itself;
 * a browser cannot, so the office is told what to do instead.
 *   Example: an 80 MB, 25-second video -> "This video is 80 MB ..." and
 *   nothing is sent.
 * The welcome-screen video (Marketing > Welcome) is NOT a product video: it
 * keeps its 100 MB limit (it is sent with purpose=welcome).
 */
export const MAX_PRODUCT_VIDEO_MB = 10;
export const MAX_PRODUCT_VIDEO_SECONDS = 15;
/** A phone's "15 seconds" is often 15.0-15.4 when read back (the server allows the same). */
const SECONDS_ALLOWED = MAX_PRODUCT_VIDEO_SECONDS + 0.5;

/** What is wrong with a product video, in plain words - or null when it may be sent.
 *  `seconds` is null when the browser could not read the length (the server checks again). */
export function productVideoProblem(sizeBytes: number, seconds: number | null): string | null {
  const mb = sizeBytes / (1024 * 1024);
  const rule = `A product video must be ${MAX_PRODUCT_VIDEO_SECONDS} seconds or less and ${MAX_PRODUCT_VIDEO_MB} MB or less.`;
  if (seconds !== null && Number.isFinite(seconds) && seconds > SECONDS_ALLOWED) {
    return `This video is ${Math.round(seconds)} seconds long. ${rule} Please shorten it first (or add it from the Takal Partners app, which makes it smaller by itself).`;
  }
  if (mb > MAX_PRODUCT_VIDEO_MB) {
    return `This video is ${Math.ceil(mb)} MB. ${rule} Please make it smaller first (or add it from the Takal Partners app, which makes it smaller by itself).`;
  }
  return null;
}

/** The length of a video file in seconds, read by the browser - or null if it cannot tell. */
export function videoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let done = false;
    const finish = (s: number | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(s);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
    v.src = url;
  });
}
