/**
 * A RIDER'S CNIC PICTURES IN THE PANEL (Mock 163, approved by Sana on
 * 5 October 2026: "Yes both sides / approved and what ever your recommendation").
 *
 *   * the rider's page shows the CNIC number and both pictures, from links that
 *     last 10 minutes (the server writes every look in the Audit Log)
 *   * Approve asks first when a rider has not sent them - it does NOT block
 *     the riders who signed up before the pictures were asked for
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CNIC_LINK_SECONDS, CNIC_LINK_REFRESH_AFTER_MS, approveNeedsCnicWarning,
  cnicLinkStillGood, cnicPicturesKnown, hasBothCnicPictures, isSafeCnicLink,
  missingCnicSides,
} from "../src/lib/cnic-pictures.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const card = read("src/domains/riders/RiderCnicCard.tsx");
const detail = read("src/app/dashboard/riders/[id]/page.tsx");
const list = read("src/app/dashboard/riders/page.tsx");
const people = read("src/lib/api-people.ts");
const backend = (p: string) =>
  readFileSync(join(root, "..", "swat-delivery-app", "backend", p), "utf8");

const both = { cnic_front_path: "r1/cnic-front-a.jpg", cnic_back_path: "r1/cnic-back-b.jpg" };

test("Approve asks first only when the pictures are missing", () => {
  assert.equal(approveNeedsCnicWarning({ cnic_front_path: null, cnic_back_path: null }), true);
  assert.equal(approveNeedsCnicWarning({ ...both, cnic_back_path: "" }), true);
  assert.equal(approveNeedsCnicWarning(both), false);
});

test("a server from before migration 122 warns about nothing", () => {
  assert.equal(cnicPicturesKnown({ id: "r1", cnic: "15602-1234567-1" }), false);
  assert.equal(approveNeedsCnicWarning({ id: "r1" }), false);
  assert.equal(hasBothCnicPictures(null), false);
});

test("the warning names what is missing", () => {
  assert.equal(missingCnicSides({}), "both sides");
  assert.equal(missingCnicSides({ cnic_back_path: "x" }), "the front");
  assert.equal(missingCnicSides({ cnic_front_path: "x" }), "the back");
  assert.equal(missingCnicSides(both), "");
});

test("the panel's 10 minutes is the server's 10 minutes", () => {
  assert.equal(CNIC_LINK_SECONDS, 600);
  assert.match(backend("rider_documents.py"), /^SIGNED_LINK_SECONDS = 600\b/m);
  assert.match(card, /The links work for 10 minutes/);
});

test("a link is asked for again before it runs out", () => {
  const t0 = 1_000_000;
  assert.equal(cnicLinkStillGood(t0, t0 + 60_000), true);
  assert.equal(cnicLinkStillGood(t0, t0 + CNIC_LINK_REFRESH_AFTER_MS), false);
  assert.ok(CNIC_LINK_REFRESH_AFTER_MS < CNIC_LINK_SECONDS * 1000);
  assert.match(card, /if \(!cnicLinkStillGood\(fetchedAt, Date\.now\(\)\)\) current = await load\(\);/);
});

test("only a signed link to the PRIVATE store is ever shown or opened", () => {
  const good = "https://aexrvwtrjkguymfbvtyx.supabase.co/storage/v1/object/sign/rider-documents/r1/cnic-front-a.jpg?token=abc";
  assert.equal(isSafeCnicLink(good), true);
  // the public store, a plain address, another site, script
  assert.equal(isSafeCnicLink(good.replace("rider-documents", "images")), false);
  assert.equal(isSafeCnicLink("https://x.supabase.co/storage/v1/object/public/rider-documents/a.jpg"), false);
  assert.equal(isSafeCnicLink("http://x.supabase.co/storage/v1/object/sign/rider-documents/a.jpg"), false);
  assert.equal(isSafeCnicLink("javascript:alert(1)"), false);
  assert.equal(isSafeCnicLink(null), false);
  assert.match(card, /isSafeCnicLink\(url\) \? \(/);
});

test("the picture's secret link is not handed to other sites", () => {
  assert.match(card, /referrerPolicy="no-referrer"/);
  assert.match(card, /tab\.opener = null/);
});

test("the rider's page carries the CNIC card, from the right door", () => {
  assert.match(detail, /<RiderCnicCard riderId=\{id\} cnic=\{r\.cnic\} \/>/);
  assert.match(people, /async getRiderCnicPictures\(riderId: string\) \{\s*return this\.request\(`\/admin\/riders\/\$\{riderId\}\/cnic-pictures`\);/);
  assert.match(backend("routers/admin_riders.py"), /@router\.get\("\/admin\/riders\/\{rider_id\}\/cnic-pictures"/);
});

test("no pictures yet is said plainly, not left as an empty box", () => {
  assert.match(card, /No CNIC pictures yet\./);
});

test("Approve and Approve after all both go through the warning", () => {
  assert.match(list, /const approve = \(r: Rider\) =>\s*approveNeedsCnicWarning\(r\)\s*\? setPending\(\{ rider: r, action: "approve" \}\)/);
  assert.match(list, /title="Approve without CNIC pictures\?"/);
  assert.match(list, /onConfirm=\{confirmApprove\}/);
  // not a red "danger" box - approving is not destroying anything
  assert.match(list, /open=\{pending\?\.action === "approve"\}\s*busy=\{busyId !== null\}\s*danger=\{false\}/);
});
