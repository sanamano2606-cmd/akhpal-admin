/**
 * THE PAGE STAYS WHERE SANA IS (page reload audit, 10 November 2026).
 *
 * Sana: "when i perform an action the page get refreshed all and i need to
 * scroll down again and again. This thing happens all over the admin panel."
 * Audit: docs/Audit/AUDIT-REPORT-PAGE-RELOAD-2026-11-10.md. "Fix All At Once."
 *
 * After a button, a list that is ALREADY on the screen must stay there while
 * it is read again (pale, with "Updating…"). Grey bars or "Loading…" are only
 * for a list that has nothing on the screen yet. Before, 98 buttons on 30
 * screens swapped the list for a few grey bars, the page shrank, and she was
 * thrown back to the top.
 *
 *   Fix A - the shared table (components/ui/Table.tsx)
 *   Fix B - every screen from the audit
 *   Fix C - Back/Forward return to the place; "Edit" scrolls the right box
 *   Fix D - the picture reader's save no longer forgets every saved page
 *   Fix E - Stores and Payments ask the server side by side
 *
 * If one of these fails, a screen has gone back to throwing her to the top.
 * Put the screen right; do not loosen the check.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { forgetsEverything, isShopCopy, PICTURE_SAVE } from "../src/lib/cache-forget.ts";
import { placeKey, rememberPlace, placeFor } from "../src/lib/hooks/useRememberedScroll.ts";

const SRC = join(import.meta.dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
/** The file without its comments, so a check is never satisfied by a note. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// ── Fix A ────────────────────────────────────────────────────────────────────
test("Fix A: the shared table draws grey bars ONLY when it has no rows", () => {
  const t = code("components/ui/Table.tsx");
  assert.match(t, /const firstRead = loading && rows\.length === 0;/);
  assert.match(t, /const reReading = loading && rows\.length > 0;/);
  // The bars hang off firstRead, never off plain `loading`.
  assert.match(t, /\{firstRead \? \(/);
  assert.doesNotMatch(t, /\{loading \? \(/);
  // Rows being read again are pale and cannot be pressed, and say so.
  assert.match(t, /className=\{reReading \? PALE_WHILE_READING/);
  assert.match(t, /<UpdatingChip show=\{reReading\} \/>/);
  // The TOTAL row stays on the screen while re-reading.
  assert.match(t, /\{!firstRead && rows\.length > 0 && columns\.some/);
});

test("Fix A: a pale row cannot be pressed - nobody pays on an old figure", () => {
  const s = code("components/ui/States.tsx");
  assert.match(s, /PALE_WHILE_READING = "[^"]*pointer-events-none[^"]*"/);
  assert.match(s, /PALE_WHILE_READING = "[^"]*opacity-60[^"]*"/);
  // The chip floats in the window's corner: it never moves the page.
  assert.match(s, /className="[^"]*\bfixed\b[^"]*"/);
});

// ── Fix B ────────────────────────────────────────────────────────────────────
/** Every screen from the audit, and the "first read only" test it must use. */
const SCREENS: [string, RegExp][] = [
  ["app/dashboard/orders/page.tsx", /\{loading && orders\.length === 0 \? \(/],
  ["app/dashboard/orders/returns/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/customers/page.tsx", /\{loading && customers\.length === 0 \? \(/],
  ["app/dashboard/reviews/ReviewList.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/reviews/products/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/reviews/questions/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/reviews/reported/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/reviews/settings/page.tsx", /if \(!settings\) return/],
  ["app/dashboard/marketing/page.tsx", /\{loading && promos\.length === 0 \? \(/],
  ["app/dashboard/marketing/banners/page.tsx", /\{loading && banners\.length === 0 \? \(/],
  ["app/dashboard/marketing/home-shops/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/marketing/welcome/page.tsx", /\{loading && slides\.length === 0 \? \(/],
  ["app/dashboard/stores/onboarding/page.tsx", /\{loading && shops\.length === 0 \? \(/],
  ["app/dashboard/stores/catalogue/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/stores/inventory/page.tsx", /\{loading && rows\.length === 0 \? \(/],
  ["app/dashboard/stores/sorting/photo-check/page.tsx", /\{loading && data\.items\.length === 0 \?/],
  ["app/dashboard/stores/sorting/shelf-check/page.tsx", /\{loading && groups\.length === 0 \? \(/],
  ["app/dashboard/stores/[id]/parts-orders.tsx", /\{loading && orders\.length === 0 \? \(/],
  ["app/dashboard/users/page.tsx", /\{loading && users\.length === 0 \? \(/],
  ["app/dashboard/support/[id]/page.tsx", /if \(loading && !thread\) return/],
  ["app/dashboard/riders/[id]/page.tsx", /if \(loading && !data\) return/],
  ["app/dashboard/go-live/page.tsx", /if \(loading && !data\) \{/],
  ["app/dashboard/payments/parts-tab-restaurants.tsx", /\{loading && fRows\.length === 0 \? \(/],
  ["app/dashboard/payments/staff/parts-staff-history.tsx", /loading && rows\.length === 0 \? \(/],
  ["components/PayoutDetailsCard.tsx", /if \(loading && !details\) \{/],
  ["components/ComplaintMoneyBox.tsx", /if \(loading && !complaint\) \{/],
];

/** Loading screens that are NOT a re-read after a button: a window that reads
 *  its own list once, when it is opened. Named one by one, never a pattern. */
const FIRST_OPEN_ONLY: Record<string, string[]> = {
  // "Look one by one" reads that group's products once when it opens.
  "app/dashboard/stores/sorting/shelf-check/page.tsx": ["{loading ? <LoadingState /> : failed ?"],
};

for (const [file, firstOnly] of SCREENS) {
  test(`Fix B: ${file} keeps what is on the screen while it reads again`, () => {
    let c = code(file);
    for (const ok of FIRST_OPEN_ONLY[file] || []) {
      assert.ok(c.includes(ok), `${file}: the allowed "${ok}" is gone - take it off FIRST_OPEN_ONLY`);
      c = c.split(ok).join("");
    }
    assert.match(c, firstOnly, `${file}: the loading screen must be for the FIRST read only`);
    // No bare "while reading, show nothing else" gate is left behind.
    assert.doesNotMatch(c, /\{loading \? \(/, `${file}: a bare {loading ? ( gate came back`);
    assert.doesNotMatch(c, /\{loading \? </, `${file}: a bare {loading ? < gate came back`);
    assert.doesNotMatch(c, /if \(loading\) return/, `${file}: if (loading) return came back`);
    assert.doesNotMatch(c, /if \(loading \|\| !\w+\) return/, `${file}: if (loading || ...) return came back`);
  });
}

test("Fix B: a modal that shows ONE person/shop/complaint starts empty for a new one", () => {
  // Keeping the old list while re-reading must never show one person's money
  // under another person's name.
  assert.match(code("app/dashboard/payments/staff/parts-staff-history.tsx"),
    /useEffect\(\(\) => \{ setRows\(\[\]\); load\(\); \}, \[load\]\);/);
  assert.match(code("components/PayoutDetailsCard.tsx"),
    /useEffect\(\(\) => \{ setDetails\(null\); load\(\); \}, \[load\]\);/);
  assert.match(code("components/ComplaintMoneyBox.tsx"),
    /useEffect\(\(\) => \{ setComplaint\(null\); void load\(\);/);
});

test("Fix B: the Stores list re-reads quietly, and lightly where it can", () => {
  const s = code("app/dashboard/stores/page.tsx");
  // Rows on the screen: refreshing (pale) - never the 8 grey bars again.
  assert.match(s, /if \(hasRows\.current\) setRefreshing\(true\);\s*else setLoading\(true\);/);
  assert.match(s, /<tbody data-rereading=\{refreshing \|\| undefined\}/);
  // Open/Close, delivery fee and commission change nothing a checklist counts:
  // 1 question instead of 3, and the heavy live-shop product count is skipped.
  const light = s.match(/fetchRestaurants\(\{ light: true \}\)/g) || [];
  assert.equal(light.length, 3);
  assert.match(s, /if \(light\) return;\s*\n\s*apiClient\.getLiveChecklists\(\)/);
  // A button that may change a checklist reads them all again.
  assert.match(s, /const saveVendorType[\s\S]*?await fetchRestaurants\(\);/);
});

test("Fix B: a list opened with 'Show more' stays open after a button", () => {
  assert.match(code("app/dashboard/stores/sorting/find/page.tsx"), /load\(find, 0, items\.length\)/);
  assert.doesNotMatch(code("app/dashboard/stores/sorting/find/page.tsx"), /setOne\(null\);\s*load\(find, 0\);/);
  const list = code("app/dashboard/stores/sorting/list/page.tsx");
  assert.equal((list.match(/load\(q, 0, lines\.length\)/g) || []).length, 3);
  assert.match(code("app/dashboard/stores/[id]/review/page.tsx"), /await load\(1, false, true\);/);
});

test("Fix B: the order list stays on the screen after Assign, Cancel, Move, Refund", () => {
  const o = code("app/dashboard/orders/page.tsx");
  assert.match(o, /<tbody className=\{loading && orders\.length > 0 \? PALE_WHILE_READING : undefined\}>/);
  assert.match(o, /\{orders\.length > 0 && \(\s*<tfoot/);
});

test("Fix B: a support conversation only jumps to the bottom when it GROWS", () => {
  const s = code("app/dashboard/support/[id]/page.tsx");
  assert.match(s, /if \(messages\.length > seenMessages\.current\) bottom\.current\?\.scrollIntoView/);
});

test("Fix B: the settings boxes do not flash 'Reading…' after Save", () => {
  for (const f of ["app/dashboard/settings/parts-business-details.tsx", "app/dashboard/settings/parts-takal-contact.tsx"]) {
    const s = code(f);
    assert.match(s, /const load = async \(quiet = false\) => \{\s*try \{\s*if \(!quiet\) setLoading\(true\);/);
    assert.match(s, /await load\(true\);/);
  }
});

// ── Fix C ────────────────────────────────────────────────────────────────────
test("Fix C: the panel's scrolling box is the one Back remembers", () => {
  const l = code("app/dashboard/layout.tsx");
  assert.match(l, /<main ref=\{setScroller\} data-panel-scroller /);
  assert.match(l, /useRememberedScroll\(scroller\);/);
});

test("Fix C: one place per address, and it survives a page being drawn again", () => {
  const stores = placeKey({ pathname: "/dashboard/stores", search: "?view=hidden" });
  const live = placeKey({ pathname: "/dashboard/stores", search: "" });
  assert.notEqual(stores, live);
  rememberPlace(stores, 2000.6);
  assert.equal(placeFor(stores), 2001);
  rememberPlace(live, -5);
  assert.equal(placeFor(live), 0);
  assert.equal(placeFor("/dashboard/never-seen"), null);
});

test("Fix C: Back waits for the NEW page and gives up the moment Sana scrolls", () => {
  const h = code("lib/hooks/useRememberedScroll.ts");
  assert.match(h, /window\.addEventListener\("popstate", onPop\)/);
  // Put back as soon as the box is tall enough, and again after each redraw.
  assert.match(h, /if \(redrawn && el\.scrollTop !== want && el\.scrollHeight - el\.clientHeight >= want\)/);
  assert.match(h, /new MutationObserver\(\(\) => \{ redrawn = true; \}\)/);
  assert.match(h, /\["wheel", "touchstart", "keydown", "pointerdown"\]/);
  assert.match(h, /Date\.now\(\) - started > RESTORE_FOR_MS/);
});

test("Fix C: nothing in the panel scrolls the window - it never moves", () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) {
        const rel = p.slice(SRC.length + 1);
        if (rel === join("lib", "hooks", "useRememberedScroll.ts")) continue;
        if (/window\.scrollTo\(/.test(code(rel))) offenders.push(rel);
      }
    }
  };
  walk(join(SRC, "app"));
  walk(join(SRC, "components"));
  assert.deepEqual(offenders, [], "use scrollPanelToTop() - the window never scrolls");
  for (const f of ["app/dashboard/orders/offices/page.tsx", "app/dashboard/marketing/page.tsx"]) {
    assert.match(code(f), /scrollPanelToTop\(\);/);
  }
});

// ── Fix D ────────────────────────────────────────────────────────────────────
test("Fix D: every write still forgets every saved copy - except the picture reader's", () => {
  for (const p of [
    "/restaurants/abc/toggle", "/admin/orders/1/assign", "/admin/payouts", "/admin/customers/1",
    "/admin/pictures/blurred", "/admin/pictures/reader", "/admin/pictures/read-more",
  ]) {
    assert.equal(forgetsEverything(p), true, p);
  }
  assert.equal(forgetsEverything("/admin/pictures/read"), false);
  assert.equal(forgetsEverything("/admin/pictures/read?x=1"), false);
  assert.ok(PICTURE_SAVE.test("/admin/pictures/read"));
});

test("Fix D: the picture reader's save forgets the shop and product copies only", () => {
  const base = "https://api.takalapp.com";
  for (const p of [
    "/admin/restaurants", "/admin/stores/ready-to-show?fresh=1", "/admin/stores/takal-hidden-products",
    "/admin/vendor-intake/live", "/admin/restaurants/9/review?page=1", "/restaurants/9/products/manage?page=1",
    "/menu/7",
  ]) {
    assert.equal(isShopCopy(base + p), true, p);
  }
  for (const p of [
    "/admin/orders?page=1", "/admin/payouts/history", "/admin/customers", "/admin/riders",
    "/admin/reviews", "/admin/settings", "/admin/storesX", "/admin/restaurantsfoo",
  ]) {
    assert.equal(isShopCopy(base + p), false, p);
  }
});

// ── Fix E ────────────────────────────────────────────────────────────────────
test("Fix E: Payments asks all its questions at the same time", () => {
  const s = code("app/dashboard/payments/page.tsx");
  const all = s.indexOf("await Promise.all([");
  assert.ok(all > 0, "the six reads are started together");
  const end = s.indexOf("setIncomplete(", all);
  for (const ask of [
    "getRestaurantPayoutReconciliation(", "getPayoutHistory()", "getRiderPayoutsReport()",
    "getRiderCashReconciliation(", "getStoreSettlements(", "getMissingBills()",
  ]) {
    const at = s.indexOf(ask);
    assert.ok(at > all && at < end, `${ask} must be inside the one Promise.all`);
  }
  // Each part still fails on its own and is still named.
  for (const words of ["the payout history", "what riders are owed", "rider cash", "what this period owes", "which bill-price orders have no bill"]) {
    assert.ok(s.includes(`partFailures.push(errorMessage(err, "${words}"))`), words);
  }
});

test("Fix E: the Stores list asks the shops and the waiting checklists together", () => {
  const s = code("app/dashboard/stores/page.tsx");
  const waiting = s.indexOf("const waiting = light ? null : (async () => {");
  const asked = s.indexOf("await apiClient.getWaitingChecklists()");
  const list = s.indexOf("await apiClient.getRestaurants({})");
  assert.ok(waiting > 0 && asked > waiting && list > asked,
    "the checklist question is started before the list is waited for");
  assert.match(s, /if \(waiting\) await waiting;/);
});
