/**
 * MOCK 200 - COMPACT CUSTOMERS, OPTION B (Sana 15 Oct 2026: "Re arrange and
 * add if something need to be added. make it compacted" -> "B").
 *
 * Measured in a browser on 16 customers spread like the real 16, at 1536 x 864:
 * the first customer moved from 346 px to 146 px down, a row from 61 to 41 px,
 * and all 16 fit the first screen (was 8). Nothing sideways at 1024 / 1280.
 *
 * The rules (lib/customers-list.ts) are run here; the page is checked for
 * what it shows and that nothing was taken away.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  customerCounts, isMadeUpEmail, isNew, matchesFilter, phoneLooksRight,
} from "../src/lib/customers-list.ts";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const PAGE = read("app/dashboard/customers/page.tsx");
const LAYOUT = read("app/dashboard/customers/layout.tsx");
const flat = PAGE.replace(/&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
const NOW = Date.parse("2026-10-15T12:00:00Z");
const day = 86400e3;

test("a made-up address for a phone sign-up is recognised - a real one is not", () => {
  assert.equal(isMadeUpEmail("03142714800_customer@noemail.akhpal.pk"), true);
  assert.equal(isMadeUpEmail(" 0300_customer@NOEMAIL.akhpal.pk "), true);
  assert.equal(isMadeUpEmail("someone@gmail.com"), false);
  assert.equal(isMadeUpEmail("noemail.akhpal.pk@gmail.com"), false);
  assert.equal(isMadeUpEmail(null), false);
});

test("a Pakistani mobile passes; the four shapes seen live are flagged", () => {
  for (const ok of ["03142714800", "0345 7778899", "+923001234567", "923004445566", "0300-123-4567", "", null])
    assert.equal(phoneLooksRight(ok), true, String(ok));
  for (const bad of ["3406499074", "++923445512703", "0300-555-12", "1234", "04212345678"])
    assert.equal(phoneLooksRight(bad), false, String(bad));
});

test("the chips count EVERYBODY; 'never ordered' only once the server sends orders", () => {
  const rows = [
    { created_at: new Date(NOW - 2 * day).toISOString(), is_active: true, orders_count: 0 },
    { created_at: new Date(NOW - 9 * day).toISOString(), is_active: true, orders_count: 3 },
    { created_at: new Date(NOW - 30 * day).toISOString(), is_active: false, orders_count: 0 },
  ];
  assert.deepEqual(customerCounts(rows, NOW), { all: 3, active: 2, blocked: 1, new: 1, never: 2 });
  const noOrders = rows.map(({ orders_count, ...r }) => r);
  assert.equal(customerCounts(noOrders, NOW).never, null, "unknown is not zero");
  assert.equal(matchesFilter(rows[0], "never", NOW), true);
  assert.equal(matchesFilter(rows[1], "never", NOW), false);
  assert.equal(matchesFilter(rows[2], "blocked", NOW), true);
  assert.equal(matchesFilter(rows[0], "new", NOW), true);
  assert.equal(isNew(new Date(NOW - 8 * day).toISOString(), NOW), false);
  assert.equal(isNew("not a date", NOW), false);
});

test("one line at the top; rows half as roomy; the columns of option B", () => {
  assert.match(LAYOUT, /<div className="flex flex-wrap items-baseline gap-x-3">\s*<h1 className="text-2xl font-bold text-takal-ink">Customers<\/h1>/);
  assert.doesNotMatch(PAGE, />All Customers</, "the second heading became the first chip");
  assert.doesNotMatch(PAGE, /px-6 py-4/);
  assert.match(PAGE, /\{knowsOrders && <th[^>]*>Orders<\/th>\}/);
  assert.match(PAGE, /\{knowsOrders && <th[^>]*>Last order<\/th>\}/);
  assert.match(PAGE, /<th[^>]*>Joined<\/th>/);
  assert.match(PAGE, /label: "never ordered", n: counts\.never/);
  assert.match(PAGE, /setOrdersUnknown\(res\?\.orders_unknown === true\)/);
  assert.match(PAGE, /href=\{`\/dashboard\/customers\/\$\{c\.id\}`\}\s+className="inline-flex items-center gap-0\.5 rounded-md bg-takal-yellow/, "a visible View");
});

test("nothing removed: every word, button and the Export still there", () => {
  for (const w of ["Search by name, email or phone...", "Export CSV", "Refresh", "Block", "Unblock", "Delete",
    "Name", "Phone", "Email", "Status", "Actions", "No customers found", "The customer list could not be read",
    "Delete this customer?", "Block this customer?", "Unblock this customer?", "Yes, delete", "Yes, block", "Yes, unblock",
    "it will refuse if they already have orders on the system.", "Their past orders stay exactly as they are.",
    "will be able to sign in and order again."]) assert.ok(flat.includes(w), w);
  assert.match(LAYOUT, /Accounts and order history\./);
  // The export keeps the stored email, and adds the two new figures.
  assert.match(PAGE, /\{ key: "email", label: "Email" \}/);
  assert.match(PAGE, /\{ key: "orders_count", label: "Orders" \}, \{ key: "last_order_at", label: "Last order" \}/);
  const calls = (PAGE.match(/apiClient\.\w+/g) ?? []).sort();
  assert.deepEqual(calls, ["apiClient.deleteCustomer", "apiClient.getCustomers", "apiClient.updateCustomer"]);
});
