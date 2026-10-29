/**
 * MOCK 215 - full pictures, the phone-number lock, WhatsApp in English /
 * اردو / Roman, messages kept, office notes, the shop's colour and the same
 * shop twice. Approved by Sana 28 October 2026 ("Approved / Yes / Yes").
 *
 * The server half is tested in backend/tests/
 * test_mock_215_no_phone_numbers_and_the_review_checks.py. The examples of
 * what IS and is NOT a phone number are ONE file both sides read.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { findContactInfo, westernDigits } from "../src/lib/contact-info.ts";
import { allReadyReasons } from "../src/lib/shop-review.ts";
import { LABEL_WORDS, REASON_WORDS, STEP_WORDS, isolate, reasonIn, sendBackMessage, whatIsLeftIn } from "../src/lib/whatsapp-words.ts";
import { contactFinds, contactLock, pictureProgress, riskOf } from "../src/lib/review-rules.ts";
import { boxesFor, brightTop, judgeQuality, qualityWords, TINY_SIDE } from "../src/lib/picture-check.ts";

const root = new URL("..", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const EX = JSON.parse(read("../swat-delivery-app/backend/tests/contact_examples.json"));

// ── the rule - the same examples as the server ──────────────────────────────
test("every example the server finds, the panel finds - the same kind", () => {
  for (const [text, kind] of EX.found) {
    assert.ok(findContactInfo(text).some((h) => h.kind === kind), `${text} -> ${kind}`);
  }
});

test("nothing is found in ordinary product words (500 ml, Rs 2,200, a barcode...)", () => {
  for (const text of EX.not_found) assert.deepEqual(findContactInfo(text), [], text);
});

test("Urdu digits are read as numbers; picture noise is not a social account", () => {
  assert.equal(westernDigits("۰۳۴۴"), "0344");
  assert.deepEqual(findContactInfo("@tasl insta", { fromPicture: true }), []);
  assert.ok(findContactInfo("WhatsApp: 03449679387", { fromPicture: true }).length);
});

// ── WhatsApp in three languages ─────────────────────────────────────────────
test("every ready reason has its own Urdu and Roman Urdu words", () => {
  const missing = allReadyReasons().filter((r) => !REASON_WORDS[r] || !REASON_WORDS[r][0] || !REASON_WORDS[r][1]);
  assert.deepEqual(missing, []);
  assert.ok(allReadyReasons().length >= 73, "40 new reasons were added to the 33 there were");
  for (const k of Object.keys(STEP_WORDS)) assert.ok(STEP_WORDS[k].ur && STEP_WORDS[k].roman, k);
  assert.ok(LABEL_WORDS["Shop logo"].ur);
});

test("English is word for word the server's message - nothing changes for English", () => {
  const en = sendBackMessage("en", "Hafiz Asghar", "Horain Traders",
    [{ label: "Shop logo", reason: "Has a phone number or website on it" }, { label: "Shop type", reason: "Wrong shop type", vendor_can_fix: false }]);
  assert.equal(en.split("\n")[0], "Assalam o Alaikum Hafiz,");
  assert.match(en, /Takal checked your shop "Horain Traders"\. Please fix these 2 things in the Takal Partners app:/);
  assert.match(en, /1\. Shop logo - Has a phone number or website on it\./);
  assert.match(en, /\(Takal will sort this one out with you\.\)/);
  assert.match(en, /When you have fixed them, press "Send for review again" in the app\.\n\nThank you,\nTakal Team$/);
  // The server writes the same lines (routers/shop_review.py whatsapp_text).
  const py = read("../swat-delivery-app/backend/routers/shop_review.py");
  assert.match(py, /Takal checked your shop "\{shop_name\}"\. Please fix/);
  assert.match(py, /When you have fixed them, press "Send for review again" in the app\./);
});

test("Urdu is Urdu, with English names kept whole; typed words go as typed", () => {
  const ur = sendBackMessage("ur", "Shahid Khan", "Mobile and Accessories",
    [{ label: "Shop logo", reason: "No logo uploaded yet" }, { label: "Shop name", reason: "My own words", words: "Remove 0315" }]);
  assert.match(ur, /^السلام علیکم ⁨Shahid⁩،/);
  assert.ok(ur.includes(`"${isolate("Mobile and Accessories")}"`), "the shop name is kept whole inside the Urdu line");
  assert.ok(ur.includes("دکان کا لوگو: لوگو ابھی نہیں ڈالا گیا۔"));
  assert.ok(ur.includes("My own words"), "a reason typed by hand is sent as typed");
  assert.ok(ur.includes("تکل ٹیم"));
  const roman = sendBackMessage("roman", "Shahid", "Mobile and Accessories", [{ label: "Shop logo", reason: "No logo uploaded yet" }]);
  assert.match(roman, /Takal ne aap ki dukan "Mobile and Accessories" check ki hai/);
  assert.match(roman, /1\. Dukan ka logo - Logo abhi nahi dala gaya\./);
  assert.equal(reasonIn("roman", "Too dark"), "Tasveer bohat andheri hai");
  assert.match(whatIsLeftIn("ur", "Ali Store", ["Shop logo"]), /1۔ دکان کا لوگو/);
  assert.equal(whatIsLeftIn("en", "Ali Store", ["Shop logo"]).split("\n")[0], "Assalam o Alaikum! Thank you for registering Ali Store on Takal.");
});

// ── the lock and the shop's colour ─────────────────────────────────────────
const LOGO = "https://x/logo.webp";
const P1 = "https://x/p1.webp";
const page = (over: any = {}) => ({
  contact: { text_hits: [] },
  pictures: { list: [{ url: LOGO, key: "logo", label: "Shop logo" }, { url: P1, key: "product:a", label: "Trimmer" }], checks: {} },
  same_shop: [], ...over,
}) as any;
const clean = (url: string) => ({ url, hits: [], boxes: [], quality: { width: 800, height: 800, tiny: false, dark: false } });

test("an unread picture keeps Approve shut - unread is not clean", () => {
  const lock = contactLock(page(), { [LOGO]: clean(LOGO) });
  assert.match(lock!, /every picture has been checked .*1 of 2/);
  assert.equal(contactLock(page(), { [LOGO]: clean(LOGO), [P1]: clean(P1) }), null);
});

test("a number in the words or on a picture locks it for everybody, and says where", () => {
  const words = page({ contact: { text_hits: [{ key: "shop.description", label: "Description", field: "description", excerpt: "WhatsApp 0344", hits: [{ kind: "phone", text: "0344-9679387" }] }] } });
  const lock = contactLock(words, { [LOGO]: { ...clean(LOGO), hits: [{ kind: "phone", text: "03449679387" }] }, [P1]: clean(P1) });
  assert.match(lock!, /^Hidden from customers/);
  assert.match(lock!, /Found: Description · Shop logo \(picture\)/);
  assert.match(lock!, /not even the main admin/);
});

test("'I looked - not a phone number' frees a PICTURE only", () => {
  const p = page();
  p.pictures.checks[LOGO] = { ...clean(LOGO), hits: [{ kind: "phone", text: "0300" }], not_contact: { by: "Sana", at: "x" } };
  assert.equal(contactFinds(p, { [P1]: clean(P1) }).length, 0);
  assert.equal(contactLock(p, { [P1]: clean(P1) }), null);
});

test("the colour: red for a number, amber for the same shop or a small photo, green otherwise", () => {
  const all = { [LOGO]: clean(LOGO), [P1]: clean(P1) };
  assert.equal(riskOf(page(), all).level, "green");
  assert.equal(riskOf(page({ same_shop: [{ id: "x", name: "Fashion", status: "approved", why: ["Same phone"] }] }), all).level, "amber");
  assert.equal(riskOf(page({ same_shop: [{ id: "x", name: "Old", status: "rejected", why: ["Same phone"] }] }), all).level, "red");
  assert.equal(riskOf(page(), { ...all, [P1]: { ...clean(P1), quality: { width: 200, height: 180, tiny: true, dark: false } } }).level, "amber");
  assert.equal(riskOf(page(), { ...all, [LOGO]: { ...clean(LOGO), hits: [{ kind: "website", text: "www.x.pk" }] } }).title, "CANNOT GO LIVE");
  assert.deepEqual(pictureProgress(page(), all), { done: 2, total: 2, left: 0 });
  assert.equal(riskOf(page({ pictures: { list: [], checks: {} } }), {}).lines[1].text, "No pictures to check yet");
});

// ── the picture reader's sums ───────────────────────────────────────────────
test("small and really dark - the two checks that never flagged a good photo", () => {
  assert.deepEqual(judgeQuality(211, 201, 200), { width: 211, height: 201, tiny: true, dark: false });
  assert.equal(TINY_SIDE, 400);
  assert.equal(judgeQuality(1000, 1000, 80).dark, true);
  // A black-background product shot still has a bright product: not dark.
  const blackShot = new Uint8Array(1000).fill(10); blackShot.fill(230, 0, 80);
  assert.equal(brightTop(blackShot) >= 200, true);
  assert.deepEqual(qualityWords({ width: 211, height: 201, tiny: true, dark: true }), ["Too dark", "Small (211 × 201)"]);
});

test("the red box goes round the words that make up the number", () => {
  const words = [
    { text: "WhatsApp:", bbox: { x0: 10, y0: 10, x1: 90, y1: 30 } },
    { text: "03449679387", bbox: { x0: 100, y0: 10, x1: 250, y1: 30 } },
    { text: "Proprietor", bbox: { x0: 10, y0: 40, x1: 90, y1: 60 } },
  ];
  const boxes = boxesFor([{ kind: "phone", text: "03449679387" }, { kind: "social", text: "WhatsApp" }], words);
  assert.deepEqual(boxes.map((b) => b.x0).sort((a, b) => a - b), [10, 100]);
});

// ── the screens use it ──────────────────────────────────────────────────────
const REVIEW = read("src/app/dashboard/stores/[id]/review/page.tsx");
const CHECKS = read("src/app/dashboard/stores/[id]/review/parts-checks.tsx");

test("the review page: the colour, the red card, the same-shop card, messages and notes", () => {
  assert.match(REVIEW, /const checking = reviewable;/);
  assert.match(REVIEW, /usePictureScan\(id, data, checking\)/);
  assert.match(REVIEW, /<RiskPanel /);
  assert.match(REVIEW, /<ContactCard finds=\{finds\} canMark=\{reviewable\}/);
  assert.match(REVIEW, /<SameShopCard twins=\{data\.same_shop \|\| \[\]\} \/>/);
  assert.match(REVIEW, /<MessagesNotes messages=/);
  assert.match(CHECKS, /Only the office sees these - never the vendor/);
});

test("the rule keeps the shop HIDDEN (not unapproved), with the reason in a note", () => {
  // Sana, 29 Oct 2026: Approve stays open; Show to customers is what is locked.
  assert.match(REVIEW, /data-approve disabled=\{!waiting \|\| busy\}/);
  assert.match(REVIEW, /data-approve-lock role="note"/);
  assert.match(REVIEW, /const lock = contactLock\(data, localChecks\);/);
});

test("WhatsApp: the switch, the preview, and the words kept in the history", () => {
  assert.match(REVIEW, /<WaLangSwitch lang=\{waLang\} onChange=\{setWaLang\}/);
  assert.match(REVIEW, /<WaPreview lang=\{waLang\} text=\{waText\(\)\}/);
  assert.match(REVIEW, /recordWhatsappSent\(id, \{ kind: "send_back", lang: waLang, text \}\)/);
  assert.match(REVIEW, /recordWhatsappSent\(id, \{ kind: "list", lang: waLang, text: listText \}\)/);
  assert.match(read("src/app/dashboard/stores/page.tsx"), /recordWhatsappSent\(id, \{ kind: "what_is_left", lang: "en", text: whatIsLeftMessage\(r\.name, left\) \}\)/);
  assert.match(CHECKS, /dir=\{lang === "ur" \? "rtl" : "ltr"\}/);
  assert.match(CHECKS, /urduFont\.className/);
});

test("every picture opens whole: product cards, the pictures box, the editor, the logo, the review", () => {
  const products = read("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.match(products, /onBig=\{\(\) => seeBig\(p, slide\)\}/);
  assert.match(products, /data-see-big onClick=\{\(\) => seeBig\(picMenu\.p\)\}/);
  assert.match(read("src/app/dashboard/stores/[id]/parts-products-grid.tsx"), /data-see-big onClick=\{props\.onBig\}/);
  const box = read("src/app/dashboard/stores/[id]/parts-pictures-box.tsx");
  assert.match(box, /onClick=\{\(\) => setBigAt\(i\)\}/);
  assert.match(box, /useDialogKeys\(true, onClose, uploading > 0 \|\| bigAt !== null\)/);
  assert.match(read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx"), /onClick=\{\(\) => setBigOpen\(true\)\}/);
  assert.match(read("src/app/dashboard/stores/[id]/page.tsx"), /onClick=\{\(\) => setLogoBig\(true\)\}/);
  assert.match(REVIEW, /<PictureViewer pictures=\{view\.list\}/);
  const viewer = read("src/components/PictureViewer.tsx");
  assert.match(viewer, /object-contain/);
  assert.match(viewer, /e\.key === "ArrowRight"/);
  assert.match(viewer, /<svg data-found-boxes/);
});

test("the product editor warns before Save; the server refuses after", () => {
  assert.match(read("src/app/dashboard/stores/[id]/ProductEditorModal.tsx"), /findContactInfo\(`\$\{name\}\\n\$\{description\}`\)/);
});

test("the picture reader is the panel's own files - nothing from anybody else", () => {
  for (const f of ["tesseract.min.js", "worker.min.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js",
                   "eng.traineddata.gz", "LICENSE-tesseract.js.md", "LICENSE-tesseract.js-core.txt"]) {
    assert.ok(existsSync(new URL(`public/ocr/${f}`, root)), f);
  }
  assert.ok(statSync(new URL("public/ocr/eng.traineddata.gz", root)).size > 2_000_000);
  const check = read("src/lib/picture-check.ts");
  assert.match(check, /s\.src = "\/ocr\/tesseract\.min\.js";/);
  assert.match(check, /workerBlobURL: false/);
  assert.doesNotMatch(check, /import\("tesseract\.js"\)/);
  const csp = read("next.config.js");
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https:\/\/www\.gstatic\.com"/);
  assert.match(csp, /"worker-src 'self'"/);
});

test("the new doors and the server's guard lines agree", () => {
  const nav = read("src/lib/navigation.ts");
  const guard = read("../swat-delivery-app/backend/app_guard.py");
  assert.match(nav, /\["\/admin\/restaurants\/\*\/picture-checks", "stores\.approve"\]/);
  assert.match(nav, /\["\/admin\/restaurants\/\*\/notes", \["stores\.all", "stores\.approve"\]\]/);
  assert.match(guard, /\("\/admin\/restaurants\/\*\/picture-checks", "stores\.approve"\)/);
  assert.match(guard, /\("\/admin\/restaurants\/\*\/notes",\s+\("stores\.all", "stores\.approve"\)\)/);
});
