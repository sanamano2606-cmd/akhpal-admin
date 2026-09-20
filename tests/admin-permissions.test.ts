// THE PERMISSION SCREEN: TABS, AND OPTIONS INSIDE THEM.  (Mock 89, step 3.)
//
// Sana approved Mock 89 on 17 September 2026:
//
//   "the main Admin (ME) has always Access to everything and can do anything.
//    Only the main admin create Sub admin, Sub Admin permission will be By Tabs
//    and then if i want a specific option inside that Tab Only so will give only
//    Access to that specific option inside the TAB. and make sure after i give
//    permission to that option so the sub admin strictly has that permission
//    only. and the sub admin is not allowed to give permission to anyone or
//    himself."
//
// The server already enforces this (step 2, backend/app_guard.py). These checks
// are about the SCREEN: that it hands out the right list, that it reads an old
// account correctly, and that the sidebar does not hide a page somebody is
// entitled to use.
//
// Nothing here is a lock. The lock is on the server. These are the checks that
// stop the screen from lying about what it is giving away.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TABS, ALL_KEYS, TAB_KEYS, OPTION_KEYS, ALWAYS_OPEN, MAIN_ADMIN_ONLY,
  NEW_FORMAT_MARK, OLD_NAME_MEANS, SENSITIVE_KEYS,
  expandPermissions, inPlainWords, isNewFormat, labelOf, mayOpen, tabOf,
  tabState, ticksForSavedList, toNewFormat,
} from "../src/lib/tabs.ts";

const PAGE = readFileSync(
  new URL("../src/app/dashboard/users/page.tsx", import.meta.url), "utf8");

// ── 1. The catalogue itself ────────────────────────────────────────────────

// ONE OPTION IS DELIBERATELY SHOWN IN TWO TABS: Riders -> Earnings & Cash is
// the SAME screen as Payments -> Riders. It keeps its Riders key in both
// places, so whichever tab Sana grants, the server is answering one question
// with one answer. A second key for the same screen is how two tabs end up
// disagreeing about who may open it.
const SHOWN_IN_TWO_TABS = new Set(["riders.earnings"]);

test("every option key begins with its own tab, and no tab is listed twice", () => {
  const seen = new Set<string>();
  for (const t of TABS) {
    assert.equal(seen.has(t.key), false, `${t.key} appears twice`);
    seen.add(t.key);
    for (const o of t.options) {
      if (SHOWN_IN_TWO_TABS.has(o.key)) continue;
      // "riders" must mean the whole Riders tab and nothing else. The landing
      // page is "riders.all". One word meaning both is how a change quietly
      // widens somebody's access.
      assert.equal(tabOf(o.key), t.key,
        `${o.key} is listed under ${t.key} but does not belong to it`);
    }
  }
  // The borrowed one is counted once, because it IS one place
  assert.equal(ALL_KEYS.size,
    TAB_KEYS.length + new Set(OPTION_KEYS).size);
  assert.equal(OPTION_KEYS.length - new Set(OPTION_KEYS).size, SHOWN_IN_TWO_TABS.size,
    "an option is shown in two tabs without being listed as a deliberate one");
});

test("the borrowed screen really is the same screen in both tabs", () => {
  // Granting either tab must open it. If it ever needed two different keys,
  // one of the two tabs would show a link that refuses the person.
  assert.equal(mayOpen("riders.earnings", [NEW_FORMAT_MARK, "riders"]), true);
  assert.equal(mayOpen("riders.earnings", [NEW_FORMAT_MARK, "payments"]), true);
});

test("the tabs match the sidebar Sana sees", () => {
  assert.equal(TAB_KEYS.length, 16);
  assert.equal(OPTION_KEYS.length, 40);
  for (const must of ["dashboard", "orders", "stores", "payments", "users"]) {
    assert.ok(TAB_KEYS.includes(must), `the ${must} tab is missing`);
  }
});

test("a key is always shown in the words on the screen", () => {
  assert.equal(labelOf("stores.inventory"), "Stores → Inventory");
  assert.equal(labelOf("orders"), "Orders");
  // Never the raw word, which means nothing to the person reading it
  for (const k of OPTION_KEYS) assert.ok(labelOf(k).includes("→"), k);
});

// ── 2. Sana's four rules ───────────────────────────────────────────────────

test("RULE 1 — the Main Admin opens everything", () => {
  for (const k of ALL_KEYS) assert.equal(mayOpen(k, [], true), true, k);
});

test("RULE 2 — Admin Users can never be given away", () => {
  // Written straight into the list, as if somebody edited the database by hand
  assert.equal(mayOpen("users", [NEW_FORMAT_MARK, "users"]), false);
  assert.equal(expandPermissions([NEW_FORMAT_MARK, "users"]).has("users"), false);
  assert.equal(toNewFormat(["users", "orders"]).includes("users"), false);
  assert.deepEqual(MAIN_ADMIN_ONLY, ["users"]);
});

test("RULE 3 — one option means that option and nothing else", () => {
  const only = [NEW_FORMAT_MARK, "stores.inventory"];
  assert.equal(mayOpen("stores.inventory", only), true);
  for (const shut of ["stores", "stores.all", "stores.catalogue",
                      "stores.commission", "stores.reliability", "orders"]) {
    assert.equal(mayOpen(shut, only), false, `${shut} opened as well`);
  }
});

test("RULE 4 — a tab carries every option in it, including new ones", () => {
  const wholeTab = [NEW_FORMAT_MARK, "stores"];
  for (const o of TABS.find((t) => t.key === "stores")!.options) {
    assert.equal(mayOpen(o.key, wholeTab), true, o.key);
  }
  // Sana, approving: "the admin panel is updating time to tim so the next new
  // tabs will be also added later if any."
  const stores = TABS.find((t) => t.key === "stores")!;
  stores.options.push({ key: "stores.brand-new", label: "Brand New" });
  try {
    assert.equal(mayOpen("stores.brand-new", wholeTab), true,
      "an option added later must be carried by the tab, with nothing to remember");
    assert.equal(mayOpen("stores.brand-new", [NEW_FORMAT_MARK, "stores.inventory"]), false);
  } finally {
    stores.options.pop();
  }
});

test("the Dashboard is always on, and is not a way in", () => {
  assert.deepEqual(ALWAYS_OPEN, ["dashboard"]);
  assert.equal(mayOpen("dashboard", []), true);
  // and it cannot be saved, because it is not something to give
  assert.equal(toNewFormat(["dashboard"]).length, 1);
});

test("an empty list opens nothing but the Dashboard", () => {
  const mine = expandPermissions([]);
  assert.deepEqual([...mine], ["dashboard"]);
});

// ── 3. What gets SAVED ─────────────────────────────────────────────────────

test("a saved list always says it is a new one", () => {
  const saved = toNewFormat(["orders", "stores.inventory"]);
  assert.equal(saved[0], NEW_FORMAT_MARK);
  assert.equal(isNewFormat(saved), true);
  assert.deepEqual(saved, [NEW_FORMAT_MARK, "orders", "stores.inventory"]);
});

test("WITHOUT the marker, the same words mean the OLD thing", () => {
  // Eight old words are also new tab keys. "riders" alone cannot say which it
  // is, so the list says. This is the whole reason the marker exists.
  assert.equal(mayOpen("riders.pay-rules", [NEW_FORMAT_MARK, "riders"]), true,
    "the new list means the whole Riders tab, which includes rider pay");
  assert.equal(mayOpen("riders.pay-rules", ["riders"]), false,
    "the old word only ever meant All Riders, one page");
  assert.equal(mayOpen("riders.all", ["riders"]), true);
});

test("a made-up word is never saved and never opens anything", () => {
  assert.deepEqual(toNewFormat(["not_a_real_key"]), [NEW_FORMAT_MARK]);
  assert.equal(mayOpen("orders", [NEW_FORMAT_MARK, "not_a_real_key"]), false);
});

// ── 4. Opening an account that was saved the OLD way ───────────────────────

test("an old account shows the EXACT places it opens, never the whole tab", () => {
  // "restaurants" opened All Stores, Inventory and Reliability - but never
  // Catalogue or Commission. Ticking the whole Stores tab would hand this
  // person two things they have never had.
  const ticks = ticksForSavedList(["restaurants"]);
  assert.deepEqual([...ticks].sort(),
    ["stores.all", "stores.inventory", "stores.reliability"]);
  assert.equal(ticks.has("stores"), false, "the whole tab must NOT be ticked");
  assert.equal(ticks.has("stores.commission"), false);
});

test("the skeleton key is shown for what it really was", () => {
  // This is the point of the whole change: "settings" was one tick that opened
  // fifteen places in seven tabs. Now Sana can see them and untick the ones she
  // never meant to give.
  // FOURTEEN, not the fifteen it was on 17 September: the payment switches
  // moved to the Payments tab on 20 September at Sana's instruction
  // ("Joining them will be good"), so the settings key no longer carries them.
  const ticks = ticksForSavedList(["settings"]);
  assert.equal(ticks.size, 14, `${ticks.size} places shown, not 14`);
  assert.equal(ticks.has("payments.methods"), false,
    "the payment switches were moved to the Payments tab and must not come back");
  assert.ok(ticks.has("riders.pay-rules"), "rider pay travelled with settings");
  assert.ok(ticks.has("stores.commission"));
  assert.ok(ticks.has("settings.letterhead"));
  assert.equal(ticks.has("settings"), false, "the whole tab must NOT be ticked");
});

test("a new account is shown exactly what was saved", () => {
  const ticks = ticksForSavedList([NEW_FORMAT_MARK, "orders", "stores.inventory"]);
  assert.deepEqual([...ticks].sort(), ["orders", "stores.inventory"]);
});

test("re-saving an untouched old account changes nothing about what it opens", () => {
  // Open Shafiq, press Save without touching a switch: he must still open the
  // parcels desk and still nothing else.
  for (const oldWord of Object.keys(OLD_NAME_MEANS)) {
    const before = expandPermissions([oldWord]);
    const after = expandPermissions(toNewFormat(ticksForSavedList([oldWord])));
    assert.deepEqual([...after].sort(), [...before].sort(),
      `re-saving "${oldWord}" changed what it opens`);
  }
});

// ── 5. What the screen says ────────────────────────────────────────────────

test("the chip on each tab says which of the three states it is in", () => {
  const stores = TABS.find((t) => t.key === "stores")!;
  assert.deepEqual(tabState(stores, new Set(["stores"])),
    { whole: true, chosen: 0, total: 5 });
  assert.deepEqual(tabState(stores, new Set(["stores.inventory"])),
    { whole: false, chosen: 1, total: 5 });
  assert.deepEqual(tabState(stores, new Set()),
    { whole: false, chosen: 0, total: 5 });
});

test("the plain-words line reads like the mock", () => {
  const words = inPlainWords(new Set(["orders", "stores.inventory", "my-deliveries"]));
  assert.deepEqual(words,
    ["Dashboard", "the whole Orders tab", "My Deliveries", "Stores → Inventory"]);
});

test("the money and system switches are marked sensitive", () => {
  for (const k of ["payments", "settings", "go-live", "riders.pay-rules",
                   "stores.commission"]) {
    assert.ok(SENSITIVE_KEYS.includes(k), `${k} is not marked sensitive`);
  }
});

// ── 6. The screen itself, read as text ─────────────────────────────────────

test("both the create form and the edit panel use the new picker", () => {
  const uses = PAGE.match(/<TabPermissions/g) || [];
  assert.equal(uses.length, 2,
    "the new picker must be on BOTH the create form and the edit panel");
  assert.equal(PAGE.includes("PermSwitches"), false, "the old grid is still there");
  assert.equal(PAGE.includes("ALL_SECTIONS"), false,
    "the page still offers the fourteen old words");
});

test("what the screen saves is always a new-style list", () => {
  const saves = PAGE.match(/toNewFormat\(/g) || [];
  assert.equal(saves.length, 2, "create and edit must both save the new way");
  // and never a hand-built array, which would lose the marker
  assert.equal(/permissions = .*filter\(/.test(PAGE), false);
});

test("the Admin Users row has no switch at all", () => {
  // Not a switch that is disabled - none. This is what stops a sub-admin
  // giving permission to anybody, including himself.
  assert.ok(PAGE.includes("MAIN_ADMIN_ONLY.includes(tab.key)"));
  assert.ok(PAGE.includes("Main Admin only"));
});

test("an old account is told it is an old account", () => {
  assert.ok(PAGE.includes("oldStyle"));
  assert.ok(PAGE.includes("saved before tabs and options existed"));
});

// ── 7. The sidebar must not hide a page somebody may use ───────────────────

test("a person given one option still sees that part of the menu", async () => {
  // perms.ts reads the browser. Give it one.
  const store: Record<string, string> = {
    admin_user: JSON.stringify({
      is_super_admin: false,
      permissions: [NEW_FORMAT_MARK, "stores.inventory"],
    }),
  };
  (globalThis as any).window = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null };
  try {
    const { canAccess } = await import("../src/lib/perms.ts");
    // Since step 4 navigation.ts names the real key, so this is now the same
    // question the server answers - no guessing left in it.
    assert.equal(canAccess("stores.inventory"), true,
      "the stock page was hidden from the person who was given it");
    assert.equal(canAccess("stores"), false, "one option is not the whole tab");
    assert.equal(canAccess("stores.commission"), false, "a page appeared that should not");
    assert.equal(canAccess("payments.balances"), false);
  } finally {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
});

test("an OLD saved list still works exactly as it did", async () => {
  const store: Record<string, string> = {
    admin_user: JSON.stringify({ is_super_admin: false, permissions: ["delivery"] }),
  };
  (globalThis as any).window = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null };
  try {
    const { canAccess } = await import("../src/lib/perms.ts");
    // The account still holds the old word "delivery"; the menu now asks for
    // the key "my-deliveries". mayOpen() is what joins the two, and this is the
    // check that it really does.
    assert.equal(canAccess("my-deliveries"), true,
      "a sub-admin saved the old way lost the one page he has");
    assert.equal(canAccess("orders.all"), false);
    assert.equal(canAccess("orders"), false);
  } finally {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
});
