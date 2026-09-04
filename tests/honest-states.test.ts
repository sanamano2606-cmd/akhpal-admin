// ─────────────────────────────────────────────────────────────────────────────
// AN EMPTY STATE IS A CLAIM ABOUT THE WORLD.
//
// "No riders found". "No parcels on the shelf". "Nothing low on stock." Every
// one of those sentences tells the operator a fact about the business, and
// every one of them may only be said when the business was actually read.
//
// Twelve screens in this panel used to say them after a FAILED read - a
// dropped connection on the free server, or a permission the sub-admin does
// not hold - so the panel answered a question it had never asked. On the pay
// screens that is somebody deciding nobody is owed money.
//
// This test walks the real page files and refuses any empty-state branch that
// is not gated on the failure first. It is a text check, not a render check,
// which is exactly why it is cheap enough to run on every change.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { errorMessage, readFailure, AccessDeniedError } from "../src/lib/api-errors.ts";

// ── 1. The two answers a failed read has to carry ───────────────────────────

test("a refusal is told apart from a breakage by asking the error, not its wording", () => {
  const refused = readFailure(new AccessDeniedError(undefined, "payments"), "the pay run");
  assert.equal(refused.denied, true);
  assert.match(refused.message, /permission/);

  const broken = readFailure(new Error("Network request failed"), "the pay run");
  assert.equal(broken.denied, false);
  assert.equal(broken.message, "Network request failed");
});

test("a breakage whose wording happens to contain the word permission is still a breakage", () => {
  // THE BUG THIS REPLACES. Pages worked out `denied` by searching the message
  // for "permission", so this error would have hidden the Try again button on
  // a failure that trying again would have fixed.
  const odd = readFailure(new Error("permission_denied while contacting the database"), "x");
  assert.equal(odd.denied, false, "only a real refusal is a refusal");
});

test("a failure with nothing to say still produces a sentence", () => {
  assert.equal(errorMessage(new Error(""), "the riders"), "Could not load the riders.");
  assert.equal(errorMessage(null), "Something went wrong.");
});

// ── 2. No screen states a fact it did not read ──────────────────────────────

const PAGES = "src/app/dashboard";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Words that mean "this branch is the failure, not the emptiness". */
const GUARD = /\b(error|loadError|staffError|historyError|switchFailed|catsFailed|revenueFailed|detailFailed|settingsError|periodsTried)\b/;

test("every empty-state branch is gated on the failed read before it", () => {
  const offenders: string[] = [];

  for (const file of walk(PAGES)) {
    const text = readFileSync(file, "utf8");

    // A page that returns early on failure can never reach its empty state.
    if (/if \(error\) return/.test(text)) continue;
    // A page that never reports a failure has no failure to confuse.
    if (!GUARD.test(text)) continue;

    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!/\.length === 0 \?/.test(line)) return;
      // Look back a few lines: the branch immediately before an empty state
      // must be the failure branch.
      // The line ITSELF counts. `loadError ? null : rows.length === 0 ?` puts
      // the guard and the empty state on one line, and that is correct code.
      const before = lines.slice(Math.max(0, i - 20), i + 1).join("\n");
      // A branch marked `read-safe:` says in words why this emptiness is a
      // real fact - usually because the whole block only renders after a
      // successful read. The reason has to be written next to it.
      if (!GUARD.test(before) && !/read-safe:/.test(before)) {
        offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "These empty states can be shown after a failed read, so they state a " +
      "fact nobody checked:\n" + offenders.join("\n")
  );
});

test("no page decides a refusal by searching the message for a word", () => {
  const offenders: string[] = [];
  for (const file of walk(PAGES)) {
    const text = readFileSync(file, "utf8");
    if (/includes\("permission"\)|includes\("Main Admin"\)/.test(text)) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "Use readFailure(err, ...) - it asks the error itself:\n" + offenders.join("\n")
  );
});
