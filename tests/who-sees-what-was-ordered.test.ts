// ─────────────────────────────────────────────────────────────────────────────
// WHO IS ALLOWED TO SEE WHAT WAS ORDERED (Sana, 18 September 2026).
//
// Swat is a small place and a customer may order something private. Sana's
// rule, in her own words:
//
//   • The RIDER (express) may see the products and the amount to collect.
//   • The TAKAL STAFF who carry standard parcels see the customer's details
//     and how much to collect, and NEVER the products.
//   • The office sees everything.
//   • The customer's own receipt, sealed inside the parcel, names the size or
//     colour - it is the customer's own record and what a return is argued
//     from.
//
// Nothing goes red when this is broken. A product name quietly appears on the
// staff's screen and the first anyone knows is a customer complaining that a
// delivery man saw what she bought. So it is guarded by a test that reads the
// screens themselves.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const officePanel = read("src/app/dashboard/orders/parts-order-panel.tsx");
const customerReceipt = read("src/app/dashboard/orders/parts-customer-receipt.tsx");
const staffDeliveries = read("src/app/dashboard/my-deliveries/page.tsx");

// It is not enough that the file MENTIONS variant_label - `{it.variant_label ?`
// is only the question. `{it.variant_label}` is the answer being printed. A
// first version of this test checked the mention and happily passed while the
// option had been emptied out of the span, so it checks the printed form.
test("the office's order page PRINTS the chosen option", () => {
  assert.ok(
    officePanel.includes("{it.variant_label}"),
    'The office could not answer "which size did she order?" from any screen. ' +
      "order_items.variant_label is on every line - print it beside the name.",
  );
});

test("the customer's receipt PRINTS the chosen option", () => {
  assert.ok(
    customerReceipt.includes("{it.variant_label}"),
    "The receipt is sealed inside the parcel and read by the customer. " +
      "Without the size or colour there is nothing to argue a return from.",
  );
});

// ─── THE ONE THAT MATTERS MOST ───────────────────────────────────────────────
test("the Takal staff's delivery screen shows NO product details", () => {
  // Every way a product could reach that screen. The names are deliberately
  // broad: the point is that nothing about WHAT is in the box gets near it.
  const forbidden = [
    "item_name",
    "variant_label",
    "variant_id",
    "order_items",
    "menu_item",
    "base_price",
    "p.items",
    "order.items",
  ];
  const found = forbidden.filter((word) => {
    // A note ABOUT the rule is not a breach of it.
    return staffDeliveries
      .split("\n")
      .some((line) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return false;
        return line.includes(word);
      });
  });
  assert.deepEqual(
    found,
    [],
    "Sana's rule, 18 September 2026: the Takal staff who carry standard " +
      "parcels must never see what is inside. This screen now mentions: " +
      found.join(", ") +
      ". Show the customer, the address, the phone and the amount to " +
      "collect - nothing about the goods.",
  );
});

test("the staff screen still shows what it IS allowed to show", () => {
  // The rule above is a ban. This one stops somebody satisfying the ban by
  // emptying the screen.
  for (const needed of ["delivery_address", "receiver_phone", "total_amount"]) {
    assert.ok(
      staffDeliveries.includes(needed),
      `The staff screen must still show ${needed} - the delivery cannot be ` +
        "made without it.",
    );
  }
});
