// STORES PAGE FIX 2 (Sana, 12 October 2026: "OK fix 2").
//
// docs/Audit/AUDIT-REPORT-STORES-PAGE-2026-10-12.md S6, Mock 182 picture 3.
// Every waiting shop shows its seven checks right under it - not only the
// shops the viewer created (Onboarding) - and Approve unlocks only when they
// are all ticked; the main admin can still "Approve anyway". The server
// (backend/tests/test_stores_page_fix_2.py) decides the same way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const page = code("src/app/dashboard/stores/page.tsx");
const api = code("src/lib/api-stores.ts");

test("the checklists of EVERY waiting shop come from their own door", () => {
  assert.match(api, /getWaitingChecklists\(\) \{\s*return this\.request\(`\/admin\/vendor-intake\/waiting`\)/);
  assert.match(page, /await apiClient\.getWaitingChecklists\(\)/);
});

test("a failed checklist read never hides the list", () => {
  assert.match(page, /\} catch \{\s*setChecklists\(\{\}\);\s*\}/);
});

test("the checklist row sits under each waiting shop, ticks and crosses", () => {
  assert.match(page, /deriveStatus\(restaurant\) === "pending" && checklists\[String\(restaurant\.id\)\] && \(\(\) => \{/);
  assert.match(page, /\{c\.done\} of \{c\.total\} done/);
  assert.match(page, /\{s\.done \? "✓" : "✕"\} \{s\.label\}/);
  assert.match(page, /colSpan=\{cols\}/);
});

test("Approve is always open now; the checklist still says what is missing", () => {
  // Sana, 29 Oct 2026: approve first, show to customers only when complete.
  assert.match(page, /const a = withChecklist\(approveState\(restaurant, isMain\),\s*checklists\[String\(restaurant\.id\)\], isMain\);/);
  assert.match(page, /return \{ \.\.\.a, why: `Still missing: \$\{left\.join\(", "\)\}` \};/);
  assert.match(page, /<b>Still missing:<\/b>/, "the anyway box says what is missing");
});
