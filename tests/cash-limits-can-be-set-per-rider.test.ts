// ─────────────────────────────────────────────────────────────────────────────
// CASH LIMITS YOU CAN SET, AND THAT CAN DIFFER PER RIDER — the panel's half.
// Mock 118, approved by Sana on 24 September 2026.
//
// WHAT WAS TRUE BEFORE. The automatic cash limit has worked since the first
// week — Rs 10,000 or 2 days — and there was NO SCREEN ANYWHERE IN THE PANEL
// to change it. `grep -rn "cash_limit" akhpal-admin/src` returned nothing.
//
// THE ONE RULE EVERYTHING BELOW PROTECTS:
//
//     empty -> follow the office, now and whenever the office figure changes
//     0     -> this limit is OFF for him, on purpose
//     5     -> his own figure
//
// A blank box must never be able to switch a limit off. If it could, an office
// clerk opening a rider and pressing Save would quietly let him carry Takal's
// money for ever, and no screen would say a word.
//
// Every check below either CALLS the real function or reads what is actually
// rendered or sent. A comment, an import line or an unused variable cannot
// satisfy them — CLAUDE.md section 3, sprung eight times on this project.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { NAVIGATION, SERVER_RULES, serverSectionFor } from "../src/lib/navigation.ts";
import { formFromRider, offSwitchWarnings } from "../src/lib/rider-cash-limits.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** A file with every comment stripped. The old wrong ways are DESCRIBED in the
 *  comments on purpose, so searching the raw text finds them and proves
 *  nothing. */
const bare = (src: string) =>
  src
    // A BLOCK COMMENT STARTS A LINE. Anchored with ^[ \t]* and /m on purpose:
    // without it, `/*` INSIDE A STRING opens a comment that runs to the next `*/`
    // — and src/lib/navigation.ts has rules like "/admin/riders/*/cash-limits".
    // Found on 24 September 2026: a lone starred rule swallowed fifty lines of
    // SERVER_RULES, and the check for a rule below it passed on a file that no
    // longer contained it. It had looked right only because the starred lines
    // happened to come in pairs, so each one closed the one before it.
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const officePage = bare(read("src/app/dashboard/riders/cash-limits/page.tsx"));
const riderCard = bare(read("src/domains/riders/RiderCashLimits.tsx"));
const riderPage = bare(read("src/app/dashboard/riders/[id]/page.tsx"));
const riderMoney = bare(read("src/domains/riders/RiderMoney.tsx"));
const apiPeople = bare(read("src/lib/api-people.ts"));

// ── 1. AN EMPTY BOX IS NOT A ZERO ──────────────────────────────────────────

test("a rider with nothing of his own gets four empty boxes", () => {
  const f = formFromRider({});
  assert.deepEqual(f, {
    cash_limit_amount: "",
    cash_limit_days: "",
    cash_limit_min_amount: "",
    cash_limit_enabled: "",
  });
});

test("a NULL from the database is an empty box, never a 0", () => {
  // THE WHOLE DESIGN IN ONE CHECK. If null came back as "0", opening a rider
  // and pressing Save would switch every one of his limits off.
  const f = formFromRider({
    cash_limit_amount: null,
    cash_limit_days: null,
    cash_limit_min_amount: null,
    cash_limit_enabled: null,
  });
  assert.equal(f.cash_limit_amount, "");
  assert.equal(f.cash_limit_days, "");
  assert.equal(f.cash_limit_min_amount, "");
  assert.equal(f.cash_limit_enabled, "");
});

test("a real 0 from the database stays a visible 0", () => {
  const f = formFromRider({ cash_limit_days: 0, cash_limit_enabled: false });
  assert.equal(f.cash_limit_days, "0");
  assert.equal(f.cash_limit_enabled, "no");
});

test("his own figures come back as his own figures", () => {
  const f = formFromRider({
    cash_limit_amount: 10000, cash_limit_days: 5,
    cash_limit_min_amount: 200, cash_limit_enabled: true,
  });
  assert.deepEqual(f, {
    cash_limit_amount: "10000", cash_limit_days: "5",
    cash_limit_min_amount: "200", cash_limit_enabled: "yes",
  });
});

test("money in the boxes is whole rupees", () => {
  // Sana, 24 September 2026: "show the whole number 144 as in admin panel
  // as Not 143.90".
  const f = formFromRider({ cash_limit_amount: 9999.6, cash_limit_min_amount: 200.4 });
  assert.equal(f.cash_limit_amount, "10000");
  assert.equal(f.cash_limit_min_amount, "200");
});

// ── 2. NOTHING IS SWITCHED OFF WITHOUT THE SCREEN SAYING SO ────────────────

test("an empty box raises no warning, because it switches nothing off", () => {
  assert.deepEqual(offSwitchWarnings(formFromRider({})), []);
});

test("typing 0 in the amount says out loud what 0 means", () => {
  const w = offSwitchWarnings({ ...formFromRider({}), cash_limit_amount: "0" });
  assert.equal(w.length, 1);
  assert.match(w[0], /no amount limit/i);
});

test("typing 0 in the days says out loud what 0 means", () => {
  const w = offSwitchWarnings({ ...formFromRider({}), cash_limit_days: "0" });
  assert.equal(w.length, 1);
  assert.match(w[0], /no day limit/i);
});

test("switching the whole limit off for him says so too", () => {
  const w = offSwitchWarnings({ ...formFromRider({}), cash_limit_enabled: "no" });
  assert.equal(w.length, 1);
  assert.match(w[0], /never stopped for cash/i);
});

test("three ways of switching something off give three warnings", () => {
  const w = offSwitchWarnings({
    cash_limit_amount: "0", cash_limit_days: "0",
    cash_limit_min_amount: "", cash_limit_enabled: "no",
  });
  assert.equal(w.length, 3);
});

test("the warning is painted on the screen, not only worked out", () => {
  assert.ok(
    riderCard.includes("offSwitchWarnings(form)") &&
      riderCard.includes('data-testid="off-switch-warning"') &&
      riderCard.includes("warnings.map"),
    "The warning is worked out and never shown, which is the same as no warning.",
  );
});

test("a blank box is sent as null, never as 0", () => {
  // THE SERVER CANNOT TELL THEM APART FOR US. `null` means follow the office;
  // 0 means the limit is off. If an empty box were sent as 0, the whole design
  // would be undone at the last step.
  assert.ok(
    riderCard.includes('if (raw === "") return null;'),
    "An empty box no longer becomes null on its way to the server.",
  );
  assert.ok(
    !/if \(raw === ""\) return 0/.test(riderCard),
    "An empty box is being sent as zero.",
  );
});

test("Back to office default clears all four, not some of them", () => {
  const block = riderCard.slice(riderCard.indexOf("const backToOffice"));
  for (const k of ["cash_limit_amount", "cash_limit_days",
                   "cash_limit_min_amount", "cash_limit_enabled"]) {
    assert.match(block, new RegExp(`${k}:\\s*null`),
      `"Back to office default" leaves ${k} as it was, so he is not back on ` +
      `the office figure at all.`);
  }
});

// ── 3. THE TEST DRIVE ──────────────────────────────────────────────────────

test("the office screen asks the server who these figures would stop", () => {
  assert.ok(officePage.includes("previewCashLimits("),
    "The office screen saves a figure without ever saying who it would stop.");
  assert.ok(officePage.includes("of your {checked} rider"),
    "The count is fetched and never shown.");
});

test("the count is never worked out in the panel", () => {
  // A SECOND OPINION IS WORSE THAN NO OPINION. If the screen worked the rule
  // out for itself, the office would be shown one answer and the rider's phone
  // another, and the argument would happen at the counter.
  assert.ok(
    !/cash_in_hand\s*>\s*\w*[Aa]mount/.test(officePage) &&
      !/days_holding\w*\s*>=/.test(officePage),
    "The panel is deciding for itself who is over the limit.",
  );
});

test("a failed test drive says so instead of showing a comforting zero", () => {
  assert.ok(officePage.includes("setPreviewFailed(true)"),
    "A failed preview is swallowed.");
  assert.ok(officePage.includes("could not check who these figures would stop"),
    "Nothing on the screen says the count could not be worked out.");
});

test("an incomplete count is marked as incomplete", () => {
  // THE WHOLE CONDITION, not the words inside it. `includes("preview.incomplete")`
  // passed a `{false && (` break, because "preview.incomplete_warning" two
  // lines below contains it — CLAUDE.md section 3, sprung for the ninth time.
  assert.ok(officePage.includes("{preview.incomplete && ("),
    "A count built from figures that could not all be read is shown as fact.");
  assert.ok(officePage.includes("This count may be short."),
    "Nothing on the screen says the count is short.");
});

test("the rider's own page test-drives him alone", () => {
  assert.match(riderCard, /previewCashLimits\(\{[^}]*rider_id: riderId/s,
    "His page asks the whole-office question instead of asking about him.");
});

// ── 4. THE CHIP IN THE RIDER LIST ──────────────────────────────────────────

test("the rider list shows whose limits each rider is on", () => {
  for (const words of ["Office ·", "His own ·", "Limit off for him"]) {
    assert.ok(riderMoney.includes(words),
      `The rider list never says "${words}", so a rider on his own rules is ` +
      `invisible until somebody opens him.`);
  }
});

test("the chip reads the server's answer, it does not work one out", () => {
  assert.ok(riderMoney.includes("limits.is_his_own"),
    "The chip decides for itself whether a rider is on his own figures.");
});

test("the list says how long he has held it, beside the limit in days", () => {
  // A limit in days means nothing without the days.
  assert.ok(riderMoney.includes("days_holding_cash"),
    'The list shows a "2 days" limit and never says what day he is on.');
});

test("the chip says what 0 means rather than printing Rs 0", () => {
  assert.ok(riderMoney.includes("no amount limit") &&
            riderMoney.includes("no day limit"),
    'A limit of 0 would read as "Rs 0", which is the opposite of the truth.');
});

// ── 5. WIRING ──────────────────────────────────────────────────────────────

test("Riders → Cash Limits is in the menu", () => {
  const riders = NAVIGATION.find((i) => i.href === "/dashboard/riders");
  const tab = (riders?.tabs ?? []).find((t) => t.href === "/dashboard/riders/cash-limits");
  assert.ok(tab, "The screen exists and nothing links to it.");
  assert.equal(tab!.section, "riders.pay-rules");
});

test("the screen and the server agree on who may open it", () => {
  assert.equal(serverSectionFor("/admin/riders/cash-limits/preview"), "riders.pay-rules");
});

test("setting one rider's limits is a Pay Rules job, not a Payments one", () => {
  // Whoever hands a rider his money must not also be able to lift the limit
  // that stops him carrying too much of Takal's.
  const rule = SERVER_RULES.find(([p]) => p === "/admin/riders/*/cash-limits");
  assert.ok(rule, "The panel has no copy of the server's rule for this door.");
  assert.equal(rule![1], "riders.pay-rules");
});

test("the rider's page only offers the boxes to somebody who may use them", () => {
  assert.ok(riderPage.includes('canAccess("riders.pay-rules")'),
    "Anybody who can open a rider is offered a Save button the server refuses.");
  assert.ok(riderCard.includes("canEdit") && riderCard.includes("disabled={!canEdit}"),
    "The boxes are live for an admin who cannot save them.");
});

test("his page carries the card at all, and not behind a condition", () => {
  // `includes("<RiderCashLimits")` passed a `{false && <RiderCashLimits`
  // break. The element being MENTIONED is not the element being DRAWN —
  // CLAUDE.md section 3 again. So this also reads what comes before it: a
  // line ending in `&&`, `(`, `?` or `:` means the card is drawn only
  // sometimes, and "sometimes" is not what this page promises.
  const at = riderPage.indexOf("<RiderCashLimits");
  assert.ok(at > 0, "The card was written and never put on a page.");
  const before = riderPage
    .slice(0, at)
    .split("\n")
    .filter((l) => l.trim() !== "")
    .pop()!
    .trim();
  assert.ok(
    !/(&&|\(|\?|:)$/.test(before),
    `The card is drawn only when something else is true: ${before}`,
  );
});

test("the whole set is sent every time, so a limit can be cleared", () => {
  const block = apiPeople.slice(apiPeople.indexOf("async setRiderCashLimits"));
  assert.match(block, /method: "PUT"/);
  for (const k of ["cash_limit_amount", "cash_limit_days",
                   "cash_limit_min_amount", "cash_limit_enabled"]) {
    assert.ok(block.includes(k), `${k} is never sent, so it can never be cleared.`);
  }
});
