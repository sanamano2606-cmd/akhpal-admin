// Mocks 238, 239, 240 and 241 (Sana 11 Nov 2026: "Approved - build all at
// once", and her three answers: KEEP the to-tell line, KEEP the payout label on
// every row, KEEP Open/Closed for hidden shops; Commission as in Mock 241).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAIN_VIEWS, MORE_VIEWS, MORE_PAGES, chipLabel } from "../src/lib/stores-chips.ts";
import { menuSpot } from "../src/lib/row-menu-spot.ts";
import { NAVIGATION } from "../src/lib/navigation.ts";
import { DEPT_EMOJI, DEPT_COLOURS, deptEmoji } from "../src/lib/shelves.ts";

const code = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LIST = code("src/app/dashboard/stores/page.tsx");
const STORE = code("src/app/dashboard/stores/[id]/page.tsx");
const BAR = code("src/app/dashboard/stores/[id]/parts-status-bar.tsx");

// ── MOCK 238: All Stores ──────────────────────────────────────────────────────
test("238: five lists on the line, the rest under More - every list still reachable", () => {
  assert.deepEqual(MAIN_VIEWS, ["live", "tell", "ready", "hidden", "suspended"]);
  assert.deepEqual(MORE_VIEWS, ["pending", "rejected", "attention", "payout"]);
  for (const k of ["live", "tell", "ready", "hidden", "pending", "suspended", "rejected", "attention", "payout"]) {
    assert.ok(MAIN_VIEWS.includes(k) || MORE_VIEWS.includes(k), `${k} is somewhere`);
    assert.ok(LIST.includes(`{ key: "${k}"`), `${k} is still a list`);
  }
  assert.equal(chipLabel("hidden", "Hidden from customers"), "Hidden");
  assert.equal(chipLabel("live", "Live"), "Live");
  assert.match(LIST, /VIEWS\.filter\(\(v\) => MAIN_VIEWS\.includes\(v\.key\) \|\| v\.key === view\)/, "a list chosen from More shows while open");
});

test("238: the chosen chip is yellow-filled, an empty one grey", () => {
  assert.match(LIST, /on \? "border-2 border-takal-ink bg-takal-yellow text-takal-ink shadow-\[0_2px_0_#111\]"/);
  assert.match(LIST, /: zero \? "border-\[1\.5px\] border-takal-line bg-white text-takal-ink-soft/);
});

test("238: 6 tabs on the bar - the 3 others keep their page, address and permission", () => {
  const tabs = NAVIGATION.find((n) => n.label === "Stores")!.tabs!;
  const onBar = tabs.filter((t) => !t.more).map((t) => t.label);
  // Mock 242 (11 Nov): + "📋 Needs me today" (stores/layout draws it first).
  assert.deepEqual(onBar, ["All Stores", "📋 Needs me today", "Malls", "Categories", "Product sorting", "⚖️ Legal check", "Commission"]);
  for (const [href, section] of [["/dashboard/stores/onboarding", "stores.all"], ["/dashboard/stores/inventory", "stores.inventory"],
    ["/dashboard/stores/reliability", "stores.reliability"]]) {
    const t = tabs.find((x) => x.href === href)!;
    assert.ok(t && t.more === true && t.section === section, href);
  }
  assert.deepEqual(MORE_PAGES.map((m) => m.href), ["/dashboard/stores/onboarding", "/dashboard/stores/reliability"]);
  assert.match(LIST, /href="\/dashboard\/stores\/inventory" data-low-stock-button/, "Low stock has its button");
});

test("238: Sana's three KEEPs are kept", () => {
  assert.match(LIST, /data-tell="none"/, "the to-tell line under the name");
  assert.match(LIST, /data-tell="sent"/);
  assert.match(LIST, /data-no-payout/, "the payout label on the rows");
  assert.match(LIST, /💰 No payout details/);
  assert.match(LIST, /data-open-now/, "Open / Closed for every approved shop, hidden ones too");
});

test("238: one status, and Review + ⋯ (WhatsApp, Reject, Suspend - each still asks first)", () => {
  assert.match(LIST, /\{!\(deriveStatus\(restaurant\) === "approved" \|\| deriveStatus\(restaurant\) === "hidden"\) && getStatusBadge\(deriveStatus\(restaurant\)\)\}/);
  assert.match(LIST, /return <RowMenu items=\{items\} label=\{restaurant\.name\} \/>;/);
  assert.match(LIST, /key: "suspend", danger: true, label: <>⏸ Suspend shop…<\/>,\s*onClick: \(\) => setPending\(\{ store: restaurant, action: "suspend" \}\)/);
  assert.match(LIST, /open=\{pending\?\.action === "reject"\}/, "the reason window is unchanged");
  const see = code("src/app/dashboard/stores/parts-customers-see.tsx");
  assert.match(see, />\s*Live\s*<\/span>/);
  assert.match(see, />\s*Hidden\s*<\/span>/);
});

test("238: the ⋯ menu always fits on the screen", () => {
  const screen = { width: 1528, height: 732 };
  const menu = { width: 220, height: 150 };
  const low = menuSpot({ top: 690, bottom: 722, right: 1500 }, menu, screen);
  assert.equal(low.up, true, "a row at the bottom opens upward");
  assert.ok(low.top >= 8 && low.top + menu.height <= screen.height);
  const high = menuSpot({ top: 200, bottom: 232, right: 1500 }, menu, screen);
  assert.equal(high.up, false);
  assert.ok(high.left + menu.width <= screen.width - 8 && high.left >= 8);
  const edge = menuSpot({ top: 200, bottom: 232, right: 100 }, menu, screen);
  assert.ok(edge.left >= 8, "never off the left edge");
});

test("238: the Low stock number is a count, asked after the list", () => {
  const api = code("src/lib/api-client.ts");
  assert.match(api, /\/admin\/low-stock\?threshold=\$\{threshold\}&count_only=true/);
  assert.match(LIST, /if \(!mayLowStock \|\| loading\) return;/);
});

// ── MOCK 239: one store's page ────────────────────────────────────────────────
test("239: three fixed lines, the name never cut", () => {
  assert.match(STORE, /data-store-line-1/);
  assert.match(STORE, /data-store-line-2 className="[^"]*" role="tablist"/);
  assert.match(STORE, /data-store-line-3/);
  assert.doesNotMatch(STORE, /truncate max-w-\[190px\]/);
  assert.match(STORE, /\{r\.is_featured \? "★ ⓘ" : "ⓘ"\}/, "the details button is ⓘ - one ⋯ only");
});

test("239: Suspend and (hidden/suspended) Reject in ⋯; a new shop keeps Reject by Approve", () => {
  assert.match(BAR, /<RowMenu label=\{name\} items=\{\[/);
  assert.match(BAR, /\{status === "pending" && \(\s*<button disabled=\{busy\} onClick=\{\(\) => setAsk\("reject"\)\}/);
  assert.match(BAR, /onClick: \(\) => setAsk\("suspend"\)/);
  assert.match(BAR, /open=\{ask === "suspend"\}/);
  assert.match(BAR, /data-live-tell-page/, "the to-tell words stay beside What to tell");
});

test("239: product cards - 2-line name, a black sizes tag, 14 px numbers", () => {
  const card = code("src/app/dashboard/stores/[id]/parts-products-grid.tsx");
  // 2.5em = exactly 2 lines (leading-tight 1.25 x 2). 2.5rem was 40 px for 35 px
  // of text, so the top of a 3rd line showed under "...and..." (seen at 1024 wide).
  assert.match(card, /className=\{`line-clamp-2 min-h-\[2\.5em\] w-full text-left text-sm font-bold leading-tight/);
  assert.match(card, /data-card-choices className="shrink-0 rounded-md bg-black/);
  // 11 Nov: the number is never cut ("1,0…" at 1024 wide) - the word gives way instead.
  assert.match(card, /<b className=\{`shrink-0 text-sm \$\{tone\}`\}>/);
  assert.match(card, /<span className="min-w-0 truncate text-xs font-semibold uppercase text-\[#777\]">\{label\}<\/span>/);
  assert.match(code("src/app/dashboard/stores/[id]/parts-products.tsx"), /grid-cols-\[repeat\(auto-fill,minmax\(200px,1fr\)\)\]/, "cards wide enough for SELL 12,500");
  assert.match(card, /showBuy && \(sizes \?/, "the buying-price box is still there");
  assert.match(card, /Add a buying price/);
});

// ── MOCK 240: the look rules ──────────────────────────────────────────────────
test("240: the left menu - 34 px rows, name menu with Change password and Log out, «", () => {
  const L = code("src/app/dashboard/layout.tsx");
  assert.match(L, /relative w-full flex items-center gap-3 h-8 px-3 rounded-lg transition-all mb-0\.5/);
  assert.match(L, /data-me-menu/);
  assert.match(L, /setMeOpen\(false\); setPwForced\(false\); setPwOpen\(true\);/);
  assert.match(L, /setMeOpen\(false\); handleLogout\(\);/);
  assert.match(L, /<ChevronsLeft /);
  assert.doesNotMatch(L, /<X className="w-5 h-5 text-takal-ink-soft" \/>/, "no × for narrowing");
});

test("240: nothing on a Stores page under 12 px", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  // fileURLToPath, not .pathname: the project folder has spaces ("%20").
  const root = fileURLToPath(new URL("../src/app/dashboard/stores/", import.meta.url));
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
  for (const f of walk(root)) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /text-\[(9|9\.5|10|10\.5|11|11\.5)px\]/, f);
  }
});

test("240: every on/off switch on the Stores pages is yellow", () => {
  for (const f of ["src/app/dashboard/stores/[id]/parts-products-grid.tsx", "src/app/dashboard/stores/[id]/parts-products.tsx",
    "src/app/dashboard/stores/[id]/parts-products-edit.tsx", "src/app/dashboard/stores/[id]/ProductEditorModal.tsx",
    "src/app/dashboard/stores/page.tsx", "src/app/dashboard/stores/catalogue/parts-shelves.tsx",
    "src/app/dashboard/stores/malls/[id]/parts-store-names.tsx"]) {
    const s = code(f);
    assert.match(s, /bg-takal-yellow ring-\[1\.5px\] ring-inset ring-takal-ink/, f);
    assert.doesNotMatch(s, /\? "bg-takal-green" : "bg-\[#C/, f);
  }
});

test("240: one picture per department, everywhere", () => {
  assert.deepEqual(Object.keys(DEPT_EMOJI).sort(), Object.keys(DEPT_COLOURS).sort(), "every coloured department has a picture");
  assert.equal(deptEmoji("food-and-drinks"), "🍔");
  assert.equal(deptEmoji("not-a-department"), "📦");
  assert.match(code("src/app/dashboard/stores/catalogue/parts-shelves.tsx"), /<DeptMark slug=\{d\.slug\} size=\{32\} \/>/);
  assert.match(code("src/app/dashboard/stores/sorting/page.tsx"), /<DeptMark slug=\{d\.slug \|\| slugOf\(d\.name\)\} size=\{28\} \/>/);
  assert.match(code("src/app/dashboard/stores/catalogue/parts-shelves.tsx"), /const iconBtn = "inline-flex h-8 w-8/, "32 px icon buttons");
});

// ── MOCK 241: Commission ──────────────────────────────────────────────────────
test("241: ONE Save, one info line, small boxes - the old locks stay", () => {
  const C = code("src/app/dashboard/stores/commission/page.tsx");
  assert.doesNotMatch(C, /saveVerticalCommission/);
  assert.doesNotMatch(C, />Important</);
  assert.match(C, /data-commission-info/);
  assert.match(C, /A new rate counts for <b>new orders only<\/b>/);
  assert.match(C, /\(the pharmacy\) is on purpose/);
  assert.match(C, /w-24 h-10 px-3/);
  assert.match(C, /data-pending/);
  assert.match(C, /disabled=\{saving \|\| loadingSettings \|\| !!settingsError\}/);
  assert.match(C, /const rows = vcError \? \[\] : changedTypes;/);
});

test("238: the ⋯ menu is drawn on the page itself - never cut off by the table or covered by the next row", () => {
  const M = code("src/app/dashboard/stores/parts-row-menu.tsx");
  assert.match(M, /import \{ createPortal \} from "react-dom";/);
  assert.match(M, /open && typeof document !== "undefined" && createPortal\(/);
  assert.match(M, /document\.body,\s*\)\}/);
  assert.match(M, /position: "fixed"/);
});

test("238: More ▾ opens to the left when the screen has no room on the right", () => {
  assert.match(LIST, /setMoreLeftward\(b\.left \+ 340 > window\.innerWidth - 8 && b\.right - 340 >= 8\)/);
  assert.match(LIST, /data-more-menu className=\{`absolute \$\{moreLeftward \? "right-0" : "left-0"\}/);
});

// ── MOCK 242: "Needs me today" in its own tab ─────────────────────────────────
test("242: the box left All Stores and has its own tab, drawn first, same permission", async () => {
  assert.doesNotMatch(LIST, /<NeedsMeToday/, "All Stores no longer draws the box");
  const page = code("src/app/dashboard/stores/today/page.tsx");
  assert.match(page, /<NeedsMeToday start isMain=\{isMain\}/);
  const tabs = NAVIGATION.find((n) => n.label === "Stores")!.tabs!;
  const t = tabs.find((x) => x.href === "/dashboard/stores/today")!;
  assert.equal(t.section, tabs.find((x) => x.label === "All Stores")!.section, "same people as All Stores");
  assert.equal(tabs[0].label, "All Stores", "the data keeps the domain's own tab first");
  const L = code("src/app/dashboard/stores/layout.tsx");
  assert.match(L, /const TABS = \[\.\.\.today, \.\.\.STORE_TABS\.filter\(\(t\) => t\.href !== TODAY\)\];/, "drawn first");
  const { isOneStorePage } = await import("../src/lib/store-page.ts");
  assert.equal(isOneStorePage("/dashboard/stores/today"), false, "keeps the Stores title and tabs - not a shop called 'today'");
});

test("242: the tab's number - red when a shop waits on you, grey for quiet shops only, none when empty", async () => {
  const { needsTabCount } = await import("../src/lib/needs-today.ts");
  const base = { ready: [], fixes: [], pictures: [], quiet: [], failed: [], quiet_days: 7, checked_at: "" } as any;
  assert.equal(needsTabCount(null), null);
  assert.equal(needsTabCount(base), null);
  assert.deepEqual(needsTabCount({ ...base, quiet: new Array(87).fill({}) }), { count: 87, countTone: "grey" });
  assert.deepEqual(needsTabCount({ ...base, ready: [{}], fixes: [{}], pictures: [{}], quiet: [{}] }), { count: 3, countTone: "red" });
  const D = code("src/components/ui/DomainTabs.tsx");
  assert.match(D, /t\.countTone === "grey" \? "bg-\[#E4E4E0\] text-takal-ink" : "bg-takal-red text-white"/);
});

test("240 (live check 14 Nov): the 2 switches that were missed are yellow too; no black or slate switch left", () => {
  const G = code("src/app/dashboard/stores/catalogue/page.tsx");
  assert.match(G, /hideEmpty \? "bg-takal-yellow ring-takal-ink" : "bg-\[#D9D9D9\] ring-\[#9A9A9A\]"/);
  const K = code("src/app/dashboard/stores/parts-create-store.tsx");
  assert.match(K, /\$\{on \? "bg-takal-yellow ring-takal-ink" : "bg-\[#D9D9D9\] ring-\[#9A9A9A\]"\}/);
  assert.doesNotMatch(G + K, /\? "bg-slate-900"|\$\{on \? "bg-takal-ink" : "bg-slate-300"\}/);
});

test("240 (live check 14 Nov): the name menu closes with Esc", () => {
  const L = code("src/app/dashboard/layout.tsx");
  assert.match(L, /if \(e\.key === "Escape"\) setMeOpen\(false\);/);
});
