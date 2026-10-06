// EXTRAS ON A RESTAURANT DISH, IN THE ADMIN PANEL (Mock 166).
// Sana, 6 October 2026: "Approved A" - the dish's discount comes off the whole
// line, extras included.
//
// Golden Star's pizza: Medium Rs 1,300; Extra cheese + Rs 150, Stuffed crust
// + Rs 250. A customer ticking both pays Rs 1,700. These checks hold:
//   * an extra goes to the server as an option of type "Extra" whose price is
//     what it ADDS - the same as the Partners app and backend/extras.py;
//   * every extra needs a name and an amount (0 = free), no two share a name;
//   * extras never make a dish read as "not in sizes", and are saved with the
//     sizes, so saving the dish in the admin panel never wipes its extras.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QUICK_EXTRAS,
  extrasFromVariants,
  extrasProblem,
  extrasToVariants,
  isExtra,
  sizesFromVariants,
  usedExtras,
  variantsAreSizes,
} from "../src/lib/product-sizes.ts";

function code(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
}

const fromServer = [
  { variant_type: "Extra", variant_value: "Extra cheese", price_override: 150 },
  { variant_type: "Extra", variant_value: "Stuffed crust", price_override: 250 },
  { variant_type: "Size", variant_value: "Medium 11\"", price_override: 1300 },
  { variant_type: "Size", variant_value: "Regular 7\"", price_override: 650 },
];

test("an extra is known by its type only", () => {
  assert.equal(isExtra({ variant_type: " extra " }), true);
  assert.equal(isExtra({ variant_type: "Size" }), false);
  assert.equal(isExtra({}), false);
});

test("a pizza with sizes and extras still reads as In sizes", () => {
  assert.equal(variantsAreSizes(fromServer), true);
  assert.equal(variantsAreSizes(fromServer.filter(isExtra)), false, "extras alone are not sizes");
});

test("the extras are read back in the shop's order; the sizes without them", () => {
  assert.deepEqual(extrasFromVariants(fromServer), [
    { name: "Extra cheese", adds: "150" },
    { name: "Stuffed crust", adds: "250" },
  ]);
  const choices = fromServer.filter((v) => !isExtra(v));
  assert.deepEqual(sizesFromVariants(choices).map((r) => r.name), ["Regular 7\"", "Medium 11\""]);
});

test("extras go to the server as Extra options with what they ADD, no stock", () => {
  const out = extrasToVariants([
    { name: " Extra cheese ", adds: "150" },
    { name: "", adds: "" },
    { name: "Free salad", adds: "0" },
  ]);
  assert.deepEqual(out, [
    { variant_type: "Extra", variant_value: "Extra cheese", price_override: 150 },
    { variant_type: "Extra", variant_value: "Free salad", price_override: 0 },
  ]);
  for (const v of out) assert.equal("stock_quantity" in v, false);
});

test("a save says exactly what is missing", () => {
  assert.equal(extrasProblem([]), null, "no extras is fine");
  assert.equal(extrasProblem([{ name: "", adds: "" }]), null, "an empty row is ignored");
  assert.equal(extrasProblem([{ name: "", adds: "50" }]), "Type a name for every extra");
  assert.equal(extrasProblem([{ name: "Cheese", adds: "" }]), "Type what Cheese adds (0 if it is free)");
  assert.equal(extrasProblem([{ name: "Cheese", adds: "-5" }]), "Type what Cheese adds (0 if it is free)");
  assert.equal(
    extrasProblem([{ name: "Cheese", adds: "1" }, { name: "cheese", adds: "2" }]),
    "Two extras are both called cheese",
  );
  assert.equal(usedExtras([{ name: "", adds: "" }, { name: "A", adds: "" }]).length, 1);
});

test("the quick ideas are the same four the Partners app offers", () => {
  assert.deepEqual(QUICK_EXTRAS.map((x) => `${x.name} ${x.adds}`), [
    "Extra cheese 150", "Extra chicken 200", "Stuffed crust 250", "Extra sauce 50",
  ]);
});

test("the editor shows extras for restaurants and saves them with the sizes", () => {
  const s = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.ok(s.includes("const vs = isRestaurant ? all.filter((v) => !isExtra(v)) : all;"));
  assert.ok(s.includes("if (isRestaurant) setExtras(extrasFromVariants(all));"));
  assert.ok(s.includes("isRestaurant ? [...vs, ...extrasToVariants(extras)] : vs"));
  assert.ok(s.includes("const extraProblem = isRestaurant ? extrasProblem(extras) : null;"));
  assert.ok(s.includes('data-testid="extras-section"'));
  // Shops that sell goods keep their options exactly as before.
  assert.ok(s.includes("{(!isRestaurant || otherOptions) && ("));
});
