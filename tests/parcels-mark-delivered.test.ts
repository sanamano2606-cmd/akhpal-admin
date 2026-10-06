/**
 * "MARK DELIVERED" ON THE PARCELS PAGE ONLY FOR WHO MAY REALLY DO IT
 * (admin actions audit M11, Sana chose "B", 5 October 2026).
 *
 * A Parcels-only clerk saw the button and the server refused it every time.
 * Now the button shows only for All Orders admins and delivery staff - the
 * same people routers/orders_status.py lets through - and the clerk sees who
 * does it instead of a dead button.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const page = readFileSync(join(root, "src/app/dashboard/orders/parcels/page.tsx"), "utf8");
const server = readFileSync(
  join(root, "..", "swat-delivery-app", "backend", "routers", "orders_status.py"), "utf8");

test("the page asks the same two permissions the server does", () => {
  assert.match(page,
    /const mayDeliver = canAccess\("orders\.all"\) \|\| canAccess\("my-deliveries"\);/);
  assert.match(server, /may_open\("my-deliveries", _my_perms\)/);
  assert.match(server, /not may_open\("orders\.all", _my_perms\)/);
});

test("the button sits only on the mayDeliver branch", () => {
  const i = page.indexOf('btn("Mark delivered"');
  assert.ok(i > 0, "the Mark delivered button is gone altogether");
  const before = page.slice(Math.max(0, i - 120), i);
  assert.match(before, /\(p\) => mayDeliver\s*\?\s*$/);
  assert.equal(page.split('btn("Mark delivered"').length - 1, 1,
    "a second, ungated Mark delivered button");
});

test("the clerk is told who marks it delivered instead", () => {
  const i = page.indexOf('btn("Mark delivered"');
  const after = page.slice(i, i + 400);
  assert.match(after, /:\s*<p[^>]*>Delivery staff mark this delivered\.<\/p>/);
});
