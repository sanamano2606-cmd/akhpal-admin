// MOCK 244 - THE APP HOME PAGE (Sana 11 Nov 2026: "Approved. Make sure
// everything done perfect"). The page only SAYS what the server decides, so
// its names and numbers must be the server's (backend/home_layout.py). These
// checks read both files and compare.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIR = "src/app/dashboard/marketing/app-home/";
const read = (f: string) => readFileSync(f, "utf8");
const PY = read("../swat-delivery-app/backend/home_layout.py");
const ROUTER = read("../swat-delivery-app/backend/routers/home_layout.py");
const GUARD = read("../swat-delivery-app/backend/app_guard.py");
const NAV = read("src/lib/navigation.ts");
const API = read("src/lib/api-money.ts");
const LIB = read("src/lib/app-home.ts");
const PAGE = read(DIR + "page.tsx");
const ALL = readdirSync(DIR).filter((f) => f.endsWith(".tsx")).map((f) => read(DIR + f)).join("\n");

const lib = () => import(pathToFileURL(join(process.cwd(), "src/lib/app-home.ts")).href);

function pyTuple(name: string): string[] {
  const m = PY.match(new RegExp(`^${name}[^=]*=\\s*\\(([^)]*)\\)`, "m"));
  assert.ok(m, `${name} not found in home_layout.py`);
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
function pyNumber(name: string): number {
  const m = PY.match(new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, "m"));
  assert.ok(m, `${name} not found`);
  return Number(m![1]);
}

test("the page's lists are the server's lists", async () => {
  const L = await lib();
  assert.deepEqual([...L.BLOCK_KEYS], pyTuple("BLOCK_KEYS"));
  assert.deepEqual(L.CARD_STYLES.map((s: any) => s.key), pyTuple("CARD_STYLES"));
  assert.deepEqual(L.TAB_STYLES.map((s: any) => s.key), pyTuple("TAB_STYLES"));
  assert.deepEqual(L.SYMBOLS.map((s: any) => s.key), pyTuple("SYMBOLS"));
  assert.deepEqual(L.READY_TIMES.map((s: any) => s.key), pyTuple("READY_TIMES"));
  assert.deepEqual(Object.keys(L.CARD_NAMES), pyTuple("CARD_KEYS"));
  assert.equal(L.MIN_CONTRAST, pyNumber("MIN_CONTRAST"));
  assert.equal(L.SOFT_TILE, PY.match(/^SOFT_TILE = "([^"]+)"/m)![1]);
});

test("the collections page keeps to the server's limits", () => {
  const C = read(DIR + "parts-collections.tsx");
  assert.ok(C.includes(`const MAX_COLLECTIONS = ${pyNumber("MAX_COLLECTIONS")};`));
  assert.ok(C.includes(`const MAX_ITEMS = ${pyNumber("MAX_COLLECTION_ITEMS")};`));
  const title = PY.match(/"title":\s*(\d+)/)![1];
  assert.ok(C.includes(`label="Title" en={c.title_en} ur={c.title_ur} max={${title}}`));
});

test("readable words are worked out the way the server does", async () => {
  const L = await lib();
  // Black on Takal yellow is about 19.6 : 1; white on yellow fails.
  assert.ok(Math.abs(L.contrast("#000000", "#FFFF00") - 19.56) < 0.05);
  assert.ok(L.contrast("#FFFFFF", "#FFFF00") < 1.1);
  assert.equal(L.mix("#000000", "#FFFFFF", 0.5).toUpperCase(), "#808080");
  // A blend card is tested on BOTH colours it stands on.
  // Black words on mid grey read; where the blend has gone 30% to black
  // they do not - so the same card passes as "soft" and fails as "blend".
  const card = { ...L.defaultCard("food"), bg1: "#9E9E9E", bg2: "#000000", name_color: "#000000", line_color: "#000000" };
  assert.equal(L.cardReadable("soft", card).ok, true);
  assert.equal(L.cardReadable("blend", card).ok, false);
  assert.equal(L.cardReadable("bigpic", card).ok, true);   // white words on the app's own fade
});

test("the look on a day is the dated one, else Normal", async () => {
  const L = await lib();
  const normal = L.newLook("Normal"); normal.normal = true;
  const eid = L.newLook("Eid"); eid.from_date = "2027-03-10"; eid.to_date = "2027-03-12";
  const layout = { v: 1, blocks: [], rain: {}, collections: [], looks: [normal, eid] } as any;
  assert.equal(L.lookOn(layout, "2027-03-11").name, "Eid");
  assert.equal(L.lookOn(layout, "2027-03-13").name, "Normal");
});

test("the iftar time follows Swat's sun", async () => {
  const L = await lib();
  // Sunset in Mingora is about 5:05 PM on 11 November and about 7:20 PM in
  // late June. Within 10 minutes is close enough for a 2-hour window.
  const nov = L.swatSunMinutes("2026-11-11", 0.833, false);
  const jun = L.swatSunMinutes("2027-06-21", 0.833, false);
  assert.ok(Math.abs(nov - (17 * 60 + 5)) <= 10, `November sunset ${nov}`);
  assert.ok(Math.abs(jun - (19 * 60 + 20)) <= 10, `June sunset ${jun}`);
  assert.equal(L.readyNow({ ready: "iftar" }, "2026-11-11", nov - 30), true);
  assert.equal(L.readyNow({ ready: "iftar" }, "2026-11-11", nov + 30), false);
  assert.equal(L.readyNow({ ready: "jumma" }, "2026-11-13", 600), true);   // a Friday
  assert.equal(L.readyNow({ ready: "jumma" }, "2026-11-12", 600), false);
});

test("the tab sits in Marketing and the server and panel guard it the same way", () => {
  assert.ok(NAV.includes('{ label: "📱 App Home", href: "/dashboard/marketing/app-home", section: "marketing.banners"'));
  assert.ok(NAV.includes('["/admin/home-layout", "marketing.banners"]'));
  assert.ok(GUARD.includes('("/admin/home-layout", "marketing.banners")'));
});

test("every call the page makes exists in the API client and on the server", () => {
  const doors: [string, string][] = [
    ["getAppHome", '@router.get("/admin/home-layout"'],
    ["saveAppHomeDraft", '@router.put("/admin/home-layout/draft"'],
    ["publishAppHome", '@router.post("/admin/home-layout/publish"'],
    ["discardAppHomeDraft", '@router.post("/admin/home-layout/discard"'],
    ["restoreAppHome", '@router.post("/admin/home-layout/restore/{history_id}"'],
    ["setAppHomePreviewPhones", '@router.put("/admin/home-layout/preview-phones"'],
    ["searchAppHomeProducts", '@router.get("/admin/home-layout/products"'],
    ["appHomeCollectionRows", '@router.post("/admin/home-layout/collection-rows"'],
    ["getAppHomeTaps", '@router.get("/admin/home-layout/taps"'],
  ];
  for (const [m, door] of doors) {
    assert.ok(API.includes(`async ${m}(`), `${m} missing from the API client`);
    assert.ok(ALL.includes(`apiClient.${m}(`), `${m} is never used by the page`);
    assert.ok(ROUTER.includes(door), `${door} missing on the server`);
  }
});

test("Publish saves the last change first, and shows the server's red list", () => {
  const pub = PAGE.slice(PAGE.indexOf("const publish = async"), PAGE.indexOf("const discard = async"));
  assert.ok(pub.indexOf("await saveNow()") < pub.indexOf("apiClient.publishAppHome()"));
  assert.ok(pub.includes("e?.detail?.problems"));
  assert.ok(PAGE.includes("data-problems"));
});

test("before migration 163 the page says so instead of failing", () => {
  assert.ok(PAGE.includes("e?.status === 501"));
  assert.ok(PAGE.includes("data-app-home-not-yet"));
});

test("Undo and Bring back ask first", () => {
  assert.ok(PAGE.includes('<ConfirmDialog open={askDiscard}'));
  assert.ok(PAGE.includes('<ConfirmDialog open={askRestore !== null}'));
  assert.ok(!/onClick=\{\(\) => (discard|restore)\(/.test(PAGE));
});

test("an own picture is read for phone numbers before it is used", () => {
  const P = read(DIR + "parts-picture.tsx");
  const up = P.slice(P.indexOf("const upload = async"));
  const at = (w: string) => { const i = up.indexOf(w); assert.ok(i > -1, `${w} is missing`); return i; };
  const added = at("add({ url })");
  assert.ok(at("const read = await checkPicture(url);") < added);
  // A picture that could not be read, or has a number on it, is never added.
  assert.ok(/if \(read\.failed\) \{[^}]*return;\s*\}/.test(up), "a picture not read is still added");
  assert.ok(/if \(read\.hits\.length\) \{[^}]*return;\s*\}/.test(up), "a picture with a number is still added");
  assert.ok(at("if (read.failed)") < added && at("if (read.hits.length)") < added);
});

test("Urdu is written in Noto Naskh and is asked for when English is written", () => {
  const F = read(DIR + "parts-fields.tsx");
  assert.ok(F.includes("../../stores/catalogue/urdu-font"));
  assert.ok(read("src/app/dashboard/stores/catalogue/urdu-font.ts").includes("Noto_Naskh_Arabic"));
  assert.ok(F.includes('dir="rtl"'));
  assert.ok(F.includes("Write the Urdu too"));
});

test("no word on the page is smaller than 12 px (the phone drawing aside)", () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".tsx") && x !== "parts-preview.tsx")) {
    for (const m of read(DIR + f).matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      assert.ok(Number(m[1]) >= 12, `${f} uses ${m[0]}`);
    }
  }
});

test("the preview's pictures are in the panel", async () => {
  const L = await lib();
  for (const code of Object.keys(L.TAB_NAMES)) assert.ok(existsSync(`public/app-home/round/${code}_1.jpg`), code);
  for (const p of Object.values(L.CARD_PHOTOS) as string[]) assert.ok(existsSync("public" + p), p);
});

test("Featured (paid) spots are not on the page - Sana: 'should stay for later'", () => {
  assert.ok(!/featured|sponsored/i.test(ALL));
});

// ── Found while checking the LIVE page (14 Nov 2026) ─────────────────────────
const DART_TYPES = read("../swat-delivery-app/customer_app/lib/services/shop_types.dart");
const DART_UR = read("../swat-delivery-app/customer_app/lib/l10n/strings_ur.dart");
const dartMap = (name: string) => {
  const body = DART_TYPES.slice(DART_TYPES.indexOf(`static const Map<String, String> ${name} = {`));
  const block = body.slice(0, body.indexOf("};"));
  return Object.fromEntries([...block.matchAll(/'([a-z_]+)': '([^']+)'/g)].map((m) => [m[1], m[2]]));
};

test("a tab is named the way the phone names it - never by its code", async () => {
  const L = await lib();
  assert.equal(L.tabName("furniture_decor"), "Furniture");   // was shown as "furniture_decor"
  const short = dartMap("_short");
  for (const [code, name] of Object.entries(L.TAB_SHORT)) assert.equal(short[code], name, code);
  assert.deepEqual(L.TAB_NAMES, dartMap("_tab"));
  assert.deepEqual(L.TAB_NAMES_UR, dartMap("_tabUr"));
  assert.ok(!/TAB_NAMES\[[^\]]+\] \|\|/.test(ALL), "every screen asks tabName()");
});

test("the Urdu boxes show the app's own Urdu words while they are empty", async () => {
  const L = await lib();
  for (const k of ["food", "fresh", "health", "market"]) {
    assert.ok(DART_UR.includes(`'home_card_${k}': '${L.CARD_NAMES_UR[k]}'`), k);
    assert.ok(DART_UR.includes(`'home_card_${k}_tag': '${L.CARD_LINES_UR[k]}'`), k);
  }
  const C = read(DIR + "parts-cards.tsx");
  assert.ok(C.includes("placeholderUr={CARD_NAMES_UR[card.key]}") && C.includes("placeholderUr={CARD_LINES_UR[card.key]}"));
});

test("a first visit does not say 'Draft saved' - nothing was saved", () => {
  assert.ok(PAGE.includes("const untouched = !info.published_at && !info.draft_saved_at"));
  assert.ok(PAGE.includes('disabled={publishing || (!changed && saving === "idle")}'));
});

test("the phone follows the part being edited, and shows the chosen time", () => {
  const P = read(DIR + "parts-preview.tsx");
  assert.ok(!P.includes("<span>10:42</span>"));
  assert.ok(P.includes("data-preview-clock>{clock}"));
  assert.ok(PAGE.includes('focus={part === "cards" ? "departments"'));
  // The sticky phone starts below the sticky status line, not under it.
  assert.ok(PAGE.includes("xl:sticky xl:top-[84px]"));
});

test("a card row shows the card's own picture, not two letters", () => {
  const C = read(DIR + "parts-cards.tsx");
  assert.ok(!C.includes(".slice(0, 2)"));
  // Mock 246: Takal's live picture first, the card's own fixed picture last.
  assert.ok(C.includes('(c.pic.source !== "takal" && c.pic.items[0]?.url)) || CARD_PHOTOS[c.key]'));
  assert.ok(C.includes('liveShown(c.pic, live?.cards[c.key], live?.min)[0]?.url'));
});

test("a collection can be shown on Home from its own box", () => {
  const C = read(DIR + "parts-collections.tsx");
  assert.ok(C.includes("b.key === `collection:${c.id}` ? { ...b, on } : b"));
  assert.ok(C.includes("data-quick-start"));
});
