// MOCK 219 - BLURRED BY TAKAL (Sana, 30 Oct 2026: "Can The Assistant do this"
// - "A blur" - "Approved" - "GO").
//
// The panel's half: the quiet reader blurs only the spots where a number was
// found, READS THE COPY AGAIN and uses it only if it reads clean; Ready to show
// says "look once"; the Review page shows before / after and "Put original
// back" for the Main Admin only. The server holds the rest (backend
// picture_blur.py, tests/test_mock_219_blurred_by_takal.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLUR_TRIES, blurRadius, blurUntilClean, blurredType, boxesFor, grownBox, joinedBoxes } from "../src/lib/picture-check.ts";
import { blurredLine } from "../src/lib/ready-to-show.ts";

const HOOK = readFileSync("src/lib/hooks/useBackgroundPictureReader.ts", "utf8");
const PIC = readFileSync("src/lib/picture-check.ts", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const NAV = readFileSync("src/lib/navigation.ts", "utf8");
const READY = readFileSync("src/app/dashboard/stores/parts-ready-to-show.tsx", "utf8");
const REVIEW = readFileSync("src/app/dashboard/stores/[id]/review/page.tsx", "utf8");
const CARD = readFileSync("src/app/dashboard/stores/[id]/review/parts-checks.tsx", "utf8");
const GUARD = readFileSync("../swat-delivery-app/backend/app_guard.py", "utf8");
const NEXT = readFileSync("next.config.js", "utf8");

test("the blur covers a little MORE than the reader's box, and never leaves the picture", () => {
  // The reader's box hugs the digits: 380 x 50 on an 800 x 800 logo.
  assert.deepEqual(grownBox({ x0: 40, y0: 300, x1: 420, y1: 350 }, 800, 800), { x0: 17, y0: 277, x1: 443, y1: 373 });
  // At the edge it stops at the edge.
  assert.deepEqual(grownBox({ x0: 2, y0: 2, x1: 790, y1: 30 }, 800, 800), { x0: 0, y0: 0, x1: 800, y1: 43 });
  // Bigger writing, softer blur; never weaker than 8 px.
  assert.equal(blurRadius({ x0: 0, y0: 0, x1: 10, y1: 50 }), 30);
  assert.equal(blurRadius({ x0: 0, y0: 0, x1: 10, y1: 6 }), 8);
});

test("a see-through PNG logo stays PNG; a photo becomes JPEG", () => {
  assert.equal(blurredType("https://x/logo.PNG"), "image/png");
  assert.equal(blurredType("https://x/logo.png?v=2"), "image/png");
  assert.equal(blurredType("https://x/coat.jpg"), "image/jpeg");
  assert.equal(blurredType("https://x/coat.webp"), "image/jpeg");
});

test("unreadable pixels first, soft blur on top - and only inside each box", () => {
  assert.match(PIC, /tiny\.width = Math\.max\(1, Math\.round\(bw \/ 12\)\)/);
  assert.match(PIC, /ctx\.rect\(b\.x0, b\.y0, bw, bh\); ctx\.clip\(\);/);
  assert.match(PIC, /ctx\.filter = `blur\(\$\{radius\}px\)`;/);
  assert.match(PIC, /for \(const b of joinedBoxes\(boxes\.map\(\(raw\) => grownBox\(raw, w, h\)\)\)\) \{/);
});

test("a copy is used ONLY if it reads clean when read again", () => {
  const body = HOOK.slice(HOOK.indexOf("export async function blurRound"));
  const clean = body.indexOf("const clean = await blurUntilClean(p.url, p.boxes || []);");
  const skip = body.indexOf("if (!clean) continue;");
  const upload = body.indexOf("await apiClient.uploadImage(file);");
  const save = body.indexOf("await apiClient.saveBlurredPicture({");
  assert.ok(clean > 0 && skip > clean && upload > skip && save > upload, "blur until clean -> skip if not -> upload -> swap");
  assert.match(body, /hits_after: again\.hits/);
});

// ── 30 Oct 2026, the first live evening: nothing was blurred ────────────────
// The blurred copy was read back through a blob: address, and the panel's
// security header allows pictures only from 'self', data: and https:. Every
// read failed, every copy was (rightly) thrown away, nothing was swapped.
test("the blurred copy is read back through an address the security header ALLOWS", () => {
  const imgSrc = (NEXT.match(/"img-src ([^"]+)"/) || [])[1] || "";
  assert.ok(imgSrc, "img-src found in next.config.js");
  const body = PIC.slice(PIC.indexOf("export async function checkBlob"), PIC.indexOf("export function asDataUrl"));
  assert.ok(!/createObjectURL/.test(body), "checkBlob must not read the copy through a blob: address");
  assert.match(body, /checkPicture\(await asDataUrl\(blob\), true\)/);
  assert.ok(imgSrc.split(/\s+/).includes("data:"), "data: must stay allowed for pictures - checkBlob depends on it");
  // A data: picture is read as it is - "?check=1" glued on would break it.
  assert.match(PIC, /img\.src = url\.startsWith\("data:"\) \|\| url\.startsWith\("blob:"\) \? url :/);
});

const fakeCheck = (hits: string[], boxes: { x0: number; y0: number; x1: number; y1: number }[] = []) =>
  ({ hits: hits.map((t) => ({ kind: "phone", text: t })), boxes, quality: null, failed: false } as any);
const B = (n: number) => ({ x0: n, y0: n, x1: n + 10, y1: n + 10 });

test("something read under the first blur is blurred too - from the ORIGINAL each time", async () => {
  // Swat Fashion House's coat photo: two numbers blurred, then "TikTok" read.
  const blurredWith: number[] = [];
  const reads = [fakeCheck(["TikTok"], [B(500)]), fakeCheck([])];
  const out = await blurUntilClean("https://x/coat.webp", [B(1), B(2)], {
    read: async () => { throw new Error("not needed - boxes were given"); },
    blur: async (url, boxes) => { assert.equal(url, "https://x/coat.webp"); blurredWith.push(boxes.length); return { blob: new Blob(["x"]), width: 853, height: 1280 }; },
    readCopy: async () => reads.shift()!,
  });
  assert.ok(out, "a clean copy");
  assert.deepEqual(blurredWith, [2, 3]);
  assert.equal(out!.boxes.length, 3);
});

test("no clean copy after the tries, or a read that fails -> the picture is left as it was", async () => {
  let n = 0;
  const never = await blurUntilClean("https://x/a.webp", [B(1)], {
    read: async () => fakeCheck([]),
    blur: async () => { n++; return { blob: new Blob(["x"]), width: 9, height: 9 }; },
    readCopy: async () => fakeCheck(["0300 1234567"], [B(n * 20)]),
  });
  assert.equal(never, null);
  assert.equal(n, BLUR_TRIES);
  const failed = await blurUntilClean("https://x/a.webp", [B(1)], {
    read: async () => fakeCheck([]),
    blur: async () => ({ blob: new Blob(["x"]), width: 9, height: 9 }),
    readCopy: async () => ({ ...fakeCheck([]), failed: true }),
  });
  assert.equal(failed, null);
  const nowhere = await blurUntilClean("https://x/a.webp", [B(1)], {
    read: async () => fakeCheck([]),
    blur: async () => ({ blob: new Blob(["x"]), width: 9, height: 9 }),
    readCopy: async () => fakeCheck(["0300 1234567"], []),
  });
  assert.equal(nowhere, null, "something read with no place to blur is never uploaded");
});

test("a picture read before boxes were kept (Dawood's logo) is read once first", async () => {
  let readFirst = 0;
  const out = await blurUntilClean("https://x/logo.webp", [], {
    read: async (_u, deep) => { readFirst++; assert.equal(deep, true); return fakeCheck(["0344-2712112"], [B(7)]); },
    blur: async (_u, boxes) => { assert.equal(boxes.length, 1); return { blob: new Blob(["x"]), width: 9, height: 9 }; },
    readCopy: async () => fakeCheck([]),
  });
  assert.equal(readFirst, 1);
  assert.ok(out);
  const unseen = await blurUntilClean("https://x/logo.webp", [], {
    read: async () => fakeCheck(["0344-2712112"], []),
    blur: async () => { throw new Error("must not blur without a place"); },
    readCopy: async () => fakeCheck([]),
  });
  assert.equal(unseen, null);
});

test("blurring happens only when nothing is waiting to be read, a few at a time", () => {
  assert.match(HOOK, /export const BLUR_PER_ROUND = 3;/);
  assert.match(HOOK, /if \(alive && visible\(\) && wait === IDLE_WAIT_MS\) \{\s*try \{\s*if \(await blurRound\(\(\) => alive && visible\(\)\)\) wait = READ_PAUSE_MS;/);
  assert.match(HOOK, /if \(done && typeof window !== "undefined"\) window\.dispatchEvent\(new Event\(PICTURES_READ_EVENT\)\);/);
});

test("the addresses and who may use them agree with the server", () => {
  for (const [path, key] of [["/admin/pictures/to-blur", "stores.approve"], ["/admin/pictures/blurred", "stores.approve"], ["/admin/pictures/put-back", "__super__"]]) {
    assert.ok(NAV.includes(`["${path}", "${key}"]`), `panel: ${path}`);
    assert.ok(GUARD.includes(`("${path}", "${key}")`), `server: ${path}`);
  }
  assert.match(API, /\/admin\/pictures\/put-back\/\$\{blurId\}`, \{ method: "POST" \}/);
});

test("Ready to show says 'look once' when Takal blurred something", () => {
  assert.equal(blurredLine(5), "Takal blurred a phone number on 5 pictures - look once");
  assert.equal(blurredLine(1), "Takal blurred a phone number on 1 picture - look once");
  assert.match(READY, /\{\(s\.pictures_blurred \?\? 0\) > 0 && \(\s*<span data-blurred-chip/);
});

test("the Review page: before / after, a label on the product, Put back for the Main Admin only", () => {
  assert.match(REVIEW, /<BlurredCard pictures=\{blurred\} isMain=\{isMain\}/);
  assert.match(REVIEW, /photosOf\(p\)\.some\(\(u\) => blurredUrls\.has\(u\)\) && <span data-pic-blurred/);
  assert.match(REVIEW, /window\.addEventListener\(PICTURES_READ_EVENT, loadBlurred\);/);
  assert.match(CARD, /disabled=\{!isMain \|\| busy !== null\} onClick=\{\(\) => onPutBack\(b\.id\)\}/);
  assert.match(CARD, /\{ u: b\.original_url, w: "Before" \}, \{ u: b\.blurred_url, w: "After" \}/);
  // Putting back asks first, and says the shop is judged on the original again.
  assert.match(REVIEW, /window\.confirm\("Put the vendor's original picture back\?/);
});

test("a number read as two words is covered by ONE patch - no seam", () => {
  // Real boxes from the reader on "Call 0328 2236600" (browser test, 30 Oct 2026).
  const grown = [{ x0: 244.7, y0: 659.3, x1: 370, y1: 701 }, { x0: 389.7, y0: 659.3, x1: 611.3, y1: 701 }].map((b) => grownBox(b, 800, 800));
  assert.deepEqual(joinedBoxes(grown), [{ x0: 225, y0: 640, x1: 631, y1: 720 }]);
  // Two numbers far apart stay two patches.
  assert.equal(joinedBoxes([{ x0: 0, y0: 0, x1: 50, y1: 20 }, { x0: 300, y0: 400, x1: 350, y1: 420 }]).length, 2);
});

test("a number read stuck to other writing still gets its box (Dawood's signboard)", () => {
  const hit = [{ kind: "phone", text: "0344-2712112" }] as any;
  const box = { x0: 350, y0: 210, x1: 520, y1: 225 };
  // The real word the reader gave on 30 Oct 2026.
  assert.deepEqual(boxesFor(hit, [{ text: "0344-2712112:/2800", bbox: box }, { text: "25", bbox: { x0: 1, y0: 1, x1: 2, y1: 2 } }]),
    [{ ...box, label: "0344-2712112" }]);
  // Still: a part of the number gets a box, and a short stray number does not.
  assert.equal(boxesFor(hit, [{ text: "0344", bbox: box }]).length, 1);
  assert.equal(boxesFor(hit, [{ text: "25", bbox: box }]).length, 0);
});
