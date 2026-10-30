// A FINISHED SHOP MOVES TO "READY TO SHOW" BY ITSELF, AND SEARCH LOOKS IN
// EVERY LIST.  (Sana, 30 Oct 2026)
//
//   "The Last hourly report says 3 stores are ready but nothing show here"
//   "the Assistant should move the ready stores to the ready tab after
//    checking if it ready" - "A" (the chip shows how many)
//   "The search should show all store" - "AL Haram" found nothing on the Live
//    list, because Al Haram Pharmacy is Hidden.
//
// The server decides who is ready and hands the reader the pictures of
// finished shops FIRST (backend product_checks.shop_pictures_to_read). These
// checks hold the panel's half: the reader sends a LOGO's shop and key, tells
// the page when something was saved, the page asks Ready to show again
// (fresh), and while words are typed the chosen chip does not narrow the
// search.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const READER = readFileSync("src/lib/hooks/useBackgroundPictureReader.ts", "utf8");
const PAGE = readFileSync("src/app/dashboard/stores/page.tsx", "utf8");
const API = readFileSync("src/lib/api-stores.ts", "utf8");
const SERVER = readFileSync("../swat-delivery-app/backend/product_checks.py", "utf8");

test("the reader sends which shop and which picture - so a LOGO can be kept", () => {
  assert.match(READER, /read\.push\(\{ product_id: p\.product_id, restaurant_id: p\.restaurant_id, item_key: p\.item_key,/);
  assert.match(API, /export type PictureToRead = \{ product_id: string; restaurant_id: string; item_key\?: string;/);
  // The server keeps a logo only under item_key "logo" with its shop.
  assert.match(SERVER, /str\(\(c or \{\}\)\.get\("item_key"\) or ""\) == "logo" and \(c or \{\}\)\.get\("restaurant_id"\)/);
});

test("after a save, the page is told - and only when something was saved", () => {
  assert.match(READER, /export const PICTURES_READ_EVENT = "takal:pictures-read";/);
  assert.match(READER, /const \{ saved \} = await apiClient\.savePictureReads\(read\);\s*if \(saved > 0 && typeof window !== "undefined"\) window\.dispatchEvent\(new Event\(PICTURES_READ_EVENT\)\);/);
});

test("the Stores page asks Ready to show again, fresh, when pictures were read", () => {
  assert.match(PAGE, /import \{ PICTURES_READ_EVENT \} from "@\/lib\/hooks\/useBackgroundPictureReader";/);
  assert.match(PAGE, /apiClient\.getReadyToShow\(true\)\.then\(\(d\) => \{ setReadyData\(d\); setReadyFailed\(false\); \}\)/);
  assert.match(PAGE, /window\.addEventListener\(PICTURES_READ_EVENT, again\);\s*return \(\) => window\.removeEventListener\(PICTURES_READ_EVENT, again\);/);
  // The chip's number is the Ready list's length (Sana: "A").
  assert.match(PAGE, /v === "ready" \? \(readyData \? readyData\.ready\.length : "…"\)/);
});

test("search looks in every list while words are typed", () => {
  assert.match(PAGE, /const searching = !!search\.trim\(\);/);
  // What decides which rows show is the condition - it must let every list in.
  assert.match(PAGE, /const matchesStatus = searching \|\| inView\(r, view\);/);
  // The Waiting list's own boxes and layout step aside while searching.
  assert.match(PAGE, /const waitingView = view === "pending" && !searching;/);
  assert.match(PAGE, /const slim = view === "rejected" && !searching;/);
  assert.match(PAGE, /const matchesReady = !waitingView \|\|/);
  assert.match(PAGE, /const matchesQueue = !waitingView \|\|/);
  // The owner's name and the phone still find a shop.
  assert.match(PAGE, /`\$\{r\.owner_name \|\| ""\} \$\{r\.phone \|\| ""\}`\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\)/);
});

test("the page says it searched every list", () => {
  assert.match(PAGE, /\{searching && \(\s*<p data-testid="search-every-list"/);
  assert.match(PAGE, /Searching every list - Live, Hidden, Waiting, Suspended and Rejected\. Each shop shows where it is\./);
  assert.match(PAGE, /\{searching \? "No shop matches your search - every list was searched\."/);
});
