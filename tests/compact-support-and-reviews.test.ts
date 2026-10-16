/**
 * MOCK 197 - COMPACT SUPPORT INBOX AND EVERY REVIEWS TAB (Sana 14 Oct 2026:
 * "Now these 2 and all inside of reviews tabs" -> 15 Oct "GO").
 *
 * Measured in a browser on the same fake data at 1536 x 864 (where the content
 * ends): Support 956 -> 444 px, Shops / Takal 976 -> 598, Riders 1,291 -> 841,
 * Products 1,080 -> 738, Questions 544 -> 322, Hidden 472 -> 234, Settings
 * 876 -> 447. Every screen fits one screen; nothing sideways at 1024 / 1280 /
 * 1536. Only placement and spacing changed - these guard that nothing was lost.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../src/app/dashboard/${p}`, import.meta.url), "utf8");
const SUPPORT = read("support/page.tsx");
const ALERTS = read("settings/parts-alerts.tsx");
const SETTINGS_GENERAL = read("settings/page.tsx");
const LAYOUT = read("reviews/layout.tsx");
const LIST = read("reviews/ReviewList.tsx");
const PRODUCTS = read("reviews/products/page.tsx");
const QUESTIONS = read("reviews/questions/page.tsx");
const RIDERS = read("reviews/riders/page.tsx");
const RSETTINGS = read("reviews/settings/page.tsx");
const flat = (s: string) => s.replace(/&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
const calls = (s: string) => {
  const out: Record<string, number> = {};
  for (const m of s.match(/apiClient\.\w+|onClick=/g) ?? []) out[m] = (out[m] ?? 0) + 1;
  return out;
};

test("Support: one header line, the alerts card as one strip, counts and search on one line", () => {
  assert.match(SUPPORT, /<h2 className="text-lg font-bold text-takal-ink">Support Inbox<\/h2>/);
  assert.match(SUPPORT, /<SupportAlerts slim \/>/);
  assert.match(SUPPORT, /\{closed\} closed[\s\S]{0,400}Show all[\s\S]{0,300}<div className="relative ml-auto w-full sm:w-80">/);
  assert.doesNotMatch(SUPPORT, /px-6 py-4/, "rows half as roomy");
  for (const w of ["Messages customers sent to Takal from inside the app.", "Search name, phone or subject",
    "waiting", "answered", "closed", "Show all", "Customer", "Subject", "Order", "Waiting", "Status", "Open",
    "Nobody has written to Takal Support yet.", "No conversation matches what you typed.",
    "The support inbox could not be read"]) assert.ok(flat(SUPPORT).includes(w), w);
  assert.deepEqual(calls(SUPPORT), { "apiClient.getSupportThreads": 1, "onClick=": 8 });
});

test("the slim strip is the SAME card: same state, same buttons, every warning still shown", () => {
  assert.match(ALERTS, /export function SupportAlerts\(\{ slim = false \}: \{ slim\?: boolean \} = \{\}\)/);
  const slim = ALERTS.slice(ALERTS.indexOf("if (slim) {"), ALERTS.indexOf("  return (\n    <Card>"));
  assert.ok(slim.length > 500, "the slim branch is there");
  for (const w of ["Alerts on this device", "Be told the moment a customer writes to support.",
    "nobody is told", "Turn on alerts on this device", "Send a test alert to this device", "Turn off on this device",
    "You will not receive support alerts", "To fix it:", "Try again", "Nobody is being alerted at all.",
    "The server cannot send any alerts.", "being alerted", "This browser cannot show alerts.",
    "The server is not giving out its alert settings."]) assert.ok(flat(slim).includes(w), w);
  // Only those allowed to send a test see the button - in the strip too.
  assert.match(slim, /youWillBeTold !== false && mayTest && \(\s*<Button size="sm" variant="secondary" onClick=\{sendTest\}/);
  // Settings -> General still draws the full card.
  assert.match(SETTINGS_GENERAL, /<SupportAlerts \/>/);
});

test("Reviews: the title and its 7 tabs on one line, the sentence on hover", () => {
  assert.match(LAYOUT, /title="Everything customers say about shops, riders, Takal and products — checked here before anyone else sees it\.">\s*Reviews\s*<\/h1>/);
  assert.match(LAYOUT, /<div className="min-w-0 flex-1"><DomainTabs tabs=\{TABS\} bare \/><\/div>/);
});

test("every list tab: title, sentence (whole on hover), the 4 lists and Refresh on one line", () => {
  assert.match(LIST, /<p className="min-w-0 flex-1 truncate text-sm text-takal-ink-soft" title=\{subtitle\}>\{subtitle\}<\/p>/);
  for (const [name, page] of [["products", PRODUCTS], ["questions", QUESTIONS]] as const) {
    assert.match(page, /<h2 className="shrink-0 text-lg font-bold text-takal-ink">/, name);
    assert.match(page, /className="min-w-0 flex-1 truncate text-sm text-takal-ink-soft"\s+title="/, name);
  }
  // A review's order line and its buttons share one line.
  assert.match(LIST, /<div className="flex gap-2 mt-2 flex-wrap items-center">\s*<p className="text-xs text-takal-ink-soft mr-auto">\s*Order/);
  // Product photos stay big; the buttons sit beside them.
  assert.match(PRODUCTS, /className="w-40 h-40 object-cover rounded-lg/);
  assert.match(PRODUCTS, /<div className="ml-auto flex gap-2 flex-wrap">\s*\{r\.status !== "published"/);
});

test("Riders and Settings: tighter, nothing removed", () => {
  assert.match(RIDERS, /<div data-rider-scores className="bg-white rounded-lg border border-takal-line px-4 py-3">/);
  for (const w of ["Rider scores", "A rider going bad shows up here before anybody complains.", "1–2 star",
    "Nobody has a 1 or 2 star rating yet.", "Reviews of riders", "the old app had one comment box and it belonged to the shop."])
    assert.ok(flat(RIDERS).includes(w), w);
  assert.match(RSETTINGS, /<div className="grid gap-3 lg:grid-cols-3 items-start">\s*<div className="lg:col-span-2 bg-white rounded-lg border border-takal-line px-5">/);
  for (const w of ["Review settings", "Who sees a review, and when.", "waiting for you right now.",
    "Check every review before customers see it", "Let plain 4 and 5 star reviews go straight through",
    "Words that always wait", "Save words", "Two things worth knowing", "Switching the top one off",
    "A star average only moves when you press Approve."]) assert.ok(flat(RSETTINGS).includes(w), w);
});

test("only looks changed: the same server calls and buttons on every tab", () => {
  assert.deepEqual(calls(LIST), { "apiClient.getReviews": 1, "apiClient.setReviewStatus": 1, "apiClient.deleteReview": 1, "onClick=": 6 });
  assert.deepEqual(calls(PRODUCTS), { "apiClient.getProductReviews": 1, "apiClient.setProductReviewStatus": 1, "apiClient.deleteProductReview": 1, "onClick=": 6 });
  assert.deepEqual(calls(QUESTIONS), { "apiClient.getProductQuestions": 1, "apiClient.answerProductQuestion": 1, "apiClient.setProductQuestionHidden": 1, "onClick=": 6 });
  assert.deepEqual(calls(RIDERS), { "apiClient.getRiderReviewScores": 1 });
  assert.deepEqual(calls(RSETTINGS), { "apiClient.getReviewSettings": 1, "apiClient.updateReviewSettings": 1, "onClick=": 2 });
  for (const w of ["Approve", "Hide", "Put back", "Delete", "Delete this review for good?", "Hide is usually the better choice.",
    "Stars only — nothing was written."]) {
    assert.ok(flat(LIST).includes(w), `reviews: ${w}`);
    assert.ok(flat(PRODUCTS).includes(w === "Delete this review for good?" ? "Delete this product review for good?" : w), `products: ${w}`);
  }
  for (const w of ["Answer as Takal", "Change the answer", "Hide from the product page", "Put back", "Takal answered",
    "The shop answered", "Type Takal's answer…"]) assert.ok(flat(QUESTIONS).includes(w), w);
});
