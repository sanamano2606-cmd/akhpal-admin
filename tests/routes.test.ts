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
