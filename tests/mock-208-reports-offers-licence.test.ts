// ─────────────────────────────────────────────────────────────────────────────
// MOCK 208 - WHAT APPLE ASKED FOR, IN THE PANEL
// (approved by Sana 26 October 2026: "Approved All exactly")
//
//   208-2  Reviews -> Reported: oldest first, a clock red after 20 hours,
//          Hide review / Keep it / Suspend writer, a red number on the tab
//   208-3  a promotional notification goes only to customers who said yes,
//          and the box says how many that is
//   208-4  a new pharmacy needs its licence: Create store asks for it, the
//          Review page checks it (Approve locked until OK), live pharmacies
//          without one are marked "Licence missing"
// The server is the rule (backend/routers/review_reports.py, offers.py,
// shop_licence.py, shop_licences.py). These hold the panel to it.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { waitingWords, isLate, LATE_AFTER_HOURS } from "../src/lib/review-reports.ts";
import { needsLicence, missingForNewPharmacy, licenceDate, LICENCE_STATE } from "../src/lib/shop-licence.ts";
import { fixedKeysFor, licenceMayBeMarkedOk, reasonsFor, REVIEW_SECTIONS } from "../src/lib/shop-review.ts";
import { tabsFor, SERVER_RULES } from "../src/lib/navigation.ts";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const REPORTED = code("src/app/dashboard/reviews/reported/page.tsx");
const LAYOUT = code("src/app/dashboard/reviews/layout.tsx");
const REVIEW = code("src/app/dashboard/stores/[id]/review/page.tsx");
const CREATE = code("src/app/dashboard/stores/parts-create-store.tsx");
const LIST = code("src/app/dashboard/stores/page.tsx");
const STORE = code("src/app/dashboard/stores/[id]/page.tsx");
const CARD = code("src/app/dashboard/stores/[id]/parts-licence.tsx");
const NOTIFY = code("src/app/dashboard/marketing/notifications/page.tsx");
const API_STORES = code("src/lib/api-stores.ts");
const API_PEOPLE = code("src/lib/api-people.ts");
const SERVER_LIC = code("../swat-delivery-app/backend/shop_licence.py");
const SERVER_REP = code("../swat-delivery-app/backend/routers/review_reports.py");

// ── 208-2: reported reviews ─────────────────────────────────────────────────
test("the clock: minutes, hours, days - and red from 20 hours", () => {
  assert.equal(waitingWords(0.2), "12 min ago");
  assert.equal(waitingWords(3.4), "3 h ago");
  assert.equal(waitingWords(30), "1 day 6 h ago");
  assert.equal(waitingWords(48), "2 days ago");
  assert.equal(waitingWords(null), "just now");
  assert.equal(LATE_AFTER_HOURS, 20);
  assert.equal(isLate(19.9), false);
  assert.equal(isLate(20), true);
  assert.equal(isLate(null), false);
});

test("Reported is a Reviews tab, before Hidden, with the server's own keys", () => {
  const tabs = tabsFor("/dashboard/reviews");
  const labels = tabs.map((t) => t.label);
  assert.ok(labels.indexOf("Reported") === labels.indexOf("Hidden") - 1, labels.join(", "));
  const rep = tabs.find((t) => t.label === "Reported")!;
  assert.equal(rep.href, "/dashboard/reviews/reported");
  assert.deepEqual(rep.section, ["reviews.shops", "reviews.riders", "reviews.takal", "reviews.products", "reviews.hidden"]);
  const rule = SERVER_RULES.find((r) => r[0] === "/admin/review-reports");
  assert.ok(rule, "the panel has no copy of the server's rule for reports");
});

test("the three answers, oldest first, and Suspend asks first", () => {
  for (const w of ["Hide review", "Keep it", "Suspend writer", "within <b className=\"text-takal-ink\">24 hours</b>",
                   "Oldest first. The clock turns red after 20 hours."]) {
    assert.ok(REPORTED.includes(w), w);
  }
  assert.match(REPORTED, /onClick=\{\(\) => decide\(r, "hide"\)\}/);
  assert.match(REPORTED, /onClick=\{\(\) => decide\(r, "keep"\)\}/);
  // Suspend never goes straight through - it opens the box that asks.
  assert.match(REPORTED, /onClick=\{\(\) => setAskSuspend\(r\)\}/);
  assert.match(REPORTED, /onConfirm=\{\(\) => askSuspend && decide\(askSuspend, "suspend"\)\}/);
  // The server lists WAITING reports oldest first (nearest Apple's 24 hours) -
  // decided ones newest first - and the page does not re-sort it. (The order
  // is chosen in one line since the 26 Oct review; the check follows that line.)
  assert.match(SERVER_REP, /order = "created_at\.asc,id\.asc" if state == "open" else "created_at\.desc,id\.desc"/);
  assert.match(SERVER_REP, /"select=\*&order=%s&limit=%d" % \(order, limit\)/);
  assert.doesNotMatch(REPORTED, /\.sort\(/);
  // The doors.
  assert.match(API_PEOPLE, /\/admin\/review-reports\?state=/);
  assert.match(API_PEOPLE, /\/admin\/review-reports\/\$\{reportId\}\/decide/);
});

test("the red number on the tab is counted again after every decision", () => {
  assert.match(LAYOUT, /getReviewReports\(\{ state: "open", limit: 1 \}\)/);
  assert.match(LAYOUT, /setReported\(Number\(res\?\.open_count\) \|\| 0\)/);
  assert.match(LAYOUT, /addEventListener\(REPORTS_CHANGED, count\)/);
  assert.match(LAYOUT, /removeEventListener\(REPORTS_CHANGED, count\)/);
  assert.match(REPORTED, /window\.dispatchEvent\(new Event\(REPORTS_CHANGED\)\)/);
});

test("before database update 148 the page says so instead of breaking", () => {
  assert.match(REPORTED, /setSwitchedOn\(res\?\.switched_on !== false\)/);
  assert.ok(REPORTED.includes("database update 148 has not been run"));
});

// ── 208-3: offers only to customers who said yes ────────────────────────────
test("the notifications page says how many customers it really reaches", () => {
  assert.ok(NOTIFY.includes("Goes to"));
  assert.match(NOTIFY, /customers_said_yes/);
  assert.ok(NOTIFY.includes("Customers get nothing yet"));
});

// ── 208-4: a pharmacy's licence ─────────────────────────────────────────────
test("only a pharmacy needs a licence - the same word as the server", () => {
  assert.equal(needsLicence("pharmacy"), true);
  assert.equal(needsLicence(" Pharmacy "), true);
  assert.equal(needsLicence("restaurant"), false);
  assert.equal(needsLicence(null), false);
  assert.match(SERVER_LIC, /PHARMACY_TYPES = frozenset\(\{"pharmacy"\}\)/);
});

test("Create store refuses a pharmacy without all three, like the server", () => {
  assert.deepEqual(missingForNewPharmacy({}), ["Licence number", "Valid until", "Licence photo"]);
  assert.deepEqual(missingForNewPharmacy({
    number: "07-321-0045-118204D", until: "2027-12-31",
    photo: "lic-0123456789abcdef0123456789abcdef.jpg",
  }), []);
  // A path the server would not accept is not a photo.
  assert.deepEqual(missingForNewPharmacy({ number: "abc", until: "2027-12-31", photo: "x.jpg" }), ["Licence photo"]);
  assert.match(SERVER_LIC, /\^lic-\[0-9a-f\]\{32\}\\\.\(jpg\|png\|webp\)\$/);
  assert.ok(CREATE.includes("Required for a pharmacy"));
  assert.match(CREATE, /licence_number: licNumber/);
  assert.match(CREATE, /licence_photo: licPhoto/);
  assert.match(API_STORES, /\/licences\/photo/);
});

test("the Review page checks the licence, and Approve waits for its OK", () => {
  assert.deepEqual(fixedKeysFor(null), REVIEW_SECTIONS.flatMap((s) => s.keys));
  assert.deepEqual(fixedKeysFor({ licence: { needs_licence: true } as any }).slice(-1), ["licence"]);
  assert.ok(reasonsFor("licence").includes("Photo is not clear"));
  // "Mark everything OK" never marks a missing or run-out licence OK.
  assert.equal(licenceMayBeMarkedOk({ licence: { needs_licence: true, state: "missing" } as any }), false);
  assert.equal(licenceMayBeMarkedOk({ licence: { needs_licence: true, state: "expired" } as any }), false);
  assert.equal(licenceMayBeMarkedOk({ licence: { needs_licence: true, state: "waiting" } as any }), true);
  assert.match(REVIEW, /if \(k === "licence" && !licenceMayBeMarkedOk\(data\)\) continue;/);
  assert.match(REVIEW, /const licenceLocked = !!data\?\.licence\?\.needs_licence && marks\.licence\?\.state !== "ok";/);
  assert.ok(REVIEW.includes("Approve stays locked for a pharmacy until the licence is marked OK."));
  assert.match(REVIEW, /\{row\("licence",/);
});

test("live pharmacies without a licence are marked on the list and the store", () => {
  assert.equal(LICENCE_STATE.missing.label, "Licence missing");
  assert.match(LICENCE_STATE.missing.tone, /takal-red/);
  assert.match(LICENCE_STATE.expiring.tone, /takal-orange/);
  assert.match(LIST, /const LICENCE_FLAG = \["missing", "expired", "expiring"\];/);
  assert.match(LIST, /LICENCE_FLAG\.includes\(restaurant\.licence_state\)/);
  assert.match(STORE, /<LicenceChip licence=\{state\.licence \|\| null\}/);
  assert.match(STORE, /<LicenceCard /);
  assert.equal(licenceDate("2027-12-31"), "31 Dec 2027");
});

test("the store card: three things required, OK only with Approve shops", () => {
  assert.match(CARD, /missingForNewPharmacy\(\{ number, until, photo \}\)/);
  assert.match(CARD, /disabled=\{!mayApprove\}/);
  assert.match(STORE, /mayAccess\("stores\.approve", getMyPerms\(\)\)/);
  assert.match(API_STORES, /\/admin\/restaurants\/\$\{restaurantId\}\/licence/);
  // The STORED photo's private path never reaches the panel - a 10-minute
  // link does. (A new upload's path goes straight back to the server.)
  assert.doesNotMatch(CARD, /licence\.licence_photo/);
  assert.match(CARD, /licence\.photo_link/);
  assert.match(SERVER_LIC, /The photo PATH never leaves/);
});
