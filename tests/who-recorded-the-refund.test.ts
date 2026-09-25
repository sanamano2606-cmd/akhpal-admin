// WHO RECORDED THIS REFUND. Money audit M15, mock 125.
//
// Imported by its real relative path with the .ts extension, which is the
// house rule written at the top of tests/tsconfig.json: the panel's test
// runner is plain Node and understands neither "@/" nor .tsx.
import { test } from "node:test";
import assert from "node:assert/strict";

import { whoRecordedTheRefund } from "../src/lib/who-refunded.ts";

const AT = "2026-09-25T05:30:00+00:00";

test("an order that was never refunded shows nothing", () => {
  assert.equal(whoRecordedTheRefund({ refunded: false }).kind, "none");
  assert.equal(whoRecordedTheRefund({}).kind, "none");
  assert.equal(whoRecordedTheRefund(null).kind, "none");
});

test("a refund with a name says who and when", () => {
  const r = whoRecordedTheRefund({
    refunded: true, refunded_by_id: "admin-7",
    refunded_by_name: "Zubair Khan", refunded_at: AT,
  });
  assert.equal(r.kind, "named");
  if (r.kind !== "named") return;
  assert.equal(r.name, "Zubair Khan");
  assert.equal(r.at, AT);
});

test("a refund from before migration 108 says so, and never shows a blank", () => {
  // THE ONE THAT MATTERS. An empty space here would read as "nobody did it".
  const r = whoRecordedTheRefund({ refunded: true, refunded_at: AT });
  assert.equal(r.kind, "before-we-kept-it");
});

test("an id with no name is still a person, not a blank", () => {
  const r = whoRecordedTheRefund({ refunded: true, refunded_by_id: "admin-7" });
  assert.equal(r.kind, "named");
  if (r.kind !== "named") return;
  assert.equal(r.name, "admin-7");
});

test("the name wins over the id when both are there", () => {
  const r = whoRecordedTheRefund({
    refunded: true, refunded_by_id: "admin-7", refunded_by_name: "Sana",
  });
  assert.equal(r.kind === "named" && r.name, "Sana");
});

test("blank spaces are not a name", () => {
  const r = whoRecordedTheRefund({
    refunded: true, refunded_by_id: "  ", refunded_by_name: "   ",
  });
  assert.equal(r.kind, "before-we-kept-it");
});

test("a refund with a name but no date still names the person", () => {
  const r = whoRecordedTheRefund({ refunded: true, refunded_by_name: "Zubair Khan" });
  assert.equal(r.kind, "named");
  if (r.kind !== "named") return;
  assert.equal(r.at, null);
});

test("refunded must be exactly true - a truthy string is not a refund", () => {
  // The desk sends select=*, so a column that arrives as "false" or "0" from
  // anywhere must never be read as a refund having happened.
  assert.equal(whoRecordedTheRefund({ refunded: "false" as never }).kind, "none");
  assert.equal(whoRecordedTheRefund({ refunded: 1 as never }).kind, "none");
});

// ── THE SCREEN REALLY PAINTS IT ───────────────────────────────────────────
//
// The runner cannot load a .tsx, so the screen is read as TEXT - with the
// comments stripped first. A rule that finds its own comment guards nothing
// (CLAUDE.md section 3), and the comment beside this very code names both the
// file and the function, so an unstripped search would pass on nothing at all.
import { readFileSync } from "node:fs";

const PANEL = readFileSync(
  new URL("../src/app/dashboard/orders/parts-order-panel.tsx", import.meta.url),
  "utf8",
);

/** The panel with every comment removed - JSX, block and line. */
const code = PANEL
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")   // {/* jsx comment */}
  .replace(/\/\*[\s\S]*?\*\//g, "")             // /* block */
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

test("the comments really were stripped, or the checks below prove nothing", () => {
  assert.ok(
    PANEL.includes("Mock 125"),
    "the note naming mock 125 has gone from the panel - update this test",
  );
  assert.ok(
    !code.includes("Mock 125"),
    "the comment stripper missed the note, so the checks below can pass on a comment",
  );
});

test("the panel asks the rule, it does not write its own", () => {
  assert.ok(
    code.includes('from "@/lib/who-refunded"'),
    "the panel no longer imports the rule",
  );
  assert.ok(
    code.includes("whoRecordedTheRefund(o)"),
    "the panel imports the rule and never asks it",
  );
});

test("all three answers are painted", () => {
  assert.ok(code.includes("Recorded by"), "no line for a refund that has a name");
  assert.ok(
    code.includes("Recorded before Takal kept this"),
    "an old refund would show a blank, which reads as 'nobody did it'",
  );
  assert.ok(
    code.includes('by.kind === "none"') && code.includes("return null"),
    "an order that was never refunded would still draw the line",
  );
});

test("the new line sits INSIDE the refund box, under the amount", () => {
  // MOCK 125 SHOWS ONE BOX, NOT TWO.
  //
  // This first checked only that "Recorded by" came somewhere before the end
  // of the branch - and a break that lifted the whole block OUT of the yellow
  // box still passed it. Rewritten to read the box itself: the box opens and
  // closes at the same indentation (18 spaces), and everything belonging to it
  // must be between those two.
  // Anchored on the AMOUNT, not on the yellow class: the customer's note is
  // painted in the same soft yellow higher up the screen, and anchoring on the
  // colour found that box instead. This test failed on correct code the first
  // time it was written, which is how that was discovered.
  const amount = code.indexOf("Refunded {money(o.refund_amount)}");
  assert.ok(amount > -1, "the refunded amount has gone from the screen");
  const open = code.lastIndexOf("bg-takal-yellow-soft", amount);
  assert.ok(open > -1, "the refund box is no longer the soft-yellow box");
  const close = code.indexOf("\n                  </div>", amount);
  assert.ok(close > -1, "the refund box never closes - the shape has changed");

  const box = code.slice(open, close);
  assert.ok(
    box.includes("whoRecordedTheRefund(o)"),
    "who recorded the refund is drawn OUTSIDE the yellow box - mock 125 shows "
      + "one box, not a second note underneath it",
  );
  assert.ok(
    box.includes("Recorded by"),
    "the 'Recorded by' line is outside the refund box",
  );
  assert.ok(
    box.indexOf("Refunded {money(o.refund_amount)}") < box.indexOf("Recorded by"),
    "who recorded it is printed ABOVE the amount",
  );
});
