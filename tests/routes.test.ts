// Does every link in the sidebar point at a page that actually exists?
//
// WHY THIS TEST EXISTS: the rebuild moved 19 pages. A link left pointing at an
// old address does not fail the build, does not fail the type check, and does
// not fail lint. It fails silently, in front of the operator, as a "page not
// found" — and only on the one screen nobody clicked while testing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NAVIGATION } from "../src/lib/navigation.ts";

/** Every address the app can actually serve, read off the folders on disk. */
function realPages(dir = "src/app", prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...realPages(full, `${prefix}/${name}`));
    } else if (name === "page.tsx") {
      out.push(prefix || "/");
    }
  }
  return out;
}

const PAGES = realPages();

/** Does this address resolve, allowing for [id]-style segments? */
function serves(href: string): boolean {
  if (PAGES.includes(href)) return true;
  return PAGES.some((p) => {
    if (!p.includes("[")) return false;
    const pattern = "^" + p.replace(/\[[^\]]+\]/g, "[^/]+") + "$";
    return new RegExp(pattern).test(href);
  });
}

test("the app really does have pages on disk", () => {
  assert.ok(PAGES.length > 20, `only found ${PAGES.length} pages — is the path right?`);
});

test("every sidebar line points at a page that exists", () => {
  for (const item of NAVIGATION) {
    assert.ok(serves(item.href), `"${item.label}" points at ${item.href}, which has no page`);
  }
});

test("every tab points at a page that exists", () => {
  for (const item of NAVIGATION) {
    for (const tab of item.tabs ?? []) {
      assert.ok(
        serves(tab.href),
        `"${item.label} → ${tab.label}" points at ${tab.href}, which has no page`
      );
    }
  }
});

// Addresses that are deliberately NOT in the sidebar because they only
// redirect somewhere that is. A bookmark, a link in a message, or a second
// browser tab still points at the old address; deleting the page would give
// whoever follows it a "not found" and no idea where the screen went.
const REDIRECTS_ONLY = [
  // Reviews left Customers on 13 September 2026 (Mock 62/63/65).
  "/dashboard/customers/reviews",
];

test("no page is stranded — every page is reachable from the sidebar", () => {
  // A page nothing links to is a page nobody will find. Detail pages are
  // reached by clicking a row, and the public pages are outside the panel.
  const reachable = new Set<string>();
  for (const item of NAVIGATION) {
    reachable.add(item.href);
    for (const tab of item.tabs ?? []) reachable.add(tab.href);
  }
  const stranded = PAGES.filter(
    (p) =>
      p.startsWith("/dashboard") &&
      !p.includes("[") &&           // detail pages: reached from a row
      !REDIRECTS_ONLY.includes(p) && // old addresses that only forward
      !reachable.has(p)
  );
  assert.deepEqual(stranded, [], `these pages are in the sidebar's blind spot: ${stranded.join(", ")}`);
});

test("the Settings page LINKS to every settings page, not just the tab strip", () => {
  // WHY: the tab strip is hidden from an admin who lacks the permission for a
  // tab. That is right — but it briefly left the sign-up switch reachable by
  // ONE route only, and a page with one route is a page somebody cannot find
  // on the day they need it. The sign-up switch in particular is turned off
  // exactly once, in a hurry, while new app builds are on their way to the
  // Play Store. The backend has a release test on this too; this one catches
  // it a week earlier.
  const page = readFileSync("src/app/dashboard/settings/page.tsx", "utf8");
  const code = page
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  for (const href of ["/dashboard/settings/signup-code", "/dashboard/settings/delivery-fees"]) {
    assert.ok(code.includes(href), `the Settings page does not link to ${href}`);
  }
});

// ── THE OLD-ADDRESS LIST MUST NOT SWALLOW A REAL PAGE ──────────────────────
//
// next.config.js keeps a list of moves: "this old address now means that new
// one". It is a good list. It is also the easiest way in this whole project to
// take a working page off the air without breaking a single build.
//
// It happened. Reviews moved OUT of Customers on 13 September 2026 and became
// its own section at /dashboard/reviews - and the old line
//     /dashboard/reviews  ->  /dashboard/customers/reviews
// was still sitting in that list from when the move went the other way. So the
// brand new page could never be opened by anybody: clicking Reviews sent you
// to the old address, the old address sent you back, and the panel sat there
// saying "Taking you there..." for ever. Everything passed - the build, the
// types, the lint, every test in this file - because nothing had ever thought
// to ask whether a redirect was standing on top of a real page.
//
// Sana, 13 September 2026: "The admin panel has still not reviews page
// working."
//
// The rule is one line long: IF THERE IS A PAGE AT AN ADDRESS, NOTHING MAY
// REDIRECT AWAY FROM IT.
test("no redirect stands on top of a page that really exists", () => {
  const config = readFileSync("next.config.js", "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  const offenders: string[] = [];
  const line = /source:\s*"([^"]+)"\s*,\s*destination:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = line.exec(config)) !== null) {
    const [, source, destination] = m;
    // A source with a :id in it is a pattern, not an address.
    if (source.includes(":")) continue;
    if (serves(source)) {
      offenders.push(`${source} has a real page, but is redirected to ${destination}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a redirect is hiding a working page:\n${offenders.join("\n")}`
  );
});

// The other half of the same rule: an old address that forwards must forward
// somewhere that EXISTS. A move that points at nothing is a "page not found"
// with extra steps.
test("every old address in the redirect list leads somewhere real", () => {
  const config = readFileSync("next.config.js", "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  const dead: string[] = [];
  const line = /source:\s*"([^"]+)"\s*,\s*destination:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = line.exec(config)) !== null) {
    const [, source, destination] = m;
    if (destination.includes(":")) continue;
    if (!serves(destination)) dead.push(`${source} -> ${destination}, which has no page`);
  }
  assert.deepEqual(dead, [], `these moves lead nowhere:\n${dead.join("\n")}`);
});
