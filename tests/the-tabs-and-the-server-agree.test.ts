// THE PANEL AND THE SERVER MUST NOT DRIFT APART.  (Mock 89, step 4 of 5.)
//
// There are now THREE lists of who may open what:
//
//   backend/core_tabs.py       the catalogue: 16 tabs, the options inside them
//   backend/app_guard.py       the lock: which permission each address needs
//   akhpal-admin/src/lib/      the panel's copies of both, used to draw the
//     tabs.ts, navigation.ts   permission screen and the sidebar
//
// The server is the only one that actually refuses a request. The other two
// exist so the screen can be drawn. That is exactly the shape of problem that
// has already bitten this project twice: the panel and the server each kept
// their own idea of a permission, they drifted, and three links opened pages
// the server then refused.
//
// So this file READS THE PYTHON FILES AS TEXT and fails the moment they stop
// agreeing. It is the test Sana was promised when she approved Mock 89 and
// added: "the admin panel is updating time to tim so the next new tabs will be
// also added later if any."
//
// IF THIS TEST FAILS: THE SERVER IS RIGHT. Bring the change across to the panel
// - never the other way round.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TABS, ALL_KEYS, TAB_KEYS, ALWAYS_OPEN, MAIN_ADMIN_ONLY, NEW_FORMAT_MARK,
  mayOpen,
} from "../src/lib/tabs.ts";
import {
  NAVIGATION, SERVER_RULES, SUPER_ONLY, requiredSections,
  serverSectionFor, serverWouldAllow, visibleNavigation,
} from "../src/lib/navigation.ts";

// ── Reading the server's own files ─────────────────────────────────────────

function serverFile(name: string): string {
  const url = new URL(`../../swat-delivery-app/backend/${name}`, import.meta.url);
  try {
    return readFileSync(url, "utf8");
  } catch {
    assert.fail(
      `Could not read backend/${name}. This test compares the panel against the ` +
      `SERVER's own files, so it must be run from inside the project folder ` +
      `with the backend beside akhpal-admin.`);
  }
}

const CORE_TABS = serverFile("core_tabs.py");
const APP_GUARD = serverFile("app_guard.py");

/** Every key the server's catalogue defines: ("key", "Label", [...]) */
function serverKeys(): Set<string> {
  const out = new Set<string>();
  const body = withoutComments(CORE_TABS.split("TABS = [")[1].split("\n]")[0]);
  for (const m of body.matchAll(/\("([a-z0-9.-]+)",\s*"/g)) out.add(m[1]);
  return out;
}

/** The server's address table, read the same way the server reads it. */
function serverRulesFromPython(): [string, string[], string?][] {
  const body = withoutComments(APP_GUARD.split("_SECTION_RULES = [")[1].split("\n]")[0]);
  const out: [string, string[], string?][] = [];
  // Each rule is ("/admin/...", "key" | ("a","b"), optional method tuple)
  const rule = /\(\s*"(\/admin\/[^"]*)"\s*,\s*(\([^)]*\)|"[^"]*")\s*(?:,\s*\(([^)]*)\))?\s*\)/g;
  for (const m of body.matchAll(rule)) {
    const keys = [...m[2].matchAll(/"([^"]+)"/g)].map((k) => k[1]);
    if (keys[0] === "__skip__") continue;     // the panel never calls these
    const methods = m[3] ? [...m[3].matchAll(/"([A-Z]+)"/g)].map((k) => k[1]) : null;
    const mode = methods
      ? (methods.includes("POST") ? "write" : "read")
      : undefined;
    out.push([m[1], keys, mode]);
  }
  return out;
}

// ── 1. The catalogue ───────────────────────────────────────────────────────

test("the panel knows every tab and option the server knows", () => {
  const server = serverKeys();
  const missing = [...server].filter((k) => !ALL_KEYS.has(k));
  assert.deepEqual(missing, [],
    `The server has tabs or options the panel has never heard of: ${missing}. ` +
    `Somebody added them to core_tabs.py without bringing them across to ` +
    `src/lib/tabs.ts, so Sana cannot give them to anybody.`);
});

test("the panel invents nothing the server does not have", () => {
  const server = serverKeys();
  const extra = [...ALL_KEYS].filter((k) => !server.has(k));
  assert.deepEqual(extra, [],
    `The panel offers permissions the server has never heard of: ${extra}. ` +
    `Ticking one of those would look like it worked and do nothing.`);
});

test("the two files agree on what is always open and what is never granted", () => {
  assert.ok(CORE_TABS.includes('ALWAYS_OPEN = frozenset({"dashboard"})'),
    "the server no longer says the Dashboard is always open");
  assert.ok(CORE_TABS.includes('MAIN_ADMIN_ONLY = frozenset({"users"})'),
    "the server no longer says Admin Users is Main-Admin-only");
  assert.deepEqual(ALWAYS_OPEN, ["dashboard"]);
  assert.deepEqual(MAIN_ADMIN_ONLY, ["users"]);
});

test("both files use the same marker for a new-style list", () => {
  assert.ok(CORE_TABS.includes(`NEW_FORMAT_MARK = "${NEW_FORMAT_MARK}"`),
    `The server's marker is not "${NEW_FORMAT_MARK}". If these two ever differ, ` +
    `every new-style list would be read as a list of the fourteen old words ` +
    `and everybody's access would change at once.`);
});

/** The python with its comments taken out.
 *
 *  A comment is prose, not code. This test read one as data once: the note
 *  explaining that the payment switches had MOVED still contained the words
 *  "payments.methods", and the test believed the server still granted it.
 *  A check that reads comments is a check that can be fooled by a sentence. */
function withoutComments(py: string): string {
  return py.split("\n").map((line) => {
    let out = "", quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) { out += c; if (c === quote && line[i - 1] !== "\\") quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; out += c; continue; }
      if (c === "#") break;
      out += c;
    }
    return out;
  }).join("\n");
}

test("the fourteen old words mean the same thing on both sides", () => {
  const body = withoutComments(CORE_TABS.split("OLD_NAME_MEANS = {")[1].split("\n}")[0]);
  const server: Record<string, string[]> = {};
  for (const m of body.matchAll(/"([a-z_]+)":\s*\[([^\]]*)\]/g)) {
    server[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((k) => k[1]);
  }
  assert.ok(Object.keys(server).length >= 14, "could not read the old-name map");
  // Checked through mayOpen rather than by comparing the two lists, because
  // what matters is the ANSWER: does an old account open the same places?
  for (const [word, keys] of Object.entries(server)) {
    for (const k of keys) {
      assert.equal(mayOpen(k, [word]), true,
        `the server says "${word}" opens ${k}; the panel says it does not`);
    }
  }
});

test("THE TEST THAT TESTS THE TEST — drift really is noticed", () => {
  // A drift-checker that has never been shown to fail is a decoration. So:
  // pretend somebody added an option to the server and forgot the panel, and
  // pretend somebody changed a rule on the server only. Both must be caught.
  const pretendCatalogue = `TABS = [
    ("stores", "Stores", [
        ("stores.brand-new", "Brand New", ["/admin/whatever"]),
    ]),
]`;
  const body = withoutComments(pretendCatalogue.split("TABS = [")[1].split("\n]")[0]);
  const found = new Set([...body.matchAll(/\("([a-z0-9.-]+)",\s*"/g)].map((m) => m[1]));
  assert.ok(found.has("stores.brand-new"));
  assert.equal(ALL_KEYS.has("stores.brand-new"), false,
    "the panel would have to be missing it for the check to mean anything");

  const pretendGuard = `_SECTION_RULES = [
    ("/admin/low-stock", "stores.commission"),
]`;
  const rules = withoutComments(pretendGuard.split("_SECTION_RULES = [")[1].split("\n]")[0]);
  const m = [...rules.matchAll(/\(\s*"(\/admin\/[^"]*)"\s*,\s*"([^"]*)"\s*\)/g)];
  assert.equal(m.length, 1);
  const panelSaysNow = SERVER_RULES.find(([p]) => p === "/admin/low-stock")![1];
  assert.notDeepEqual(panelSaysNow, m[0][2],
    "the comparison must notice a rule the server changed on its own");
});

// ── 2. The address table ───────────────────────────────────────────────────

test("the panel's copy of the server rules is the server's rules", () => {
  // THE ONE THAT WOULD HAVE CAUGHT THE LAST THREE MISMATCHES.
  const server = serverRulesFromPython();
  const panel = SERVER_RULES.map(([p, sec, mode]) =>
    [p, Array.isArray(sec) ? sec : [sec], mode] as [string, string[], string?]);
  assert.equal(panel.length, server.length,
    `the panel lists ${panel.length} server rules, the server has ${server.length}`);
  for (let i = 0; i < server.length; i++) {
    assert.deepEqual(panel[i], server[i],
      `rule ${i + 1} differs.\n  server: ${JSON.stringify(server[i])}\n` +
      `  panel:  ${JSON.stringify(panel[i])}\n` +
      `THE SERVER IS RIGHT — bring its line across.`);
  }
});

test("every rule names a permission that exists", () => {
  const special = new Set(["__any__", "__super__"]);
  for (const [path, sec] of SERVER_RULES) {
    for (const k of (Array.isArray(sec) ? sec : [sec])) {
      assert.ok(special.has(k) || ALL_KEYS.has(k),
        `the rule for ${path} names "${k}", which is not a tab or an option`);
    }
  }
});

// ── 3. The sidebar ─────────────────────────────────────────────────────────

const EVERYWHERE: { label: string; section: any; calls: string[] }[] = [];
for (const item of NAVIGATION) {
  EVERYWHERE.push({ label: item.label, section: item.section, calls: item.calls });
  for (const tab of item.tabs ?? []) {
    EVERYWHERE.push({ label: `${item.label} → ${tab.label}`, section: tab.section, calls: tab.calls });
  }
}

test("every link and tab asks for a tab or an option that exists", () => {
  for (const item of EVERYWHERE) {
    for (const s of requiredSections(item.section)) {
      assert.ok(ALL_KEYS.has(s),
        `"${item.label}" asks for "${s}", which is not in the catalogue`);
    }
  }
});

test("every option Sana can hand out actually opens something", () => {
  // A switch that unlocks nothing is a promise the panel does not keep.
  // "notifications" was exactly that once: a label, a hint, a switch, no page.
  const used = new Set<string>();
  for (const item of EVERYWHERE) requiredSections(item.section).forEach((s) => used.add(s));
  const orphans = [...ALL_KEYS].filter(
    (k) => !used.has(k) && !ALWAYS_OPEN.includes(k) && !MAIN_ADMIN_ONLY.includes(k)
           && !TAB_KEYS.includes(k));
  assert.deepEqual(orphans, [],
    `these options can be switched on and open no page: ${orphans}`);
});

test("holding a link's permission is enough for every address it calls", () => {
  // THE IMPORTANT ONE. A link you can see but cannot use is worse than no link.
  for (const item of EVERYWHERE) {
    if (item.section === SUPER_ONLY) continue;       // Main Admin passes everything
    const held = requiredSections(item.section);
    for (const raw of item.calls) {
      // An "optional:" address is one the page survives without - see the note
      // in navigation.ts. Demanding it would hide a whole page over an extra.
      if (raw.startsWith("optional:")) continue;
      const write = raw.startsWith("write:");
      const path = write ? raw.slice("write:".length) : raw;
      const needed = serverSectionFor(path, write ? "write" : "read");
      assert.ok(
        serverWouldAllow(needed, held),
        `"${item.label}" is shown to [${held.join(", ")}] but the server guards ` +
        `${write ? "writing " : ""}${path} with ` +
        `[${(Array.isArray(needed) ? needed : [needed]).join(" or ")}]`);
    }
  }
});

test("an optional address really is optional", () => {
  // It must NOT be one of the keys the link is shown for. If it were, marking
  // it optional would be hiding a requirement rather than describing an extra.
  for (const item of EVERYWHERE) {
    for (const raw of item.calls) {
      if (!raw.startsWith("optional:")) continue;
      const needed = serverSectionFor(raw.slice("optional:".length));
      const held = requiredSections(item.section);
      assert.equal(serverWouldAllow(needed, held), false,
        `"${item.label}" marks ${raw} optional, but its own permission already ` +
        `covers it - so the mark is hiding nothing and should come off`);
    }
  }
});

// ── 4. What a real person sees ─────────────────────────────────────────────

test("somebody given ONE option still sees the line that leads to it", () => {
  // The trap this step was built to close. The server would let this person
  // into the stock page; if the sidebar hid Stores, they could never find it.
  const perms = { isSuper: false, sections: [NEW_FORMAT_MARK, "stores.inventory"] };
  const labels = visibleNavigation(perms).map((i) => i.label);
  assert.deepEqual(labels, ["Dashboard", "Stores"]);
});

test("...and only the tab they were given, inside it", () => {
  const perms = { isSuper: false, sections: [NEW_FORMAT_MARK, "stores.inventory"] };
  const stores = NAVIGATION.find((i) => i.label === "Stores")!;
  const tabs = (stores.tabs ?? []).filter((t) =>
    requiredSections(t.section).some((s) => mayOpen(s, perms.sections)));
  assert.deepEqual(tabs.map((t) => t.label), ["Inventory"]);
});

test("the whole tab shows every tab inside it", () => {
  const perms = { isSuper: false, sections: [NEW_FORMAT_MARK, "stores"] };
  const stores = NAVIGATION.find((i) => i.label === "Stores")!;
  const tabs = (stores.tabs ?? []).filter((t) =>
    requiredSections(t.section).some((s) => mayOpen(s, perms.sections)));
  assert.equal(tabs.length, stores.tabs!.length);
});

test("an OLD account sees exactly the menu it saw before", () => {
  // Shafiq, the only sub-admin on the live site
  const shafiq = { isSuper: false, sections: ["delivery"] };
  assert.deepEqual(visibleNavigation(shafiq).map((i) => i.label),
    ["Dashboard", "My Deliveries"]);
  // and the old skeleton key still opens its seven tabs' worth of screens
  const old = { isSuper: false, sections: ["settings"] };
  const labels = visibleNavigation(old).map((i) => i.label);
  for (const must of ["Orders", "Riders", "Stores", "Marketing", "Website", "Settings"]) {
    assert.ok(labels.includes(must), `an old settings admin lost the ${must} menu`);
  }
});

test("Admin Users stays Main-Admin-only, whatever anybody is granted", () => {
  const everything = { isSuper: false, sections: [NEW_FORMAT_MARK, ...ALL_KEYS] };
  const labels = visibleNavigation(everything).map((i) => i.label);
  assert.ok(!labels.includes("Admin Users"));
});

test("the Main Admin still sees every line", () => {
  assert.equal(visibleNavigation({ isSuper: true, sections: [] }).length, NAVIGATION.length);
});
