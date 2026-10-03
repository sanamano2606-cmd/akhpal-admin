/**
 * Item 10 (Sana, 2 October 2026): the Dashboard's daily money chart is asked
 * for with the NEW permission key.
 *
 * It asked canAccess("analytics"). "analytics" is an old word that the
 * permission reader turns into "earnings" + "reports.sales", so it matched no
 * sub-admin, old-style or new, and the chart never loaded for any of them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mayOpen, NEW_FORMAT_MARK } from "../src/lib/tabs.ts";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "page.tsx"),
  "utf8",
);

test("the old word opened the chart for nobody - the reason for the fix", () => {
  assert.equal(mayOpen("analytics", ["analytics"]), false);
  assert.equal(mayOpen("analytics", [NEW_FORMAT_MARK, "reports.sales"]), false);
});

test("Reports -> Sales opens it, for an old-style and a new-style account", () => {
  assert.equal(mayOpen("reports.sales", ["analytics"]), true);
  assert.equal(mayOpen("reports.sales", [NEW_FORMAT_MARK, "reports.sales"]), true);
  assert.equal(mayOpen("reports.sales", [NEW_FORMAT_MARK, "earnings"]), false);
});

test("the page asks with the new key and draws the chart only when it may load it", () => {
  assert.ok(!PAGE.includes('canAccess("analytics")'), "still asks with the old word");
  assert.ok(PAGE.includes('canAccess("reports.sales")\n          ? apiClient.getRevenueAnalytics'));
  assert.ok(PAGE.includes('const showChart = showMoney && canAccess("reports.sales");'));
  assert.ok(PAGE.includes("{showChart && ("));
});
