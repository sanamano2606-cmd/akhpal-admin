// AUDIT 203 (19 October 2026) - editing a product from the office.
//
// A1 A product that could not be read: Save stays locked with Retry - nothing
//    (not even the description) is sent from boxes that were never filled.
// A2 The editor starts from a FRESH read and sends only what changed: product
//    boxes, option boxes (type/value always, as the key), photos, featured.
// A3 An emptied box clears: stock -> null, option stock -> null, option price
//    -> null ("uses the product price").
// A4 A fixed-price store's option prices are locked like the product's.
// A5 A new fixed-price product at a loss asks, then sends confirm_loss.
// A6 Prescription mark, preparation time, key details, option code/barcode,
//    switched-off options, One price (drop_choices), video, size guide.
// A7 The Prices list can clear a buying price (clear_buying).
// A8 A restaurant size with no price of its own uses the product's price.
// A9 The list's On/Off switch sends the state wanted.
// A10 A timed-out "Add product" then "already in this shop": edit THAT one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  answerWasLost, cooksFood, draftsFromOptions, existingIdOf, extraDrafts, isSameName, lossOf,
  onlyChanged, optionChanges, optionKey, optionsAfterSave, optionsProblem, prepFromBox,
  productBaseline, sameCatalogueName, samePhotos, sizeDrafts, specsChanged, specsFromText,
  specsProblem, specsToText, stockFromBox, tidyName, wearsSizes, type LoadedOption,
} from "../src/lib/product-edit.ts";
import { cheapestSize, extrasFromVariants, sizesFromVariants, sizesProblem } from "../src/lib/product-sizes.ts";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const EDITOR = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
const TAB = code("src/app/dashboard/stores/[id]/parts-products.tsx");
const PRICES = code("src/app/dashboard/stores/[id]/parts-products-prices.tsx");
const API = code("src/lib/api-stores.ts");
const CORE = code("src/lib/api-core.ts");

// ── A1 ──────────────────────────────────────────────────────────────────────

test("A1: a product that could not be read keeps Save locked, with Retry", () => {
  assert.match(EDITOR, /disabled=\{saving \|\| \(editing && !detailLoaded\)\}/);
  assert.match(EDITOR, /if \(editing && !detailLoaded\) \{/);
  assert.match(EDITOR, /data-testid="load-failed"/);
  assert.match(EDITOR, /Couldn&apos;t load this product\./);
  assert.match(EDITOR, /onClick=\{\(\) => setLoadTry\(\(n\) => n \+ 1\)\}/, "Retry reads it again");
  assert.match(EDITOR, /\}, \[editId, loadTry\]\);/);
  // The old "text and price saved, photos left alone" path is gone.
  assert.doesNotMatch(EDITOR, /Text and price saved/);
  assert.doesNotMatch(EDITOR, /if \(!detailFailed\) \{/);
});

// ── A2 ──────────────────────────────────────────────────────────────────────

test("A2: the fresh read becomes what Save compares with", () => {
  const b = productBaseline({
    name: "  Panadol   500mg ", description: null, price: "120", discount_percent: null,
    stock: null, is_available: true, category_id: 7, preparation_time: 15,
    specs: '{"Brand":"GSK"}', video_url: " ",
  });
  assert.deepEqual(b, {
    name: "Panadol 500mg", description: "", price: 120, discount_percent: 0, stock: null,
    is_available: true, category_id: "7", preparation_time: 15, specs: '{"Brand":"GSK"}', video_url: null,
  });
  assert.equal(tidyName(" a   b "), "a b");
});

test("A2: only the boxes that changed are sent", () => {
  const before = { name: "Tea", description: "", price: 100, discount_percent: 0, stock: 5, is_available: true };
  assert.deepEqual(onlyChanged(before, { ...before }), {}, "nothing changed = nothing sent");
  assert.deepEqual(onlyChanged(before, { ...before, price: 110 }), { price: 110 });
  assert.deepEqual(onlyChanged(before, { ...before, stock: null }), { stock: null }, "emptied stock clears");
  assert.deepEqual(onlyChanged(before, { ...before, description: "Fresh" }), { description: "Fresh" });
  assert.deepEqual(onlyChanged({ price: 100 }, { price: "100" as unknown as number }), {}, "100 and '100' are the same");
  assert.deepEqual(onlyChanged({ x: null }, { x: undefined }), {}, "undefined is never sent");
});

test("A2: the editor reads the product and EVERY option fresh, and sends only changes", () => {
  assert.match(EDITOR, /apiClient\.getProduct\(editId, \{ fresh: true \}\)/);
  assert.match(EDITOR, /apiClient\.getProductVariants\(editId, \{ fresh: true \}\)/);
  assert.match(EDITOR, /setBase\(productBaseline\(full\)\);/);
  assert.match(EDITOR, /setName\(String\(full\?\.name \?\? ""\)\);/, "the name comes from the read, not the list row");
  assert.match(EDITOR, /setStock\(full\?\.stock != null \? String\(full\.stock\) : ""\);/);
  assert.match(EDITOR, /const send = onlyChanged\(base \|\| \{\}, payload\);/);
  assert.match(EDITOR, /if \(Object\.keys\(send\)\.length > 0\) \{\s*await apiClient\.updateMenuItem\(productId, send\);/,
    "an empty change is not sent (the server would refuse it)");
  assert.match(EDITOR, /if \(!samePhotos\(loadedPhotos, list\)\) \{/, "photos only when they changed");
  assert.match(EDITOR, /if \(canFeature && featured !== loadedFeatured\) try \{/, "featured only when it changed");
  assert.match(EDITOR, /toast\("Nothing was changed", "info"\);/);
  assert.match(API, /async getProduct\(itemId: string, opts: \{ fresh\?: boolean \} = \{\}\)/);
  assert.match(API, /\$\{opts\.fresh \? `\?fresh=\$\{Date\.now\(\)\}` : ""\}/);
});

test("A2: the same photos in the same order are not sent again", () => {
  assert.equal(samePhotos(["a", "b"], ["a", " b ", ""]), true);
  assert.equal(samePhotos(["a", "b"], ["b", "a"]), false, "a new cover is a change");
  assert.equal(samePhotos(["a"], []), false);
  assert.equal(samePhotos([], []), true);
});

const LOADED: LoadedOption[] = [
  { id: "m", variant_type: "Size", variant_value: "M", sku: "SKU-M", stock_quantity: 5, price_override: 900, is_available: true },
  { id: "l", variant_type: "Size", variant_value: "L", sku: null, stock_quantity: null, price_override: null, is_available: true },
  { id: "xl", variant_type: "Size", variant_value: "XL", sku: null, stock_quantity: 0, price_override: 1100, is_available: false },
];

test("A2: options - nothing changed = no call at all", () => {
  assert.equal(optionChanges(LOADED, draftsFromOptions(LOADED)), null);
});

test("A2: options - only the changed box is sent; every ON option is named by its key", () => {
  const d = draftsFromOptions(LOADED);
  d[0].stock = "7";
  assert.deepEqual(optionChanges(LOADED, d), {
    variants: [
      { variant_type: "Size", variant_value: "M", stock_quantity: 7 },
      { variant_type: "Size", variant_value: "L" },
    ],
  }, "XL is off and untouched, so it is not sent - the server keeps it");
});

// ── A3 ──────────────────────────────────────────────────────────────────────

test("A3: an emptied option box clears - stock not counted, price = the product's", () => {
  const d = draftsFromOptions(LOADED);
  d[0].stock = "";
  d[0].price = " ";
  const body = optionChanges(LOADED, d)!;
  assert.deepEqual(body.variants[0], { variant_type: "Size", variant_value: "M", stock_quantity: null, price_override: null });
});

test("A3: the product's stock box - empty is null, not 'leave it'", () => {
  assert.deepEqual(stockFromBox(""), { ok: true, value: null });
  assert.deepEqual(stockFromBox(" 12 "), { ok: true, value: 12 });
  assert.equal(stockFromBox("abc").ok, false, "abc used to be saved as 0 in stock");
  assert.equal(stockFromBox("-1").ok, false);
  assert.match(EDITOR, /payload\.stock = stockOk\.value;/);
  assert.match(EDITOR, /placeholder="Not counted"/);
  assert.match(EDITOR, /placeholder="Product price"/);
});

// ── A4 ──────────────────────────────────────────────────────────────────────

test("A4: a fixed-price store - option prices locked, the loaded price sent back as it was", () => {
  const d = draftsFromOptions(LOADED);
  d[1].stock = "3";
  d[0].price = "1";           // typed somehow - never sent
  const body = optionChanges(LOADED, d, { fixedPrice: true })!;
  assert.deepEqual(body.variants, [
    { variant_type: "Size", variant_value: "M", price_override: 900 },
    { variant_type: "Size", variant_value: "L", stock_quantity: 3, price_override: null },
  ]);
  assert.equal(optionChanges(LOADED, draftsFromOptions(LOADED), { fixedPrice: true }), null,
    "the price alone is not a change");
  // A new option in such a store goes without a price (set on the Products tab).
  const add = optionChanges([], [{ variant_type: "Size", variant_value: "S", price: "500", on: true }], { fixedPrice: true })!;
  assert.deepEqual(add.variants, [{ variant_type: "Size", variant_value: "S" }]);
  assert.match(EDITOR, /readOnly=\{pricesLocked\} value=\{v\.price \?\? ""\}/);
  assert.match(EDITOR, /Option prices are set on the <b>Products<\/b> tab/);
});

// ── A5 ──────────────────────────────────────────────────────────────────────

test("A5: the loss answer is read, asked about, and sent again with confirm_loss", () => {
  const err = Object.assign(new Error("would be sold for less"), {
    status: 409, detail: { message: "...", losses: [{ name: "Panadol", buying_price: 140, customer_pays: 120, loss_each: 20 }] },
  });
  assert.deepEqual(lossOf(err), { name: "Panadol", lossEach: 20 });
  assert.equal(lossOf(Object.assign(new Error("x"), { status: 409, detail: "This shop already has" })), null);
  assert.equal(lossOf(Object.assign(new Error("x"), { status: 400, detail: { losses: [{}] } })), null);
  assert.match(EDITOR, /const loss = needsBuying && !confirmLoss \? lossOf\(err\) : null;/);
  assert.match(EDITOR, /This sells below its buying price \(loss \$\{money\(lossAsk\.lossEach\)\} each\)\. Save anyway\?/);
  assert.match(EDITOR, /onConfirm=\{\(\) => \{ setLossAsk\(null\); save\(true\); \}\}/);
  assert.match(EDITOR, /if \(needsBuying && confirmLoss\) payload\.confirm_loss = true;/);
});

// ── A6 ──────────────────────────────────────────────────────────────────────

test("A6: prescription - a read-only line in the editor, an Rx tag in the list", () => {
  assert.match(EDITOR, /setRx\(full\?\.needs_prescription === true\);/);
  assert.match(EDITOR, /Needs a prescription - set by its shelf \/ medicine rules/);
  assert.doesNotMatch(EDITOR, /needs_prescription:/, "never sent - the server decides it");
  assert.match(TAB, /\{p\.needs_prescription === true && \(/);
  assert.match(API, /needs_prescription\?: boolean;/);
});

test("A6: preparation time - shops that cook only, 0 to 1440 minutes, empty clears", () => {
  assert.equal(cooksFood("restaurant"), true);
  assert.equal(cooksFood("bakery"), true);
  assert.equal(cooksFood("pharmacy"), false);
  assert.deepEqual(prepFromBox(""), { ok: true, value: null });
  assert.deepEqual(prepFromBox("25"), { ok: true, value: 25 });
  assert.equal(prepFromBox("1441").ok, false);
  assert.equal(prepFromBox("2.5").ok, false);
  assert.match(EDITOR, /const prepOk = food \? prepFromBox\(prep\) : null;/);
  assert.match(EDITOR, /if \(prepOk\) payload\.preparation_time = prepOk\.value;/);
});

test("A6: key details round-trip exactly; untouched values keep their own kind", () => {
  const raw = '{"Brand":"GSK","Pack":12,"Barcode":"8964000123456"}';
  const { rows, editable } = specsFromText(raw);
  assert.equal(editable, true);
  assert.deepEqual(rows.map((r) => [r.key, r.value]), [["Brand", "GSK"], ["Pack", "12"], ["Barcode", "8964000123456"]]);
  assert.equal(specsToText(rows), raw, "read and written back, it is the same text");
  assert.equal(specsChanged(rows, rows.map((r) => ({ ...r }))), false);
  const edited = rows.map((r) => ({ ...r }));
  edited[0].value = "Haleon";
  assert.equal(specsChanged(rows, edited), true);
  assert.equal(specsToText(edited), '{"Brand":"Haleon","Pack":12,"Barcode":"8964000123456"}');
  assert.equal(specsToText([]), null, "an empty list clears the details");
  assert.equal(specsToText([{ key: " ", value: "" }]), null);
  assert.deepEqual(specsFromText(null), { rows: [], editable: true });
  assert.equal(specsFromText("not json").editable, false, "kept as it is, never sent");
  assert.equal(specsFromText('["a"]').editable, false);
  assert.equal(specsFromText('{"Sizes":{"S":1}}').editable, false);
  assert.equal(specsFromText({ Brand: "X" }).rows[0].value, "X", "a server that sends an object");
});

test("A6: key details - the limits in words", () => {
  assert.equal(specsProblem([{ key: "", value: "x" }]), "Type a name for every key detail (for example Brand)");
  assert.equal(specsProblem([{ key: "Brand", value: "a" }, { key: "Brand", value: "b" }]), "Two key details are both called Brand");
  assert.match(specsProblem(Array.from({ length: 31 }, (_, i) => ({ key: `k${i}`, value: "v" })))!, /Up to 30/);
  assert.match(specsProblem([{ key: "x".repeat(61), value: "v" }])!, /60 letters at most/);
  assert.equal(specsProblem([{ key: "Barcode", value: "123" }]), null);
  assert.match(EDITOR, /if \(specsEditable && specsChanged\(loadedSpecs, specs\)\) payload\.specs = specsToText\(specs\);/);
  assert.match(EDITOR, /＋ Barcode/);
});

test("A6: an option's code / barcode can be changed, and emptied", () => {
  const d = draftsFromOptions(LOADED);
  d[0].sku = "";
  d[1].sku = " 8964 ";
  const body = optionChanges(LOADED, d)!;
  assert.deepEqual(body.variants, [
    { variant_type: "Size", variant_value: "M", sku: "" },
    { variant_type: "Size", variant_value: "L", sku: "8964" },
  ]);
  assert.match(EDITOR, /aria-label=\{`Code or barcode of \$\{label\}`\}/);
});

test("A6: switched-off options are shown, can be switched on, and an off one changed stays off", () => {
  const d = draftsFromOptions(LOADED);
  assert.equal(d[2].on, false, "XL is read as off");
  d[2].on = true;
  assert.deepEqual(optionChanges(LOADED, d)!.variants[2], { variant_type: "Size", variant_value: "XL", is_available: true });
  const e = draftsFromOptions(LOADED);
  e[2].stock = "4";
  assert.deepEqual(optionChanges(LOADED, e)!.variants[2],
    { variant_type: "Size", variant_value: "XL", stock_quantity: 4, is_available: false },
    "an older server switches a sent option on unless told");
  const f = draftsFromOptions(LOADED);
  f[0].on = false;
  assert.deepEqual(optionChanges(LOADED, f)!.variants[0], { variant_type: "Size", variant_value: "M", is_available: false });
  assert.match(API, /variants\?include_unavailable=true/);
});

test("A6: a deleted option - on or off - goes in remove_ids", () => {
  const d = draftsFromOptions(LOADED).filter((x) => x.id !== "xl" && x.id !== "l");
  assert.deepEqual(optionChanges(LOADED, d), {
    variants: [{ variant_type: "Size", variant_value: "M" }],
    remove_ids: ["l", "xl"],
  });
});

test("A6: a renamed option is a new one, and the old one is removed", () => {
  const d = draftsFromOptions(LOADED);
  d[1].variant_value = "Large";
  const body = optionChanges(LOADED, d)!;
  assert.deepEqual(body.variants[1], { variant_type: "Size", variant_value: "Large" });
  assert.deepEqual(body.remove_ids, ["l"]);
  // Renamed onto a name the product already has: that one is changed.
  const e = draftsFromOptions(LOADED).filter((x) => x.id !== "xl");
  e[1].variant_value = "XL";
  const body2 = optionChanges(LOADED, e)!;
  assert.deepEqual(body2.remove_ids, ["l"]);
  assert.deepEqual(body2.variants[1], { variant_type: "Size", variant_value: "XL", stock_quantity: null, price_override: null, is_available: true });
});

test("A6: new options carry only what was typed", () => {
  const body = optionChanges(LOADED, [...draftsFromOptions(LOADED),
    { variant_type: " Colour ", variant_value: "Red", stock: "", price: "", sku: "", on: true }])!;
  assert.deepEqual(body.variants.at(-1), { variant_type: "Colour", variant_value: "Red" });
  assert.equal(optionKey(" Size ", "m"), optionKey("size", "M "));
});

test("A6: the grid says what is wrong before anything is sent", () => {
  assert.equal(optionsProblem([{ variant_type: "Size", variant_value: "", on: true }]),
    "Every option needs both a kind (Size) and a value (M)");
  assert.equal(optionsProblem([
    { variant_type: "Size", variant_value: "M", on: true }, { variant_type: "size", variant_value: "m ", on: true }]),
    "Two options are both size m");
  assert.match(optionsProblem([{ variant_type: "Size", variant_value: "M", stock: "2.5", on: true }])!, /whole number/);
  assert.equal(optionsProblem([{ variant_type: "", variant_value: "", stock: "", price: "", sku: "", on: true }]), null,
    "an empty row is ignored");
});

test("A6: One price drops every choice and keeps the extras", () => {
  const dish: LoadedOption[] = [
    { id: "s", variant_type: "Size", variant_value: "Small", price_override: 650, is_available: true },
    { id: "o", variant_type: "Size", variant_value: "Large", price_override: 1300, is_available: false },
    { id: "e", variant_type: "Extra", variant_value: "Cheese", price_override: 150, is_available: true },
  ];
  const extras = extraDrafts(extrasFromVariants(dish));
  assert.deepEqual(optionChanges(dish, extras, { dropChoices: true }), {
    variants: [{ variant_type: "Extra", variant_value: "Cheese" }],
    drop_choices: true,
  });
  assert.equal(optionChanges(dish.filter((v) => v.id === "e"), extras, { dropChoices: true }), null,
    "a dish that had no sizes: nothing to drop");
  assert.match(EDITOR, /dropChoices: isRestaurant && !sized && !otherOptions,/);
  assert.match(API, /more: \{ remove_ids\?: string\[\]; drop_choices\?: true \} = \{\}/);
  assert.match(API, /body: JSON\.stringify\(\{ variants, \.\.\.more \}\),/);
});

test("A6: sizes and extras keep their id and their switch when read", () => {
  const rows = sizesFromVariants([{ id: "a", variant_type: "Size", variant_value: "Half", price_override: 500, is_available: false }]);
  assert.deepEqual(rows, [{ name: "Half", price: "500", id: "a", off: true }]);
  assert.deepEqual(sizeDrafts(rows), [{ id: "a", variant_type: "Size", variant_value: "Half", price: "500", on: false }]);
  // A row typed here keeps the plain shape.
  assert.deepEqual(sizesFromVariants([{ variant_type: "Size", variant_value: "Full", price_override: 900 }]),
    [{ name: "Full", price: "900" }]);
});

test("A6: video - shown, removed with video_url null, uploaded through the vendor's door", () => {
  assert.match(EDITOR, /payload\.video_url = video\?\.url \?\? null;/);
  assert.match(EDITOR, /send\.video_duration_seconds = video \? video\.seconds : 0;/);
  assert.match(EDITOR, /await apiClient\.uploadVideo\(file\)/);
  assert.match(EDITOR, /aria-label="Remove the video"/);
  assert.match(API, /\/restaurants\/upload-video/);
});

test("A6: size guide - shown, view only, for shops that sell sizes", () => {
  assert.equal(wearsSizes("clothing_store"), true);
  assert.equal(wearsSizes("grocery"), false);
  assert.match(EDITOR, /data-testid="size-guide"/);
  assert.match(EDITOR, /view only · the shop edits it in the Partners app/);
  assert.doesNotMatch(EDITOR, /size-guide`/, "not written from here");
});

// ── A7 ──────────────────────────────────────────────────────────────────────

test("A7: the Prices list can clear a buying price, after asking", () => {
  assert.match(PRICES, /clear_buying\?: boolean;/);
  assert.match(PRICES, /await save\(\[\{ product_id: item\.id, clear_buying: true \}\]\);/);
  assert.match(PRICES, /await save\(\[\{ product_id: item\.id, variant_id: option\.id, clear_buying: true \}\]\);/);
  assert.match(PRICES, /✕ Clear buying price/);
  assert.match(PRICES, /Yes, clear/);
  assert.match(API, /clear_buying\?: boolean;/, "the door already takes it");
});

// ── A8 ──────────────────────────────────────────────────────────────────────

test("A8: a size with no price of its own uses the product's price - Save is not blocked", () => {
  const rows = sizesFromVariants([
    { variant_type: "Size", variant_value: "Regular", price_override: null },
    { variant_type: "Size", variant_value: "Large", price_override: 900 },
  ]);
  assert.equal(sizesProblem(rows), "Type a price for Regular", "a new dish still needs every price");
  assert.equal(sizesProblem(rows, 650), null);
  assert.equal(cheapestSize(rows, 650), 650);
  assert.equal(sizesProblem([{ name: "Small", price: "0" }], 650), "Type a price for Small", "0 is still not a price");
  // Sent as it was: no own price -> nothing sent for it.
  const loaded: LoadedOption[] = [
    { id: "r", variant_type: "Size", variant_value: "Regular", price_override: null, is_available: true },
    { id: "g", variant_type: "Size", variant_value: "Large", price_override: 900, is_available: true },
  ];
  assert.equal(optionChanges(loaded, sizeDrafts(rows)), null);
});

test("A8: a switched-off size is not the 'from' price while another is on", () => {
  assert.equal(cheapestSize([{ name: "Half", price: "300", off: true }, { name: "Full", price: "500" }]), 500);
  assert.equal(cheapestSize([{ name: "Half", price: "300", off: true }]), 300);
});

// ── A9 ──────────────────────────────────────────────────────────────────────

test("A9: the list's switch sends the state wanted - never a blind flip", () => {
  assert.match(API, /async toggleMenuItem\(itemId: string, wanted\?: boolean\)/);
  assert.match(API, /body: JSON\.stringify\(\{ is_available: wanted \}\)/);
  assert.match(TAB, /const wanted = !p\.is_available;/);
  assert.match(TAB, /apiClient\.toggleMenuItem\(p\.id, wanted\)/);
  assert.match(TAB, /if \(flipping\.current\.has\(p\.id\)\) return;/, "still one click at a time");
});

// ── A10 ─────────────────────────────────────────────────────────────────────

test("A10: a lost answer, then 'already in this shop' - the editor takes that product", () => {
  assert.equal(answerWasLost(new Error("Couldn't reach the server, so this may or may not have gone through. Refresh")), true);
  assert.equal(answerWasLost(Object.assign(new Error("may or may not have gone through"), { status: 500 })), false);
  const dup = Object.assign(new Error("This shop already has \"Tea\""), { status: 409, detail: "This shop already has", existingProductId: "p-9" });
  assert.equal(isSameName(dup), true);
  assert.equal(existingIdOf(dup), "p-9");
  assert.equal(existingIdOf(new Error("x")), null);
  assert.equal(sameCatalogueName(" Panadol  500MG", "panadol 500mg"), true);
  assert.equal(sameCatalogueName("Tea", "Tea 2"), false);
  assert.match(CORE, /existingProductHeader\(response\),/);
  assert.match(CORE, /response\.headers\?\.get\?\.\("X-Existing-Product-Id"\)/);
  assert.match(EDITOR, /if \(answerWasLost\(err\)\) lostCreate\.current = true;/);
  assert.match(EDITOR, /else if \(isSameName\(err\) && lostCreate\.current\) \{\s*const id = existingIdOf\(err\) \|\| await findSameName\(payload\.name\);/);
  assert.match(EDITOR, /const editId: string \| null = product && product\.id \? String\(product\.id\) : adoptedId;/);
  assert.match(EDITOR, /data-testid="adopted"/);
});

test("A10: after a save, the next press compares with what the server now has", () => {
  const loaded: LoadedOption[] = [
    { id: "m", variant_type: "Size", variant_value: "M", stock_quantity: 5, is_available: true },
    { id: "x", variant_type: "Size", variant_value: "XL", stock_quantity: 0, is_available: false },
    { id: "s", variant_type: "Size", variant_value: "S", is_available: true },
  ];
  const body = { variants: [{ variant_type: "Size", variant_value: "M", stock_quantity: 7 }], remove_ids: ["s"] };
  const after = optionsAfterSave(loaded, body, [{ id: "m", variant_type: "Size", variant_value: "M", stock_quantity: 7, is_available: true }])!;
  assert.deepEqual(after.map((o) => o.id).sort(), ["m", "x"]);
  assert.equal(after.find((o) => o.id === "m")!.stock_quantity, 7);
  assert.equal(optionsAfterSave(loaded, body, undefined), null, "no rows in the answer: read again");
});

// ── Found while fixing ──────────────────────────────────────────────────────

test("the list's own Stock box can be emptied too - not counted", () => {
  assert.match(TAB, /const cleared = field === "stock" && edit\.val\.trim\(\) === "";/);
  assert.match(TAB, /const c = cleared \? \{ ok: true as const, value: null \}/);
});

test("a price or stock typed as words is refused in words, never saved as 0", () => {
  assert.doesNotMatch(EDITOR, /parseFloat\(price\) \|\| 0/);
  assert.doesNotMatch(EDITOR, /parseInt\(stock\) \|\| 0/);
  assert.match(EDITOR, /const priceOk = !sized && !pricesLocked \? checkPrice\(price\) : null;/);
});
