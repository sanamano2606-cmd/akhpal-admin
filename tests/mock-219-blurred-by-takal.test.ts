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
import { blurRadius, blurredType, grownBox, joinedBoxes } from "../src/lib/picture-check.ts";
import { blurredLine } from "../src/lib/ready-to-show.ts";

const HOOK = readFileSync("src/lib/hooks/useBackgroundPictureReader.ts", "utf8");
const PIC = readFileSync("src/lib/picture-check.ts", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const NAV = readFileSync("src/lib/navigation.ts", "utf8");
const READY = readFileSync("src/app/dashboard/stores/parts-ready-to-show.tsx", "utf8");
const REVIEW = readFileSync("src/app/dashboard/stores/[id]/review/page.tsx", "utf8");
const CARD = readFileSync("src/app/dashboard/stores/[id]/review/parts-checks.tsx", "utf8");
const GUARD = readFileSync("../swat-delivery-app/backend/app_guard.py", "utf8");

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
  const read = body.indexOf("const again = await checkBlob(blob);");
  const skip = body.indexOf("if (again.failed || again.hits.length) continue;");
  const upload = body.indexOf("await apiClient.uploadImage(file);");
  const save = body.indexOf("await apiClient.saveBlurredPicture({");
  assert.ok(read > 0 && skip > read && upload > skip && save > upload, "read again -> skip if not clean -> upload -> swap");
  assert.match(body, /hits_after: again\.hits/);
  // A blob is read as it is - never with "?check=1" glued on.
  assert.match(PIC, /img\.src = url\.startsWith\("blob:"\) \? url :/);
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
