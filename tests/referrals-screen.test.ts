// ─────────────────────────────────────────────────────────────────────────────
// THE REFERRALS & CREDIT SCREEN  (Mock 97, approved by Sana 19 September 2026)
//
// The money audit closed the holes in the referral scheme but left one thing
// open, and said so: there was no screen. Nobody could see what had been
// handed out.
//
// What this file holds in place is mostly about the page NOT doing its own
// arithmetic on money. Every figure comes from the server, which already
// doubles a pair (Rs 50 a side is Rs 100 out of the door). A screen that
// halves or re-adds any of it is the comfortable wrong answer nobody goes
// looking for.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** The file with its comments taken out - a guard that reads its own
 *  explanation guards nothing (CLAUDE.md section 3). */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = code(read("src/app/dashboard/payments/referrals/page.tsx"));
const nav = code(read("src/lib/navigation.ts"));
const api = code(read("src/lib/api-money.ts"));

test("the page exists and asks the server for the figures", () => {
  assert.ok(api.includes("/admin/referrals?limit="), "the call must be there");
  assert.ok(page.includes("apiClient.getReferrals()"), "and the page must make it");
});

test("all four figures are shown", () => {
  for (const label of [
    "Given away, all time",
    "Promised, not yet paid",
    "Credit still unspent",
    "Credit already spent",
  ]) {
    assert.ok(page.includes(label), `the "${label}" figure is missing`);
  }
});

test("the page does NOT work any money out for itself", () => {
  // The server doubles a pair. If the page multiplied or halved anything, the
  // two would disagree and only one of them can be right.
  assert.ok(!/\*\s*2\b/.test(page), "the page must not double anything");
  assert.ok(!/\/\s*2\b/.test(page), "...or halve it");
  assert.ok(
    !page.includes("reward_each_side *"),
    "the reward must not be multiplied on screen",
  );
});

test("the rules strip is read from the server, never typed in", () => {
  assert.ok(page.includes("rules.reward_each_side"));
  assert.ok(page.includes("rules.minimum_first_order"));
  assert.ok(page.includes("rules.max_per_referrer"));
  // A hard-coded Rs 50 or Rs 500 would be right today and wrong the first
  // time somebody changes the setting in Render.
  assert.ok(!/Rs\s*50\b/.test(page), "no reward amount typed into the page");
  assert.ok(!/Rs\s*500\b/.test(page), "no minimum order typed into the page");
});

test("a switched-off scheme says so instead of showing stale rules", () => {
  assert.ok(page.includes("rules.switched_off"));
  assert.ok(page.includes("switched off"));
});

test("a cap of zero is reported as NO cap, not as a cap of zero", () => {
  // Found by looking at the real page rather than the code: with the cap set
  // to 0 - which switches the limit OFF in core_otp.py - the page read "At
  // most 0 referrals per customer" and "The cap is 0", the exact opposite of
  // what is true. Somebody reading that would think the scheme was shut.
  assert.ok(
    page.includes("Number(rules.max_per_referrer) > 0"),
    "the page must ask whether there IS a cap before printing one",
  );
  assert.ok(page.includes("No limit on how many one customer may refer"));
  assert.ok(page.includes("There is no cap at the moment."));
});

test("a figure that could not be read is called out, not shown as zero", () => {
  assert.ok(page.includes("data?.incomplete"), "the warning must be wired up");
  assert.ok(
    page.includes("too LOW, not wrong"),
    "the office has to know which way an incomplete figure is wrong - " +
      "otherwise a database hiccup looks like a real customer farming rewards",
  );
});

test("the fraud column shows how many actually ordered", () => {
  assert.ok(page.includes("Of those, ordered"));
  assert.ok(page.includes("never_ordered"));
  assert.ok(page.includes("at_the_cap") && page.includes("worth_a_look"));
});

test("a waiting reward says why it is waiting", () => {
  // THE PRINTED FORM, not the name. Looking for "waiting_because" anywhere
  // passed a deliberate break that kept the `r.waiting_because && (...)`
  // condition and printed nothing inside it - the reason was fetched,
  // checked, and thrown away. This project has now sprung that trap five
  // times (CLAUDE.md section 3).
  assert.ok(
    page.includes("{r.waiting_because}"),
    "the reason must actually be drawn, not merely checked",
  );
  assert.ok(page.includes("r.waiting_because && ("), "...and only when there is one");
});

test("the rules are CHANGED in Settings, not here", () => {
  // Two places to change one number is how they drift apart.
  assert.ok(page.includes('href="/dashboard/settings"'));
  assert.ok(
    !page.includes("updateSettings"),
    "this page reports; it must not write a setting",
  );
});

test("it is a Payments tab and behind the payments permission", () => {
  assert.ok(
    nav.includes('href: "/dashboard/payments/referrals", section: "payments"'),
    "money out of the door belongs with the other money pages, not Marketing",
  );
  assert.ok(
    nav.includes('["/admin/referrals", "payments"]'),
    "the route map must agree with the server's own rule",
  );
});
