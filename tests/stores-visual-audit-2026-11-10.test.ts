// Stores visual audit, 10 Nov 2026 (Sana: "Go your suggestions and fix all at
// once"). The panel half of the direct fixes - report:
// docs/Audit/AUDIT-REPORT-STORES-VISUAL-2026-11-10.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liveState, leftWords, LIVE_WORDS } from "../src/lib/shop-live-state.ts";
import { storeCounts, forStore, pageOf, pageCount, count, LOW_STOCK_PAGE_SIZE } from "../src/lib/low-stock-view.ts";
import { showsPrescription } from "../src/lib/rx-column.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── B1: My new shops says "Live" only for a live shop ───────────────────────
test("B1: suspended, hidden and live are three different words", () => {
  // Tar Kora Mart, 10 Nov: approved, is_approved still true, but suspended.
  assert.equal(liveState({ is_approved: true, shown_to_customers: true, suspended: true }), "suspended");
  // Wakeel Flowers & Gifts: approved by Takal, hidden from customers.
  assert.equal(liveState({ is_approved: true, shown_to_customers: false, suspended: false }), "approved_hidden");
  assert.equal(liveState({ is_approved: true, shown_to_customers: true, suspended: false }), "live");
  assert.equal(liveState({ is_approved: false }), "not_approved");
  // An older server without shown_to_customers: never guess "Live".
  assert.equal(liveState({ is_approved: true }), "approved_hidden");
  assert.equal(LIVE_WORDS.suspended, "Suspended");
});

test("B1: 'What is left' follows the same word", () => {
  assert.equal(leftWords("live", false), "Already live");
  assert.equal(leftWords("suspended", true), "Suspended by Takal");
  assert.equal(leftWords("approved_hidden", true), "Nothing — switch it on in All Stores");
  assert.equal(leftWords("approved_hidden", false), null, "not finished: the checklist says what is left");
  assert.equal(leftWords("not_approved", true), null);
});

test("B1: the page uses it, and no longer prints Live for every approved shop", () => {
  const page = code("src/app/dashboard/stores/onboarding/page.tsx");
  assert.match(page, /liveState\(s\)/);
  assert.doesNotMatch(page, /<Badge tone="good">Live<\/Badge>/);
  assert.doesNotMatch(page, /s\.is_approved \? \(\s*<span className="text-takal-ink-soft">Already live/);
});

// ── A1: Low stock draws 50 rows, not 12,770 ─────────────────────────────────
const many = Array.from({ length: 12770 }, (_, i) => ({ store: i < 12621 ? "Health Mart Pharmacy" : i < 12645 ? "Wakeel Baby" : "Wakeel Beauty", i }));

test("A1: one page is 50 rows, and a page past the end gives the last page", () => {
  assert.equal(LOW_STOCK_PAGE_SIZE, 50);
  assert.equal(pageOf(many, 1).length, 50);
  assert.equal(pageCount(many.length), 256);
  assert.equal(pageOf(many, 256).length, 20);
  assert.deepEqual(pageOf(many, 999), pageOf(many, 256));
  assert.equal(pageOf(many, 0)[0].i, 0);
  assert.equal(pageCount(0), 1);
  assert.deepEqual(pageOf([], 1), []);
});

test("A1: the Store choice lists each shop once, biggest first", () => {
  assert.deepEqual(storeCounts(many), [
    { store: "Health Mart Pharmacy", count: 12621 }, { store: "Wakeel Baby", count: 24 }, { store: "Wakeel Beauty", count: 125 },
  ].sort((a, b) => b.count - a.count));
  assert.equal(forStore(many, "Wakeel Baby").length, 24);
  assert.equal(forStore(many, "").length, 12770);
  assert.equal(count(12770), "12,770");
});

test("A1: the page draws only the visible page", () => {
  const page = code("src/app/dashboard/stores/inventory/page.tsx");
  assert.match(page, /visible\.map\(\(r, i\) =>/);
  assert.doesNotMatch(page, /\brows\.map\(\(r, i\) =>/);
  assert.match(page, /Every store \(\{count\(rows\.length\)\}\)/);
  assert.doesNotMatch(page, /placeholder="Set"/);
});

// ── C4: Urdu in Naskh (Sana, 31 Oct 2026) ────────────────────────────────────
test("C4: the Stores Urdu font is Noto Naskh, not Nastaliq", () => {
  const font = code("src/app/dashboard/stores/catalogue/urdu-font.ts");
  assert.match(font, /import \{ Noto_Naskh_Arabic \} from "next\/font\/google"/);
  assert.doesNotMatch(font, /Noto_Nastaliq_Urdu/);
  assert.doesNotMatch(code("src/app/dashboard/stores/catalogue/parts-shelves.tsx"), /Nastaliq/);
});

// ── D2: Categories - the prescription column only where it means something ─
test("D2: Rx column for pharmacy, or where a shelf already carries the mark", () => {
  assert.equal(showsPrescription({ slug: "food-and-drinks", name: "Food & Drinks" }, [{}, {}]), false);
  assert.equal(showsPrescription({ slug: "health-and-pharmacy", name: "Health & Pharmacy" }, []), true);
  assert.equal(showsPrescription({ slug: "beauty", name: "Beauty & Personal Care" }, [{ needs_prescription: true }]), true,
    "a mark set by mistake can still be seen and taken off");
  const shelves = code("src/app/dashboard/stores/catalogue/parts-shelves.tsx");
  assert.match(shelves, /\{showRx && <th/);
  assert.doesNotMatch(shelves, /colSpan=\{5\}/);
});

// ── Small words and looks ───────────────────────────────────────────────────
test("C3: the Money tab says payout is not needed to go live", () => {
  const card = code("src/components/PayoutDetailsCard.tsx");
  assert.match(card, /not needed<\/b> to show the shop to customers/);
  assert.doesNotMatch(card, /This shop could not be paid/);
});

test("C12: Commission - no leftover English line; Save sits on its own strip", () => {
  const page = code("src/app/dashboard/stores/commission/page.tsx");
  assert.doesNotMatch(page, /Configure platform commission rates and policies/);
  assert.match(page, /sticky bottom-0 z-10 [^"]*bg-takal-page\/95/);
});

test("D3: Cancellations offers 'Show all shops' once", () => {
  assert.match(code("src/app/dashboard/stores/reliability/page.tsx"), /hidden > 0 && visible\.length > 0 &&/);
});

test("C2: Legal check shows its lists at once and counts after", () => {
  const page = code("src/app/dashboard/stores/legal/page.tsx");
  assert.match(page, /if \(got\.switched_on && !got\.today\)/);
  assert.match(page, /!preview \? "counting…"/);
});

test("C9: long words wrap instead of being cut", () => {
  const list = code("src/app/dashboard/stores/page.tsx");
  assert.match(list, /whitespace-normal leading-tight">💬 WhatsApp sent/);
  assert.match(list, /Fixed-price - no commission/, "the words themselves are unchanged");
  assert.match(list, /max-w-\[11rem\] items-center gap-1 whitespace-normal rounded-2xl bg-black/);
});

test("D4: Take out on the mall page looks like a risky button", () => {
  assert.match(code("src/app/dashboard/stores/malls/[id]/page.tsx"),
    /border-\[#F3C2C7\] bg-white px-3 py-1\.5 text-\[12\.5px\] font-bold text-takal-red hover:bg-takal-red-soft">\s*Take out/);
});

test("Find & move: the search hint fits its box", () => {
  assert.match(code("src/app/dashboard/stores/sorting/find/page.tsx"), /placeholder="Product name, or part of it"/);
});
