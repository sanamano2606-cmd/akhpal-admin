// MOCK 246 - "TAKAL PICKS LIVE PICTURES" FOR THE 4 CARDS AND THE TOP TABS
// (Sana 14 Nov 2026: "Approved A" - live pictures are the normal choice).
// The page only SAYS what the server decides, so its numbers must be the
// server's (backend/home_layout.py, backend/home_pictures.py). These checks
// read both and compare, and run the page's own rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIR = "src/app/dashboard/marketing/app-home/";
const read = (f: string) => readFileSync(f, "utf8");
const PY = read("../swat-delivery-app/backend/home_layout.py");
const ROUTER = read("../swat-delivery-app/backend/routers/home_layout.py");
const API = read("src/lib/api-money.ts");
const CARDS = read(DIR + "parts-cards.tsx");
const TABS = read(DIR + "parts-tabs.tsx");
const PICTURE = read(DIR + "parts-picture.tsx");
const PREVIEW = read(DIR + "parts-preview.tsx");
const PAGE = read(DIR + "page.tsx");

const lib = () => import(pathToFileURL(join(process.cwd(), "src/lib/app-home.ts")).href);

function pyNumber(name: string): number {
  const m = PY.match(new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, "m"));
  assert.ok(m, `${name} not found`);
  return Number(m![1]);
}
function pyTuple(name: string): string[] {
  const m = PY.match(new RegExp(`^${name}[^=]*=\\s*\\(([^)]*)\\)`, "m"));
  assert.ok(m, `${name} not found in home_layout.py`);
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const pics = (n: number, shops = n) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://x/${i}.webp`, shop: `Shop ${i % shops}`, shop_id: `s${i % shops}` }));

test("the page's numbers are the server's numbers", async () => {
  const L = await lib();
  assert.equal(L.AUTO_MIN, pyNumber("AUTO_MIN"));
  assert.equal(L.AUTO_SECONDS, pyNumber("AUTO_SECONDS"));
  assert.deepEqual(["auto", "takal", "live", "own"], pyTuple("PIC_SOURCES"));
  assert.deepEqual(["fixed", "any"], pyTuple("FEWER"));
  assert.deepEqual(["auto", "takal"], pyTuple("TAB_PICS"));
});

test("choice A: a new card and a new row use Takal's live pictures", async () => {
  const L = await lib();
  const c = L.defaultCard("food");
  assert.equal(c.pic.source, "auto");
  assert.equal(c.pic.change_seconds, 4);
  assert.equal(c.pic.fewer, "fixed");
  assert.equal(L.defaultTabs().pics, "auto");
  assert.equal(L.defaultTabs().pics_seconds, 0);
});

test("every save says the panel knows the fixed picture apart (pics_v 2)", () => {
  // Without it the server reads "takal" as an old document's, i.e. live.
  assert.ok(API.includes("JSON.stringify({ doc: { ...doc, pics_v: 2 } })"));
  assert.ok(PY.includes("PICS_V = 2"));
});

test("too few live pictures shows the fixed picture, unless the office said otherwise", async () => {
  const L = await lib();
  const pic = L.defaultCard("health").pic;
  assert.equal(L.liveShown(pic, pics(1)).length, 0);
  assert.equal(L.liveShown(pic, pics(2)).length, 2);
  assert.equal(L.liveShown({ ...pic, fewer: "any" }, pics(1)).length, 1);
  assert.equal(L.liveShown({ ...pic, source: "takal" }, pics(6)).length, 0);
  assert.equal(L.liveShown(pic, undefined).length, 0);
});

test("a tab follows its row", async () => {
  const L = await lib();
  const tabs = L.defaultTabs();
  const pic = L.defaultPic(true);
  assert.equal(L.tabLiveShown(tabs, pic, pics(3)).length, 3);
  assert.equal(L.tabLiveShown({ ...tabs, pics: "takal" }, pic, pics(3)).length, 0);
  assert.equal(L.tabLiveShown(tabs, pic, pics(1)).length, 0);
});

test("food and grocery fill the space, the others show whole", async () => {
  const L = await lib();
  assert.deepEqual(["food", "fresh", "health", "market", undefined].map(L.liveFit),
    ["cover", "cover", "contain", "contain", "contain"]);
});

test("the 4 cards: a one-tap button, the live words on every row, the chooser fed", () => {
  assert.ok(CARDS.includes("✨ Use live pictures on all 4 cards"));
  assert.ok(CARDS.includes('source: "auto"'));
  assert.ok(CARDS.includes("data-card-picture-words"));
  assert.ok(CARDS.includes("live.cards[card.key]"));
  assert.ok(PICTURE.includes('"✨ Takal picks live pictures"'));
  assert.ok(PICTURE.includes('"Takal\'s fixed picture"'));
  assert.ok(PICTURE.includes('"Show what there is, even 1"'));
  assert.ok(PICTURE.includes("data-auto-thumbs"));
  // The office never sets a fit for live pictures - the rule decides.
  assert.ok(PICTURE.includes('pic.source === "auto"\n            ? <div'));
});

test("the top tabs: one choice for the whole row, and how often it changes", () => {
  assert.ok(TABS.includes('testid="tab-pics"'));
  assert.ok(TABS.includes('{ key: "0", name: "Never" }'));
  assert.ok(TABS.includes("data-tab-picture-words"));
  assert.ok(TABS.includes("rowLive={tabs.pics === \"auto\"}"));
});

test("the preview draws the live pictures, with the same fit rule", () => {
  assert.ok(PREVIEW.includes("liveShown(card.pic, live?.cards[card.key], live?.min)"));
  assert.ok(PREVIEW.includes("tabLiveShown(tabs,"));
  assert.ok(PREVIEW.includes("liveFit(card.key)"));
  assert.ok(PAGE.includes("live={live || undefined}"));
});

test("the page asks the server's own door, once per town", () => {
  assert.ok(API.includes("/admin/home-layout/live-pictures?town=${town}"));
  assert.ok(ROUTER.includes('@router.get("/admin/home-layout/live-pictures"'));
  assert.ok(PAGE.includes("apiClient.getAppHomeLivePictures(town)"));
  assert.ok(PAGE.includes("}, [town]);"));
});

test("no word on the new parts is smaller than 12 px", () => {
  for (const [name, src] of [["parts-picture", PICTURE], ["parts-tabs", TABS], ["parts-cards", CARDS]]) {
    for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      assert.ok(Number(m[1]) >= 12, `${name} uses text-[${m[1]}px]`);
    }
  }
});
