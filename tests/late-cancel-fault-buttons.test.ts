/**
 * Sana, 2 October 2026 ("go4.5"): on a late-cancelled order the office sees
 * what the shop and rider are owed and can mark either at fault; Settlements
 * names the late cancels inside each figure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", ...p), "utf8");
const BOX = read("src", "app", "dashboard", "orders", "parts-late-cancel.tsx");
const PANEL = read("src", "app", "dashboard", "orders", "parts-order-panel.tsx");
const API = read("src", "lib", "api-orders.ts");
const SETTLE = read("src", "app", "dashboard", "payments", "settlements", "page.tsx");
const GUARD = readFileSync(join(import.meta.dirname, "..", "..", "swat-delivery-app", "backend", "app_guard.py"), "utf8");

test("the box shows both amounts and the three buttons", () => {
  assert.ok(BOX.includes("Late cancel — shop owed {money(shop)} · rider owed {money(rider)}"));
  for (const label of ["Shop at fault", "Rider at fault", "Undo"]) assert.ok(BOX.includes(label), label);
});

test("only Settlements may press them, and a reason is required", () => {
  assert.ok(BOX.includes('canAccess("payments.settlements")'));
  assert.ok(BOX.includes("Please write a reason first."));
});

test("the order panel shows the box and re-reads the order after a press", () => {
  assert.ok(PANEL.includes("<LateCancelBox"));
  const block = PANEL.slice(PANEL.indexOf("<LateCancelBox"), PANEL.indexOf('<Section title="The three people">'));
  assert.ok(block.includes("apiClient.getOrderFull(orderId)"));
});

test("the panel calls the same address the server guards", () => {
  assert.ok(API.includes("/admin/settlements/late-cancels/${orderId}/fault"));
  assert.ok(GUARD.includes('("/admin/settlements/late-cancels", "payments.settlements")'));
});

test("Settlements names the late cancels for shops and riders", () => {
  assert.ok(SETTLE.includes("<LateCancelNote n={s.late_cancels} owed={s.late_cancel_owed} />"));
  assert.ok(SETTLE.includes("<LateCancelNote n={r.late_cancels} owed={r.late_cancel_owed} />"));
  assert.ok(SETTLE.includes("incl. {n} late cancel"));
});
