/**
 * REVIEWS ARE THEIR OWN DOMAIN NOW, WITH THEIR OWN KEY.
 *
 * Three things this file stops from quietly coming undone.
 *
 *  1. THE KEY. Reviews used to answer to the "restaurants" permission - the
 *     one that also lets a person add, edit and switch off every shop on the
 *     platform. So the only way to let somebody tidy up an abusive review was
 *     to hand them the shops as well. If a future edit puts that back, the
 *     panel will look fine and the permission will be wrong.
 *
 *  2. THE SIDEBAR AND THE SERVER AGREEING. navigation.ts carries a copy of the
 *     server's rules so the two can be compared. A tab asking for one
 *     permission while the server demands another is how a page opens and then
 *     fills with red errors.
 *
 *  3. THE OLD TAB STAYING GONE. Sana asked for it to be removed from
 *     Customers; a tidy-up that "helpfully" puts it back would undo that.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NAVIGATION,
  serverSectionFor,
  serverWouldAllow,
  tabsFor,
  mayAccess,
} from "../src/lib/navigation.ts";
import { ALL_SECTIONS, SECTION_LABELS, SECTION_HINTS } from "../src/lib/perms.ts";

const reviews = NAVIGATION.find((i) => i.label === "Reviews");

test("Reviews has its own line in the sidebar", () => {
  assert.ok(reviews, "the Reviews line is missing from the sidebar");
  assert.equal(reviews!.href, "/dashboard/reviews");
  assert.equal(reviews!.section, "reviews");
});

test("Customers no longer carries a Reviews tab", () => {
  const customerTabs = tabsFor("/dashboard/customers").map((t) => t.label);
  assert.ok(
    !customerTabs.includes("Reviews"),
    `Reviews is back inside Customers: ${customerTabs.join(", ")}`,
  );
});

test("every Reviews tab exists and asks for the reviews permission", () => {
  const tabs = tabsFor("/dashboard/reviews");
  assert.deepEqual(
    tabs.map((t) => t.label),
    ["Shops", "Riders", "Takal", "Products", "Hidden", "Settings"],
  );
  for (const tab of tabs) {
    assert.equal(tab.section, "reviews", `${tab.label} asks for the wrong permission`);
  }
});

test("the server demands the reviews permission for both review addresses", () => {
  assert.equal(serverSectionFor("/admin/reviews"), "reviews");
  assert.equal(serverSectionFor("/admin/reviews/settings"), "reviews");
  assert.equal(serverSectionFor("/admin/reviews/rider-scores"), "reviews");
  assert.equal(serverSectionFor("/admin/product-reviews"), "reviews");
});

test("every address a Reviews tab calls is one this permission actually opens", () => {
  for (const tab of tabsFor("/dashboard/reviews")) {
    for (const call of tab.calls) {
      const needed = serverSectionFor(call.replace(/^write:/, ""),
                                      call.startsWith("write:") ? "write" : "read");
      assert.equal(
        serverWouldAllow(needed, ["reviews"]),
        true,
        `${tab.label} calls ${call}, which the server guards with "${needed}"`,
      );
    }
  }
});

test("holding only the reviews permission opens reviews and nothing else", () => {
  const only = { isSuper: false, sections: ["reviews"] };
  assert.equal(mayAccess(reviews!.section, only), true);
  for (const item of NAVIGATION) {
    if (item.label === "Reviews" || item.label === "Dashboard") continue;
    assert.equal(
      mayAccess(item.section, only),
      false,
      `"${item.label}" opens for somebody who only has the reviews permission`,
    );
  }
});

test("a shops-only sub-admin can no longer reach the reviews", () => {
  // This is the whole point of the change, not a side effect of it.
  assert.equal(serverWouldAllow(serverSectionFor("/admin/reviews"), ["restaurants"]), false);
});

test("the reviews permission is offered on the Admin Users page, with words", () => {
  assert.ok(
    (ALL_SECTIONS as readonly string[]).includes("reviews"),
    "the switch cannot be ticked because the permission is not on the list",
  );
  assert.ok(SECTION_LABELS.reviews, "the switch has no name");
  assert.ok(
    (SECTION_HINTS.reviews || "").length > 40,
    "the switch has no sentence saying what it unlocks",
  );
});
