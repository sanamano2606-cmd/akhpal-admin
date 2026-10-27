// ─────────────────────────────────────────────────────────────────────────────
// AUDIT 23 OCTOBER 2026 - the waiting shops, made easy to work through.
// "New vendors are registering their shops and I am facing difficulties in
// managing them."
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  passesReady, shopPhone, waNumber, waitingOrder, whatIsLeftMessage, whatsappLink,
} from "../src/lib/vendor-queue.ts";

const code = (p: string) => readFileSync(p, "utf8");

const CHECKS = {
  a: { ready: false, days_waiting: 1, what_is_left: ["Add 5 products"] },
  b: { ready: true, days_waiting: 0, what_is_left: [] },
  c: { ready: false, days_waiting: 9, what_is_left: ["Map pin"] },
};

test("the Waiting list: ready shops first, then the one waiting longest, unknown last", () => {
  const stores = [{ id: "a" }, { id: "x" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(waitingOrder(stores, CHECKS).map((s) => s.id), ["b", "c", "a", "x"]);
  assert.deepEqual(stores.map((s) => s.id), ["a", "x", "b", "c"], "the list given is not changed");
});

test("ready / still missing: a shop with no checklist is never hidden as 'ready'", () => {
  assert.equal(passesReady(CHECKS.b, "ready"), true);
  assert.equal(passesReady(CHECKS.a, "ready"), false);
  assert.equal(passesReady(CHECKS.a, "missing"), true);
  assert.equal(passesReady(undefined, "ready"), false);
  assert.equal(passesReady(undefined, "missing"), true);
  assert.equal(passesReady(undefined, "all"), true);
});

test("a Pakistani mobile becomes a WhatsApp number, however it was typed", () => {
  for (const p of ["03001234567", "0300-1234567", "+92 300 1234567", "00923001234567", "3001234567", "۰۳۰۰۱۲۳۴۵۶۷"]) {
    assert.equal(waNumber(p), "923001234567", p);
  }
  assert.equal(waNumber("0912345678"), "", "a landline is not WhatsApp");
  assert.equal(waNumber(""), "");
  assert.equal(waNumber(null), "");
});

test("the message lists what is left, and the link carries it", () => {
  const m = whatIsLeftMessage("Asif Online Medicine", ["Add 5 products", "Put the shop on the map"]);
  assert.match(m, /Asif Online Medicine/);
  assert.match(m, /1\. Add 5 products\n2\. Put the shop on the map/);
  assert.match(whatIsLeftMessage("X", []), /ready/);
  const link = whatsappLink("03001234567", m);
  assert.ok(link.startsWith("https://wa.me/923001234567?text="));
  assert.equal(decodeURIComponent(link.split("text=")[1]), m);
  assert.equal(whatsappLink("", m), "", "no number, no button");
});

test("the shop's phone is read from whichever field the list carries", () => {
  assert.equal(shopPhone({ phone: " 0300 " }), "0300");
  assert.equal(shopPhone({ owner: { phone: "0311" } }), "0311");
  assert.equal(shopPhone({}), "");
  assert.equal(shopPhone(null), "");
});

test("the screens use it: menu count, waiting order, ready filter, WhatsApp", () => {
  const layout = code("src/app/dashboard/layout.tsx");
  assert.match(layout, /useWaitingShopsCount\(\)/);
  assert.match(layout, /data-testid="waiting-shops-count"/);
  const page = code("src/app/dashboard/stores/page.tsx");
  // Mock 211 (27 Oct 2026): the Waiting list opens Newest first, not in the
  // audit's waitingOrder; waitingOrder itself is still tested above.
  assert.match(page, /sortStores\(filteredRestaurants, sortByShown/);
  assert.match(page, /passesReady\(checklists\[String\(r\.id\)\], readyFilter\)/);
  assert.match(page, /WhatsApp what is left/);
});

import { approveAllLabel, approveAllResult } from "../src/lib/vendor-queue.ts";

test("approve all ready: the button's words and the one-line answer", () => {
  assert.equal(approveAllLabel(1), "Approve the 1 ready shop");
  assert.equal(approveAllLabel(4), "Approve all 4 ready");
  assert.deepEqual(approveAllResult(3, []), { text: "3 shops approved", kind: "success" });
  const r = approveAllResult(1, [{ name: "Shah", why: "still missing: logo" }]);
  assert.equal(r.kind, "error");
  assert.equal(r.text, "1 shop approved · not approved: Shah (still missing: logo)");
  const many = approveAllResult(0, ["a", "b", "c", "d", "e"].map((n) => ({ name: n, why: "x" })));
  assert.match(many.text, /and 2 more$/);
});

test("approve all ready is asked first, and only for shops with every check ticked", () => {
  const page = code("src/app/dashboard/stores/page.tsx");
  assert.match(page, /data-approve-all-ready onClick=\{\(\) => setBulkAsk\(true\)\}/);
  assert.match(page, /&& !!checklists\[String\(r\.id\)\]\?\.ready\)/);
  assert.match(page, /approveRestaurant\(String\(r\.id\), false\)/, "never 'anyway' in bulk");
  const shop = code("src/app/dashboard/stores/[id]/page.tsx");
  assert.match(shop, /📞 Call/);
  assert.match(shop, /wa\.me\/\$\{waNumber\(/);
});
