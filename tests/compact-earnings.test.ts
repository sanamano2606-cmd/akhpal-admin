/**
 * MOCK 194 - COMPACT EARNINGS (Sana 14 Oct 2026: "Now this Earnings Screen"
 * -> "GO").
 *
 * Measured in a browser on the same figures as her screenshot (Rs 2,399
 * earned, Rs 1,334 kept) at 1536 x 864: the whole page went from 1,902 px to
 * 991 px, "Which shops earn you the most" from 1,129 px to 456 px down, and
 * the five ways Takal earns came up onto the first screen. Nothing sideways at
 * 1024 / 1280 / 1536. Only placement and spacing changed - these guard that
 * nothing was lost and no sum was touched.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const PAGE = read("app/dashboard/earnings/page.tsx");
const TABLE = read("components/ui/Table.tsx");
const flat = PAGE.replace(/&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");

test("one header line: title, its sentence (whole on hover), the dates, Export CSV and Refresh", () => {
  assert.match(PAGE, /<h2 className="shrink-0 text-lg font-bold text-takal-ink">Earnings<\/h2>\s*<p className="min-w-0 flex-1 truncate text-sm text-takal-ink-soft" title=\{ABOUT\}>/);
  assert.match(PAGE, /const ABOUT = "Answers: what did Takal itself make\? Not what customers paid/);
  assert.match(PAGE, /\{RANGES\.map\(\(r\) => \([\s\S]{0,700}onClick=\{exportCsv\}>Export CSV<\/Button>[\s\S]{0,200}onClick=\{load\} loading=\{loading\}>Refresh<\/Button>/);
});

test("the black box no longer stretches; the five ways sit under it; What you gave back beside both", () => {
  assert.match(PAGE, /<div className="lg:col-span-2 space-y-3 min-w-0">\s*<div data-earned-hero className="bg-takal-ink text-white rounded-lg px-5 py-4 flex flex-col md:flex-row md:items-center gap-4">/);
  assert.match(PAGE, /<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2\.5">/);
  assert.match(PAGE, /<div data-gave-back-box className="bg-white rounded-lg border border-takal-line px-4 py-3 flex flex-col">/);
  // A tile's explanation is its title's hover text.
  assert.match(PAGE, /cursor-help" title=\{why\}>/);
  // A "gave back" line with its own figures keeps them, one short line.
  assert.match(PAGE, /detail=\{`Of \$\{money\(p\.refunds_total\)\} refunded, the shops carried \$\{money\(p\.refund_shop_carried\)\}`\}/);
});

test("the markup note is one line until clicked - every word still there", () => {
  assert.match(PAGE, /<details data-markup-note/);
  assert.match(PAGE, /\{a\.markup_not_recorded\} older orders · no money was lost/);
  assert.match(PAGE, /Read why ▾/);
});

test("nothing removed: every label, sentence and figure that was on the page", () => {
  for (const w of [
    "Answers: what did Takal itself make?", "almost all of that belongs to the shops",
    "WHAT TAKAL EARNED · ", "After refunds, promo discounts, wallet credit, late cancels and staff pay,",
    "All-time:", "Customers paid", "Almost all of this is the shops' money", "Your take rate",
    "Of every Rs 100 a customer spends, Takal earns about Rs", "What you gave back",
    "Refunds you carried", "Free delivery given", "Already inside the delivery line below.",
    "Promo discounts", "Wallet credit used", "Promo codes and wallet credit are Takal's money. The shop is still paid in full.",
    "Late cancels paid by Takal", "cancelled after the shop took it - the shop's share and the rider's trip, paid by Takal.",
    "Staff pay (salaries & bonuses)", "to office staff, on the day each was paid. Cancelled payments are not counted.",
    "Net kept", "The ways Takal earns", "Every one of these is a number you can change in Settings.",
    "Commission", "Menu markup", "Price difference", "Rider delivery", "Parcel shipping",
    "of which sold at a loss", "shown, never hidden",
    "Why the markup looks missing on older orders", "No money was lost.", "every shop is on the same 5%.",
    "Which shops earn you the most", "Fixed-price stores", "These figures could not be read",
    "No delivered orders in these dates", "No fixed-price orders in these dates", "These figures are incomplete",
    "Only <strong>delivered</strong> orders count.", "the two screens cannot disagree.",
  ]) assert.ok(flat.includes(w), w);
});

test("only looks changed: one read, the same buttons, the same export, the same sums", () => {
  const count = (re: RegExp) => (PAGE.match(re) ?? []).length;
  assert.equal(count(/apiClient\.\w+/g), 1);
  assert.match(PAGE, /apiClient\.getEarnings\(range \? \{ days: range \} : \{\}\)/);
  assert.equal(count(/onClick=/g), 4);
  assert.equal(count(/downloadCsv/g), 2);
  for (const sum of ["money(p.earned)", "money(p.net)", "money(a.earned)", "money(a.net)", "money(p.customers_paid)",
    "money(p.refund_takal_carried)", "money(p.free_delivery_given)", "money(p.discounts_given)", "money(p.credit_given)",
    "money(p.late_cancels_paid ?? 0)", "money(p.staff_pay ?? 0)", "{Math.round(p.take_rate ?? 0)}"]) {
    assert.ok(PAGE.includes(sum), sum);
  }
});

test("tighter shop tables on THIS page only - every other table is unchanged", () => {
  assert.match(TABLE, /dense = false,/);
  assert.match(TABLE, /const pad = dense \? "px-4 py-2" : "px-6 py-4";/);
  assert.equal((PAGE.match(/<Table\s+dense/g) ?? []).length, 2);
  const others: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") && !p.endsWith(join("earnings", "page.tsx")) && /<Table\s+dense/.test(readFileSync(p, "utf8"))) others.push(p);
    }
  };
  walk(fileURLToPath(new URL("../src/app", import.meta.url)));
  assert.deepEqual(others, []);
});
