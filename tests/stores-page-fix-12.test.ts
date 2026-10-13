// STORES PAGE FIX 12 (Sana, 12 October 2026: "OK fix 12") - three small
// display fixes.
//   1. Cancellations shows "Fashion", not the code "clothing_store".
//   2. Low stock: the shop's name opens that shop.
//   3. A store's Recent orders shows the order number (#10001) and a row
//      opens that order - the Orders page now opens ?order=<id>, which also
//      makes the Support pages' links work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { orderLabel } from "../src/lib/format.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("1. Cancellations names the shop type in words", () => {
  const p = read("src/app/dashboard/stores/reliability/page.tsx");
  assert.match(p, /verticalLabel\(r\.vendor_type\)/);
  assert.doesNotMatch(p, /\{r\.vendor_type \|\| ""\}/);
});

test("2. Low stock: the shop name is a link when the server sends its id", () => {
  const p = read("src/app/dashboard/stores/inventory/page.tsx");
  assert.match(p, /\{r\.store_id \? \(\s*<Link href=\{`\/dashboard\/stores\/\$\{r\.store_id\}`\}/);
});

test("3. Recent orders: the number, and the row opens the order", () => {
  const p = read("src/app/dashboard/stores/[id]/page.tsx");
  assert.match(p, /\{orderLabel\(o\)\}/);
  assert.doesNotMatch(p, />#\{o\.id\}</);
  assert.match(p, /router\.push\(`\/dashboard\/orders\?order=\$\{encodeURIComponent\(o\.id\)\}`\)/);
  assert.equal(orderLabel({ id: "e407df50-1111", order_no: 10001 }), "#10001");
  assert.equal(orderLabel({ id: "e407df50-1111" }), "#e407df50", "an older server still shows something");
});

test("3. the Orders page opens the order named in the address", () => {
  const p = read("src/app/dashboard/orders/page.tsx");
  assert.match(p, /new URLSearchParams\(window\.location\.search\)\.get\("order"\)/);
  assert.match(p, /if \(id && \/\^\[0-9a-fA-F-\]\{8,64\}\$\/\.test\(id\)\) setOpenId\(id\);/);
});
