// A RESTAURANT DISH SOLD IN SIZES, IN THE ADMIN PANEL (Mock 162).
// Sana, 5 October 2026: "Start the admin panel sizes improvement".
//
// The product editor asks a restaurant "How is it sold? One price / In sizes",
// the same as the Partners app. These checks hold the rules in place:
//   * every size needs a name and a price, and no two sizes share a name;
//   * the dish's own price is its CHEAPEST size - typed by nobody, so a pizza
//     can no longer be saved "from Rs 2,400" when it starts at Rs 650;
//   * sizes go to the server as options of type "Size", cheapest first, with
//     no stock (cooked food is not counted);
//   * the general options grid stays for shops that sell goods.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QUICK_SETS,
  cheapestSize,
  cheapestFirst,
  quickFill,
  sizesFromVariants,
  sizesProblem,
  sizesToVariants,
  usedSizes,
  variantsAreSizes,
} from "../src/lib/product-sizes.ts";

function code(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
}

const pizza = [
  { name: "Large 13\"", price: "1700" },
  { name: "Regular 7\"", price: "650" },
  { name: "Extra large 16\"", price: "2400" },
  { name: "Medium 11\"", price: "1300" },
];

test("the dish costs its cheapest size", () => {
  assert.equal(cheapestSize(pizza), 650);
  assert.equal(cheapestSize([]), null);
});

test("sizes go to the server cheapest first, as Size options, no stock", () => {
  assert.deepEqual(sizesToVariants(pizza), [
    { variant_type: "Size", variant_value: "Regular 7\"", price_override: 650 },
    { variant_type: "Size", variant_value: "Medium 11\"", price_override: 1300 },
    { variant_type: "Size", variant_value: "Large 13\"", price_override: 1700 },
    { variant_type: "Size", variant_value: "Extra large 16\"", price_override: 2400 },
  ]);
  for (const v of sizesToVariants(pizza)) assert.equal("stock_quantity" in v, false);
});

test("a save says exactly what is missing", () => {
  assert.equal(sizesProblem([]), "Add at least one size, or choose One price");
  assert.equal(sizesProblem([{ name: "Small", price: "" }]), "Type a price for Small");
  assert.equal(sizesProblem([{ name: "Small", price: "0" }]), "Type a price for Small");
  assert.equal(sizesProblem([{ name: "", price: "200" }]), "Type a name for every size");
  assert.equal(
    sizesProblem([{ name: "Small", price: "200" }, { name: "small", price: "300" }]),
    "Two sizes are both called small",
  );
  assert.equal(sizesProblem(pizza), null);
  // Empty rows are not a problem - they are ignored.
  assert.equal(sizesProblem([...pizza, { name: "", price: "" }]), null);
  assert.equal(usedSizes([...pizza, { name: "", price: "" }]).length, 4);
});

test("a product's options are read back as sizes, cheapest first", () => {
  const vs = [
    { variant_type: "Size", variant_value: "Large 13\"", price_override: 1700 },
    { variant_type: "size", variant_value: "Regular 7\"", price_override: 650.0 },
  ];
  assert.equal(variantsAreSizes(vs), true);
  assert.deepEqual(sizesFromVariants(vs), [
    { name: "Regular 7\"", price: "650" },
    { name: "Large 13\"", price: "1700" },
  ]);
  assert.equal(variantsAreSizes([{ variant_type: "Colour", variant_value: "Red" }]), false);
  assert.equal(variantsAreSizes([]), false);
});

test("quick start fills names, keeps typed prices, never doubles a name", () => {
  const out = quickFill([{ name: "Small", price: "200" }, { name: "", price: "" }], QUICK_SETS[0]);
  assert.deepEqual(out, [
    { name: "Small", price: "200" },
    { name: "Medium", price: "" },
    { name: "Large", price: "" },
  ]);
});

test("the same price keeps its order; a row with no price goes last", () => {
  const out = cheapestFirst([
    { name: "B", price: "5" }, { name: "X", price: "" }, { name: "A", price: "5" }, { name: "C", price: "1" },
  ]);
  assert.deepEqual(out.map((r) => r.name), ["C", "B", "A", "X"]);
});

test("the editor uses these rules, and only for restaurants", () => {
  const s = code("src/app/dashboard/stores/[id]/ProductEditorModal.tsx");
  assert.ok(s.includes('const isRestaurant = vendorType === "restaurant";'));
  assert.ok(s.includes("price: sized ? (cheapestSize(sizes) as number) : parseFloat(price) || 0,"));
  assert.ok(s.includes("const vs = sized ? sizesToVariants(sizes) : variants"));
  assert.ok(s.includes("const sizeProblem = sized ? sizesProblem(sizes) : null;"));
  assert.ok(s.includes("How is it sold?"));
  // Shops that sell goods keep the general grid.
  assert.ok(s.includes("{(!isRestaurant || otherOptions) && ("));
});
