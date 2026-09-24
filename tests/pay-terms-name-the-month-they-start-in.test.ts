// ─────────────────────────────────────────────────────────────────────────────
// PAY TERMS MUST NAME THE MONTH THEY START IN (money audit M10, Mock 112).
//
// Parcel-staff pay terms had ONE undated row per person, and saving new terms
// wrote over the old ones. The pay run then applied today's salary to whichever
// month was on the screen.
//
//   Karim on Rs 30,000 in August. August paid in full, "to pay Rs 0", settled.
//   Give him a rise to Rs 40,000 on 1 October and August re-opens reading
//   earned Rs 40,000, paid Rs 30,000, TO PAY Rs 10,000 - with the button live.
//
// The server now prices a month from the terms that were in force IN IT. This
// file checks the panel's half of it:
//
//   * the new month is actually SENT, or the server silently uses this month
//     for a rise the office meant to back-date
//   * the form opens on TODAY's figures, not on the month being read
//   * the screen says WHICH terms a salary came from
//   * "no terms for this month" and "no pay terms set" stay different words
//
// Every check below reads what is actually RENDERED or SENT. A comment, an
// import line or an unused variable cannot satisfy them - CLAUDE.md section 3,
// which has been sprung seven times on this project.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const api = read("src/lib/api-money.ts");
const page = read("src/app/dashboard/payments/staff/page.tsx");
const server = read("../swat-delivery-app/backend/routers/staff_pay.py");

/** The page with every comment stripped out. The old wrong ways are DESCRIBED
 *  in the comments on purpose, so searching the raw file finds them and proves
 *  nothing. */
const code = page
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

const serverCode = server
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");

test("the call can carry the month the terms start in", () => {
  assert.ok(api.includes("effective_from?: string;"),
    "setStaffPayTerms has no effective_from, so the panel cannot back-date a rise.");
});

test("the page actually sends it", () => {
  assert.ok(code.includes("effective_from: fFrom"),
    "The chosen month never reaches the server. Every rise would start in the "
    + "month it was typed, and a back-dated one would be impossible.");
});

test("the server reads the field the panel sends", () => {
  // One fact, two places. This is the drift that cost this project Rs 129.95
  // on a rider once already.
  assert.ok(/effective_from:\s*Optional\[str\]/.test(serverCode),
    "StaffPayTerms on the server has no effective_from, so the panel is "
    + "sending a field nothing reads.");
});

test("the form opens on TODAY'S figures, not on the month being read", () => {
  // Looking at August must not make Save quietly offer August's salary as the
  // current one - that would undo a rise by opening an old month.
  for (const field of ["current_monthly_salary",
                       "current_daily_delivery_target",
                       "current_bonus_per_extra_delivery",
                       "current_is_active"]) {
    assert.ok(code.includes(field),
      `openTerms does not read ${field}. Opening the Terms button while an `
      + "older month is on screen would offer that month's figures as today's.");
  }
});

test("the server sends those figures", () => {
  assert.ok(serverCode.includes('f"current_{k}"'),
    "The pay run does not return the current_* figures the form opens on.");
});

test("a salary says which terms it came from", () => {
  assert.ok(code.includes("in force since {shortMonth(r.terms_effective_from)}"),
    "Nothing under the salary says which terms produced it, so a figure that "
    + "changes after a rise has no explanation on the screen.");
});

test("the server sends the month those terms started in", () => {
  assert.ok(serverCode.includes('"effective_from": str(eff)[:10] if eff else None'),
    "The pay run does not report effective_from, so the line above can only "
    + "ever be blank.");
});

test("'no terms for this month' and 'no pay terms set' are different words", () => {
  // They need different answers from the office: one is a month nobody agreed
  // a salary for, the other is a person who has never been set up.
  assert.ok(code.includes('"NO TERMS FOR THIS MONTH"'),
    "A month with no terms in force is still labelled the same as a person "
    + "who was never set up, which sends the office to the wrong screen.");
  assert.ok(code.includes('"NO PAY TERMS SET"'),
    "The original label has gone. A brand-new staff member now reads as a "
    + "month problem.");
  assert.ok(code.includes("r.terms_not_recorded_for_this_month"),
    "Nothing decides between the two labels.");
});

test("the server tells the panel which of the two it is", () => {
  assert.ok(serverCode.includes('"terms_not_recorded_for_this_month": not_recorded'),
    "The pay run does not send the flag, so the panel can never show the new "
    + "wording.");
});

test("the button on such a row names the month", () => {
  assert.ok(code.includes("`Set terms for ${shortMonth(month)}`"),
    "The button still says 'Set pay terms' on a row whose problem is one "
    + "particular month.");
});

test("the form explains the rule in the office's own words", () => {
  assert.ok(code.includes("Starts from"),
    "The new box has no label.");
  assert.ok(/Earlier months keep the\s+terms they already had/.test(code),
    "Nothing on the form says that earlier months are left alone, which is "
    + "the whole reassurance.");
  assert.ok(code.includes("back-date a rise that was agreed earlier"),
    "Nothing says what the box is for.");
});

test("the form shows what the person has been on", () => {
  // PINNED TO THE WHOLE CONDITION, not just to the words inside it.
  //
  // Written first as `code.includes("terms.terms_history")`, this let a
  // deliberate break straight through: changing the guard to `{false && (`
  // left the words in the file and painted nothing on the screen. CLAUDE.md
  // section 3, sprung an eighth time. What decides whether the office SEES
  // the list is the condition, so the condition is what is checked.
  assert.ok(
    code.includes(
      "{Array.isArray(terms?.terms_history) && terms.terms_history.length > 0 && ("),
    "The list of old terms is not shown from the data itself, so nothing on "
    + "screen proves the old figures were kept rather than written over.");
  assert.ok(code.includes("terms.terms_history.slice(0, 6).map("),
    "Nothing walks the list, so it can only ever paint an empty box.");
  assert.ok(code.includes("Old terms are kept, never written over."),
    "The one sentence that says why this is safe is missing.");
});

test("the server sends that list", () => {
  assert.ok(serverCode.includes('"terms_history": ['),
    "The pay run does not return terms_history, so the list can only be empty.");
});

test("the month box offers real months, not free text", () => {
  // A typed month is a typo waiting to be a wrong payslip; the server refuses
  // anything that is not YYYY-MM and the office would meet a red box.
  const box = code.slice(code.indexOf("Starts from"));
  assert.ok(box.includes("<select value={fFrom}"),
    "The month is typed rather than chosen.");
  assert.ok(box.includes("START_MONTHS.map"),
    "The month list is not the shared one, so the options could drift.");
});

test("a rise can be set to start in a month that has not arrived yet", () => {
  // Agreeing in September that October is the new rate is normal. Offering
  // only past months would force the office to come back on the 1st and
  // remember - and the server already keeps a future rise out of what the
  // person is on today.
  assert.ok(code.includes("function startMonthChoices()"),
    "The Starts-from box reuses the pay-run month picker, which only goes "
    + "backwards, so next month cannot be chosen.");
  assert.ok(/for \(let i = 3; i >= -12; i--\)/.test(code),
    "startMonthChoices does not offer any month ahead of today.");
  assert.ok(code.includes('" (not started yet)"'),
    "A future month is offered with nothing marking it as future, so it reads "
    + "as a month that has already been paid.");
});

test("the button does not wrap into a narrow column", () => {
  // MEASURED, not guessed. At 1440px and below this cell is narrow: the label
  // wrapped into a 68px-wide column three lines tall. "Set pay terms" already
  // did it before the month was added; adding the month made it 116px tall.
  const cell = code.slice(code.indexOf('key: "action"'));
  const btn = cell.slice(cell.indexOf("Set terms for") - 600,
                         cell.indexOf("Set terms for") + 200);
  assert.ok(btn.includes('className="whitespace-nowrap"'),
    "The Set-terms button can wrap, which turns it into a tall narrow column "
    + "on any screen narrower than 1440px.");
});

test("the sentence in words is written in English that reads properly", () => {
  assert.ok(code.includes('`${terms.name.split(" ")[0]} gets`'),
    "The summary says \"Karim get\", which is the sentence the office reads "
    + "back before changing somebody's salary.");
});

test("a month with no date shows nothing, not 'Invalid Date'", () => {
  assert.ok(/if \(!value\) return "";/.test(code),
    "shortMonth does not guard an empty value.");
  assert.ok(/if \(!m\) return "";/.test(code),
    "shortMonth does not guard a value it cannot read, so an older server's "
    + "answer would paint 'Invalid Date' onto the pay screen.");
});
