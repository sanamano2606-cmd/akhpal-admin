// Change 7 (Sana, 8 Nov 2026): honest words, and Suspend asks WHY.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");

const DIALOG = code("src/components/RejectReasonDialog.tsx");
const LIST = code("src/app/dashboard/stores/page.tsx");
const BAR = code("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const API = code("src/lib/api-stores.ts");

test("the reason window can say Yes, suspend - and still says Yes, reject by default", () => {
  assert.match(DIALOG, /confirmLabel = "Yes, reject",/);
  assert.match(DIALOG, /\{confirmLabel\}/);
  assert.match(DIALOG, /export const SUSPEND_REASONS = \[/);
});

test("Suspend on the list and on the store's page asks for the reason and sends it", () => {
  for (const [name, src] of [["list", LIST], ["store page", BAR]] as const) {
    const at = src.indexOf('open={pending?.action === "suspend"}') >= 0
      ? src.indexOf('open={pending?.action === "suspend"}') : src.indexOf('open={ask === "suspend"}');
    assert.ok(at > 0, name);
    const before = src.lastIndexOf("<", at);
    assert.equal(src.slice(before, before + 19), "<RejectReasonDialog", `${name}: suspend asks why`);
    assert.match(src.slice(at, at + 700), /suggestions=\{SUSPEND_REASONS\}/, name);
    assert.match(src.slice(at, at + 700), /confirmLabel="Yes, suspend"/, name);
  }
  assert.match(LIST, /await apiClient\.suspendRestaurant\(store\.id, reason \|\| ""\);/);
  assert.match(BAR, /apiClient\.suspendRestaurant\(String\(r\.id\), reason\)/);
  assert.match(API, /async suspendRestaurant\(restaurantId: string, reason\?: string\)/);
  assert.match(API, /body: JSON\.stringify\(\{ reason: reason \|\| null \}\)/);
});

test("the store's page shows why it was suspended", () => {
  assert.match(BAR, /\{suspendedReason \? ` — \$\{suspendedReason\}` : ""\}/);
  assert.match(BAR, /No reason was written down when it was suspended/);
});

test("the list nobody waits on is called what it is", () => {
  assert.match(LIST, /\{ key: "pending", label: "Just signed up", hint: "the Assistant approves them within an hour"/);
  assert.doesNotMatch(LIST, /label: "Waiting for approval"/);
});

test("the server says the same honest words", () => {
  const show = code("../swat-delivery-app/backend/show_lock.py");
  const ra = code("../swat-delivery-app/backend/routers/restaurants_admin.py");
  assert.match(show, /ka Takal account ban gaya\. Ab dukan tayyar karein: /);
  assert.doesNotMatch(show, /approve kar di hai/);
  assert.match(ra, /"Aap ka Takal account ban gaya",/);
  assert.match(ra, /tell_the_shop_owner\(restaurant_id, "Aap ki dukan rok di gayi hai",/);
});
