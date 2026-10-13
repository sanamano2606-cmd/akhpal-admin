/**
 * MOCK 187 - PICTURES STRAIGHT FROM THE PRODUCTS LIST (approved by Sana 13 Oct 2026).
 *
 *   "i want the picture upload easier as much as you can, direct from the
 *    product list."
 *
 * The rules (lib/product-pictures.ts) are run here, and the server's own
 * photo rules (routers/product_extras.py: PUT replaces the list, then
 * _sync_cover) are copied into a small fake so each case shows what a
 * customer would see afterwards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  imagesBody, pictureCount, picturesOf, rowAfter, savedWords, sendPictures, splitPictures,
  withAdded, withCoverChanged, withRemoved,
} from "../src/lib/product-pictures.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** The server, as product_extras.set_images + _sync_cover behave. */
function fakeServer(start: { list: string[]; image_url: string | null }) {
  const db = { list: start.list.slice(), image_url: start.image_url };
  const calls: string[][] = [];
  return {
    db, calls,
    async setProductImages(_id: string, images: { url: string; position: number }[]) {
      const before = new Set(db.list);
      db.list = images.slice().sort((a, b) => a.position - b.position).map((i) => i.url);
      calls.push(db.list.slice());
      if (db.list.length) { db.image_url = db.list[0]; return; }
      const kept = new Set(db.list);
      const removed = [...before].filter((u) => !kept.has(u));
      if (db.image_url && removed.includes(db.image_url)) db.image_url = null;
    },
  };
}

test("an imported picture (only in image_url) is read as photo 1 - never as 'no photos'", () => {
  assert.deepEqual(picturesOf({ images: [], image_url: "https://x/karahi.jpg" }),
    { list: ["https://x/karahi.jpg"], imported: "https://x/karahi.jpg" });
  assert.deepEqual(picturesOf({ images: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }], image_url: "https://x/a.jpg" }),
    { list: ["https://x/a.jpg", "https://x/b.jpg"], imported: null });
  assert.deepEqual(picturesOf({ images: [], image_url: null }), { list: [], imported: null });
  assert.deepEqual(picturesOf(null), { list: [], imported: null });
});

test("+ Add keeps the imported picture - the bug from before is gone", async () => {
  const api = fakeServer({ list: [], image_url: "https://x/karahi.jpg" });
  const read = picturesOf({ images: [], image_url: api.db.image_url });
  await sendPictures(api, "p1", withAdded(read.list, ["https://x/new.jpg"]), read.imported);
  assert.deepEqual(api.db.list, ["https://x/karahi.jpg", "https://x/new.jpg"]);
  assert.equal(api.db.image_url, "https://x/karahi.jpg", "the cover customers see is unchanged");
});

test("Change replaces only the cover; the other pictures stay in their places", async () => {
  const api = fakeServer({ list: ["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"], image_url: "https://x/a.jpg" });
  const read = picturesOf({ images: api.db.list.map((url) => ({ url })), image_url: api.db.image_url });
  await sendPictures(api, "p1", withCoverChanged(read.list, ["https://x/new.jpg"]), read.imported);
  assert.deepEqual(api.db.list, ["https://x/new.jpg", "https://x/b.jpg", "https://x/c.jpg"]);
  assert.equal(api.db.image_url, "https://x/new.jpg");
  assert.deepEqual(withCoverChanged([], ["https://x/1.jpg", "https://x/2.jpg"]), ["https://x/1.jpg", "https://x/2.jpg"],
    "no picture yet: the first is the cover, the rest follow");
  assert.deepEqual(withCoverChanged(["https://x/a.jpg"], []), ["https://x/a.jpg"], "nothing uploaded: nothing changes");
});

test("removing an imported picture really takes it off the product", async () => {
  // Without the extra step the server keeps image_url (it never clears a
  // picture that was not in the list), so customers would still see it.
  const api = fakeServer({ list: [], image_url: "https://x/karahi.jpg" });
  const read = picturesOf({ images: [], image_url: api.db.image_url });
  await sendPictures(api, "p1", withRemoved(read.list, 0), read.imported);
  assert.equal(api.db.image_url, null);
  assert.deepEqual(api.calls, [["https://x/karahi.jpg"], []], "put in first, then taken out");
  // A normal product: one call only.
  const api2 = fakeServer({ list: ["https://x/a.jpg", "https://x/b.jpg"], image_url: "https://x/a.jpg" });
  await sendPictures(api2, "p2", ["https://x/b.jpg"], null);
  assert.equal(api2.calls.length, 1);
  assert.equal(api2.db.image_url, "https://x/b.jpg");
});

test("several photos at once: all of them, in order, no doubles; not-pictures named", () => {
  assert.deepEqual(withAdded(["https://x/a.jpg"], ["https://x/b.jpg", "https://x/a.jpg", "https://x/c.jpg"]),
    ["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"]);
  const s = splitPictures([{ name: "a.jpg", type: "image/jpeg" }, { name: "list.pdf", type: "application/pdf" }, { name: "b.png", type: "image/png" }]);
  assert.deepEqual(s.ok.map((f) => f.name), ["a.jpg", "b.png"]);
  assert.deepEqual(s.notPictures, ["list.pdf"]);
});

test("the row afterwards: cover, count, and the words under it", () => {
  assert.deepEqual(rowAfter(["https://x/a.jpg", "https://x/b.jpg"]), { image_url: "https://x/a.jpg", photo_count: 2 });
  assert.deepEqual(rowAfter([]), { image_url: null, photo_count: 0 });
  assert.deepEqual(imagesBody(["u1", "u2"]), [{ url: "u1", position: 0 }, { url: "u2", position: 1 }]);
  assert.equal(pictureCount(0, true), 1, "an imported picture counts as one");
  assert.equal(pictureCount(3, true), 3);
  assert.equal(savedWords("add", 1), "Picture saved");
  assert.equal(savedWords("add", 3), "3 pictures saved");
  assert.equal(savedWords("change", 1), "Picture changed");
  assert.equal(savedWords("change", 3), "Picture changed, 2 more added");
});

test("the list (v2): the cover, a yellow drop space beside it, and options only on a click", () => {
  const tab = code("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.match(tab, /const SHOW_PICTURE = "table-cell";/);
  // At least one picture shows (the cover); the drop space is ALWAYS there.
  assert.match(tab, /\{p\.image_url && \(\s*<button\s+type="button"\s+data-picture-cover/);
  assert.match(tab, /<button\s+type="button"\s+data-picture-space/);
  assert.match(tab, /Drop<br \/>\{pictureCount\(p\.photo_count, true\) === 1 \? "2nd" : "more"\}/);
  assert.match(tab, /Drop<br \/>click/, "no picture yet: one space (\"Drop / click\" - Mock 190, 36 px)");
  // From the 2nd picture, the 1st shows the number.
  assert.match(tab, /\{pictureCount\(p\.photo_count, true\) > 1 && \(\s*<span data-picture-count/);
  // A click only OPENS the options - it never uploads, changes or removes by itself.
  assert.match(tab, /data-picture-cover\s+onClick=\{\(e\) => openPicMenu\(p, "cover", e\)\}/);
  assert.match(tab, /data-picture-space\s+onClick=\{\(e\) => openPicMenu\(p, "space", e\)\}/);
  assert.doesNotMatch(tab, /group-hover\/pic|data-picture-actions|byFinger/, "the mouse-over buttons are gone");
  for (const words of ["See all pictures", "Add photos from computer", "Change this picture",
    "Make another one the cover", "Remove this picture", "Choose photos from computer", "Paste a picture link"]) {
    assert.ok(tab.includes(words), words);
  }
  assert.match(tab, /title="Remove this picture\?"/, "removing asks first");
  // Dropped anywhere in the cell: every photo is added.
  assert.match(tab, /onDrop=\{\(e\) => dropped\(p, e\)\}/);
  assert.match(tab, /accept="image\/\*"\s+multiple/, "the file box takes several photos at once");
  assert.match(tab, /uploadPictures\(p, files, pickHow\.current\)/);
  assert.match(tab, /<Pencil className="w-3\.5 h-3\.5" \/> <span className="hidden xl:inline">Edit<\/span>/, "the pencil says what it does (from 1280 px)");
  // A click on a picture in the last rows: the page settles a few pixels - that must not close the options.
  assert.match(tab, /const scrolled = \(\) => \{ if \(Date\.now\(\) - opened > 400\) setPicMenu\(null\); \};/);
  assert.match(tab, /<ImagePlus className="w-4 h-4" \/> Pictures/, "the ... menu has Pictures too");
  assert.match(tab, /<PicturesBox[\s\S]{0,260}onChanged=\{\(list\) => picturesChanged\(picturesFor\.id, list\)\}/);
});

test("Remove this picture reads first and goes through the one door", () => {
  const tab = code("src/app/dashboard/stores/[id]/parts-products.tsx");
  const start = tab.indexOf("const removeCoverPicture = ");
  const body = tab.slice(start, tab.indexOf("\n  };", start));
  assert.match(body, /const read = picturesOf\(\(await apiClient\.getProduct\(p\.id\)\) as any\);/);
  assert.match(body, /const next = withRemoved\(read\.list, 0\);/);
  assert.match(body, /await sendPictures\(apiClient, p\.id, next, read\.imported\);/);
});

test("the Pictures box: reads first, saves every change by itself, one save at a time", () => {
  const box = code("src/app/dashboard/stores/[id]/parts-pictures-box.tsx");
  assert.match(box, /const r = picturesOf\(full\);/);
  assert.match(box, /chain\.current = chain\.current\.then\(async \(\) => \{/, "saves never overlap");
  assert.match(box, /await sendPictures\(apiClient, String\(product\.id\), next, imported\.current\);/);
  assert.match(box, /imported\.current = null;/, "after a save the imported picture is no longer special");
  // An unread list is never sent: the squares appear only once it is read.
  assert.match(box, /\{ready && \(\s*<div className="mt-5 flex flex-wrap gap-3\.5">/);
  assert.match(box, /if \(read !== "ok"\) return;/);
  assert.match(box, /window\.addEventListener\("paste", onPaste\)/, "Ctrl+V of a copied picture");
  assert.match(box, /`Picture \$\{i \+ 1\} removed\.`/);
  assert.match(box, /onClick=\{\(\) => \{ commit\(undo\.list\); setUndo\(null\); \}\}/, "Undo");
});

test("the Edit form shows an imported picture too, and sends it back", () => {
  const ed = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.match(ed, /const read = picturesOf\(full\);\s*setPhotos\(read\.list\);\s*setImported\(read\.imported\);/);
  assert.match(ed, /await sendPictures\(apiClient, productId, photos\.map\(\(u\) => u\.trim\(\)\)\.filter\(Boolean\), imported\);/);
  assert.doesNotMatch(ed, /apiClient\.setProductImages\(/, "only the one door");
});
