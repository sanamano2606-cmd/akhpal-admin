// STORES PAGE FIX 3 (Sana, 12 October 2026: "OK fix 3").
//
// docs/Audit/AUDIT-REPORT-STORES-PAGE-2026-10-12.md S2 S3 S9 + O4, Mock 182
// picture 4. The store's own page used to read only is_approved: a SUSPENDED
// shop said "Approved", a REJECTED one "Waiting for approval". Approve, Reject
// and Suspend were only on the list. The owner was at the bottom of Settings,
// and a shop on the global rate showed "Commission 0%".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storeStatusOf } from "../src/lib/store-status.ts";

const ROOT = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(ROOT, p), "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const page = code("src/app/dashboard/stores/[id]/page.tsx");
const bar = code("src/app/dashboard/stores/[id]/parts-status-bar.tsx");

test("the status tells the truth", () => {
  assert.equal(storeStatusOf({ is_approved: true, suspended_at: "2026-10-11" }), "suspended",
    "a suspended shop is not 'Approved'");
  assert.equal(storeStatusOf({ is_approved: false, rejected_at: "2026-10-12" }), "rejected",
    "a rejected shop is not 'Waiting for approval'");
  assert.equal(storeStatusOf({ is_approved: false }), "pending");
  assert.equal(storeStatusOf({ is_approved: true }), "approved");
  assert.equal(storeStatusOf({ is_approved: true }, "suspended"), "suspended", "the server's word wins");
  assert.doesNotMatch(page, /r\.is_approved \? "Approved" : "Waiting for approval"/);
  assert.match(page, /<StoreStatusChip r=\{r\} status=\{status\} \/>/);
});

test("the same buttons as the list, on the store's page, each asking first", () => {
  assert.match(page, /<StoreStatusActions r=\{r\} status=\{status\}/);
  for (const call of ["approveRestaurant", "rejectRestaurant", "suspendRestaurant",
                      "unsuspendRestaurant", "removeRestaurantForGood"]) {
    assert.match(bar, new RegExp(`apiClient\\.${call}\\(`), call);
  }
  assert.match(bar, /<RejectReasonDialog/);
  assert.match(bar, /title="Suspend this store\?"/);
  assert.match(bar, /status === "rejected" && isMain && \(/, "Remove for good: Main Admin only");
  assert.match(bar, /approveState\(\{ product_count: productCount \}, isMain\)/,
    "the 5-product rule is the list's rule");
  assert.match(bar, /Still missing: \$\{left\.join/, "and the waiting checklist (fix 2)");
});

test("the owner is at the top, his phone can be tapped", () => {
  assert.match(page, /Owner <b className="text-takal-ink">\{owner\.full_name \|\| "—"\}<\/b>/);
  assert.match(page, /href=\{`tel:\$\{owner\.phone\}`\}/);
  assert.match(page, /his login is switched off/);
});

test("no '0%' for a shop on the global rate", () => {
  assert.doesNotMatch(page, /commission_percent \?\? 0\}%/);
  assert.match(page, /`Global rate \(\$\{state\.commission_in_use_percent\}%\)`/);
});

test("closed by its hours, and hidden without a map pin, are said at the top", () => {
  // Shorter since Mock 190 (14 Oct 2026); the long words are its hover text.
  assert.match(page, /state\.open_now === false \? "On · closed by hours"/);
  assert.match(page, /"Switched on - but closed by its opening hours right now"/);
  assert.match(page, /state\.hidden_no_location && \(/);
});
