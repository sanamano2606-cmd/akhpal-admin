// MOCK 233 PIECE 5 (Sana, 9 Nov 2026: "Go 5"): Store settings shows the up to
// 3 types a shop ALSO sells, and the office can correct them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alsoSellsLine } from "../src/lib/also-sells.ts";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");
const CARD = code("src/app/dashboard/stores/[id]/parts-also-sells.tsx");
const PAGE = code("src/app/dashboard/stores/[id]/page.tsx");
const API = code("src/lib/api-stores.ts");
const SERVER = code("../swat-delivery-app/backend/routers/shop_also_sells.py");

test("the line under the title", () => {
  assert.equal(alsoSellsLine(["Fashion"]), "Also listed under Fashion");
  assert.equal(alsoSellsLine([]), "Listed under its main type only");
});

test("the box asks the server's own doors", () => {
  assert.match(SERVER, /@router\.get\("\/admin\/restaurants\/\{restaurant_id\}\/also-sells"/);
  assert.match(SERVER, /@router\.put\("\/admin\/restaurants\/\{restaurant_id\}\/also-sells"/);
  assert.match(API, /`\/admin\/restaurants\/\$\{restaurantId\}\/also-sells`/);
  assert.match(API, /body: JSON\.stringify\(\{ also_sells: alsoSells \}\)/);
});

test("it is on Store settings, editable only with Add & edit shops", () => {
  assert.match(PAGE, /<AlsoSellsCard restaurantId=\{id\} \/>/);
  assert.match(CARD, /const mayEdit = canAccess\("stores\.all"\);/);
  assert.match(CARD, /\{mayEdit && changed && \(/);
  assert.match(CARD, /At most \$\{max\} - untick one first\./);
});
