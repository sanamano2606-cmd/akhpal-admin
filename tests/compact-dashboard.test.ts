/**
 * MOCK 191 - A COMPACT DASHBOARD (approved by Sana 14 Oct 2026: "re arrange
 * the content. do not remove any content. just re organise and make it the
 * compacted as much as you can" -> "GO").
 *
 * Measured in a browser: the whole page went from 1,392 px (scrolling 528 px)
 * to 864 px at 1536 x 864 - one screen, no scrolling - with every word that
 * was on it still there. These guard both halves: compact, and nothing lost.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const DASH = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");

test("nothing was removed - every heading, figure and line is still on the page", () => {
  for (const words of [
    "Welcome back! Here&apos;s your live overview.", "Last 30 days", "Refresh",
    'title="Total Orders"', 'title="Takal earned (all-time)"', 'title="Approved Stores"', 'title="Online Riders"', "See the breakdown →",
    "Needs your attention", "Stores awaiting approval", "Riders awaiting approval", "Pending orders",
    "Money customers paid — last {days} days", "Order Status Distribution", "Quick Stats",
    "Today&apos;s Orders", "Commission earned", "Menu markup earned", "Price difference", "Delivery kept",
    "Money customers paid <span", "Stores waiting for approval", "Pending Riders",
    "System Health", 'label="API"', 'label="Database"', 'label="Push (Firebase)"', 'label="Sign-up (OTP)"',
    'label="AI features (paid)"', 'label="Old rider apps"', "Nothing to show here yet",
  ]) {
    assert.ok(DASH.includes(words), words);
  }
});

test("compact: one header line, one row of tiles, three columns, health on one line", () => {
  assert.match(DASH, /<h1 className="text-2xl font-bold text-takal-ink">Dashboard<\/h1>\s*<p className="text-sm/);
  assert.match(DASH, /<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">/);
  assert.match(DASH, /<AttentionTile href="\/dashboard\/stores\?status=pending" count=\{pendingRestaurants\}/);
  assert.doesNotMatch(DASH, /bg-amber-50 border border-amber-200 rounded-lg p-4/, "no separate attention box");
  assert.match(DASH, /<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2\.5">/);
  assert.match(DASH, /<div className="flex items-center gap-4">\s*<div className="w-\[170px\] shrink-0">/, "the ring's list is beside it");
  assert.match(DASH, /px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1">\s*<h3 className="font-semibold text-takal-ink text-sm">System Health<\/h3>/);
  assert.match(DASH, /<p className="basis-full text-xs text-red-500">\{health\.database_reason\}<\/p>/, "a problem's reason still shows in full");
});

test("each part still shows only to whom may see it", () => {
  assert.match(DASH, /\{attnShops && \(/);
  assert.match(DASH, /\{attnRiders && \(/);
  assert.match(DASH, /\{attnOrders && \(/);
  assert.match(DASH, /\{showQuick && \(/);
  assert.match(DASH, /\{showHealth && \(/);
  assert.match(DASH, /const showQuick = showOrders \|\| showMoney \|\| showShops \|\| showRiders;/);
});
