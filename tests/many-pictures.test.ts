// ─────────────────────────────────────────────────────────────────────────────
// "MANY PICTURES": EVERY PHOTO GOES TO THE RIGHT PRODUCT OR TO A PERSON.
// (Mock 132 step 4, 30 September 2026.) These RUN the real matching code.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cleanName, fileKey, isPictureFile, likeness, makeMatcher, positionsFor,
  type NameEntry,
} from "../src/lib/picture-match.ts";

const P = (id: string, name: string, has_picture = false): NameEntry => ({ id, name, has_picture });
const SHOP: NameEntry[] = [
  P("coke", "Coca Cola 1.5 L"),
  P("surf1", "Surf Excel 1 kg"),
  P("surf5", "Surf Excel 500 g"),
  P("honey", "Shezan Honey 500g", true),       // already has a picture
  P("n1", "Nestle Fruita Vitals Apple 1 L"),
  P("n2", "Nestle Fruita Vitals Mango 1 L"),
  P("n3", "Nestle Fruita Vitals Orange 1 L"),
  P("tw1", "Chicken Karahi"),
  P("tw2", "Chicken Karahi"),                   // two products, one name
  P("ur", "چکن کڑاہی"),
];
const match = makeMatcher(SHOP);

test("a photo named after its product is matched, however it is written", () => {
  for (const f of ["coca-cola-1.5L.jpg", "Coca_Cola_1.5_L.PNG", "COCA COLA 1.5l.webp",
                   "coca-cola-1.5L (2).jpg", "coca-cola-1.5L copy.jpeg", "coca-cola-1.5L-2.jpg"]) {
    const plan = match(f);
    assert.equal(plan.kind, "matched", f);
    assert.equal((plan as any).productId, "coke", f);
  }
});

test("the size is part of the name - 1 kg is not 500 g", () => {
  assert.equal((match("surf-excel-1kg.png") as any).productId, "surf1");
  assert.equal((match("surf_excel_500_g.jpg") as any).productId, "surf5");
});

test("a product that already has a picture is skipped, never re-covered", () => {
  const plan = match("shezan-honey-500g.jpg");
  assert.equal(plan.kind, "already");
  assert.equal((plan as any).productId, "honey");
});

test("a photo that is not certain goes to a person, with the closest products", () => {
  const plan = match("nestle-fruita-vitals.jpg");
  assert.equal(plan.kind, "pick");
  const ids = (plan as any).candidates.map((c: NameEntry) => c.id).sort();
  assert.deepEqual(ids, ["n1", "n2", "n3"]);
  const none = match("IMG_2231.jpg");
  assert.equal(none.kind, "pick");
  assert.deepEqual((none as any).candidates, []);
});

test("two products with the same name are never guessed between", () => {
  const plan = match("chicken-karahi.jpg");
  assert.equal(plan.kind, "pick");
  assert.deepEqual((plan as any).candidates.map((c: NameEntry) => c.id).sort(), ["tw1", "tw2"]);
});

test("a product that already has a picture is never offered as a choice", () => {
  const plan = match("shezan honey jar.jpg");
  assert.equal(plan.kind, "pick");
  assert.ok(!(plan as any).candidates.some((c: NameEntry) => c.id === "honey"));
});

test("Urdu names match too", () => {
  assert.equal((match("چکن کڑاہی.jpg") as any).productId, "ur");
});

test("only the pictures the server takes are pictures", () => {
  assert.equal(match("price-list.pdf").kind, "not_picture");
  assert.equal(match("notes.txt").kind, "not_picture");
  assert.equal(isPictureFile("a.HEIC"), false, "the server refuses HEIC");
  assert.equal(isPictureFile("a.jpg"), true);
  assert.equal(isPictureFile("noending", "image/png"), true);
});

test("the cleaning rules themselves", () => {
  assert.equal(cleanName("Coca-Cola 1.5 L"), "coca cola 1.5l");
  assert.equal(fileKey("folder/Surf_Excel_1kg (3).png"), "surf excel 1kg");
  assert.equal(likeness("a b", "a b"), 1);
  assert.equal(likeness("a b", "c d"), 0);
});

test("several photos of one product keep their order and the first is the cover", () => {
  assert.deepEqual(positionsFor(["a", "b", "a", null, "a"]), [0, 0, 1, null, 2]);
});

// ── The window that uses it ─────────────────────────────────────────────────
const DLG = readFileSync(new URL("../src/app/dashboard/stores/[id]/parts-many-pictures.tsx", import.meta.url), "utf8");
const API = readFileSync(new URL("../src/lib/api-stores.ts", import.meta.url), "utf8");

test("nothing is saved before the person presses Upload", () => {
  // The only calls that write are inside the upload runner.
  const runner = DLG.slice(DLG.indexOf("const uploadOne = "), DLG.indexOf("// ── end of upload"));
  assert.match(runner, /apiClient\.uploadImage\(/);
  assert.match(runner, /apiClient\.addProductPhoto\(/);
  const outside = DLG.replace(runner, "");
  assert.doesNotMatch(outside, /apiClient\.(uploadImage|addProductPhoto)\(/);
});

test("only matched photos, or photos a person picked a product for, are uploaded", () => {
  assert.match(DLG, /const toUpload = rows\.filter\(\(r\) => r\.productId && \(r\.plan\.kind === "matched" \|\| r\.picked\)\);/);
});

test("the pace limit waits and carries on instead of failing", () => {
  assert.match(DLG, /\(err as any\)\?\.status === 429/);
  assert.match(DLG, /await sleep\(WAIT_WHEN_BUSY_MS\)/);
  assert.match(API, /\(err as any\)\.status = res\.status;/);
});

test("three at a time, never the whole folder at once", () => {
  assert.match(DLG, /const AT_ONCE = 3;/);
});

test("leaving the page while photos are going up is warned about", () => {
  assert.match(DLG, /addEventListener\("beforeunload"/);
});

test("the names come from the server's own list", () => {
  assert.match(API, /`\/restaurants\/\$\{encodeURIComponent\(restaurantId\)\}\/products\/names\?fresh=\$\{Date\.now\(\)\}`/);
});

test("no call in the panel's client has the same name twice", () => {
  // The client is one class built in layers (core -> orders -> stores ->
  // people -> money). A second method with an existing name does not fail -
  // it silently REPLACES the first one for every screen. On 30 Sep 2026 a new
  // "getShopProductNames" nearly replaced the catalogue page's own call; the
  // type check caught it only because both sat in the same file.
  const seen = new Map<string, string>();
  const clash: string[] = [];
  for (const f of ["api-core", "api-orders", "api-stores", "api-people", "api-money", "api-client"]) {
    const src = readFileSync(new URL(`../src/lib/${f}.ts`, import.meta.url), "utf8");
    for (const m of src.matchAll(/^\s+(?:protected |private |public )?(?:static )?async ([A-Za-z0-9_]+)\s*[<(]/gm)) {
      const name = m[1];
      if (seen.has(name)) clash.push(`${name}: ${seen.get(name)} and ${f}`);
      else seen.set(name, f);
    }
  }
  assert.deepEqual(clash, []);
});

test("previews never use a blob: address, which the panel's security header refuses", () => {
  assert.doesNotMatch(DLG, /URL\.createObjectURL/);
  assert.match(DLG, /c\.toDataURL\("image\/jpeg", 0\.7\)/);
});

