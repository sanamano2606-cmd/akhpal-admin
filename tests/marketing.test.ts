// THE MARKETING PAGES — the faults the 3 September 2026 audit found, held shut.
//
// Every check here is one line of MARKETING-AUDIT.md. If one of them ever goes
// red, that fault has come back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROMO_STATUS,
  BANNER_STATUS,
  BANNER_DESTINATIONS,
  contrast,
  readableInk,
  colourWarning,
  bannerReach,
} from "../src/lib/marketing.ts";

/** A file with its comments taken out.
 *
 * Same helper, same reason as the Orders tests: a comment explaining that
 * `window.confirm` USED to be here must not read as the fault coming back, or
 * the honest note gets deleted to make a test pass. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

const PROMOS = code("src/app/dashboard/marketing/page.tsx");
const PROMO_DIALOGS = code("src/app/dashboard/marketing/parts-promo-dialogs.tsx");
const PROMO_COST = code("src/app/dashboard/marketing/parts-promo-cost.tsx");
const BANNERS = code("src/app/dashboard/marketing/banners/page.tsx");
const BANNER_PREVIEW = code("src/app/dashboard/marketing/banners/parts-banner-preview.tsx");
const WELCOME = code("src/app/dashboard/marketing/welcome/page.tsx");
const SEND = code("src/app/dashboard/marketing/notifications/page.tsx");
const API = code("src/lib/api-money.ts");

const ALL_PAGES = [PROMOS, PROMO_DIALOGS, PROMO_COST, BANNERS, WELCOME, SEND];

// ── 1. The grey browser box is gone from every Marketing screen ─────────────

test("no Marketing screen asks with the browser's grey box", () => {
  // It could not show what was about to happen, and in a browser with dialogs
  // switched off it silently did nothing at all. Four of these stood in front
  // of actions that could not be taken back.
  for (const src of ALL_PAGES) {
    assert.ok(!/window\.confirm\s*\(/.test(src), "window.confirm is back");
    assert.ok(!/window\.prompt\s*\(/.test(src), "window.prompt is back");
    assert.ok(!/window\.alert\s*\(/.test(src), "window.alert is back");
  }
});

// ── 2. The delete window says what would be lost ───────────────────────────

test("the delete window reads the real cost before offering anything", () => {
  assert.ok(PROMO_DIALOGS.includes("getPromoCost"));
  assert.ok(PROMO_DIALOGS.includes("Records that would be lost"));
});

test("a code that has been used is offered Disable, not Delete", () => {
  // Deleting a used code would take the only record of what it cost, and hand
  // the "1 per customer" offer back to everyone who had already used it.
  assert.ok(PROMO_DIALOGS.includes("neverUsed"));
  assert.ok(PROMO_DIALOGS.includes("Disable it"));
  assert.ok(PROMO_DIALOGS.includes("cannot be deleted"));
});

test("a failed count is not treated as never used", () => {
  // readable is false when the read failed. neverUsed requires readable.
  assert.ok(/const neverUsed = readable && used === 0/.test(PROMO_DIALOGS));
});

// ── 3. The Discount column tells the truth ─────────────────────────────────

test("the list prints every part of an offer, not the first one that fits", () => {
  // FIRST5 (free delivery) showed a dash and TAKAL1 (50% up to Rs 1,000 AND
  // free delivery) showed "50%". A code can give more than one thing.
  assert.ok(PROMOS.includes("p.gives"), "the gives list is not rendered");
  assert.ok(
    !/p\.percent_off \? `\$\{p\.percent_off\}%`/.test(PROMOS),
    "the old single-field Discount column is back",
  );
});

test("a code that gives nothing is called out", () => {
  assert.ok(PROMOS.includes("gives_nothing"));
});

test("the panel does not decide for itself whether a code is active", () => {
  // The old screen read is_active alone, so a code that expired last month
  // still showed a green Active. The server decides now.
  assert.ok(PROMOS.includes("PROMO_STATUS[p.status]"));
});

test("every status a code can be in has a word and a colour", () => {
  for (const s of ["live", "ended", "used_up", "scheduled", "off"]) {
    assert.ok(PROMO_STATUS[s], `${s} has no label`);
    assert.ok(PROMO_STATUS[s].label.length > 0);
  }
  // "Ended" and "Disabled" are different problems and must not share a word.
  assert.notEqual(PROMO_STATUS.ended.label, PROMO_STATUS.off.label);
});

// ── 4. A code can be prepared in advance ───────────────────────────────────

test("a discount code has a start date as well as an end date", () => {
  assert.ok(PROMOS.includes("starts_at"));
  assert.ok(PROMOS.includes("Starts on"));
});

// ── 5. What a code cost is a screen that exists ────────────────────────────

test("there is a screen for what a code has cost", () => {
  assert.ok(PROMO_COST.includes("Given away"));
  assert.ok(PROMO_COST.includes("Times used"));
  assert.ok(PROMOS.includes("What it cost"));
});

test("an unreadable cost is not shown as zero", () => {
  assert.ok(PROMO_COST.includes("readable === false"));
  assert.ok(PROMOS.includes("cost_readable === false"));
});

// ── 6. A banner is connected to what it offers ─────────────────────────────

test("a banner can be pointed at a discount code", () => {
  // The whole reason "Big Savings" leads nowhere: this choice did not exist.
  assert.ok(BANNER_DESTINATIONS.some((d) => d.value === "promo"));
  assert.ok(BANNERS.includes("BANNER_DESTINATIONS"));
});

test("the destinations offered match the ones the server allows", () => {
  // A value this list offers and the database refuses is a save that fails for
  // no visible reason. The server's list is BANNER_ACTION_TYPES.
  const server = readFileSync(
    "../swat-delivery-app/backend/core_marketing.py",
    "utf8",
  );
  for (const d of BANNER_DESTINATIONS) {
    assert.ok(
      server.includes(`"${d.value}"`),
      `the server does not accept ${d.value}`,
    );
  }
});

test("a banner with no destination says where it really lands", () => {
  // Not "does nothing" — the app falls back to the categories list. Saying
  // the wrong one on the screen would be this rebuild inventing its own
  // untruth to make the point sound worse.
  assert.ok(BANNERS.includes("leads_nowhere"));
  assert.ok(BANNERS.includes("opens the categories list"));
});

test("a banner has dates and its taps are shown", () => {
  assert.ok(BANNERS.includes("starts_at") && BANNERS.includes("ends_at"));
  assert.ok(BANNERS.includes("bannerReach"));
});

test("banner order is moved with buttons, not typed into a box", () => {
  assert.ok(BANNERS.includes("reorderPromoBanners"));
  assert.ok(
    !/set\("sort_order"/.test(BANNERS),
    "the hand-typed position box is back",
  );
});

test("the whole order is sent, not one banner's new number", () => {
  // Renumbering one banner is exactly how two end up sharing a position.
  assert.ok(/reorderPromoBanners\(\s*next\.map/.test(BANNERS));
});

test("every status a banner can be in has a word", () => {
  for (const s of ["live", "ended", "scheduled", "off"]) {
    assert.ok(BANNER_STATUS[s], `${s} has no label`);
  }
});

// ── 7. The banner is seen before it is saved ───────────────────────────────

test("the editor shows the banner the way a phone will", () => {
  assert.ok(BANNERS.includes("BannerPreview"));
  assert.ok(BANNER_PREVIEW.includes("colourWarning"));
});

test("contrast is measured, not guessed", () => {
  // Black on white is the maximum, 21. A colour against itself is 1.
  assert.ok(Math.abs(contrast("#000000", "#FFFFFF") - 21) < 0.01);
  assert.ok(Math.abs(contrast("#1e00ff", "#1e00ff") - 1) < 0.001);
});

test("the ink is whichever of black or white can be read", () => {
  assert.equal(readableInk("#FFFF00"), "#000000"); // Takal yellow: black on it
  assert.equal(readableInk("#1C1340"), "#FFFFFF"); // her dark navy: white on it
});

test("her two invisible fades are caught", () => {
  // #1e00ff -> #001eff is the live "Free Delivery" banner. It is the same blue
  // twice and the fade cannot be seen.
  assert.match(colourWarning("#1e00ff", "#001eff"), /almost the same/);
  // Yellow into a slightly darker yellow IS a visible fade and reads fine.
  assert.equal(colourWarning("#FFFF00", "#FFD400"), "");
});

test("the warning never refuses a save", () => {
  assert.ok(BANNER_PREVIEW.includes("only a warning"));
});

test("a banner nobody has seen has no percentage", () => {
  // Printing "0%" beside a brand new banner reads as "this banner failed".
  assert.equal(bannerReach(0, 0), "Not shown yet");
  assert.match(bannerReach(1204, 86), /7%/);
});

// ── 8. Sending to everybody ────────────────────────────────────────────────

test("the send window shows the message and carries the number", () => {
  assert.ok(SEND.includes("getBroadcastAudience"));
  assert.ok(/Send to \$\{Number\(people\)/.test(SEND));
});

test("nothing can be sent when the count could not be read", () => {
  assert.ok(/canSend =[^;]*!audience\?\.failed/.test(SEND));
});

test("the history says what landed, not what was hoped for", () => {
  assert.ok(SEND.includes("h.delivered"));
  assert.ok(SEND.includes("h.intended"));
});

test("a failure to load the history is not shown as 'nothing sent'", () => {
  assert.ok(SEND.includes("historyError"));
});

// ── 9. Welcome screens ─────────────────────────────────────────────────────

test("welcome screens are reordered with buttons too", () => {
  assert.ok(WELCOME.includes("reorderOnboardingSlides"));
});

// ── 10. The calls exist ────────────────────────────────────────────────────

test("every new call the pages make is defined", () => {
  for (const call of [
    "getPromoCost",
    "getBroadcastAudience",
    "getBroadcasts",
    "reorderPromoBanners",
    "reorderOnboardingSlides",
  ]) {
    assert.ok(API.includes(`async ${call}(`), `${call} is missing`);
  }
});
