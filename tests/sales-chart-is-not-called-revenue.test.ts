/**
 * Item 9 (Sana, 2 October 2026): the chart of what CUSTOMERS paid is not
 * called "Revenue".
 *
 * It plots money customers paid each day (after refunds) - food, delivery and
 * mark-up, almost all of it the shops'. The Dashboard headline was renamed for
 * the same reason; the chart under it still said "Revenue Trend", which reads
 * as Takal's own income (Rs 48,392 shown on a day Takal earned Rs 2,615).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) =>
  readFileSync(join(import.meta.dirname, "..", "src", "app", "dashboard", ...p), "utf8");
const DASH = read("page.tsx");
const SALES = read("reports", "sales", "page.tsx");

for (const [where, src] of [["Dashboard", DASH], ["Reports → Sales", SALES]] as const) {
  test(`${where}: the chart says what it is, and that it is mostly the shops'`, () => {
    assert.ok(!src.includes("Revenue Trend"), `${where} still says "Revenue Trend"`);
    assert.ok(src.includes("Money customers paid — last {days} days"));
    assert.ok(src.includes("Mostly the shops&apos; money"));
    assert.ok(src.includes('name="Customers paid"'), "the hover box still says revenue");
  });
}

test("the empty chart, the categories and the page line say sales", () => {
  // On screen (a line of its own), not the old note in the code's comments.
  assert.ok(!/^\s*No revenue data yet\s*$/m.test(DASH), "the empty chart still says revenue");
  assert.ok(/^\s*No sales yet\s*$/m.test(DASH));
  assert.ok(!SALES.includes("Top Categories by Revenue"));
  assert.ok(SALES.includes("Top categories by sales"));
  assert.ok(SALES.includes("sales, riders, customers and demand"));
});

test("the Dashboard points to where Takal's own earnings are", () => {
  assert.ok(DASH.includes('href="/dashboard/earnings"'));
});
