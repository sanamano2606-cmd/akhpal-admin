/**
 * A RIDER'S CHARGE THAT DID NOT SAVE CAN BE SAVED LATER (admin actions audit
 * H3, Sana 5 October 2026).
 *
 * The panel shows "Save it now" ONLY when the server says the charge is
 * missing, calls the one repair door, and never offers "The rider" on an
 * order no rider carried.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const box = readFileSync(join(root, "src/components/ComplaintMoneyBox.tsx"), "utf8");
const api = readFileSync(join(root, "src/lib/api-orders.ts"), "utf8");
const server = readFileSync(
  join(root, "..", "swat-delivery-app", "backend", "routers", "complaints.py"), "utf8");

test("the button shows only on a plain true from the server", () => {
  assert.match(box, /setRiderChargeMissing\(data\?\.rider_charge_missing === true\)/);
  assert.match(box, /\{riderChargeMissing && \(/);
  assert.match(box, /Save it now/);
});

test("it calls the one repair door the server has", () => {
  assert.match(api, /\/admin\/complaints\/\$\{complaintId\}\/finish-rider-charge/);
  assert.match(server, /@router\.post\("\/admin\/complaints\/\{complaint_id\}\/finish-rider-charge"/);
  const call = api.slice(api.indexOf("async finishRiderCharge"));
  assert.ok(!call.slice(0, 400).includes("requestOnce"),
    "a retry must reach the server, not be answered 'still finishing'");
});

test("'The rider' is not offered on an order with no rider", () => {
  assert.match(box, /p !== "rider" \|\| !!\(order as \{ rider_id\?: unknown \}\)\.rider_id/);
});
