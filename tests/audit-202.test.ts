// AUDIT 202 (19 October 2026) - the product editor, fixed-price stores, the
// Approve checklist, the catalogue Undo after a reload, and the Create store
// handover.
//
// A1 A new product whose pictures or options fail is remembered, so Save
//    again finishes IT - never a second copy - and the list is read again.
// A2 A new product in a fixed-price store asks for its buying price and sends
//    it; "hidden until it has a buying price" is shown in the server's words.
// A3 Approve shows the server's own checklist and is ready only when nothing
//    is missing; the main admin keeps "Approve anyway"; refusals stay on screen.
// A4 The catalogue upload's Undo ids are kept in this browser for the hour.
// A5 The handover says the app will ask for a new password; the phone hint is
//    the server's 03XXXXXXXXX.
// A6 "Customer pays" is the server's figure.
// A7 A 503 the app itself sent shows the app's words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buyingPriceProblem, partsFailedMessage, sellsAtALoss } from "../src/lib/product-save.ts";
import {
  approveState, approveWithChecklist, missingForApproval, type ShopChecklist,
} from "../src/lib/approve-rule.ts";
import {
  UNDO_WINDOW_MS, forgetUpload, keepUpload, keptUpload, minutesLeft, undoKey, type SmallStorage,
} from "../src/lib/upload-undo.ts";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const EDITOR = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const TAB = code("src/app/dashboard/stores/[id]/parts-products.tsx");
const BAR = code("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const LIST = code("src/app/dashboard/stores/page.tsx");
const SAVE = code("src/app/dashboard/stores/[id]/catalogue/parts-save.tsx");
const CATALOGUE = code("src/app/dashboard/stores/[id]/catalogue/page.tsx");
const CHECK = code("src/app/dashboard/stores/[id]/catalogue/parts-check.tsx");
const WIZARD = code("src/app/dashboard/stores/parts-create-store.tsx");
const CORE = code("src/lib/api-core.ts");

// ── A1 ──────────────────────────────────────────────────────────────────────

test("A1: the words say exactly which part did not save", () => {
  assert.equal(partsFailedMessage(true, []), null);
  assert.equal(partsFailedMessage(true, ["pictures"]),
    "Product saved, but its pictures did not upload - press Save to try again");
  assert.equal(partsFailedMessage(true, ["options"]),
    "Product saved, but its options did not save - press Save to try again");
  assert.equal(partsFailedMessage(true, ["pictures", "options"]),
    "Product saved, but its pictures and options did not save - press Save to try again");
  assert.equal(partsFailedMessage(false, ["pictures"]),
    "Changes saved, but its pictures did not upload - press Save to try again");
});

test("A1: the new product is remembered the moment it is made", () => {
  assert.match(EDITOR, /const \[createdId, setCreatedId\] = useState<string \| null>\(null\);/);
  // Audit 203: the product being edited may also be one the box adopted
  // (A10), and only the boxes that changed are sent (A2).
  assert.match(EDITOR, /let productId = editId \|\| createdId \|\| "";/);
  assert.match(EDITOR, /const madeNow = !productId;[\s\S]{0,400}if \(!madeNow\) \{\s*const send = onlyChanged\(base \|\| \{\}, payload\);[\s\S]{0,400}await apiClient\.updateMenuItem\(productId, send\);/,
    "a product made by an earlier press is UPDATED, never made again");
  assert.match(EDITOR, /productId = String\(res\?\.item\?\.id \|\| ""\);\s*if \(!productId\) throw new Error\("Could not save the product"\);\s*setCreatedId\(productId\);/);
});

test("A1: pictures and options are tried one by one, and a failure keeps the box open", () => {
  assert.match(EDITOR, /catch \{\s*failed\.push\("pictures"\);\s*\}/);
  assert.match(EDITOR, /catch \{\s*failed\.push\("options"\);\s*\}/);
  assert.match(EDITOR, /if \(partly\) \{\s*setProblem\(partly\);\s*toast\(partly, "error"\);\s*onChanged\?\.\(\);\s*return;\s*\}/);
  assert.match(EDITOR, /data-testid="save-problem"/);
  assert.match(EDITOR, /createdId \? "Save again" : "Add product"/);
  assert.match(EDITOR, /createdId \? "Close" : "Cancel"/);
});

test("A1: the products tab reads its list again without closing the box", () => {
  // MOCK 203 v2: every store's cards show a buying price, so it is read again too.
  assert.match(TAB, /onChanged=\{\(\) => \{ setReloadKey\(\(k\) => k \+ 1\); if \(fixed \|\| prepare \|\| showBuy\) reloadPrices\(\); \}\}/);
});

// ── A2 ──────────────────────────────────────────────────────────────────────

test("A2: the buying price is whole rupees and required", () => {
  assert.ok(buyingPriceProblem(""));
  assert.ok(buyingPriceProblem("12.5"));
  assert.ok(buyingPriceProblem("-3"));
  assert.ok(buyingPriceProblem("abc"));
  assert.equal(buyingPriceProblem("450"), null);
  assert.equal(buyingPriceProblem(" 0 "), null);
});

test("A2: a buying price above what the customer pays is a loss", () => {
  assert.equal(sellsAtALoss("600", "690", "10"), false, "Walnut: 690 - 10% = 621 > 600");
  assert.equal(sellsAtALoss("1200", "1150", "0"), true, "Pistachio sells at a loss");
  assert.equal(sellsAtALoss("650", "690", "10"), true, "the discount makes it a loss");
  assert.equal(sellsAtALoss("", "690", "0"), false);
});

test("A2: a new product in a fixed-price store asks for and sends its buying price", () => {
  assert.match(EDITOR, /const needsBuying = fixedPrice && !editing && !createdId;/);
  assert.match(EDITOR, /if \(needsBuying\) payload\.buying_price = parseInt\(buying\.trim\(\), 10\);/);
  // MOCK 203 v2: Buy · Sell · Disc · Stock on one line - "Buy *" is the buying price.
  assert.match(EDITOR, /<span className=\{labelCls\}>Buy\{needsBuying \? " \*" : ""\}<\/span>/);
  assert.match(EDITOR, /aria-label="Buying price \(Rs\)"/);
  assert.match(EDITOR, /Takal pays the shop the <b>Buy<\/b> price; customers see the fixed selling price\./);
  assert.match(EDITOR, /needsBuying \? "Selling price \(Rs\)" : "Price \(Rs\)"/);
  // Once made, its prices belong to the Products tab like any other.
  assert.match(EDITOR, /const pricesLocked = \(editing \|\| !!createdId\) && fixedPrice;/);
});

test("A2: 'hidden until it has a buying price' is said in the server's words", () => {
  assert.match(EDITOR, /if \(res\?\.hidden_until_buying_price === true\) \{\s*setAvailable\(false\);/);
  assert.match(EDITOR, /String\(res\?\.message \|\|/);
});

test("A1/A2: a 409 or 400 from the server is shown in its own words", () => {
  assert.match(EDITOR, /const said = err instanceof Error \? err\.message : "Failed to save product";/);
  assert.match(EDITOR, /setProblem\(told\);/);
});

// ── A3 ──────────────────────────────────────────────────────────────────────

const LIST_OF: ShopChecklist = {
  ready: false, done: 6, total: 8,
  steps: [
    { key: "details", label: "Shop details and phone", done: true },
    { key: "logo", label: "Shop logo", done: false, note: "No picture on the shop" },
    { key: "products", label: "At least 5 products", done: false, note: "3 of 5" },
    { key: "terms", label: "Owner has signed in and accepted the Terms", done: false },
  ],
};

test("A3: what is missing comes from the server's steps - a new check appears by itself", () => {
  assert.deepEqual(missingForApproval(LIST_OF), ["Shop logo", "Owner has signed in and accepted the Terms"]);
  assert.deepEqual(missingForApproval({ what_is_left: ["Shop logo", "At least 5 products"] }), ["Shop logo"]);
  assert.deepEqual(missingForApproval({ steps: [{ key: "logo", label: "Shop logo", done: true }] }), []);
  assert.equal(missingForApproval(null), null, "not read is not 'nothing missing'");
});

test("A3: Approve is ready only when nothing is missing; the main admin keeps Approve anyway", () => {
  const enough = approveState({ product_count: 9 }, false);
  assert.equal(approveWithChecklist(enough, [], false).button, "approve");
  assert.equal(approveWithChecklist(enough, null, false).button, "approve", "not read: the server checks");
  const sub = approveWithChecklist(enough, ["Shop logo"], false);
  assert.equal(sub.button, "none");
  assert.equal(sub.why, "Still missing: Shop logo");
  assert.equal(approveWithChecklist(approveState({ product_count: 9 }, true), ["Shop logo"], true).button, "anyway");
  // The products rule still comes first.
  assert.equal(approveWithChecklist(approveState({ product_count: 2 }, false), [], false).button, "none");
});

test("A3: the store page reads THIS shop's checklist from its own door, for rejected shops too", () => {
  assert.match(BAR, /apiClient\.getShopChecklist\(String\(r\.id\)\)/);
  assert.match(BAR, /const wantsList = status === "pending" \|\| status === "rejected";/);
  assert.match(BAR, /approveWithChecklist\(approveState\(\{ product_count: productCount \}, isMain\), left, isMain\)/);
  assert.match(BAR, /data-testid="approve-checklist"/);
  assert.match(BAR, /\{s\.done \? "✓" : "✕"\}/);
});

test("A3: a refused Approve stays on screen and the checklist is read again", () => {
  assert.match(BAR, /if \(approving\) \{\s*setRefused\(said\);\s*setListOpen\(true\);\s*readList\(\);/);
  assert.match(LIST, /setRefused\(\{ id: String\(restaurantId\), message: said \}\);/);
  assert.match(LIST, /data-testid="approve-refused"/);
});

test("A3: the Stores list asks for a rejected shop's checklist only when Approve is pressed", () => {
  assert.match(LIST, /const approveAfterAll = async \(restaurant: any\) => \{/);
  assert.match(LIST, /list = await apiClient\.getShopChecklist\(id\) as Checklist;/);
  assert.match(LIST, /\? setAnyway\(restaurant\) : approveAfterAll\(restaurant\)\}/);
  // Never one read per row.
  assert.doesNotMatch(LIST, /restaurants\.map\([^)]*getShopChecklist/);
});

// ── A4 ──────────────────────────────────────────────────────────────────────

function fakeStorage(): SmallStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

test("A4: an upload is kept per store and offered again within the hour", () => {
  const s = fakeStorage();
  const at = Date.UTC(2026, 9, 19, 9, 0);
  keepUpload(s, "shop-1", ["a", "b"], at);
  assert.deepEqual(keptUpload(s, "shop-1", at + 30 * 60_000), { ids: ["a", "b"], at });
  assert.equal(keptUpload(s, "shop-2", at), null, "another store's upload is its own");
  assert.equal(minutesLeft(at, at + 30 * 60_000), 30);
  assert.equal(minutesLeft(at, at + UNDO_WINDOW_MS - 1), 1);
});

test("A4: after the hour, or after an undo, it is gone", () => {
  const s = fakeStorage();
  const at = 1_000_000;
  keepUpload(s, "shop-1", ["a"], at);
  assert.equal(keptUpload(s, "shop-1", at + UNDO_WINDOW_MS), null);
  assert.equal(s.data.has(undoKey("shop-1")), false, "an expired entry is cleared");
  keepUpload(s, "shop-1", ["a"], at);
  forgetUpload(s, "shop-1");
  assert.equal(keptUpload(s, "shop-1", at), null);
});

test("A4: broken or blocked storage never breaks the page", () => {
  const s = fakeStorage();
  s.setItem(undoKey("shop-1"), "{not json");
  assert.equal(keptUpload(s, "shop-1"), null);
  const blocked: SmallStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("full"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.doesNotThrow(() => keepUpload(blocked, "shop-1", ["a"]));
  assert.equal(keptUpload(blocked, "shop-1"), null);
  assert.doesNotThrow(() => forgetUpload(blocked, "shop-1"));
  assert.equal(keptUpload(null, "shop-1"), null);
});

test("A4: every saved part is kept, an undo forgets it, and a reload offers it", () => {
  assert.match(SAVE, /if \(add\) keepUpload\(browserStorage\(\), shopId, t\.ids\);/);
  assert.match(SAVE, /setUndone\(true\);\s*forgetUpload\(browserStorage\(\), shopId\);/);
  assert.match(SAVE, /export function KeptUploadUndo\(\{ shopId \}: \{ shopId: string \}\)/);
  assert.match(CATALOGUE, /\{step === 1 && <KeptUploadUndo shopId=\{shopId\} \/>\}/);
});

// ── A5 ──────────────────────────────────────────────────────────────────────

test("A5: the handover says the Partners app will ask for a new password", () => {
  assert.match(WIZARD, /The Takal Partners app will ask you to choose a new password the first time you sign in\./);
  assert.doesNotMatch(WIZARD, /Please change this password/);
  assert.match(WIZARD, /Saved as \$\{savedPhone\(phone\)\} — the vendor signs in with this/);
});

// ── A6 ──────────────────────────────────────────────────────────────────────

test("A6: 'customer pays' is the server's figure, never worked out here", () => {
  assert.match(CHECK, /typeof one\.pays === "number" \? money\(one\.pays\) : "—"/);
  assert.match(CHECK, /r\.fixed_price \? "after discount" : "after discount \+ markup"/);
  assert.doesNotMatch(CHECK, /customerPays\(/);
});

// ── A7 ──────────────────────────────────────────────────────────────────────

test("A7: a 503 the app sent, with its own words, is shown - a proxy's is not", () => {
  assert.match(CORE, /if \(response\.status === 503\) \{\s*const body = await response\.clone\(\)\.json\(\)/);
  assert.match(CORE, /if \(said\) throw Object\.assign\(new Error\(said\), \{ status: 503, detail: body\.detail \}\);/);
  assert.match(CORE, /The server didn't confirm this request/, "the careful message stays for a proxy");
});
