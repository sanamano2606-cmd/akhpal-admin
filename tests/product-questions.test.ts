/**
 * QUESTIONS ABOUT A PRODUCT REACH THIS PANEL (Mock 93, 17 September 2026).
 *
 * Sana: "make sure the Ask about Questions should reach to Vendor as well as
 * Admin Panel, so the customer get answer accordingly."
 *
 * The server sends every question to the shop AND to the admins who hold the
 * reviews permission (backend/tests/test_the_product_page_extras.py). This file
 * keeps the panel's half: the page is there, it is where the alert points, and
 * it calls the doors the server really has.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { serverSectionFor, tabsFor } from "../src/lib/navigation.ts";

const page = readFileSync("src/app/dashboard/reviews/questions/page.tsx", "utf8");
const api = readFileSync("src/lib/api-people.ts", "utf8");
const server = readFileSync(
  "../swat-delivery-app/backend/routers/product_questions.py", "utf8");

test("Reviews has a Questions tab, on the reviews permission", () => {
  const tab = tabsFor("/dashboard/reviews").find((t) => t.label === "Questions");
  assert.ok(tab, "no Questions tab under Reviews");
  assert.equal(tab!.href, "/dashboard/reviews/questions");
  assert.equal(tab!.section, "reviews");
  assert.deepEqual(tab!.calls, ["/admin/product-questions"]);
  assert.equal(serverSectionFor("/admin/product-questions"), "reviews");
});

test("the page is where the server's alert points", () => {
  assert.ok(server.includes('/dashboard/reviews/questions"'),
    "the phone alert would open a page that does not exist");
});

test("the page can answer, hide and put back", () => {
  assert.ok(page.includes("apiClient.getProductQuestions"));
  assert.ok(page.includes("apiClient.answerProductQuestion"));
  assert.ok(page.includes("apiClient.setProductQuestionHidden"));
});

test("it calls addresses the server really has", () => {
  for (const door of [
    "/admin/product-questions?status=",
    "/admin/product-questions/${questionId}/answer",
    '/admin/product-questions/${questionId}/${hidden ? "hide" : "show"}',
  ]) {
    assert.ok(api.includes(door), `the panel does not call ${door}`);
  }
  for (const door of [
    '"/admin/product-questions"',
    '"/admin/product-questions/{question_id}/answer"',
    '"/admin/product-questions/{question_id}/hide"',
    '"/admin/product-questions/{question_id}/show"',
  ]) {
    assert.ok(server.includes(door), `the server has no ${door}`);
  }
});

test("waiting questions come first and are counted", () => {
  assert.ok(page.includes('useState<string>("waiting")'));
  assert.ok(page.includes("res?.waiting"));
});

test("the customer's name is never shown here", () => {
  assert.ok(!page.includes("customer_name"));
  assert.ok(!page.includes("customer_id"));
});
