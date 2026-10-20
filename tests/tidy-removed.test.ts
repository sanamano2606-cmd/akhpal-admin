// AUDIT 204 fix 7 - Settings > Tidy up removed products (Mock 203, APPROVED
// by Sana 20 Oct 2026). The words and rules of the card, and the wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkLines, confirmTitle, dayWords, mayRemove, removedBetween, type TidyCheck } from "../src/lib/tidy-removed.ts";
import { SERVER_RULES } from "../src/lib/navigation.ts";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8");

const LIVE: TidyCheck = { products: 219, shops: 11, first_removed: "2026-10-05T09:12:00+00:00",
  last_removed: "2026-10-05T09:15:00+00:00", files: 657, on_orders_kept: 0 };

test("the list after Check first says what Mock 203 says", () => {
  assert.deepEqual(checkLines({ ...LIVE, first_removed: "2026-08-05", last_removed: "2026-10-05" }), [
    ["Removed products, on no order", "219"],
    ["Shops they belong to", "11"],
    ["Removed between", "5 Aug - 5 Oct 2026"],
    ["Picture files to remove (with small copies)", "up to 657"],
    ["Products on an order (kept)", "0 touched"],
  ]);
  assert.equal(removedBetween(LIVE), "5 Oct 2026", "one day, said once");
  assert.equal(removedBetween({ first_removed: "2025-12-30", last_removed: "2026-01-02" }), "30 Dec 2025 - 2 Jan 2026");
  assert.equal(dayWords(null), "-");
});

test("Remove only after a check that found something; the question names the number", () => {
  assert.equal(mayRemove(null), false);
  assert.equal(mayRemove({ ...LIVE, products: 0 }), false);
  assert.equal(mayRemove(LIVE), true);
  assert.equal(confirmTitle(219), "Remove 219 products for good?");
  assert.equal(confirmTitle(1), "Remove 1 product for good?");
});

test("Main Admin only - the panel and the server agree", () => {
  assert.deepEqual(SERVER_RULES.find(([p]) => p === "/admin/products/tidy-removed")?.[1], "__super__");
  const guard = readFileSync(join(ROOT, "..", "swat-delivery-app", "backend", "app_guard.py"), "utf8");
  assert.match(guard, /\("\/admin\/products\/tidy-removed", "__super__"\)/);
  const card = code("src/app/dashboard/settings/parts-tidy-removed.tsx");
  assert.match(card, /if \(!isSuper\) return null;/);
});

test("the card is on Settings, sends the number it showed, and says the backup note", () => {
  const page = code("src/app/dashboard/settings/page.tsx");
  assert.match(page, /<TidyRemovedProducts \/>/);
  const card = code("src/app/dashboard/settings/parts-tidy-removed.tsx");
  assert.match(card, /tidyRemovedProducts\(check\.products\)/);
  assert.match(card, /copied to a backup list first/);
  assert.match(card, /their pictures cannot come back/);
  const api = code("src/lib/api-stores.ts");
  assert.match(api, /\/admin\/products\/tidy-removed`, \{\s*method: "POST",\s*body: JSON\.stringify\(\{ expected \}\)/);
});
