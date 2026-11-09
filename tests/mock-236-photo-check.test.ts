// Mock 236 (Sana, 9 Nov 2026: "Approved"): Stores › Product sorting › Photo check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHOW_CHIPS, actionsFor, byStore, nameProblem, picsFor, tagFor, wasName, weeklyWords,
  type PhotoCheckItem,
} from "../src/lib/photo-check.ts";
import { SORTING_TABS } from "../src/lib/product-sorting.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const P = "https://x.supabase.co/storage/v1/object/public/images/";

function item(over: Partial<PhotoCheckItem>): PhotoCheckItem {
  return {
    id: "c1", product_id: "p1", shop_id: "s1", shop: "Nova Pizza", problem: "mismatch", state: "open",
    why: "photo is a pizza", fix: null, name: "Chocolate Coffee", photo: P + "pizza.webp", on_sale: true,
    old_name: null, new_name: null, old_photo: null, new_photo: null, found_by: "Photo audit 9 Nov 2026",
    found_at: "2026-11-09T09:00:00Z", fixed_by: null, fixed_at: null, can_undo: false, ...over,
  };
}

test("Photo check is the last inner tab of Product sorting, with the NEW tag", () => {
  assert.deepEqual(SORTING_TABS.map((t) => t.label), ["Overview", "Find & move", "Sorting list", "Shelf check", "Photo check"]);
  const tab = SORTING_TABS.find((t) => t.label === "Photo check") as any;
  assert.equal(tab.href, "/dashboard/stores/sorting/photo-check");
  assert.equal(tab.tag, "NEW");
  assert.match(code("src/app/dashboard/stores/sorting/layout.tsx"), /t\.tag/);
});

test("the server's permission line is copied into the panel, in the same place", () => {
  const nav = code("src/lib/navigation.ts");
  assert.match(nav, /\["\/admin\/sorting", "stores\.catalogue"\],\n\s*\["\/admin\/photo-checks", "stores\.catalogue"\],/);
  assert.match(nav, /"\/admin\/photo-checks"\] \}/, "the Product sorting link names the address it calls");
});

test("chips: red need work, green fixed, all", () => {
  const c = { open: 10, fixed: 55, all: 65 };
  assert.deepEqual(SHOW_CHIPS.map((x) => x.label(c)), ["10 Need work", "55 Fixed", "All 65"]);
});

test("buttons: no photo -> Add photo + Rename; mismatch -> Rename, Change photo, It is correct; fixed -> Undo", () => {
  assert.deepEqual(actionsFor(item({ problem: "no_photo" })), ["add_photo", "rename"]);
  assert.deepEqual(actionsFor(item({})), ["rename", "change_photo", "correct"]);
  assert.deepEqual(actionsFor(item({ state: "fixed", fix: "renamed", can_undo: true })), ["undo"]);
  assert.deepEqual(actionsFor(item({ state: "fixed", fix: "photo_added", can_undo: false })), []);
});

test("pictures: removed -> No photo; old -> new after a photo change; one photo otherwise", () => {
  assert.deepEqual(picsFor(item({ problem: "no_photo", photo: null, old_photo: P + "kofta.webp" })),
    { old: P + "kofta.webp", now: null, arrow: true, removed: true });
  assert.deepEqual(picsFor(item({ state: "fixed", fix: "photo_changed", old_photo: P + "pizza.webp", new_photo: P + "mocha.webp" })),
    { old: P + "pizza.webp", now: P + "mocha.webp", arrow: true, removed: false });
  assert.deepEqual(picsFor(item({})), { old: null, now: P + "pizza.webp", arrow: false, removed: false });
  assert.deepEqual(picsFor(item({ state: "fixed", fix: "renamed" })).arrow, false);
});

test("tags and the crossed-out old name", () => {
  assert.deepEqual(tagFor(item({ problem: "no_photo" })), { text: "No photo · needs a real one", tone: "red" });
  assert.deepEqual(tagFor(item({})), { text: "Photo and name do not match", tone: "red" });
  assert.deepEqual(tagFor(item({ state: "fixed", fix: "renamed", fixed_at: "2026-11-09T08:00:00Z" })),
    { text: "Fixed 9 Nov · Renamed to match the photo", tone: "green" });
  assert.equal(wasName(item({ old_name: "Black Sequin Party Frock", name: "Green Embroidered Party Frock" })), "Black Sequin Party Frock");
  assert.equal(wasName(item({ old_name: "Chocolate Coffee" })), null, "same name - nothing crossed out");
});

test("stores with the most work first; open rows first inside a store", () => {
  const cards = byStore([
    item({ id: "a", shop_id: "s1", shop: "Nova Pizza", state: "fixed", fix: "renamed", name: "A" }),
    item({ id: "b", shop_id: "s2", shop: "Minus -21", name: "Roll Pista" }),
    item({ id: "c", shop_id: "s2", shop: "Minus -21", name: "Roll Almond" }),
    item({ id: "d", shop_id: "s1", shop: "Nova Pizza", name: "Z" }),
  ]);
  assert.deepEqual(cards.map((c) => [c.name, c.open, c.fixed]), [["Minus -21", 2, 0], ["Nova Pizza", 1, 1]]);
  assert.deepEqual(cards[0].items.map((i) => i.name), ["Roll Almond", "Roll Pista"]);
  assert.deepEqual(cards[1].items.map((i) => i.id), ["d", "a"], "the open one first");
});

test("the weekly time is Pakistan time; names are checked like the server", () => {
  assert.equal(weeklyWords("2026-11-16T04:47:00Z"), "Mon 16 Nov, 9:47 am");
  assert.equal(weeklyWords(null), "");
  assert.equal(nameProblem(" a "), "Please type a name of at least 2 letters.");
  assert.equal(nameProblem("x".repeat(151)), "A name can be at most 150 letters.");
  assert.equal(nameProblem("Green   Party Frock"), null);
});

test("the page: no blob: previews, the vendor is not told, and Add photo is the yellow button", () => {
  const page = code("src/app/dashboard/stores/sorting/photo-check/page.tsx");
  assert.doesNotMatch(page, /createObjectURL/, "the security header refuses blob: pictures");
  assert.match(page, /readAsDataURL/);
  assert.match(page, /the vendor is not told/);
  assert.match(page, /const yellow = a === "add_photo"/);
  assert.match(page, /no photo is better than a wrong one/);
  assert.doesNotMatch(page, /setChoice\(\{ from: suggest\[0\]/, "nothing is picked for the person");
});
