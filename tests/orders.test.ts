// THE ORDERS PAGE — the faults the 2 September 2026 audit found, held shut.
//
// Every check here is one line of ORDERS-AUDIT.md. If one of them ever goes
// red, that fault has come back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ORDER_STATUS,
  ORDER_STATUS_ORDER,
  orderStatusLabel,
} from "../src/components/ui/theme.ts";

/** A file with its comments taken out.
 *
 * These checks are about what the CODE does. A comment explaining that
 * `window.prompt` used to be here, or that "Cooking" was once offered as a
 * status, must not read as the fault coming back - or the honest note gets
 * deleted to make the test pass, which is the wrong way round. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

const ORDERS = code("src/app/dashboard/orders/page.tsx");
const PANEL = code("src/app/dashboard/orders/parts-order-panel.tsx");
const DIALOGS = code("src/app/dashboard/orders/parts-order-dialogs.tsx");
const RETURNS = code("src/app/dashboard/orders/returns/page.tsx");
const RETURN_DIALOG = code("src/app/dashboard/orders/returns/parts-return-dialog.tsx");
const OFFICES = code("src/app/dashboard/orders/offices/page.tsx");
const PARCELS = code("src/app/dashboard/orders/parcels/page.tsx");
const API = code("src/lib/api-orders.ts");
const SLIP = code("src/app/dashboard/orders/parts-order-slip.tsx");
const SLIP_RAW = readFileSync(
  "src/app/dashboard/orders/parts-order-slip.tsx",
  "utf8",
);
const MAP = code("src/app/dashboard/orders/parts-order-map.tsx");
// The backend is the only place the status rules actually live.
const FLOW = readFileSync(
  "../swat-delivery-app/backend/core_orders.py",
  "utf8",
);
const DESK = readFileSync(
  "../swat-delivery-app/backend/routers/orders_desk.py",
  "utf8",
);

/* ── THE STATUSES ────────────────────────────────────────────────────────── */

test("the panel knows exactly the statuses the backend has, and no others", () => {
  // THE fault that started the audit. The dropdown offered "Cooking" and
  // "Delivering" - words this system has never used - so choosing either
  // showed an empty page for ever, and seven statuses that DO exist were
  // missing altogether. On the real 34 test orders, five orders could not be
  // found by any filter on the page.
  const fromBackend = new Set<string>();
  const flowBlock = FLOW.slice(
    FLOW.indexOf("ORDER_STATUS_FLOW: Dict[str, set] = {"),
    FLOW.indexOf("#: Once an order reaches one of these it is finished"),
  );
  for (const m of flowBlock.matchAll(/"([a-z_]+)"/g)) fromBackend.add(m[1]);
  const terminal = FLOW.slice(FLOW.indexOf("TERMINAL_ORDER_STATUSES = {"));
  for (const m of terminal.slice(0, 120).matchAll(/"([a-z_]+)"/g)) {
    fromBackend.add(m[1]);
  }

  assert.ok(fromBackend.size >= 10, "the backend statuses were not read properly");

  const invented = ORDER_STATUS_ORDER.filter((s) => !fromBackend.has(s));
  assert.deepEqual(
    invented,
    [],
    `the panel offers statuses the system has never used: ${invented.join(", ")}`,
  );

  const missing = [...fromBackend].filter((s) => !ORDER_STATUS[s]);
  assert.deepEqual(
    missing,
    [],
    `these real statuses cannot be filtered or shown: ${missing.join(", ")}`,
  );
});

test("no status that does not exist can be chosen from the dropdown", () => {
  // The dropdown is built from ORDER_STATUS_ORDER, so nothing can be typed
  // into it by hand. This is the check that it STAYS built that way.
  assert.ok(
    ORDERS.includes("ORDER_STATUS_ORDER.map"),
    "the status dropdown is being written out by hand again - that is how " +
      '"Cooking" and "Delivering" got in, and neither is a real status',
  );
  // A chip may still be LABELLED "Cooking" - it asks the server for the
  // `cooking` queue, which really means accepted-or-preparing. What must never
  // come back is a status VALUE the system does not have.
  for (const dead of ['value="cooking"', 'value="delivering"',
                      'status=eq.cooking', 'status=eq.delivering']) {
    assert.ok(!ORDERS.includes(dead), `${dead} is back on the Orders page`);
  }
});

test("every status has words a person can read", () => {
  assert.equal(orderStatusLabel("at_hub"), "At a Takal office");
  assert.equal(orderStatusLabel("on_the_way_to_restaurant"), "Rider going to shop");
  assert.equal(orderStatusLabel("rejected"), "Shop refused");
  // Nothing raw ever reaches the screen.
  for (const s of ORDER_STATUS_ORDER) {
    assert.ok(
      !orderStatusLabel(s).includes("_"),
      `${s} still shows its raw name to the operator`,
    );
  }
});

test("every status has its own dot, so two sharing a colour can be told apart", () => {
  const dots = ORDER_STATUS_ORDER.map((s) => `${ORDER_STATUS[s].tone}|${ORDER_STATUS[s].dot}`);
  assert.equal(new Set(dots).size, dots.length, "two statuses look identical");
});

test("yellow never means a warning - it is Takal's own colour", () => {
  for (const s of ORDER_STATUS_ORDER) {
    assert.ok(
      !/^#f{2}f{2}0{2}$/i.test(ORDER_STATUS[s].dot),
      `${s} uses the brand yellow to mean a status - the Brand Kit forbids it`,
    );
  }
});

/* ── THE CHIPS ───────────────────────────────────────────────────────────── */

test("every chip on the page is a queue the server really answers", () => {
  // The count on a chip and the list you get when you press it must come from
  // the same place, or one day they will disagree and nobody will know which
  // is right.
  const backendKeys = new Set<string>();
  const q = DESK.slice(DESK.indexOf("QUEUES: Dict[str, Tuple[str, str]] = {"));
  for (const m of q.slice(0, 1400).matchAll(/^\s{4}"([a-z_]+)":/gm)) {
    backendKeys.add(m[1]);
  }
  assert.ok(backendKeys.size >= 6, "the backend queues were not read properly");

  // Just the CHIPS array - the CSV export columns are written the same way,
  // and reading those as chips is how this check went wrong the first time.
  const from = ORDERS.indexOf("const CHIPS");
  assert.ok(from >= 0, "the chip list could not be found on the page");
  const chipBlock = ORDERS.slice(from, ORDERS.indexOf("\n];", from));
  const chipKeys = [...chipBlock.matchAll(/key:\s*"([a-z_]*)",\s*label:/g)]
    .map((m) => m[1])
    .filter((k) => k && k !== "delivered_today" && k !== "late");
  assert.ok(chipKeys.length > 0, "no chips were found on the page");
  const unknown = chipKeys.filter((k) => !backendKeys.has(k));
  assert.deepEqual(
    unknown,
    [],
    `these chips ask the server for a queue it does not have: ${unknown.join(", ")}`,
  );
});

/* ── SEARCH, TOTALS, PAGES ───────────────────────────────────────────────── */

test("search is asked of the server, not of the fifty rows on the screen", () => {
  assert.ok(
    /setSearch\(searchBox\.trim\(\)\)/.test(ORDERS),
    "the search box no longer feeds a server filter",
  );
  assert.ok(
    !/orders\.filter\([\s\S]{0,200}toLowerCase\(\)/.test(ORDERS),
    "the page is filtering orders in the browser again - an order from last " +
      "week will stop being findable",
  );
});

test("the page says how many orders there are, not just 'Page 1'", () => {
  assert.ok(
    ORDERS.includes("setTotal("),
    "the real total the server sends is being thrown away again",
  );
  assert.ok(
    /of\s*<b/.test(ORDERS) || ORDERS.includes("page {page} of"),
    "the pager no longer shows the true number of pages",
  );
});

test("an empty filter is never sent to the server", () => {
  // `status=` with nothing after it is a filter for orders whose status is the
  // empty string, which is none of them - an empty page that looks exactly
  // like a quiet day.
  assert.ok(
    API.includes('v === "" || v === "all"'),
    "empty filters are being sent again",
  );
});

/* ── THE PANEL ───────────────────────────────────────────────────────────── */

test("the order panel reads the order's own endpoint, so items can appear", () => {
  // The old pop-up showed items `if (order.items)`, and the list endpoint has
  // never sent items - so that section could not appear on any order ever.
  assert.ok(API.includes("getOrderFull"), "there is no way to read one order in full");
  assert.ok(PANEL.includes("getOrderFull"), "the panel is back to showing the row it already had");
});

test("the panel reads delivery_address, the field the order actually has", () => {
  // It used to read `order.address`. There is no such column, so the line was
  // silently blank on every order ever placed.
  assert.ok(PANEL.includes("delivery_address"), "the address is being read from a field that does not exist");
  assert.ok(
    !/\bo\.address\b/.test(PANEL),
    "something is reading `order.address` again - there is no such column, so " +
      "the line will be silently blank on every order",
  );
});

test("the progress line is built from the order's real times", () => {
  // The old one drew pending -> confirmed -> cooking -> delivering -> delivered.
  // Three of those five are not statuses, so nothing ever lit up.
  assert.ok(PANEL.includes("data.journey"), "the panel is drawing an invented list of steps again");
  for (const invented of ["confirmed", "cooking", "delivering"]) {
    assert.ok(
      !PANEL.includes(`"${invented}"`),
      `the panel is back to drawing "${invented}", which is not a status`,
    );
  }
});

test("the panel shows what Takal keeps, and says when it cannot know", () => {
  assert.ok(PANEL.includes("TAKAL KEEPS"), "the money breakdown has gone");
  assert.ok(
    PANEL.includes("markup_known"),
    "an order older than 14 August 2026 will show a confident 0 mark-up, which is a lie",
  );
});

/* ── NO MORE GREY BROWSER BOXES ──────────────────────────────────────────── */

test("nothing on the Orders page asks window.prompt", () => {
  // It cannot show the order, it cannot be styled, and some browsers switch it
  // off entirely - in which case the button silently does nothing at all.
  for (const [name, src] of [
    ["the list", ORDERS],
    ["the order panel", PANEL],
    ["the dialogs", DIALOGS],
    ["returns", RETURNS],
    ["the parcel desk", PARCELS],
  ] as const) {
    assert.ok(
      !src.includes("window.prompt"),
      `${name} is back to using the browser's grey prompt box`,
    );
  }
});

test("cancelling shows the order, and will not run without a reason", () => {
  assert.ok(DIALOGS.includes("OrderLine"), "the cancel window no longer shows what is being cancelled");
  assert.ok(
    /disabled=\{!reason\}/.test(DIALOGS),
    "an order can be cancelled with no reason again",
  );
});

test("moving an order says it will be recorded as the admin, not the shop", () => {
  assert.ok(
    DIALOGS.includes("moved from the\n        admin panel") ||
      DIALOGS.includes("moved from the"),
    "the move window no longer warns that this is written down",
  );
  assert.ok(
    /disabled=\{!status \|\| !reason\.trim\(\)\}/.test(DIALOGS),
    "an order can be moved with no reason again",
  );
});

/* ── RETURNS ─────────────────────────────────────────────────────────────── */

test("a return can be part-refunded, keeping the delivery fee", () => {
  // Approving ALWAYS refunded the whole order. On a return where only the
  // goods go back, that gave away a delivery fee that was genuinely earned -
  // the rider rode, the parcel arrived - by default, with no choice offered.
  assert.ok(RETURN_DIALOG.includes("goodsOnly"), "the part-refund choice has gone");
  assert.ok(
    /approveReturn\([^)]*amount/.test(RETURNS),
    "the amount is no longer sent, so the whole order is refunded again",
  );
});

test("the reason the customer gave is not cut off", () => {
  assert.ok(
    RETURNS.includes("whitespace-normal break-words"),
    "the return reason is being truncated again - it is the one thing needed " +
      "to judge a return",
  );
});

/* ── BULK ────────────────────────────────────────────────────────────────── */

test("there is bulk assign, and deliberately no bulk cancel or bulk refund", () => {
  assert.ok(API.includes("bulkAssignRider"), "bulk assign has gone");
  for (const banned of ["bulkCancel", "bulkRefund", "bulk-cancel", "bulk-refund"]) {
    assert.ok(
      !API.includes(banned) && !ORDERS.includes(banned),
      `${banned} has appeared. Twelve refunds from one careless click is not a ` +
        `risk worth taking - ask Sana first.`,
    );
  }
  assert.ok(
    ORDERS.includes("Cancel and refund are deliberately not here"),
    "the screen no longer explains why bulk stops at assigning",
  );
});

/* ── THE OTHER TWO TABS ──────────────────────────────────────────────────── */

test("a parcel says how long it has been sitting, and with whom", () => {
  assert.ok(PARCELS.includes("heldFor("), "the parcel desk no longer shows how long");
  assert.ok(PARCELS.includes("Held too long"), "a parcel held for days is no longer marked");
});

test("the office list says what each office is carrying", () => {
  assert.ok(OFFICES.includes("Cash in the room"), "the office list is a settings page again");
  assert.ok(
    OFFICES.includes("worth, not notes in a drawer") ||
      OFFICES.includes("not notes in a drawer"),
    "nothing explains what 'cash in the room' means, and it will be read as banknotes",
  );
});


/* ── THE DELIVERY SLIP — Sana's five rules, 1 September 2026 ─────────────── */

test("rule 1: the 4-digit code is never printed on the slip", () => {
  // The code exists so the rider must get it FROM THE CUSTOMER, in person. A
  // code he can already read off the paper in his hand stops nothing. This is
  // the check that matters most in this file.
  for (const leak of [
    "delivery_code",
    "deliveryCode",
    "delivery_code_bypassed_by",
  ]) {
    assert.ok(
      !SLIP_RAW.includes(leak),
      `the slip touches ${leak}. The 4-digit code is never printed, never on ` +
        `a screen, and only the customer has it.`,
    );
  }
  // It must still TELL the rider to ask for it.
  assert.ok(
    SLIP.includes("ask the customer for their 4-digit"),
    "the slip no longer tells the rider to ask for the code",
  );
});

test("rule 2: the address is printed exactly as the customer wrote it", () => {
  assert.ok(
    SLIP.includes("exactly as the customer wrote it"),
    "the slip no longer says the address is the customer's own words",
  );
  assert.ok(
    SLIP.includes("delivery_address"),
    "the slip is not printing the address the customer gave",
  );
  assert.ok(
    SLIP.includes("whiteSpace: \"pre-wrap\""),
    "the address is being collapsed onto one line, so \"2nd floor blue gate, " +
      "ring the bell twice\" loses its shape",
  );
});

test("rule 3: only Takal's own contact details, and this is the rider's copy", () => {
  assert.ok(SLIP.includes("CONTACT_EMAIL"), "Takal's own contact has gone from the slip");
  assert.ok(SLIP.includes("RIDER COPY"), "the slip no longer says whose copy it is");
  // The rider needs both numbers - he cannot do the job otherwise. It is the
  // CUSTOMER and the SHOP who must never have each other's.
  assert.ok(SLIP.includes("customer_phone"), "the rider has lost the customer's number");
  assert.ok(SLIP.includes("restaurant_phone"), "the rider has lost the shop's number");
});

test("rule 3 again: a made-up help number is never printed", () => {
  // The approved mock-up printed "0300 000 0000" as a placeholder. A
  // placeholder number on a real slip is worse than none: somebody rings it,
  // gets nothing, and stops trusting the slip.
  assert.ok(
    !/0300\s*000\s*0000/.test(SLIP_RAW),
    "the placeholder help number from the mock-up has been printed for real",
  );
  assert.ok(
    SLIP.includes("CONTACT_PHONE ?"),
    "the slip prints the help number even when there is not one set",
  );
});

test("rule 4: the big box is the money to collect, and says Rs 0 when paid", () => {
  assert.ok(SLIP.includes("COLLECT FROM THE CUSTOMER"), "the money box has gone");
  assert.ok(
    SLIP.includes("Collect Rs 0") && SLIP.includes("ALREADY PAID ONLINE"),
    "an order already paid online no longer says plainly to take nothing",
  );
  assert.ok(
    SLIP.includes("Do not take any money from the customer"),
    "the paid-online box no longer spells it out",
  );
});

test("rule 5: what the rider is paid is never on the slip", () => {
  for (const leak of ["rider_earning", "riderEarning", "rider_pay"]) {
    assert.ok(
      !SLIP_RAW.includes(leak),
      `the slip prints ${leak}. What Takal pays a rider is between Takal and ` +
        `the rider - the slip shows only the delivery charge the customer paid.`,
    );
  }
  assert.ok(SLIP.includes("Delivery charge"), "the charge the customer paid has gone");
});

test("printing prints the slip, not the whole admin panel", () => {
  assert.ok(
    SLIP.includes("body > *:not(#takal-slip-root)"),
    "the sidebar, the filters and every button will come out on the paper again",
  );
  assert.ok(
    !PANEL.includes("window.print()"),
    "the panel is printing itself again instead of the slip",
  );
});

/* ── THE MAP ─────────────────────────────────────────────────────────────── */

test("the map does not fetch anything until somebody asks for it", () => {
  // The web address a map is fetched with contains the customer's front door.
  // Loading it whenever an order is opened would send every customer's home
  // address to a third party, hundreds of times a day, for orders nobody is
  // even looking for on a map.
  assert.ok(MAP.includes("Show the map"), "the map no longer waits to be asked");
  assert.ok(
    /shown \? \(\s*<iframe/.test(MAP),
    "the map iframe is being rendered before anybody pressed anything",
  );
  assert.ok(
    MAP.includes("Nothing is sent until you do"),
    "the button no longer says what pressing it does",
  );
});

test("the map never replaces the written address", () => {
  assert.ok(
    PANEL.indexOf("delivery_address") < PANEL.indexOf("<OrderMap"),
    "the map has been put above the address the customer wrote, or the " +
      "address has gone - it must always be shown as they wrote it",
  );
});

test("an order with no map point says so instead of showing the wrong place", () => {
  assert.ok(
    MAP.includes("No map point was recorded"),
    "an order with no coordinates will show a map of somewhere else",
  );
  assert.ok(
    MAP.includes("lat === 0 && lon === 0"),
    "0,0 is treated as a real place - that is the Atlantic Ocean",
  );
});
