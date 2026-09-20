// Does every sidebar link ask for a permission that actually works?
//
// WHY THIS TEST EXISTS: the sidebar and the server each kept their own idea of
// who may open what, in two different repositories, and they drifted. Three
// links asked for a permission the server does not check for that page, so the
// page opened and then failed. One permission was offered to sub-admins and
// unlocked nothing at all.
//
// Nobody spots that by reading. This test spots it every time.
//
// If this test fails after a change: THE SERVER IS RIGHT. Fix SERVER_RULES in
// navigation.ts only if backend/app_guard.py really changed; otherwise fix the
// link's `section`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAVIGATION,
  GROUP_ORDER,
  SERVER_RULES,
  serverSectionFor,
  serverWouldAllow,
  requiredSections,
  sectionForPath,
  mayAccess,
  visibleNavigation,
} from "../src/lib/navigation.ts";
import { ALL_SECTIONS, SECTION_LABELS, SECTION_HINTS } from "../src/lib/perms.ts";
import { ALL_KEYS, NEW_FORMAT_MARK, OLD_NAME_MEANS, mayOpen } from "../src/lib/tabs.ts";

// Mock 89, step 4: a link asks for a TAB or an OPTION now, not one of the
// fourteen old words. ALL_SECTIONS is still imported because the old words are
// still what every existing ACCOUNT holds - see the test further down.
const KNOWN = ALL_KEYS;

/** Every place you can land: sidebar lines AND the tabs inside them. */
const EVERYWHERE: { label: string; section: any; calls: string[] }[] = [];
for (const item of NAVIGATION) {
  EVERYWHERE.push({ label: item.label, section: item.section, calls: item.calls });
  for (const tab of item.tabs ?? []) {
    EVERYWHERE.push({ label: `${item.label} → ${tab.label}`, section: tab.section, calls: tab.calls });
  }
}

test("every link and tab asks for a permission that really exists", () => {
  for (const item of EVERYWHERE) {
    for (const s of requiredSections(item.section)) {
      assert.ok(KNOWN.has(s), `"${item.label}" asks for unknown permission "${s}"`);
    }
  }
});

test("every one of the fourteen old words still opens the pages it always did", () => {
  // The Admin Users screen no longer OFFERS these - it offers tabs and options
  // (Mock 89, step 3). But every account created before 20 September 2026 still
  // holds them, so each one must still lead somewhere in this menu. The day one
  // stops, somebody signs in to an empty panel.
  //
  // This replaces the old "every permission offered unlocks a page" check,
  // which "notifications" once failed: it had a label, a description and a
  // switch, and no link anywhere used it. The new version of that check lives
  // in the-tabs-and-the-server-agree.test.ts.
  for (const word of Object.keys(OLD_NAME_MEANS)) {
    const opensSomething = EVERYWHERE.some((item) =>
      requiredSections(item.section).some((k) => mayOpen(k, [word])));
    assert.ok(opensSomething,
      `an account holding the old word "${word}" now sees nothing at all`);
  }
});

test("every permission has a label and a plain-English hint", () => {
  for (const s of ALL_SECTIONS) {
    assert.ok(SECTION_LABELS[s], `"${s}" has no label`);
    assert.ok(SECTION_HINTS[s], `"${s}" has no hint`);
  }
});

test("holding a link or tab's permission is enough for every address it calls", () => {
  // THE IMPORTANT ONE. A link you can see but cannot use is worse than no link.
  for (const item of EVERYWHERE) {
    if (item.section === "__super__") continue; // Main Admin passes everything
    const held = requiredSections(item.section);
    for (const raw of item.calls) {
      // An "optional:" address is an extra the page survives without - see the
      // note on `calls` in navigation.ts.
      if (raw.startsWith("optional:")) continue;
      const write = raw.startsWith("write:");
      const path = write ? raw.slice("write:".length) : raw;
      const needed = serverSectionFor(path, write ? "write" : "read");
      assert.ok(
        serverWouldAllow(needed, held),
        `"${item.label}" is shown to [${held.join(", ")}] but the server ` +
          `guards ${write ? "writing " : ""}${path} with ` +
          `[${(Array.isArray(needed) ? needed : [needed]).join(" or ")}]`
      );
    }
  }
});

test("the three known mismatches stay fixed", () => {
  const find = (label: string) => EVERYWHERE.find((i) => i.label.endsWith(label))!;
  assert.deepEqual(find("Audit Log").section, "reports.audit");
  assert.deepEqual(find("Send Notification").section, "marketing.notifications");
  // Payment Methods needed TWO permissions until 20 September 2026, because the
  // page and the switches on it answered to different words. Sana: "Joining
  // them will be good." One key now owns the whole screen.
  assert.deepEqual(find("Payment Methods").section, "payments.methods");
});

test("every link sits in a real group, and no group is empty", () => {
  const groups = new Set<string>([...GROUP_ORDER, "TOP"]);
  for (const item of NAVIGATION) {
    assert.ok(groups.has(item.group), `"${item.label}" is in unknown group "${item.group}"`);
  }
  for (const g of GROUP_ORDER) {
    assert.ok(NAVIGATION.some((i) => i.group === g), `group "${g}" has no links`);
  }
});

test("no two links share an address", () => {
  const seen = new Set<string>();
  for (const item of NAVIGATION) {
    assert.ok(!seen.has(item.href), `two links point at ${item.href}`);
    seen.add(item.href);
  }
});

test("the longest matching address wins, so a tab gets its OWN permission", () => {
  // /dashboard/reports/sales must NOT fall back to its parent's "reports" -
  // the analytics endpoints behind it are guarded by "analytics".
  assert.equal(sectionForPath("/dashboard/reports/sales"), "reports.sales");
  assert.equal(sectionForPath("/dashboard/reports/audit"), "reports.audit");
  // /dashboard/settings/hubs must NOT fall back to the shorter /dashboard/settings
  assert.equal(sectionForPath("/dashboard/settings/hubs"), "settings.general");
  assert.equal(sectionForPath("/dashboard/marketing/notifications"), "marketing.notifications");
  assert.equal(sectionForPath("/dashboard/marketing/welcome"), "marketing.welcome");
  assert.equal(sectionForPath("/dashboard/stores/commission"), "stores.commission");
  assert.equal(sectionForPath("/dashboard/stores/catalogue"), "stores.catalogue");
  assert.equal(sectionForPath("/dashboard/riders/earnings"), "riders.earnings");
  assert.equal(sectionForPath("/dashboard/riders/pay-rules"), "riders.pay-rules");
  // The offices moved out of Settings into Orders, and got their own key with
  // them. Before Mock 89 this line read "settings", which is how changing an
  // office travelled with changing what every rider is paid.
  assert.equal(sectionForPath("/dashboard/orders/offices"), "orders.offices");
  assert.equal(sectionForPath("/dashboard/my-deliveries"), "my-deliveries");
});

test("no two tabs in one domain share an address", () => {
  for (const item of NAVIGATION) {
    const seen = new Set<string>();
    for (const tab of item.tabs ?? []) {
      assert.ok(!seen.has(tab.href), `"${item.label}" has two tabs at ${tab.href}`);
      seen.add(tab.href);
    }
  }
});

test("a domain's first tab is the domain itself, so the tab strip never opens empty", () => {
  for (const item of NAVIGATION) {
    if (!item.tabs || item.tabs.length === 0) continue;
    assert.equal(
      item.tabs[0].href,
      item.href,
      `"${item.label}" — the first tab must be the domain's own address`
    );
  }
});

test("a detail page needs the same permission as its list page", () => {
  assert.equal(sectionForPath("/dashboard/customers/abc-123"), "customers");
  // The rider DETAIL page inherits the rider LIST page, not the sidebar line:
  // a sub-admin holding only Pay Rules has no business on a rider's record.
  assert.equal(sectionForPath("/dashboard/riders/abc-123"), "riders.all");
  assert.equal(sectionForPath("/dashboard/stores/abc-123"), "stores.all");
});

test("a page nobody listed is Main-Admin-only, never wide open", () => {
  assert.equal(sectionForPath("/dashboard/some-new-page-nobody-listed"), "__super__");
});

test("the dashboard itself is open to every signed-in admin", () => {
  assert.equal(sectionForPath("/dashboard"), null);
});

test("a delivery man sees exactly one link and nothing else", () => {
  const perms = { isSuper: false, sections: ["delivery"] };
  const visible = visibleNavigation(perms);
  assert.deepEqual(
    visible.map((i) => i.label),
    ["Dashboard", "My Deliveries"],
    "a delivery man must not see any other part of the panel"
  );
});

test("a page that reads with one permission and writes with another opens for either", () => {
  // CHANGED 4 September 2026. This used to require BOTH, which had the rule
  // backwards: the pay run needs only "payments" to read and to record a
  // payment, so demanding "settings" as well meant the only person who could
  // open the pay run was somebody who could also give themselves a raise.
  //
  // Either permission now opens the page. The raise itself is still guarded -
  // the button is switched off without "settings", and the server refuses it.
  // STAFF PAY is the one left with two keys, and for the original reason:
  // reading the pay run is "Payments -> Staff Pay", changing what somebody is
  // PAID is "Settings -> Staff Pay Rules". Either opens the page; the raise
  // button needs the second, and the server refuses it without one.
  //
  // PAYMENT METHODS no longer needs two - Sana joined them on 20 September 2026.
  const onlyPayments = { isSuper: false, sections: [NEW_FORMAT_MARK, "payments.staff"] };
  const onlySettings = { isSuper: false, sections: [NEW_FORMAT_MARK, "settings.staff-pay"] };
  const neither = { isSuper: false, sections: [NEW_FORMAT_MARK, "orders"] };
  const both = { isSuper: false, sections: [NEW_FORMAT_MARK, "payments.staff", "settings.staff-pay"] };
  const tab = EVERYWHERE.find((i) => i.label.endsWith("Staff Pay"))!;
  assert.ok(tab, "the Staff Pay tab is missing");
  assert.equal(mayAccess(tab.section, onlyPayments), true);
  assert.equal(mayAccess(tab.section, onlySettings), true);
  assert.equal(mayAccess(tab.section, both), true);
  assert.equal(mayAccess(tab.section, neither), false);
  // And the old words still open it, exactly as they did
  assert.equal(mayAccess(tab.section, { isSuper: false, sections: ["payments"] }), true);
  assert.equal(mayAccess(tab.section, { isSuper: false, sections: ["settings"] }), true);
});

test("the sidebar is one line per domain, in the agreed order", () => {
  // THE WHOLE POINT OF THE REBUILD. It was 28 links under six headings.
  //
  // "Earnings" was added on 2 September 2026 at Sana's instruction — "No,
  // Takal Earnings must be a separate tab on the sidebar" — and it earns a
  // line rather than a tab because it answers a different question from
  // everything around it: Payments says WHO DO I OWE, Earnings says WHAT DID
  // I MAKE. Before it existed, two of Takal's four income streams (rider
  // delivery margin and parcel shipping) appeared on no screen at all, and
  // the Dashboard's headline was GMV labelled "Revenue" — Rs 48,392 against
  // Rs 2,615 actually earned.
  assert.deepEqual(
    NAVIGATION.map((i) => i.label),
    [
      // "Support" was added on 10 September 2026 (Plan 52). It sits HIGH, next
      // to Orders and My Deliveries, because it belongs with the things
      // somebody opens first thing in the morning to see who is waiting - not
      // with the reference lists further down. It is deliberately NOT a tab
      // under Customers: it has its own permission, so a support person can be
      // given the inbox without the customer list.
      // "Reviews" was added on 13 September 2026 (Mock 62/63/65). It sits
      // next to Support for the same reason Support sits there: both are
      // queues of things people are waiting on you for, and a queue you do
      // not see first thing is a queue nobody reads. It was a tab under
      // Customers, where it asked for the STORES permission - so the menu
      // said one thing and the lock said another.
      "Dashboard", "Orders", "My Deliveries", "Support", "Reviews", "Customers", "Riders", "Stores",
      "Earnings", "Payments", "Marketing", "Admin Users", "Reports",
      // "Website" was added on 14 September 2026 (Mock 68, approved by Sana:
      // "must be manageable each and everything from admin panel"). It is the
      // wording on the public site at takalapp.com.
      //
      // It sits DOWN HERE, below the divider, because it is not a queue and
      // not a daily job - the products and shops on the website look after
      // themselves, and the words around them change perhaps once a month. It
      // sits next to Settings because it is the same KIND of thing: something
      // you set once and then leave alone.
      //
      // It is not a tab under Settings, because Settings is "things true of
      // the whole system" and a headline is not a system setting - it is a
      // public page. It does share the "settings" permission, which is what
      // the server actually enforces for /admin/settings.
      "Website", "Settings",
      // "Go Live" is last on purpose: it clears the internal-tester data ONCE
      // and then disappears for good. Sana, 2 September 2026: "Keep that in a
      // separate sidebar tab so when I add a sub-admin I can switch that off
      // for sub-admins." Its own line means its own permission, off for every
      // sub-admin by default — inside Settings it would have been handed to
      // anybody ever trusted to change a delivery fee.
      "Go Live",
    ]
  );
});

test("no domain hides more than seven tabs behind it", () => {
  // A tab strip you have to scroll is the sidebar's problem moved sideways.
  for (const item of NAVIGATION) {
    const n = item.tabs?.length ?? 0;
    assert.ok(n <= 7, `"${item.label}" has ${n} tabs — too many to read at a glance`);
  }
});

test("every tab address sits inside its own domain, or is deliberately shared", () => {
  // A tab pointing somewhere else entirely is how a section stops being
  // self-contained. The one exception is Payments → Riders, which points at
  // the Riders section on purpose so there is ONE rider money screen.
  const SHARED = new Set(["/dashboard/riders/earnings"]);
  for (const item of NAVIGATION) {
    for (const tab of item.tabs ?? []) {
      if (SHARED.has(tab.href)) continue;
      assert.ok(
        tab.href === item.href || tab.href.startsWith(item.href + "/"),
        `"${item.label} → ${tab.label}" points outside its own domain (${tab.href})`
      );
    }
  }
});

test("the Main Admin sees every link", () => {
  const superAdmin = { isSuper: true, sections: [] };
  assert.equal(visibleNavigation(superAdmin).length, NAVIGATION.length);
});

test("Admin Users stays Main-Admin-only, whatever a sub-admin is granted", () => {
  const everything = { isSuper: false, sections: [NEW_FORMAT_MARK, ...ALL_KEYS] };
  const labels = visibleNavigation(everything).map((i) => i.label);
  assert.ok(!labels.includes("Admin Users"));
});

test("the server rule list is ordered most-specific-first", () => {
  // The server takes the FIRST match. A short prefix placed above a longer one
  // that starts with it would swallow the longer one and hand out the wrong
  // permission - which is how the parcels staff list nearly went to delivery men.
  for (let i = 0; i < SERVER_RULES.length; i++) {
    for (let j = i + 1; j < SERVER_RULES.length; j++) {
      const [earlier] = SERVER_RULES[i];
      const [later] = SERVER_RULES[j];
      if (later.startsWith(earlier) && later !== earlier) {
        assert.fail(`"${later}" can never match: "${earlier}" above it swallows it`);
      }
    }
  }
});
