/**
 * Item 11 (Sana, 2 October 2026): the Earnings page never shows money with a
 * decimal. "Takal keeps Rs 12.3" of every Rs 100 is now "about Rs 12"; the
 * take-rate percentage itself keeps one decimal (12.3%) - it is not money.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "dashboard", "earnings", "page.tsx"),
  "utf8",
);

test("the Rs-per-100 sentence is whole rupees", () => {
  const i = PAGE.indexOf("Of every Rs 100 a customer spends");
  assert.ok(i > 0);
  const sentence = PAGE.slice(i, i + 160);
  assert.ok(sentence.includes("Takal keeps about Rs"));
  assert.ok(sentence.includes("{Math.round(p.take_rate ?? 0)}"));
  assert.ok(!sentence.includes("toFixed(1)"), "Rs is still shown with a decimal");
});

test("the percentage itself keeps its one decimal", () => {
  assert.ok(PAGE.includes('{(p.take_rate ?? 0).toFixed(1)}%'));
});
