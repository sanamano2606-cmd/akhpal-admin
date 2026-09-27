// WHAT THE UPLOAD SCREEN SAYS AFTER THE SERVER ANSWERS.
// (Mock 126, approved by Sana 27 September 2026. Red for a refusal, blue for
// "already in your shop" — her choice.)
//
// WHAT CHANGED ON THE SERVER
// It now checks the WHOLE file before writing anything, so one bad row means
// the shop is untouched. And it treats "this name is already in your shop" as
// NOT a fault, because a vendor re-uploading his whole sheet after fixing one
// row is doing the obvious thing.
//
// The screen was written for the old behaviour and said the wrong things:
// "0 products added" (which does not say the shop is untouched) and "4,999
// rows skipped" in red for rows that were simply already there.
//
// Every rule below stops one of those coming back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readImportAnswer } from "../src/lib/sheet-reader.ts";

// ── one bad row means nothing was added ─────────────────────────────────────

test("a refused file is reported as refused, not as an empty success", () => {
  const seen = readImportAnswer({
    created: 0, created_ids: [], nothing_was_added: true, rows_read: 5000,
    failed: [{ row: 3, error: "missing price" }],
    message: "Nothing was added. Your shop is unchanged. 1 of 5,000 rows need fixing.",
  });
  assert.equal(seen.kind, "refused");
  if (seen.kind !== "refused") return;
  assert.equal(seen.rowsRead, 5000);
  assert.equal(seen.rows.length, 1);
  assert.match(seen.message, /unchanged/i);
});

test("the sentence the vendor needs is the server's own, not a new one", () => {
  // Two places wording the same rule is how they drift apart. If the server
  // ever changes the numbers in that sentence, the screen must not still be
  // showing yesterday's wording.
  const seen = readImportAnswer({
    created: 0, nothing_was_added: true, message: "A brand new sentence.",
  });
  if (seen.kind !== "refused") throw new Error("expected refused");
  assert.equal(seen.message, "A brand new sentence.");
});

test("with no message at all it still says the shop is unchanged", () => {
  const seen = readImportAnswer({ created: 0, nothing_was_added: true });
  if (seen.kind !== "refused") throw new Error("expected refused");
  assert.match(seen.message, /unchanged/i);
});

// ── THE ONE THAT WOULD HAVE BROKEN EVERY UPLOAD FOR A FEW MINUTES ───────────

test("a panel newer than the server does NOT call a good upload a failure", () => {
  // A panel deployed before the server is will not have `nothing_was_added` at
  // all. `undefined` has to read as "the old behaviour", never as a refusal -
  // otherwise every successful upload is reported as a failure for the minutes
  // between the two deploys, and nothing anywhere would say why.
  const seen = readImportAnswer({ created: 42, created_ids: ["a"], failed: [] });
  assert.equal(seen.kind, "added");
});

test("only a real true counts, not a truthy value", () => {
  for (const odd of [0, "", "false", null, undefined] as any[]) {
    const seen = readImportAnswer({ created: 7, nothing_was_added: odd });
    assert.equal(seen.kind, "added", `${String(odd)} was read as a refusal`);
  }
});

// ── already in the shop is not a failure ────────────────────────────────────

test("rows the shop already had are taken out of the red list", () => {
  const seen = readImportAnswer({
    created: 1, created_ids: ["new-1"],
    failed: [
      { row: 2, error: "'Basmati Rice 5kg' is already in this shop" },
      { row: 4, error: "'Tea 900g' is already in this shop" },
    ],
    already_there_rows: [
      { row: 2, error: "'Basmati Rice 5kg' is already in this shop" },
      { row: 4, error: "'Tea 900g' is already in this shop" },
    ],
    already_there: 2,
  });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.equal(seen.faults.length, 0, "an already-there row was shown as a fault");
  assert.equal(seen.alreadyThere.length, 2);
  assert.equal(seen.created, 1);
});

test("a real fault beside an already-there row is still shown", () => {
  const seen = readImportAnswer({
    created: 1,
    failed: [
      { row: 2, error: "'Rice' is already in this shop" },
      { row: 9, error: "missing price" },
    ],
    already_there_rows: [{ row: 2, error: "'Rice' is already in this shop" }],
  });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.deepEqual(seen.faults, [{ row: 9, error: "missing price" }]);
});

test("they are recognised by the server's list, NEVER by the wording", () => {
  // Matching the sentence "is already in this shop" breaks silently the day
  // somebody rewrites a message. Here the wording says nothing of the sort and
  // the row must STILL be treated as already-there, because the server said so.
  const seen = readImportAnswer({
    created: 0,
    failed: [{ row: 5, error: "yeh cheez pehle se maujood hai" }],
    already_there_rows: [{ row: 5, error: "yeh cheez pehle se maujood hai" }],
  });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.equal(seen.faults.length, 0);
  assert.equal(seen.alreadyThere.length, 1);
});

test("an older server that sends no separate list still works", () => {
  const seen = readImportAnswer({
    created: 3, failed: [{ row: 9, error: "missing price" }],
  });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.equal(seen.faults.length, 1);
  assert.equal(seen.alreadyThere.length, 0);
});

// ── the pictures ────────────────────────────────────────────────────────────

test("the screen is told how many pictures are being fetched", () => {
  const seen = readImportAnswer({ created: 5000, pictures_queued: 4812 });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.equal(seen.picturesQueued, 4812);
});

test("no pictures means no progress bar", () => {
  const seen = readImportAnswer({ created: 5 });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.equal(seen.picturesQueued, 0);
});

// ── nothing is ever undefined ───────────────────────────────────────────────

test("every list comes back as a list, whatever the server left out", () => {
  const seen = readImportAnswer({ created: 1 });
  if (seen.kind !== "added") throw new Error("expected added");
  assert.ok(Array.isArray(seen.faults));
  assert.ok(Array.isArray(seen.alreadyThere));
  assert.ok(Array.isArray(seen.ids));
});
