/**
 * MOCK 186 - ONE UPLOAD PAGE THAT DOES EVERYTHING (approved by Sana 13 Oct 2026).
 *
 *   "keep both and both must have same things at all" ... "Ok Keep the
 *    Catalogue and add all options of both and whatever you said."
 *
 * Both buttons open the SAME page: "Whole catalogue" on Add new, "Prices sheet"
 * on Update prices & stock. Step 4 shows now -> new, what Takal earns, and the
 * loss check (on Add AND Update). The figures come from the server
 * (backend/catalogue_money.py, tests/test_mock_186_one_upload_page.py); these
 * check the screen's own rules.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  earnsHeading, earnsText, linesFor, lossProducts, lossWhy, nowNew, partBody, productsToSave, saveAllowed,
  type CheckProduct, type CheckResult, type MoneyLine,
} from "../src/lib/catalogue-flow.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function line(over: Partial<MoneyLine>): MoneyLine {
  return {
    label: "", kind: "product", sell_now: null, sell_new: 45, buy_now: null, buy_new: 38,
    discount_percent: 0, pays: 45, earns: 7, earns_pct: 16, loss: false, missing_buying: false,
    stock_now: null, stock_new: null, price_changed: true, stock_changed: false, ...over,
  };
}

function product(name: string, over: Partial<MoneyLine> = {}, extra: Partial<CheckProduct> = {}): CheckProduct {
  const l = line(over);
  return {
    name, rows: [2], price: l.sell_new ?? undefined, buying_price: l.buy_new ?? undefined,
    money: { lines: [l], loss: l.loss, missing_buying: l.missing_buying, price_changed: l.price_changed, stock_changed: l.stock_changed },
    ...extra,
  };
}

function result(products: CheckProduct[], mode: "add" | "update" = "update"): CheckResult {
  return {
    mode, rows_read: products.length, rows_dropped: 0, products, already: [], not_found: [], problems: [], notes: [],
    counts: { products: products.length, with_options: 0, rows_joined: 0, already: 0, not_found: 0, problem_rows: 0,
      with_stock: 0, with_buying: 0, pictures: 0, prescription: 0 },
    parts: 1, room_today: null, daily_limit: null, fixed_price: true, mapping: [],
    money: { loss: products.filter((p) => p.money?.loss).length, missing_buying: 0, price_changes: 0, stock_only: 0, same: 0, earns_pct: 15 },
  };
}

test("now -> new: the old price struck through only when it really changes", () => {
  assert.deepEqual(nowNew(38, 48), { was: "Rs 38", is: "Rs 48", changed: true });
  assert.deepEqual(nowNew(45, 45), { was: null, is: "Rs 45", changed: false });
  assert.deepEqual(nowNew(null, 45), { was: null, is: "Rs 45", changed: false }, "Add: no 'now'");
  assert.deepEqual(nowNew(120, null), { was: null, is: "Rs 120", changed: false }, "not in the list: stays");
  assert.deepEqual(nowNew(null, null).is, "—");
  assert.deepEqual(nowNew(120, 200, (n) => n.toLocaleString()), { was: "120", is: "200", changed: true }, "stock is a count");
});

test("what Takal earns, in words - rupees and %, a loss with a minus", () => {
  assert.equal(earnsText({ earns: 11, earns_pct: 17 }), "Rs 11 · 17%");
  assert.equal(earnsText({ earns: -3, earns_pct: -7 }), "− Rs 3");
  assert.equal(earnsText({ earns: null, earns_pct: null }), "—");
  assert.equal(earnsHeading(true), "Takal earns");
  assert.equal(earnsHeading(false), "Margin", "a standard store: the shop's own margin, not Takal's");
});

test("why a red row is red - the discount named when it is the cause", () => {
  assert.equal(lossWhy(line({ buy_new: 48, sell_new: 45, pays: 45, earns: -3, loss: true })),
    "sells at a loss: Rs 3 on each one");
  assert.equal(lossWhy(line({ buy_new: 2710, sell_new: 3000, pays: 2700, earns: -10, loss: true, discount_percent: 10 })),
    "the 10% discount makes it a loss: Rs 10 on each one");
  assert.equal(lossWhy(line({})), "");
});

test("Save stays grey until a person has looked at every loss", () => {
  const r = result([product("Panadol", { earns: -3, loss: true }), product("Brufen")]);
  assert.equal(saveAllowed(r, false, false), false, "a loss nobody ticked");
  assert.equal(saveAllowed(r, true, false), true, "ticked: I know these sell at a loss");
  assert.equal(saveAllowed(r, false, true), true, "left out");
  assert.deepEqual(productsToSave(r, true).map((p) => p.name), ["Brufen"]);
  assert.deepEqual(productsToSave(r, false).map((p) => p.name), ["Panadol", "Brufen"]);
  assert.deepEqual(lossProducts(r).map((p) => p.name), ["Panadol"]);
  const onlyLoss = result([product("Panadol", { earns: -3, loss: true })]);
  assert.equal(saveAllowed(onlyLoss, false, true), false, "leaving out the only product leaves nothing to save");
  const none = result([product("Brufen")]);
  assert.equal(saveAllowed(none, false, false), true);
});

test("the tabs: Sell at a loss, Prices change, Stock only", () => {
  const r = result([
    product("Panadol", { earns: -3, loss: true }),
    product("Brufen", { price_changed: true }),
    product("Ensure", { price_changed: false, stock_changed: true }),
    product("Risek", { price_changed: false, stock_changed: false }),
  ]);
  assert.deepEqual(linesFor(r, "loss").map((l) => l.name), ["Panadol"]);
  assert.deepEqual(linesFor(r, "changes").map((l) => l.name), ["Panadol", "Brufen"]);
  assert.deepEqual(linesFor(r, "stock").map((l) => l.name), ["Ensure"]);
  assert.equal(linesFor(r, "all").length, 4);
});

test("a part sends the matched product's id, never the screen's money lines", () => {
  const p = product("Panadol", {}, { product_id: "p-1" });
  const body = partBody([p], [0])[0];
  assert.equal(body.product_id, "p-1");
  assert.equal("money" in body, false);
  assert.equal("rows" in body, false);
});

test("one page for both buttons: Prices sheet opens it on Update", () => {
  const products = code("src/app/dashboard/stores/[id]/parts-products.tsx");
  assert.ok(products.includes("href={`/dashboard/stores/${restaurantId}/catalogue?mode=update`}"));
  assert.ok(!products.includes("PricesSheetDialog"), "the old dialog is gone - one page, one set of rules");
  assert.ok(!code("src/app/dashboard/stores/[id]/parts-products-prices.tsx").includes("export function PricesSheetDialog"));
  const page = code("src/app/dashboard/stores/[id]/catalogue/page.tsx");
  assert.ok(page.includes('if (new URLSearchParams(window.location.search).get("mode") === "update") setMode("update");'));
  assert.ok(page.includes('{mode === "update" ? "Update prices & stock" : "Add a whole catalogue"}'));
});

test("the check asks for loss WARNINGS, and every part says whether the loss was confirmed", () => {
  const api = code("src/lib/api-stores.ts");
  assert.ok(api.includes('JSON.stringify({ ...body, include_products: true, loss_rows: "warn" })'));
  assert.ok(api.includes("JSON.stringify({ mode, products, confirm_loss: confirmLoss })"));
  const check = code("src/app/dashboard/stores/[id]/catalogue/parts-check.tsx");
  assert.ok(check.includes("I know {losses === 1 ? \"this product\" : `these ${losses.toLocaleString()} products`} will sell at a loss"));
  assert.ok(check.includes("Leave out the ${losses.toLocaleString()}"));
  assert.ok(check.includes("onSave({ confirmLoss: ticked && !leftOut, leaveOutLosses: leftOut })"));
  // The old-price strike-through, Takal earns and stock now -> new, per row and per option.
  for (const s of ["<NowNew now={one.buy_now} next={one.buy_new} />", "<NowNew now={one.sell_now} next={one.sell_new} />",
    "<Earns l={one} />", "<NowNew now={one.stock_now} next={one.stock_new} plain />", "<Earns l={x} />"]) {
    assert.ok(check.includes(s), s);
  }
  const save = code("src/app/dashboard/stores/[id]/catalogue/parts-save.tsx");
  assert.ok(save.includes("const products = useMemo(() => productsToSave(r, leaveOutLosses), [r, leaveOutLosses]);"));
});
