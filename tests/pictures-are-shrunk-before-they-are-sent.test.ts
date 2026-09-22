// ─────────────────────────────────────────────────────────────────────────────
// THE PANEL MAKES A PICTURE SMALLER BEFORE IT SENDS IT, AND HAS ONE SIZE LIMIT.
//
// Sana, 21 September 2026, before hiring somebody to put shops on Takal:
// "the uploading of Millions products must not Affect the speed, crashes,
// lags, or anything."
//
// TWO FAULTS THIS HOLDS SHUT
//
//  1. THE PANEL SENT THE FILE EXACTLY AS IT WAS. The three phone apps have
//     shrunk every picture since 9 September - 1,600 pixels, quality 80, in
//     one shared file with a guard test. The panel had nothing. A 12 MB shop
//     photo went up as 12 MB and was stored at about 300 KB anyway.
//
//  2. THREE DIFFERENT SIZE LIMITS, ALL WRONG. The banners hook said 5 MB, the
//     product editor kept its own copy of 5 MB, Create store had no check at
//     all, and the server accepts 10 MB. So the panel refused good photos
//     while telling the person a number that was not true.
//
// THE PART THAT MATTERS IN SIX MONTHS is the last group: the panel's three
// numbers are read out of the SERVER'S OWN FILE and compared. If the server
// changes and the panel does not, these fail on the rupee, not on a comment.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  shrinkPictureForUpload,
  PICTURE_MAX_SIDE,
  PICTURE_QUALITY,
  MAX_PICTURE_MB,
  MAX_PICTURE_BYTES,
  pictureSizeInWords,
  pictureTooBigMessage,
} from "../src/lib/picture-upload.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** The file with its comments taken out. A guard that reads its own
 *  explanation guards nothing - CLAUDE.md section 3. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "")
     .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
     .replace(/^\s*\/\/.*$/gm, "");

const api = code(read("src/lib/api-stores.ts"));
const hook = code(read("src/lib/hooks/useImageUpload.ts"));
const editor = code(read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx"));
const createStore = code(read("src/app/dashboard/stores/parts-create-store.tsx"));

/** Just ONE method's body. Slicing a fixed number of characters after a name
 *  reads into whatever comes next - here it read into `uploadVideo`, which
 *  sends its file as it is, quite correctly, and made this check fail on
 *  somebody else's code. */
function methodBody(src: string, name: string): string {
  const i = src.indexOf(`async ${name}(`);
  assert.ok(i > 0, `${name} is gone`);
  const next = src.indexOf("\n  async ", i + 1);
  return src.slice(i, next > 0 ? next : src.length);
}

// The server's own file. The panel tests read the backend on purpose - see
// CLAUDE.md section 4.
const server = read("../swat-delivery-app/backend/routers/uploads.py");

const numberFromServer = (name: string, re: RegExp) => {
  const m = server.match(re);
  assert.ok(m, `could not find ${name} in the server's uploads.py`);
  return m![1];
};

// ─── The panel's numbers ARE the server's numbers ───────────────────────────

test("the long edge matches the server's MAX_IMAGE_DIMENSION", () => {
  // Sending more pixels than the server keeps cannot improve the stored
  // picture. It can only make the upload slower.
  const onTheServer = Number(numberFromServer(
    "MAX_IMAGE_DIMENSION", /^MAX_IMAGE_DIMENSION\s*=\s*(\d+)/m));
  assert.equal(PICTURE_MAX_SIDE, onTheServer,
    `the panel shrinks to ${PICTURE_MAX_SIDE} px but the server stores ` +
    `${onTheServer} px - change the server first, then this file`);
});

test("the quality matches the server's JPEG_QUALITY", () => {
  // Squeezing at two different settings loses a little for nothing.
  const onTheServer = Number(numberFromServer(
    "JPEG_QUALITY", /^JPEG_QUALITY\s*=\s*(\d+)/m));
  assert.equal(Math.round(PICTURE_QUALITY * 100), onTheServer);
});

test("the size limit matches the server's MAX_IMAGE_BYTES", () => {
  // THE FAULT THIS CLOSES. The panel said 5 MB - out loud, to the person -
  // and the server has always taken 10 MB.
  const mb = Number(numberFromServer(
    "MAX_IMAGE_BYTES", /^MAX_IMAGE_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/m));
  assert.equal(MAX_PICTURE_MB, mb,
    `the panel refuses over ${MAX_PICTURE_MB} MB, the server accepts ${mb} MB`);
  assert.equal(MAX_PICTURE_BYTES, mb * 1024 * 1024);
});

// ─── One door, and no screen can go round it ────────────────────────────────

test("uploadImage shrinks the picture and sends the SMALL one", () => {
  const body = methodBody(api, "uploadImage");
  assert.ok(body.includes("await shrinkPictureForUpload(file)"),
    "the picture must be made smaller before it is sent");
  assert.ok(body.includes('fd.append("file", small'),
    "the SMALL picture must be the one appended - appending `file` sends the " +
    "original and makes the shrinking pointless");
  assert.ok(!/fd\.append\("file", file\)/.test(body),
    "the original file must not be the one sent");
});

test("the one size limit is applied AFTER shrinking, not before", () => {
  // A 12 MB camera photo that becomes 300 KB is a picture Takal is happy
  // with. Refusing it on the size it arrived at would be the old wrong answer
  // wearing the new fix's clothes.
  const body = methodBody(api, "uploadImage");
  const shrink = body.indexOf("shrinkPictureForUpload");
  const check = body.indexOf("MAX_PICTURE_BYTES");
  assert.ok(shrink > 0 && check > shrink,
    "the size must be checked on the shrunk picture, not the original");
  assert.ok(body.includes("pictureTooBigMessage("),
    "and the person must be told in words what happened");
});

test("the VIDEO door is deliberately left exactly as it was", () => {
  // A video is not a picture: there is no canvas trick that makes one smaller
  // in a browser, and the welcome-screen video has its own 100 MB limit and
  // its own server endpoint. This check is here so that "one limit for
  // everything" is never read as "put videos through the picture rule too".
  const video = methodBody(api, "uploadVideo");
  assert.ok(video.includes('fd.append("file", file)'),
    "the video upload sends its file as it is, on purpose");
  assert.ok(!video.includes("shrinkPictureForUpload"),
    "a video must not be handed to the picture shrinker");
});

test("no screen keeps its own picture size number any more", () => {
  // Three copies of a wrong 5 MB is how three screens came to disagree with
  // the server and with each other.
  for (const [name, src] of [["the banners/welcome hook", hook],
                             ["the product editor", editor],
                             ["Create store", createStore]] as const) {
    assert.ok(!/\d+\s*\*\s*1024\s*\*\s*1024/.test(src),
      `${name} still has its own size number - there is one limit, in ` +
      `src/lib/picture-upload.ts`);
    assert.ok(!/MAX_IMAGE_MB/.test(src),
      `${name} still refers to the old MAX_IMAGE_MB`);
  }
});

test("Create store, which had NO check at all, is covered now", () => {
  // The screen the new vendor-onboarding job uses all day. It calls the one
  // door, so it gets the shrinking and the limit without a line of its own.
  assert.ok(createStore.includes("apiClient.uploadImage("),
    "the shop logo must go through the one upload door");
});

test("one bad photo in a batch no longer stops the good ones", () => {
  const i = editor.indexOf("const uploadFiles");
  const body = editor.slice(i, i + 1200);
  assert.ok(body.includes("try {") && body.includes("catch (err)"),
    "each file must be tried on its own - one refusal used to abandon the rest");
});

// ─── RUNNING IT. A test that reads the code is not a test that it works. ────

/** A stand-in browser: just enough canvas for the shrinker to use. */
function fakeBrowser({ width = 4000, height = 3000, blobSize = 120_000,
                       blobType = null as string | null,
                       toBlobGives = "blob" as "blob" | "null",
                       decode = "ok" as "ok" | "fail" } = {}) {
  const canvas: any = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (cb: (b: Blob | null) => void, type: string, _q: number) => {
      if (toBlobGives === "null") return cb(null);
      const t = blobType || type;
      cb(new Blob([new Uint8Array(blobSize)], { type: t }));
    },
  };
  (globalThis as any).document = { createElement: () => canvas };
  (globalThis as any).createImageBitmap = async () => {
    if (decode === "fail") throw new Error("cannot decode");
    return { width, height };
  };
  (globalThis as any).Image = class { onerror: any; set src(_v: string) { this.onerror?.(); } };
  (globalThis as any).URL.createObjectURL = () => "blob:x";
  (globalThis as any).URL.revokeObjectURL = () => {};
  return canvas;
}

function forget() {
  delete (globalThis as any).document;
  delete (globalThis as any).createImageBitmap;
  delete (globalThis as any).Image;
}

const photo = (bytes: number, type = "image/jpeg", name = "IMG_0042.jpg") =>
  new File([new Uint8Array(bytes)], name, { type });

test("a big camera photo really is made smaller", async () => {
  const canvas = fakeBrowser({ width: 4000, height: 3000, blobSize: 250_000 });
  try {
    const original = photo(12 * 1024 * 1024);
    const out = await shrinkPictureForUpload(original);
    assert.ok(out.size < original.size, "it must come out smaller");
    assert.equal(out.size, 250_000);
    assert.equal(canvas.width, 1600, "the long edge must be 1600");
    assert.equal(canvas.height, 1200, "and the shape must be kept");
  } finally { forget(); }
});

test("a see-through logo is NOT flattened onto white", async () => {
  // A PNG may have a transparent background. Turning it into a JPEG would put
  // a white box behind the Takal logo on the website.
  fakeBrowser({ width: 2400, height: 2400, blobSize: 90_000 });
  try {
    const out = await shrinkPictureForUpload(photo(4_000_000, "image/png", "logo.png"));
    assert.equal(out.type, "image/webp", "transparency must be kept");
    assert.ok(out.name.endsWith(".webp"), "the name must match what is inside");
  } finally { forget(); }
});

test("the file name always matches what is really inside it", async () => {
  // A browser that cannot write WebP quietly hands back a PNG instead.
  fakeBrowser({ width: 2400, height: 2400, blobSize: 90_000, blobType: "image/png" });
  try {
    const out = await shrinkPictureForUpload(photo(4_000_000, "image/png", "logo.png"));
    assert.equal(out.type, "image/png");
    assert.ok(out.name.endsWith(".png"),
      "a PNG named .webp is a file the server refuses by its ending");
  } finally { forget(); }
});

test("a picture that is already small is sent untouched", async () => {
  // Re-encoding it could only lose a little quality and gain nothing.
  fakeBrowser({ width: 800, height: 600 });
  try {
    const original = photo(200 * 1024, "image/png", "icon.png");
    assert.equal(await shrinkPictureForUpload(original), original);
  } finally { forget(); }
});

test("an animated GIF keeps its animation", async () => {
  fakeBrowser();
  try {
    const original = photo(3_000_000, "image/gif", "spin.gif");
    assert.equal(await shrinkPictureForUpload(original), original,
      "drawing a GIF on a canvas throws the animation away");
  } finally { forget(); }
});

test("a picture the browser cannot open is sent as it is", async () => {
  // An iPhone HEIC, above all. Before this file existed that is what happened
  // to EVERY picture, so it is no worse - and the server answers by name.
  fakeBrowser({ decode: "fail" });
  try {
    const original = photo(9_000_000, "image/heic", "IMG_1.heic");
    assert.equal(await shrinkPictureForUpload(original), original);
  } finally { forget(); }
});

test("a picture is never made BIGGER", async () => {
  fakeBrowser({ width: 4000, height: 3000, blobSize: 9_000_000 });
  try {
    const original = photo(1_500_000);
    assert.equal(await shrinkPictureForUpload(original), original);
  } finally { forget(); }
});

test("a canvas that gives back nothing does not lose the picture", async () => {
  fakeBrowser({ width: 4000, height: 3000, toBlobGives: "null" });
  try {
    const original = photo(8_000_000);
    assert.equal(await shrinkPictureForUpload(original), original);
  } finally { forget(); }
});

test("a browser that blows up mid-way still gives the picture back", async () => {
  // THE SAFETY NET ITSELF. Not "does the shrinking work" - does the FAILURE of
  // the shrinking still leave a working upload? Out of memory on a 108
  // megapixel photo on a cheap phone is the real version of this.
  fakeBrowser({ width: 4000, height: 3000 });
  (globalThis as any).document = {
    createElement: () => { throw new Error("out of memory"); },
  };
  try {
    const original = photo(11_000_000);
    const out = await shrinkPictureForUpload(original);
    assert.equal(out, original,
      "a thrown error here would stop the upload dead and lose the photo");
  } finally { forget(); }
});

test("it never throws, and never refuses, with no browser at all", async () => {
  forget();
  const original = photo(8_000_000);
  assert.equal(await shrinkPictureForUpload(original), original,
    "losing somebody's photo because a resize failed is far worse than a " +
    "slow upload");
});

// ─── The words somebody actually reads ──────────────────────────────────────

test("the size is written the way a person says it", () => {
  assert.equal(pictureSizeInWords(512), "512 B");
  assert.equal(pictureSizeInWords(200 * 1024), "200 KB");
  assert.equal(pictureSizeInWords(12 * 1024 * 1024), "12.0 MB");
});

test("the refusal names the real limit and says what to do", () => {
  const msg = pictureTooBigMessage(14 * 1024 * 1024);
  assert.ok(msg.includes("14.0 MB"), "say how big it actually is");
  assert.ok(msg.includes(`${MAX_PICTURE_MB} MB`), "say the REAL limit");
  assert.ok(!msg.includes("5 MB"), "the old wrong number must be gone");
});
