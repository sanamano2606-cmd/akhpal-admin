/**
 * THE WEBSITE SCREENS AND WHAT THE SERVER ACTUALLY SAVES.
 *
 * Mock 68, approved 14 September 2026. Three screens now change what a stranger
 * reads on the front page of the company.
 *
 * The fault worth guarding against here is the quiet one: a box on the panel
 * whose name the server does not recognise. Nothing errors. The save is
 * reported as successful. The website simply never changes, and the person goes
 * back and types it again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FRONT_PAGE_FIELDS, AREA_FIELDS, LINK_FIELDS, ALL_WEBSITE_FIELDS,
} from "../src/lib/website-fields.ts";
import { NAVIGATION, tabsFor } from "../src/lib/navigation.ts";

const root = join(import.meta.dirname, "..", "..");
const backend = join(root, "swat-delivery-app", "backend");

const settingsModel = readFileSync(join(backend, "routers", "admin_shared.py"), "utf8");
const settingsSave = readFileSync(join(backend, "routers", "admin_settings.py"), "utf8");
const publicReader = readFileSync(join(backend, "routers", "site_settings.py"), "utf8");

test("every box the panel offers is one the server knows about", () => {
  const missing = ALL_WEBSITE_FIELDS
    .map((f) => f.key)
    .filter((k) => !settingsModel.includes(`${k}: Optional[str]`));

  assert.deepEqual(missing, [], `The panel offers these boxes and the server ignores them: ${missing}. ` +
    "The save reports success, the website never changes, and the person types it again.");
});

test("every box the panel offers is one the server actually saves", () => {
  // Not just declared on the model - copied into the write. The settings
  // endpoint copies fields across by hand, and a field on the model that
  // nothing copies is dropped in silence.
  const missing = ALL_WEBSITE_FIELDS
    .map((f) => f.key)
    .filter((k) => !settingsSave.includes(`"${k}"`));

  assert.deepEqual(missing, [], `These are on the server's form but never written: ${missing}`);
});

test("every word the public website can read has a box somewhere in the panel", () => {
  // The other direction. A setting the website reads but nothing can set is a
  // dead column: the site quietly uses its fallback for ever and nobody knows
  // there was supposed to be a way to change it.
  const readByWebsite = [...publicReader.matchAll(/"(site_[a-z_]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(readByWebsite)];
  const offered = new Set(ALL_WEBSITE_FIELDS.map((f) => f.key));

  const unreachable = unique.filter((k) => !offered.has(k));
  assert.deepEqual(unreachable, [], `The website reads these, and no screen can set them: ${unreachable}`);
});

test("the panel's length limits match the server's", () => {
  // The panel checking first is a courtesy, so somebody sees the problem while
  // typing. If the panel allows MORE than the server, that courtesy becomes a
  // trap: the box says the text is fine and the save is then refused.
  for (const f of ALL_WEBSITE_FIELDS) {
    // Links and colours are checked by their SHAPE on the server, not against a
    // length table - "must start with https://", "must be # and six letters".
    // A length row for those would be a second rule that nothing enforces. The
    // test below checks the shape rule is really there.
    if (f.link || f.colour) continue;
    assert.ok(
      settingsSave.includes(`"${f.key}": ${f.max}`),
      `${f.key}: the panel allows ${f.max} characters. The server's limit must say the same, ` +
      `or a person is told their text is fine and then refused.`
    );
  }
});

test("a field checked by shape really is checked on the server", () => {
  // Skipping these above is only safe while the shape check exists. Without
  // this, deleting the check on the server would make the skip into a hole
  // nothing complains about - and this one ends up inside a stylesheet on a
  // public page.
  for (const f of ALL_WEBSITE_FIELDS.filter((x) => x.colour)) {
    assert.match(settingsSave, new RegExp(`payload\\.${f.key}`),
      `${f.key} is never looked at by the save handler`);
    assert.match(settingsSave, /re\.fullmatch\(r"#\(\?:\[0-9a-fA-F\]\{3\}\|\[0-9a-fA-F\]\{6\}\)"/,
      `${f.key} is saved without checking that it is a colour`);
  }

  for (const f of ALL_WEBSITE_FIELDS.filter((x) => x.link)) {
    assert.ok(settingsSave.includes(`"${f.key}"`),
      `${f.key} is never looked at by the save handler`);
  }
  assert.match(settingsSave, /startswith\("https:\/\/"\)/,
    "the server no longer insists that links are https");
});

test("there is exactly one delivery radius, and the Website section does not offer a second", () => {
  // The website reads max_delivery_km - the same number the customer app uses
  // to decide which shops are in range, and the delivery fee uses to set the
  // price. A second "website radius" would let the front page promise 20 km
  // while the app refuses anything past 15.
  const strays = ALL_WEBSITE_FIELDS.filter(
    (f) => f.key.includes("km") || f.key.includes("radius") || /how far/i.test(f.label)
  );
  assert.deepEqual(strays.map((f) => f.key), [],
    "The Website section offers its own delivery radius. There must be exactly one, " +
    "set on Settings > Delivery Fees, so the site cannot promise a distance the app refuses.");
});

test("the Website section is locked behind the permission the server enforces", () => {
  const website = NAVIGATION.find((i) => i.label === "Website");
  assert.ok(website, "the Website line is missing from the sidebar");
  assert.equal(website!.section, "settings",
    "Every Website screen reads and writes /admin/settings, which the server guards with " +
    "'settings'. A gentler permission here is a link that opens a page the server refuses.");

  for (const tab of website!.tabs ?? []) {
    assert.equal(tab.section, "settings", `the ${tab.label} tab asks for the wrong permission`);
    assert.ok(tab.calls.includes("/admin/settings"), `the ${tab.label} tab does not declare what it calls`);
  }
});

test("every Website tab points at a page that exists", () => {
  const tabs = tabsFor("/dashboard/website");
  assert.ok(tabs.length >= 3, "the Website tabs are missing");

  for (const tab of tabs) {
    const rest = tab.href.replace("/dashboard/website", "").replace(/^\//, "");
    const file = rest === ""
      ? join(root, "akhpal-admin", "src", "app", "dashboard", "website", "page.tsx")
      : join(root, "akhpal-admin", "src", "app", "dashboard", "website", rest, "page.tsx");
    assert.doesNotThrow(() => readFileSync(file, "utf8"),
      `the ${tab.label} tab points at ${tab.href}, and there is no page there`);
  }
});

test("no field is offered on two screens at once", () => {
  // Two boxes writing the same column means whichever screen is saved last
  // wins, and the other screen keeps showing a value that is no longer true.
  const keys = ALL_WEBSITE_FIELDS.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, "a field appears on more than one Website screen");
  assert.equal(
    FRONT_PAGE_FIELDS.length + AREA_FIELDS.length + LINK_FIELDS.length,
    ALL_WEBSITE_FIELDS.length
  );
});

test("every field is explained in words a shopkeeper would use", () => {
  for (const f of ALL_WEBSITE_FIELDS) {
    assert.ok(f.hint.trim().length > 15, `${f.key} has no real explanation`);
    assert.ok(!f.label.includes("_"), `${f.key} shows a database column name as its label`);
    assert.ok(f.max > 0, `${f.key} has no length limit`);
  }
});
