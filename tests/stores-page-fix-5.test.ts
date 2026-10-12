// STORES PAGE FIX 5 (Sana, 12 October 2026: "OK fix 5") - a mall's stores sit
// under one yellow mall row, indented, under their short names. The ▾ arrow
// folds them away; search still finds them (by store or by mall name); the
// Live / Waiting / Suspended / Rejected boxes still decide which ones show.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groupByMall, shortStoreName } from "../src/lib/store-groups.ts";

const ROOT = join(import.meta.dirname, "..");
const page = readFileSync(join(ROOT, "src/app/dashboard/stores/page.tsx"), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

const status = (r: any) => r.suspended_at ? "suspended" : r.is_approved ? "approved" : r.rejected_at ? "rejected" : "pending";
const W = "Wakeel Shopping Mall";
const mallStore = (id: string, part: string, extra: any = {}) =>
  ({ id, name: `${W} — ${part}`, mall_id: "m1", mall_name: W, owner_name: "Wakeel", is_approved: true, ...extra });
const ALL = [
  { id: "a", name: "Habib Cafe", is_approved: true },
  mallStore("b", "Fashion"),
  { id: "c", name: "Shah G", is_approved: true },
  mallStore("d", "Baby, Kids & Toys", { suspended_at: "2026-10-01" }),
  mallStore("e", "Flowers & Gifts"),
];

test("the short name drops the mall's name, any other name stays whole", () => {
  assert.equal(shortStoreName(`${W} — Baby, Kids & Toys`, W), "Baby, Kids & Toys");
  assert.equal(shortStoreName(`${W} - Fashion`, W), "Fashion");
  assert.equal(shortStoreName("Habib Cafe", W), "Habib Cafe");
  assert.equal(shortStoreName("Wakeel Shopping Malls", W), "Wakeel Shopping Malls");
  assert.equal(shortStoreName("Fashion", null), "Fashion");
});

test("the mall row stands where its first store was, its stores under it", () => {
  const live = ALL.filter((r) => status(r) === "approved");
  const rows = groupByMall(live, ALL, status);
  assert.deepEqual(rows.map((x) => x.kind === "mall" ? `MALL:${x.mallId}` : `${x.r.id}${x.inMall ? "*" : ""}`),
    ["a", "MALL:m1", "b*", "e*", "c"]);
  const mall = rows[1] as any;
  assert.equal(mall.mallName, W);
  assert.equal(mall.total, 3);
  assert.equal(mall.live, 2);
  assert.equal(mall.suspended, 1);
  assert.equal(mall.shown, 2);
  assert.equal(mall.owner, "Wakeel");
});

test("no mall row when none of its stores is in the list", () => {
  const rows = groupByMall([ALL[0], ALL[2]], ALL, status);
  assert.equal(rows.filter((x) => x.kind === "mall").length, 0);
});

test("a folded mall keeps its row and hides its stores", () => {
  const rows = groupByMall(ALL, ALL, status, new Set(["m1"]));
  assert.deepEqual(rows.map((x) => x.kind === "mall" ? "MALL" : x.r.id), ["a", "MALL", "c"]);
});

test("the page uses the groups, the arrow, the short name and Open mall", () => {
  assert.match(page, /groupByMall\(sortedRestaurants, restaurants, deriveStatus/);
  assert.match(page, /listRows\.map\(\(row\) => row\.kind === "mall"/);
  assert.match(page, /onClick=\{\(\) => toggleMall\(row\.mallId\)\}/);
  assert.match(page, /shortStoreName\(restaurant\.name, restaurant\.mall_name\)/);
  assert.match(page, /href=\{`\/dashboard\/stores\/malls\/\$\{row\.mallId\}`\}/);
  assert.match(page, />MALL<\/span>/);
});

test("search finds a store by its mall's name, and nothing is folded while searching", () => {
  assert.match(page, /`\$\{r\.name \|\| ""\} \$\{r\.mall_name \|\| ""\}`\.toLowerCase\(\)\.includes/);
  assert.match(page, /search\.trim\(\) \? new Set<string>\(\) : closedMalls/);
});
