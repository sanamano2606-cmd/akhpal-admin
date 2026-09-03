// THE ORDERS PAGE — the faults the 2 September 2026 audit found, held shut.
//
// Every check here is one line of ORDERS-AUDIT.md. If one of them ever goes
// red, that fault has come back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const RECEIPT = code("src/app/dashboard/orders/parts-customer-receipt.tsx");
const RECEIPT_RAW = readFileSync(
  "src/app/dashboard/orders/parts-customer-receipt.tsx",
  "utf8",
);
const MAP = code("src/app/dashboard/orders/parts-order-map.tsx");
const SETTINGS = code("src/app/dashboard/settings/parts-takal-contact.tsx");
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


/* ── THE CUSTOMER'S RECEIPT ─────────────────────────────────────────────── */
//
// Sana, 2 September 2026: "I want a print of the receipt to pack inside the
// parcel. That will be printed on small paper size / thermal printer." And, in
// the same message, the thing that killed the rider slip: "you know the rider
// will be assign, so everything he will have in the rider app."
//
// THE RECEIPT FOLLOWS THE OPPOSITE PRIVACY RULES TO THE SLIP IT REPLACED. The
// slip carried BOTH phone numbers because a rider cannot work without them.
// This is read by the CUSTOMER, so the shop's number must never be on it.

test("the receipt never carries the shop's phone number", () => {
  // Sana's rule: a customer never gets a shop's number and a shop never gets a
  // customer's - both reach the other through Takal. This is the exact
  // document that would leak it, because it is packed in the customer's hands.
  // The comment-stripped file, not the raw one. A comment that names the field
  // in order to say "never print this" must not read as the fault coming back,
  // or the honest note gets deleted to make the test pass.
  assert.ok(
    !RECEIPT.includes("restaurant_phone"),
    "the shop's phone number is on the customer's receipt",
  );
  // The shop's NAME is fine - they know who they bought from.
  assert.ok(
    RECEIPT.includes("restaurant_name"),
    "the receipt no longer says which shop the order came from",
  );
});

test("the receipt never carries the 4-digit code", () => {
  for (const leak of ["delivery_code", "deliveryCode"]) {
    assert.ok(
      !RECEIPT.includes(leak),
      `the receipt touches ${leak}. Only the customer's own app has that code.`,
    );
  }
});

test("the receipt never shows what the rider was paid, or what Takal kept", () => {
  for (const leak of ["rider_earning", "riderEarning", "commission", "takal?.earned",
                      "markup", "shop_keeps"]) {
    assert.ok(
      !RECEIPT.includes(leak),
      `the receipt shows ${leak}. The customer sees what they paid, never what ` +
        `Takal kept out of it.`,
    );
  }
});

test("the receipt is built for an 80mm roll, not a page", () => {
  // "auto" is what makes the paper cut where the receipt ends. The A5 slip ran
  // to two pages on a one-item order; a roll has no pages to run onto.
  assert.ok(
    RECEIPT.includes("size: 80mm auto"),
    "the receipt is back to a fixed page size, so it will paginate again",
  );
  assert.ok(
    RECEIPT.includes('width: "80mm"'),
    "the receipt is no longer laid out at the width of the paper",
  );
});

test("the receipt prints in black only", () => {
  // A thermal head burns black dots and can do nothing else. The yellow box on
  // the old slip would have come out as grey mush or as nothing at all.
  // The raw file on purpose: a colour written in a comment is a colour the
  // next person copies into the code.
  const colours = RECEIPT_RAW.match(/#[0-9a-fA-F]{3,6}/g) || [];
  const bad = [...new Set(colours)].filter(
    (c) => !["#fff", "#ffffff", "#000", "#000000"].includes(c.toLowerCase()),
  );
  assert.deepEqual(
    bad,
    [],
    `the receipt uses colours a thermal printer cannot print: ${bad.join(", ")}`,
  );
});

test("the amount comes from the server's one rule, not the receipt's opinion", () => {
  assert.ok(
    RECEIPT.includes("order?.paid_online === true"),
    "the receipt is deciding for itself whether an order was paid - that is " +
      "what printed 'Collect Rs 0' on a Rs 576 cash order",
  );
  assert.ok(
    !RECEIPT.includes("payment_status"),
    "the receipt is reading payment_status again",
  );
});

test("the return window is read from the settings, never typed in", () => {
  // A number printed on paper that disagrees with what the app will actually
  // allow is a promise Takal cannot keep.
  assert.ok(
    RECEIPT.includes("return_window_days_standard") &&
      RECEIPT.includes("return_window_hours_quick"),
    "the return window is hard-coded on the receipt",
  );
});

test("Takal's own details come from Settings, and are left out when unset", () => {
  assert.ok(
    RECEIPT.includes("settings?.support_phone"),
    "the receipt is back to a number written into the code",
  );
  assert.ok(
    RECEIPT.includes("Set a phone and email in Settings"),
    "a receipt with no contact details says nothing about it, so nobody finds out",
  );
});

test("the QR code goes somewhere useful, or is left off entirely", () => {
  assert.ok(RECEIPT.includes("wa.me/"), "the WhatsApp link has gone");
  assert.ok(RECEIPT.includes("tel:") && RECEIPT.includes("mailto:"),
    "there is no fallback when there is no WhatsApp number");
  assert.ok(
    RECEIPT.includes("if (!target) return null"),
    "a QR that goes nowhere can still be printed, which is worse than no QR",
  );
  // The order number must survive a smudged QR.
  assert.ok(
    RECEIPT.includes("Quote {code} if you contact us"),
    "the order number is only on the receipt as a QR",
  );
});

test("a Pakistani number is turned into international form once, not twice", () => {
  assert.ok(
    RECEIPT.includes('digits.startsWith("92")'),
    "a number already typed with 92 will have another 92 put in front of it",
  );
});

test("printing prints the receipt, not the whole admin panel", () => {
  assert.ok(
    RECEIPT.includes("body > *:not(#takal-receipt-root)"),
    "the sidebar, the filters and every button will come out on the roll",
  );
  assert.ok(
    !PANEL.includes("window.print()"),
    "the panel is printing itself again instead of the receipt",
  );
});

test("the A5 rider slip is gone", () => {
  // "You know the rider will be assign, so everything he will have in the
  // rider app." The slip was the same information twice, on paper that goes in
  // a bin, and it took two pages for a one-item order.
  assert.ok(
    !existsSync("src/app/dashboard/orders/parts-order-slip.tsx"),
    "the rider slip is back",
  );
  assert.ok(
    !PANEL.includes("OrderSlip"),
    "the order panel still offers to print the rider slip",
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


/* ── WHAT SANA ASKED FOR ON 2 SEPTEMBER, AFTER SEEING IT LIVE ───────────── */

test("the order opens on the whole screen, not half of it", () => {
  // "when i click Open the page show Half on the screen" — it was a panel down
  // the right-hand side, about half her monitor, with two columns of an order
  // squeezed into it and the list showing uselessly behind.
  assert.ok(
    !PANEL.includes("max-w-5xl"),
    "the order is back to opening as a half-width panel",
  );
  assert.ok(
    PANEL.includes("max-w-[1500px]") && PANEL.includes("mx-auto"),
    "the order panel is no longer opening across the screen",
  );
  assert.ok(
    PANEL.includes('e.key === "Escape"'),
    "Escape no longer closes the order - it is full screen now, so there has " +
      "to be a way out that does not need a mouse",
  );
});

test("the filters are one line, not six", () => {
  // "the search bar and filter is too expended look very un professional" —
  // the panel's stylesheet makes every input full width, so six dropdowns
  // became six full-width rows and the filter card was taller than the list.
  assert.ok(
    ORDERS.includes("showFilters"),
    "the six dropdowns are back on the page all the time",
  );
  assert.ok(
    ORDERS.includes("activeCount"),
    "the Filters button no longer says how many filters are switched on, so a " +
      "hidden filter can silently empty the list",
  );
  assert.ok(
    /grid-cols-2[\s\S]{0,80}xl:grid-cols-5/.test(ORDERS),
    "the filters are no longer laid out in a compact grid",
  );
});

test("every filter that is on can be taken off in one press", () => {
  assert.ok(
    ORDERS.includes("Remove this filter") && ORDERS.includes("Clear all"),
    "a filter can be switched on and then not found again",
  );
});

/* ── TAKAL'S OWN CONTACT DETAILS ─────────────────────────────────────────── */

test("Takal's phone and email can be changed from Settings", () => {
  assert.ok(SETTINGS.includes("support_phone"), "the phone number cannot be changed");
  assert.ok(SETTINGS.includes("support_email"), "the email cannot be changed");
  assert.ok(
    SETTINGS.includes("updateSettings"),
    "the contact details are not actually saved anywhere",
  );
});

test("Settings explains why these two details matter", () => {
  assert.ok(
    SETTINGS.includes("reach the other through Takal") ||
      SETTINGS.includes("through Takal"),
    "nothing says why the number matters, so somebody will empty it",
  );
});

test("emptying a box removes the detail rather than inventing one", () => {
  assert.ok(
    SETTINGS.includes("take that detail off the slips"),
    "the screen no longer says what an empty box does",
  );
});


/* ── PRINTING A STACK OF RECEIPTS AT PACKING TIME ────────────────────────── */
//
// Receipts are printed at PACKING time, and packing happens at the parcel
// desk — not by opening fifteen orders one at a time and pressing print on
// each of them.

test("the parcel desk can print several receipts at once", () => {
  assert.ok(
    PARCELS.includes("ReceiptBatch"),
    "the parcel desk can no longer print the receipts that go in the parcels",
  );
  assert.ok(
    PARCELS.includes("printPicked"),
    "there is no way to print for more than one parcel at a time",
  );
});

test("a batch is cut between receipts, not printed as one long strip", () => {
  // Without this, five receipts come off the roll as one unbroken strip that
  // somebody cuts by hand, and the cut lands in the middle of an order.
  assert.ok(
    RECEIPT.includes("break-after: page"),
    "several receipts will print as one continuous strip",
  );
  assert.ok(
    RECEIPT.includes(".takal-receipt:last-child"),
    "the last receipt will feed a blank length of paper after it",
  );
});

test("one receipt and a batch print the exact same paper", () => {
  // Two copies of the receipt would slowly stop agreeing about what a customer
  // is shown — and one of them would be the copy that leaks the shop's number.
  assert.ok(
    RECEIPT.includes("export function ReceiptBody"),
    "the receipt markup is no longer shared between the single print and the batch",
  );
  const single = RECEIPT.indexOf("export function CustomerReceipt");
  const many = RECEIPT.indexOf("export function ReceiptBatch");
  assert.ok(single > 0 && many > 0, "both ways of printing must exist");
  for (const from of [single, many]) {
    assert.ok(
      RECEIPT.slice(from, from + 900).includes("<ReceiptBody"),
      "one of the two print paths is drawing its own receipt instead of the shared one",
    );
  }
});

test("a parcel whose lines cannot be read is named, not silently skipped", () => {
  // Printing four receipts when five were ticked, and saying nothing, is how a
  // parcel goes out with no receipt in it.
  assert.ok(
    PARCELS.includes("could not be read"),
    "a parcel that fails to read is dropped from the print in silence",
  );
});

test("the ticks are cleared once the paper is out", () => {
  assert.ok(
    /setPrinting\(false\);[\s\S]{0,300}setPicked\(new Set\(\)\)/.test(PARCELS),
    "the same parcels stay ticked after printing, so the next press prints " +
      "them all again",
  );
});


/* ── THE TWO THINGS FOUND ON SANA'S FIRST REAL RECEIPT ───────────────────── */
//
// 3 September 2026. She filled in Settings and printed one. Both of these were
// on the paper, live.

test("an international number is not turned into a Pakistani one", () => {
  // She saved 00966506821833 — a Saudi number, written the way it is dialled
  // from a landline. The old rule saw a leading zero, took it for a Pakistani
  // 03xx mobile, and made 920966506821833: a number belonging to nobody.
  assert.ok(
    RECEIPT.includes('digits.startsWith("00")'),
    "a number written as 00<country code> is treated as a local one again",
  );
  assert.ok(
    RECEIPT.includes('trimmed.startsWith("+")'),
    "a number written with a + is no longer recognised as international",
  );
  // And a local number must only be converted when it really looks local.
  assert.ok(
    /digits\.length === 10 \|\| digits\.length === 11/.test(RECEIPT),
    "any number starting with a zero is being given a Pakistani country code, " +
      "which is a QR that opens a stranger's chat",
  );
});

test("Settings warns about an email that is almost certainly a typo", () => {
  // She saved sanamano2606@gamil.com and it printed on every receipt.
  // gamil.com is a REAL domain owned by somebody else, so a customer writing
  // to it gets silence rather than a bounce — nobody ever finds out.
  assert.ok(
    SETTINGS.includes('"gamil.com"'),
    "the typo that reached a printed receipt is no longer warned about",
  );
  assert.ok(
    SETTINGS.includes("belongs to somebody else"),
    "the warning no longer explains why a typo here is worse than a bounce",
  );
  // A warning, not a refusal — it is her address and she may have a reason.
  assert.ok(
    !SETTINGS.includes("throw") ,
    "a suspected typo now blocks saving, which is not this check's job",
  );
});
