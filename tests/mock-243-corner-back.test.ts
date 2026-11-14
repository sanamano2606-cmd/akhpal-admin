// MOCK 243 (Sana 11 Nov 2026: "Please also Add a second Back button too all
// over the Pages those opens" -> A -> "Approved But tapping this should first
// Take a scrolled page to top then tap again the previous page the the
// previous" -> "Go").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextTrail, hasPreviousPage, cornerStep } from "../src/lib/back-trail.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("one tap = one step: scrolled down -> to the top; at the top -> back", () => {
  assert.equal(cornerStep(2400), "top");
  assert.equal(cornerStep(41), "top");
  assert.equal(cornerStep(0), "back");
  assert.equal(cornerStep(30), "back", "a hair from the top counts as the top");
  const C = code("src/components/CornerBack.tsx");
  assert.match(C, /\(box \|\| window\)\.scrollTo\(\{ top: 0, behavior: "smooth" \}\);\s*return;/, "Top stays on the page");
  // Changed ON PURPOSE (Sana 11 Nov, "not applied to all screens" -> "go"): one
  // button for every screen; a page's list and its "leave?" check come from
  // that page's <CornerBack />.
  assert.match(C, /hasPreviousPage\(readTrail\(\)\) \? router\.back\(\) : rules \? rules\.fallback\(\) : undefined/, "Back = the page before, else the page's list");
  assert.match(C, /if \(rules\?\.leave\) rules\.leave\(go\); else go\(\);/, "a page can ask 'leave without saving?' first");
  assert.match(C, /\{spot\.step === "top" \? "Top" : "Back"\}/, "the words say what the next tap does");
});

test("the trail: forward adds a page, Back takes one off - so tap after tap goes page by page", () => {
  let t: string[] = [];
  for (const p of ["/dashboard/stores", "/dashboard/stores/s1", "/dashboard/stores/s1/review"]) t = nextTrail(t, p);
  assert.deepEqual(t, ["/dashboard/stores", "/dashboard/stores/s1", "/dashboard/stores/s1/review"]);
  assert.equal(hasPreviousPage(t), true);
  t = nextTrail(t, "/dashboard/stores/s1", true);    // tap: back to the shop
  assert.deepEqual(t, ["/dashboard/stores", "/dashboard/stores/s1"]);
  t = nextTrail(t, "/dashboard/stores", true);       // tap again: back to All Stores
  assert.deepEqual(t, ["/dashboard/stores"]);
  assert.equal(hasPreviousPage(t), false, "nothing before it - a list page has no corner button anyway");
  assert.deepEqual(nextTrail(["/a"], "/a"), ["/a"], "the same page twice is not a new step");
  assert.deepEqual(nextTrail([], "/dashboard/customers/c1"), ["/dashboard/customers/c1"]);
  assert.equal(hasPreviousPage(["/dashboard/customers/c1"]), false, "opened from a link: the list instead");
  assert.equal(nextTrail(Array.from({ length: 40 }, (_, i) => "/p" + i), "/x").length, 30, "kept short");
});

test("the panel remembers each page opened in this tab", () => {
  const L = code("src/app/dashboard/layout.tsx");
  assert.match(L, /useEffect\(\(\) => \{ rememberPage\(pathname\); \}, \[pathname\]\);/);
  const T = code("src/lib/back-trail.ts");
  assert.match(T, /sessionStorage\.getItem\(TRAIL_KEY\)/);
  assert.equal((T.match(/try \{/g) || []).length, 2, "every read and write is wrapped");
});

test("on all 7 pages that open from a list - with the same list as the top Back when there is no page before", () => {
  const pages: [string, RegExp][] = [
    ["src/app/dashboard/customers/[id]/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\("\/dashboard\/customers"\)\} \/>/],
    ["src/app/dashboard/riders/[id]/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\("\/dashboard\/riders"\)\} \/>/],
    ["src/app/dashboard/stores/malls/[id]/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\("\/dashboard\/stores\/malls"\)\} \/>/],
    ["src/app/dashboard/stores/[id]/catalogue/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\(backHref\)\} \/>/],
    ["src/app/dashboard/stores/[id]/review/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\(`\/dashboard\/stores\?status=/],
    ["src/app/dashboard/support/[id]/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\("\/dashboard\/support"\)\} \/>/],
    ["src/app/dashboard/stores/[id]/page.tsx", /<CornerBack fallback=\{\(\) => router\.push\(allStoresHref\(\)\)\}\s*leave=\{\(go\) => leaveIfSaved\(\(\) => \{ setDirtyParts\(\{\}\); go\(\); \}\)\} \/>/],
  ];
  for (const [p, re] of pages) assert.match(code(p), re, p);
});

test("it never covers a bar fixed at the bottom; yellow, black on mouse-over", () => {
  const C = code("src/components/CornerBack.tsx");
  assert.match(C, /\[aria-label=\\"Change the ticked products\\"\]\) \[data-corner-back\],/);
  assert.match(code("src/app/dashboard/stores/[id]/parts-products.tsx"), /aria-label="Change the ticked products"/, "the bar it lifts above still has that name");
  assert.match(C, /@media \(max-width:1023px\)\{body:has\(\.fixed\.inset-x-0\.bottom-0\)/);
  assert.match(C, /bg-takal-yellow pl-3 pr-4 text-sm font-bold text-takal-ink shadow-\[0_3px_0_#111\] transition hover:bg-takal-ink hover:text-takal-yellow/);
  assert.match(C, /createPortal\(/);
  // 14 Nov (live check): the room is an empty block after the page, NOT padding
  // on the scroller - padding lifted Commission's Save strip to mid-page.
  assert.doesNotMatch(C, /\[data-panel-scroller\]\{padding-bottom/);
  assert.match(code("src/app/dashboard/layout.tsx"), /<div aria-hidden="true" data-corner-room className="h-\[60px\]" \/>\s*<\/main>/);
  assert.match(C, /body:has\(\[data-lifts-corner\]\) \[data-corner-back\]\{bottom:84px!important\}/);
  assert.match(code("src/app/dashboard/stores/sorting/photo-check/page.tsx"), /<div data-lifts-corner className="sticky bottom-3/, "Photo check's bar lifts it");
});

test("EVERY screen: one button in the panel frame; at the top with nowhere to go it hides", () => {
  const L = code("src/app/dashboard/layout.tsx");
  assert.match(L, /<CornerBackButton \/>\s*<main ref=\{setScroller\} data-panel-scroller/, "drawn once, for every page");
  const C = code("src/components/CornerBack.tsx");
  assert.match(C, /const show = !!spot && !\(spot\.step === "back" && !spot\.canBack\);/);
  assert.match(C, /\{show && spot && <button type="button"/);
  assert.match(C, /const canBack = hasPreviousPage\(trailWith\(path\)\) \|\| !!pageRules;/);
  assert.match(C, /export function CornerBack\(props: PageRules\) \{[\s\S]*?return null;\s*\}/, "a page's <CornerBack /> draws nothing - no second button");
  const pages = ["customers/[id]", "riders/[id]", "stores/malls/[id]", "stores/[id]/catalogue", "stores/[id]/review", "support/[id]", "stores/[id]"];
  for (const p of pages) assert.equal((code(`src/app/dashboard/${p}/page.tsx`).match(/<CornerBack /g) || []).length, 1, p);
});

test("Stores -> Dashboard -> Stores from the left menu is three steps, not a Back", () => {
  let t: string[] = [];
  for (const p of ["/dashboard/stores", "/dashboard", "/dashboard/stores"]) t = nextTrail(t, p);
  assert.deepEqual(t, ["/dashboard/stores", "/dashboard", "/dashboard/stores"]);
  assert.equal(hasPreviousPage(t), true, "Back still shows - it goes to Dashboard");
  assert.deepEqual(nextTrail(t, "/dashboard", true), ["/dashboard/stores", "/dashboard"], "a real Back takes one off");
  const L = code("src/app/dashboard/layout.tsx");
  assert.match(L, /window\.addEventListener\("popstate", noteHistoryMove\);/);
});
