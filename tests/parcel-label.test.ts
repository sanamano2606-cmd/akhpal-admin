// ─────────────────────────────────────────────────────────────────────────────
// THE PARCEL LABEL — the paper stuck ON THE OUTSIDE of the box.
// Mock 94, approved by Sana on 18 September 2026.
//
// THE RULE THIS GUARDS (docs/PRIVACY-AND-CONTACT-RULES.md §7):
// Swat is a small place and a customer may order something private. The label
// is read by anyone who handles the box — the Takal staff who carry standard
// parcels, whoever opens the door, anyone standing near it. So it carries the
// customer's details, the shop's NAME and the amount to collect, and NEVER a
// product, a size, a colour, the shop's phone number or the 4-digit code.
//
// Nothing goes red when this breaks. A product name quietly appears on the
// outside of a box and the first anyone knows is a customer who will not order
// again. So the label's own source is read here.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { code128Bits, code128Bars } from "../src/lib/code128.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const label = read("src/app/dashboard/orders/parts-parcel-label.tsx");
const panel = read("src/app/dashboard/orders/parts-order-panel.tsx");
const parcels = read("src/app/dashboard/orders/parcels/page.tsx");

/** The code, with the comments taken out. A note ABOUT a rule is not a breach. */
const codeOnly = (src: string) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("*/"));
    })
    .join("\n");

// ─── 1. THE BAN ──────────────────────────────────────────────────────────────

test("the label's own code mentions no product, anywhere", () => {
  const forbidden = [
    "item_name",
    "variant_label",
    "variant_id",
    "variant_ids",
    "base_price",
    "order_items",
    "menu_item",
  ];
  const found = forbidden.filter((w) => codeOnly(label).includes(w));
  assert.deepEqual(
    found,
    [],
    "The parcel label is stuck on the OUTSIDE of the box. It now mentions: " +
      found.join(", ") +
      ". Sana's rule, 18 September 2026: never a product, never a size, never " +
      "a colour.",
  );
});

test("the label is never handed the order's lines", () => {
  // Not "it does not print them" — it is never GIVEN them. A component with no
  // items cannot leak one however it is later edited.
  assert.ok(
    !/items\s*[?:]/.test(codeOnly(label)),
    "parts-parcel-label.tsx must not take an `items` prop. The whole defence " +
      "is that the lines never reach this file.",
  );
  for (const [where, src] of [["the order page", panel], ["the parcels desk", parcels]] as const) {
    const m = src.match(/<ParcelLabel(Batch)?[\s\S]{0,400}?\/>/g) || [];
    assert.ok(m.length > 0, `${where} should print a label.`);
    for (const use of m) {
      assert.ok(
        !use.includes("items"),
        `${where} passes items to the label. It must not:\n${use}`,
      );
    }
  }
});

test("the label carries neither the shop's phone nor the delivery code", () => {
  for (const banned of ["restaurant_phone", "delivery_code"]) {
    assert.ok(
      !codeOnly(label).includes(banned),
      `A customer reaches a shop through Takal, and the 4-digit code is the ` +
        `customer's alone. The label must not carry ${banned}.`,
    );
  }
});

// ─── 2. WHAT IT MUST STILL SHOW ──────────────────────────────────────────────

test("the label shows everything a delivery needs", () => {
  for (const needed of [
    "receiver_name",
    "receiver_phone",
    "delivery_address",
    "restaurant_name",
    "total_amount",
    "delivery_type",
  ]) {
    assert.ok(
      codeOnly(label).includes(needed),
      `The parcel cannot be delivered without ${needed}. Banning the products ` +
        "must not end in an empty label.",
    );
  }
  assert.ok(codeOnly(label).includes("CONTACT_PHONE"), "Takal's own phone must be on it.");
  assert.ok(codeOnly(label).includes("CONTACT_EMAIL"), "Takal's own email must be on it.");
});

test("both papers can be printed, from the order page and from the parcels desk", () => {
  assert.ok(panel.includes("Print label"), "The order page needs a Print label button.");
  assert.ok(panel.includes("Print receipt"), "It must not have lost Print receipt.");
  assert.ok(parcels.includes("Print their labels"), "The parcels desk prints labels in a batch.");
  assert.ok(parcels.includes("Print their receipts"), "It must not have lost the receipts batch.");
});

test("the amount keeps Rs and the number on one line", () => {
  // Sana, 18 September 2026. A wrapped amount is the one number on the label
  // that must not be misread.
  assert.ok(
    /whiteSpace:\s*"nowrap"/.test(label),
    "The COLLECT amount must not wrap.",
  );
});

// ─── 3. THE BARCODE ──────────────────────────────────────────────────────────
//
// Written out in src/lib/code128.ts rather than installed, because a new
// package in package.json stops Sana's deploy (CLAUDE.md §4). These vectors
// come from Python's `python-barcode`, the reference implementation.

const VECTORS: [string, string][] = [
  ["TKL-3AA2F6FC", "110100100001101110001010110001110100011011101001101110011001011100101000110001010001100011001110010100011000101100111010010001100010100010001101100111010011000111010"],
  ["A", "11010010000101000110001000101100011000111010"],
  ["0123456789", "11010010000100111011001001110011011001110010110010111001100100111011011100100110011101001110110111011101001100111001011001100001010011000111010"],
  ["!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~", "11010010000110011011001100110011010010011000100100011001000100110010011001000100110001001000110010011001001000110010001001100010010010110011100100110111001001100111010111001100100111011001001110011011001110010110010111001100100111011011100100110011101001110110111011101001100111001011001110010011011101100100111001101001110011001011011011000110110001101100011011010100011000100010110001000100011010110001000100011010001000110001011010001000110001010001100010001010110111000101100011101000110111010111011000101110001101000111011011101110110110100011101100010111011011101000110111000101101110111011101011000111010001101110001011011101101000111011000101110001101011101111010110010000101111000101010100110000101000011001001011000010010000110100001011001000010011010110010000101100001001001101000010011000010100001101001000011001011000010010110010100001111011101011000010100100011110101010011110010010111100100100111101011110010010011110100100111100101111010010011110010100111100100101101101111011011110110111101101101010111100010100011110100010111101001001100011000111010"],
  ["Rs 1,344", "1101001000011000101110101111001001101100110010011100110101100111001100101110011001001110110010011101000110001011000111010"],
  ["TKL-00000000", "110100100001101110001010110001110100011011101001101110010011101100100111011001001110110010011101100100111011001001110110010011101100100111011001001100001011000111010"],
];

test("the barcode matches the reference implementation", () => {
  for (const [text, bits] of VECTORS) {
    assert.equal(code128Bits(text), bits, `Code 128 of ${JSON.stringify(text.slice(0, 20))}`);
  }
});

test("a barcode that cannot be made is left out, not guessed at", () => {
  assert.equal(code128Bits(""), null, "Nothing to encode.");
  assert.equal(code128Bits("café"), null, "Code 128 B holds no é — printing something else would scan as something else.");
  assert.equal(code128Bars("TKL-3AA2F6FC")?.[0], 2, "Code 128 always opens with a 2-module bar.");
});

test("the bar widths and the bits are the same answer", () => {
  const runs = code128Bars("TKL-3AA2F6FC")!;
  const bits = code128Bits("TKL-3AA2F6FC")!;
  assert.equal(runs.reduce((a, b) => a + b, 0), bits.length, "The runs must add up to the bits.");
});
