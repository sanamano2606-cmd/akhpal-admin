// ─────────────────────────────────────────────────────────────────────────────
// MALL STAFF IN A FIXED-PRICE STORE SEE ONLY WHAT THE STORE GETS
// (money audit 21 Oct 2026, AREA-7-9; decision 3 of the fixed-price plan).
//
// The staff products table fell back to the ordinary "Price" column, which
// prints `price` - and in a fixed-price store that is TAKAL'S SELLING price.
// Example: almonds, buying price Rs 2,600, selling at Rs 2,570 (a loss). The
// staff list showed "Rs 2,570" and could count the losses. The vendor side
// sees only what it GETS. The screen now shows "You get" (the server's
// `you_get`) and "—" until the server sends it - never the selling price.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const tab = read("src/app/dashboard/stores/[id]/parts-products.tsx");

test("a staff member in a fixed-price store is recognised", () => {
  assert.ok(tab.includes('const staffFixed = !!staffView && data?.price_mode === "fixed";'));
});

test("the price cell shows what the store gets, never the selling price", () => {
  const i = tab.indexOf("{staffFixed ? (\n                          // What the store gets");
  assert.ok(i > 0, "the staff cell is gone");
  const cell = tab.slice(i, i + 400);
  assert.ok(cell.includes('typeof p.you_get === "number" ? money(p.you_get) : "—"'));
  assert.ok(!cell.includes("p.price"), "the staff cell reads the selling price");
  // ...and it comes BEFORE the editable price button, so staff never reach it.
  assert.ok(i < tab.indexOf('{n.busy === "price" ? "Saving…" : money(p.price)}'));
});

test("the column is called You get for them", () => {
  assert.ok(tab.includes('{staffFixed ? "You get" : "Price"}'));
});

test("the Loss and No-buy-price buttons stay hidden from staff", () => {
  // They show only where buying prices are shown, which staff never are.
  assert.ok(tab.includes("const fixed = !staffView && data?.price_mode === \"fixed\";"));
  assert.ok(tab.includes("(showBuy || !PRICE_FILTER_IDS.includes(f.id))"));
});
