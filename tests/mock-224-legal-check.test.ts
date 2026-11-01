// MOCK 224 - THE LEGAL CHECK (approved by Sana, 1 Nov 2026: "editable list
// Change and add another name" -> "Approved"). The rules are run for real
// (src/lib/legal-check.ts, src/lib/takal-hidden.ts); the screens are checked
// for who sees which button and that the server agrees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addWord, removeWord, wordProblem, listsChanged, catches, wordCatches, newGroup, hideReasonToSend,
  normWord, HIDE_REASONS, type LegalGroup, type LegalPreview,
} from "../src/lib/legal-check.ts";
import { reasonTags, filterHidden, isLocked, showAgainWords, type TakalHiddenProduct } from "../src/lib/takal-hidden.ts";
import { NAVIGATION, SERVER_RULES, serverSectionFor } from "../src/lib/navigation.ts";
import { isOneStorePage } from "../src/lib/store-page.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PAGE = read("src/app/dashboard/stores/legal/page.tsx");
const DIALOG = read("src/app/dashboard/stores/[id]/parts-hide-lock.tsx");
const PRODUCTS = read("src/app/dashboard/stores/[id]/parts-products.tsx");
const HIDDEN = read("src/app/dashboard/stores/parts-takal-hidden.tsx");
const GUARD = read("../swat-delivery-app/backend/app_guard.py");

// ── 1. the words ──
test("a word is added once, whatever its case or marks", () => {
  assert.deepEqual(addWord(["police"], "Army"), ["police", "Army"]);
  const same = ["police"];
  assert.equal(addWord(same, "POLICE"), same);
  assert.equal(addWord(["e-cig"], "E cig").length, 1);
  assert.equal(addWord(same, "   "), same);
  assert.equal(addWord(same, "x".repeat(41)), same);
  assert.deepEqual(removeWord(["a", "b"], "a"), ["b"]);
  assert.equal(normWord("PLUM/Wine"), "plum wine");
});

test("why a word cannot be added is said in words", () => {
  assert.equal(wordProblem(["police"], "Police"), '"Police" is already in the list.');
  assert.equal(wordProblem([], "!!"), "A word needs letters or numbers.");
  assert.equal(wordProblem([], "badge"), "");
});

test("Save changes lights up only when something changed", () => {
  const g: LegalGroup = { key: "k", icon: "⚖️", name: "N", why: "w", words: ["a"], on: true, skip_types: [] };
  const a = { groups: [g], safe_phrases: ["toy"] };
  assert.equal(listsChanged(a, { groups: [{ ...g }], safe_phrases: ["toy"] }), false);
  assert.equal(listsChanged(a, { groups: [{ ...g, words: ["a", "b"] }], safe_phrases: ["toy"] }), true);
  assert.equal(listsChanged(a, { groups: [g], safe_phrases: [] }), true);
});

test("'catches N today' and '·1' come from the server's preview", () => {
  const p = { per_group: { police: 2 }, per_word: { police: { police: 1, uniform: 1 } } } as unknown as LegalPreview;
  assert.equal(catches(p, "police"), 2);
  assert.equal(catches(p, "weapons"), 0);
  assert.equal(wordCatches(p, "police", "uniform"), 1);
  assert.equal(catches(null, "police"), 0);
});

test("a new group starts OFF with a key nobody has", () => {
  const g = newGroup([{ key: "group_2" } as LegalGroup]);
  assert.equal(g.on, false);
  assert.notEqual(g.key, "group_2");
  assert.deepEqual(g.words, []);
});

// ── 2. Hide and lock ──
test("the reasons are the mock's five, and a reason must be written", () => {
  assert.deepEqual(HIDE_REASONS.map((r) => r.label),
    ["⚖️ Qanooni masla (legal)", "Replica brand", "Galat tasveer", "Galat qeemat", "Other…"]);
  assert.equal(hideReasonToSend("  ab "), "");
  assert.equal(hideReasonToSend(" Galat   tasveer "), "Galat tasveer");
  assert.equal(hideReasonToSend("x".repeat(301)), "");
});

test("Hide and lock is in a product's menu for the reviewers only, never for a mall's staff", () => {
  assert.match(PRODUCTS, /setMayHide\(!staffView && mayAccess\("stores\.approve", getMyPerms\(\)\)\)/);
  assert.match(PRODUCTS, /\{mayHide && !menu\.p\.takal_hidden_at && \(/);
  assert.match(DIALOG, /apiClient\.hideAndLockProduct\(product\.id, send\)/);
  assert.match(DIALOG, /disabled=\{busy \|\| !send\}/);
});

// ── 3. Hidden by Takal ──
const H = (kind: TakalHiddenProduct["takal_hidden_kind"], extra: Partial<TakalHiddenProduct> = {}) =>
  ({ id: kind || "x", restaurant_id: "r", name: "Police Flag", takal_hidden_at: "t",
    takal_hidden_reason: "Police/fauj ka saman", takal_hidden_kind: kind, ...extra }) as TakalHiddenProduct;

test("legal and admin hides carry their own mark, are locked, and can be filtered", () => {
  assert.deepEqual(reasonTags("x", "legal"), ["⚖️ Legal"]);
  assert.deepEqual(reasonTags("x", "admin"), ["👤 By admin"]);
  assert.deepEqual(reasonTags("is ki koi tasveer nahi hai", null), ["No picture"]);
  assert.equal(isLocked(H("legal")) && isLocked(H("admin")) && !isLocked(H(null)), true);
  const all = [H("legal"), H("admin"), H(null)];
  assert.deepEqual(filterHidden(all, "legal").map((p) => p.id), ["legal"]);
  assert.equal(filterHidden(all, "all").length, 3);
});

test("Show again on a legal hide says it means ALLOWED, with the word", () => {
  const w = showAgainWords(H("legal", { takal_hidden_word: "police" }));
  assert.match(w, /word "police"/);
  assert.match(w, /means you ALLOW it/);
  assert.match(showAgainWords(H("admin", { hidden_by_name: "Sana Ullah" })), /^Sana Ullah hid and locked it/);
  assert.match(HIDDEN, /chip\("legal", `⚖️ Legal \$\{nLegal\}`\)/);
});

// ── 4. the Legal check page ──
test("the tab sits after Product sorting, for the reviewers", () => {
  const tabs = NAVIGATION.find((n) => n.label === "Stores")!.tabs!;
  const i = tabs.findIndex((t) => t.label === "⚖️ Legal check");
  assert.equal(tabs[i - 1].label, "Product sorting");
  assert.equal(tabs[i].href, "/dashboard/stores/legal");
  assert.equal(tabs[i].section, "stores.approve");
  // Found by looking at the built page: "legal" was read as a store's id, and
  // the Stores title and tabs disappeared above it.
  assert.equal(isOneStorePage("/dashboard/stores/legal"), false);
});

test("only the Main Admin saves - on the page and on the server", () => {
  assert.match(PAGE, /const canEdit = on && isMain;/);
  assert.match(PAGE, /\{canEdit && \(\s*<div className="flex gap-2">/);
  assert.equal(serverSectionFor("/admin/legal-check/save", "write"), "__super__");
  assert.equal(serverSectionFor("/admin/legal-check/preview", "write"), "stores.approve");
  assert.equal(serverSectionFor("/admin/products/hide-lock/p1", "write"), "stores.approve");
  for (const [p, s] of [["/admin/legal-check/save", "__super__"], ["/admin/legal-check", "stores.approve"],
    ["/admin/products/hide-lock", "stores.approve"]]) {
    assert.ok(SERVER_RULES.some(([a, b]) => a === p && b === s), p);
    assert.ok(GUARD.includes(`("${p}", "${s}")`), `server: ${p}`);
  }
});

test("'If you save now' asks the server about the lists ON SCREEN, and a typed word shows its catch", () => {
  assert.match(PAGE, /apiClient\.previewLegalCheck\(draft\.groups, draft\.safe_phrases\)/);
  assert.match(PAGE, /\{changed \? "If you save now" : "Today"\}/);
  assert.match(PAGE, /<TypedWordNote group=\{g\} word=\{typing\.trim\(\)\}/);
});

test("the medicine card says Herbal, Unani and Homeopathic are never caught (Sana, 2 Nov 2026: GO)", () => {
  assert.match(PAGE, /<span data-herbal-never>Herbal, Unani and Homeopathic medicines are never caught\.<\/span>/);
});
