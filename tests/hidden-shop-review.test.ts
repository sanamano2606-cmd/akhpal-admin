// A HIDDEN SHOP CAN BE REVIEWED (Sana, 1 Nov 2026: "why I cant show the store
// and if there are things needed a fix then How can I recheck them? there is
// no review button" -> "Go ahead for all").
//
// Khan Readymade Collection was approved but hidden, with 2 lines marked Needs
// fix. Show to customers was refused (rightly) - and nothing on the list or on
// its page led to the Review page, where those lines are rechecked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = read("src/app/dashboard/stores/page.tsx");
const BAR = read("src/app/dashboard/stores/[id]/parts-status-bar.tsx");
const SWITCH = read("src/app/dashboard/stores/parts-customers-see.tsx");
const SERVER = read("../swat-delivery-app/backend/routers/restaurants_admin.py");

test("a hidden shop's row has Review - for the approver, saying how many are marked Needs fix", () => {
  assert.match(LIST, /\{deriveStatus\(restaurant\) === "hidden" && canAccess\("stores\.approve"\) && \(\s*<Link href=\{`\/dashboard\/stores\/\$\{restaurant\.id\}\/review`\} data-hidden-review/);
  assert.match(LIST, /Number\(restaurant\.review_to_fix\) > 0 \? `Review · \$\{restaurant\.review_to_fix\} to fix` : "Review"/);
});

test("the list's rows carry the review marks of hidden shops (server)", () => {
  assert.match(SERVER, /REVIEW_MARKS_ON_THE_LIST = REVIEW_ON_THE_LIST \+ \("hidden",\)/);
});

test("a hidden shop's own page has Review", () => {
  assert.match(BAR, /\{status === "hidden" && \(\s*<Link href=\{`\/dashboard\/stores\/\$\{r\.id\}\/review`\} data-hidden-review-link/);
});

test("Show refused for 'Needs fix' offers Open Review instead of only a red message", () => {
  assert.match(SWITCH, /if \(ask === "on" && \/Needs fix\/i\.test\(said\)\) setToReview\(said\);\s*else toast\(said, "error"\);/);
  assert.match(SWITCH, /router\.push\(`\/dashboard\/stores\/\$\{shop\.id\}\/review`\)/);
  assert.match(SWITCH, /confirmLabel="Open Review"/);
});

test("any other refusal is still said in the server's own words", () => {
  assert.match(SWITCH, /else toast\(said, "error"\)/);
});
