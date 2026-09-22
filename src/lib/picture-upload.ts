"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ONE PICTURE RULE FOR THE WHOLE PANEL: SHRINK IT FIRST, AND ONE SIZE LIMIT.
//
// WHY THIS FILE EXISTS  (21 September 2026, Sana's three fixes.)
//
// FAULT 1 - THE PANEL SENT THE PHOTO EXACTLY AS IT WAS.
// The three phone apps have shrunk every picture before sending it since
// 9 September: 1,600 pixels on the long edge, quality 80, in one shared file
// (`lib/services/picture_upload.dart`), with a guard test that fails the build
// if a screen stops using it. The admin panel had nothing of the kind. A 12 MB
// shop photo went up as 12 MB.
//
// The STORED picture was never wrong - the server shrinks everything it is
// given. What was wasted was the person's time and internet: a minute of
// uploading for a file that ends up about 300 KB, on a connection in Swat that
// can drop halfway. Somebody putting fifty shops on Takal feels that fifty
// times a day.
//
// FAULT 2 - THREE DIFFERENT SIZE LIMITS, AND ALL THREE WERE WRONG.
//   · the banners / welcome hook refused over 5 MB
//   · the product editor had its OWN copy of the same 5 MB
//   · Create store, the screen used all day to put shops on Takal, had NO
//     check at all
//   · and the server has always accepted 10 MB
// So a perfectly good 7 MB photo was refused with the words "the largest
// allowed is 5 MB", which is not true, and a huge one on Create store went up
// slowly and was then refused by the server.
//
// Both are fixed in ONE place: `shrinkPictureForUpload` runs inside
// `apiClient.uploadImage`, so no screen can forget it, and `MAX_PICTURE_MB` is
// the only size number left in the panel.
//
// ⚠️ THE THREE NUMBERS BELOW ARE THE SERVER'S OWN NUMBERS. A guard test reads
// `backend/routers/uploads.py` and fails if they ever drift apart. If the
// server changes, change the server first and let the test name this file.
// ─────────────────────────────────────────────────────────────────────────────

/** The longest edge, in pixels, that any picture is sent at.
 *
 *  Equal to the server's `MAX_IMAGE_DIMENSION`. Sending more cannot improve
 *  the stored picture - the server shrinks to exactly this - it can only make
 *  the upload slower. */
export const PICTURE_MAX_SIDE = 1600;

/** Matches the server's `JPEG_QUALITY` of 82, so the picture is not squeezed
 *  twice at two different settings for no reason. */
export const PICTURE_QUALITY = 0.82;

/** The most a picture may be before the server refuses it. The server's
 *  `MAX_IMAGE_BYTES`, written here so the panel can say so at the moment the
 *  picture is chosen rather than after a long upload. */
export const MAX_PICTURE_MB = 10;
export const MAX_PICTURE_BYTES = MAX_PICTURE_MB * 1024 * 1024;

/** A picture already this small is sent untouched, whatever its size in
 *  pixels - re-encoding it could only lose a little quality and gain nothing.
 *  A logo or an icon is the normal case here. */
const ALREADY_SMALL_ENOUGH_BYTES = 1024 * 1024;

/** How big a picture is, in words. "2.4 MB". */
export function pictureSizeInWords(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What to tell somebody whose picture is still too big after shrinking. */
export function pictureTooBigMessage(bytes: number): string {
  return `That picture is ${pictureSizeInWords(bytes)} even after being made ` +
    `smaller. The largest Takal accepts is ${MAX_PICTURE_MB} MB — ` +
    `please choose another one.`;
}

/** Same name, new ending, so the file name matches what is inside it. */
function renamed(name: string, type: string): string {
  const stem = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return `${stem || "picture"}.${ext}`;
}

/** Draw the picture, at whatever size the browser can manage. */
async function decode(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource } | null> {
  // createImageBitmap is the fast path and honours the camera's rotation tag.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, draw: bitmap };
    } catch {
      // A format this browser cannot decode - an iPhone HEIC above all. Fall
      // through to the <img> path, and if that fails too the picture is sent
      // exactly as it is, which is what happened before this file existed.
    }
  }
  return await new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight, draw: img });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Make a picture small enough to send quickly, before it is sent.
 *
 * NEVER THROWS, and never refuses. Anything it cannot handle - a format this
 * browser cannot open, a browser with no canvas, a picture that comes out
 * BIGGER than it went in - comes back as the original file, and the upload
 * carries on exactly as it did before. Losing somebody's photo because a
 * resize failed would be far worse than a slow upload.
 *
 * A 12 megapixel camera photo leaves the panel at roughly 200-400 KB.
 */
export async function shrinkPictureForUpload(file: File): Promise<File> {
  try {
    if (typeof document === "undefined") return file;          // not in a browser
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    // An animated GIF loses its animation the moment it is drawn on a canvas,
    // and an SVG has no pixels to shrink. Neither is one of the four types the
    // server accepts, so both are left for the server to refuse by name.
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

    const picture = await decode(file);
    if (!picture || !picture.width || !picture.height) return file;

    const longest = Math.max(picture.width, picture.height);
    if (longest <= PICTURE_MAX_SIDE && file.size <= ALREADY_SMALL_ENOUGH_BYTES) {
      return file;   // already right - re-encoding could only lose quality
    }

    const scale = Math.min(1, PICTURE_MAX_SIDE / longest);
    const w = Math.max(1, Math.round(picture.width * scale));
    const h = Math.max(1, Math.round(picture.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(picture.draw, 0, 0, w, h);

    // A PNG or a WebP may have a SEE-THROUGH BACKGROUND, and a logo flattened
    // onto white is ruined. WebP keeps the transparency and is the format the
    // server itself stores those in. Everything else becomes a JPEG.
    const keepsTransparency = file.type === "image/png" || file.type === "image/webp";
    const wanted = keepsTransparency ? "image/webp" : "image/jpeg";

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), wanted, PICTURE_QUALITY));
    // A browser that cannot write WebP quietly hands back a PNG instead. That
    // is fine - the server accepts PNG - but the file NAME has to agree with
    // what is actually inside it, which is why `renamed` reads blob.type.
    if (!blob || !blob.size) return file;
    if (blob.size >= file.size) return file;   // never send something bigger

    return new File([blob], renamed(file.name || "picture", blob.type),
                    { type: blob.type || wanted, lastModified: Date.now() });
  } catch {
    // Whatever went wrong, the original picture still works.
    return file;
  }
}
