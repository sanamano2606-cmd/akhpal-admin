/**
 * A REJECTED APPLICATION SAYS SO (Mock 161, approved by Sana 5 October 2026 -
 * admin actions audit M14).
 *
 * Reject asks for the reason they are told; a rejected rider or shop shows a
 * red "Rejected" label with the reason, has its own filter, and one button,
 * "Approve after all". The server (rejection.py) refuses a reject without a
 * reason, so the panel must always send one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const dialog = read("src/components/RejectReasonDialog.tsx");
const riders = read("src/app/dashboard/riders/page.tsx");
const stores = read("src/app/dashboard/stores/page.tsx");
const people = read("src/lib/api-people.ts");
const shopsApi = read("src/lib/api-stores.ts");
const server = readFileSync(
  join(root, "..", "swat-delivery-app", "backend", "rejection.py"), "utf8");

test("both reject calls send the reason in the body", () => {
  for (const [src, fn] of [[people, "rejectRider"], [shopsApi, "rejectRestaurant"]] as const) {
    const at = src.indexOf(`async ${fn}(`);
    const body = src.slice(at, at + 400);
    assert.match(body, /reason: string\)/, `${fn} takes no reason`);
    assert.match(body, /body: JSON\.stringify\(\{ reason \}\)/, `${fn} never sends it`);
  }
});

test("the window and the server agree on the shortest reason", () => {
  assert.match(dialog, /export const REASON_MIN = 3;/);
  assert.match(server, /REASON_MIN = 3\b/);
  assert.match(dialog, /export const REASON_MAX = 300;/);
  assert.match(server, /REASON_MAX = 300\b/);
});

test("Yes, reject stays grey until there is a reason", () => {
  assert.match(dialog, /disabled=\{!ready\}/);
  assert.match(dialog, /const ready = reasonIsEnough\(reason\);/);
  assert.match(dialog, /onClick=\{\(\) => ready && onConfirm\(tidyReason\(reason\)\)\}/);
});

test("the window opens empty every time, never with the last one's reason", () => {
  assert.match(dialog, /if \(open\) setReason\(""\);/);
});

test("the suggested reasons are the ones in the approved mock", () => {
  for (const r of ["CNIC photo unclear", "Phone not answering",
                   "Vehicle papers missing", "Outside our area",
                   "Shop photo unclear", "Address could not be checked",
                   "Not a shop we can list"]) {
    assert.ok(dialog.includes(`"${r}"`), r);
  }
});

test("a rejected rider or shop is REJECTED, not pending, on both lists", () => {
  for (const [name, src] of [["riders", riders], ["stores", stores]] as const) {
    assert.match(src, /: r(?:\.is_approved)? \? "approved"\s*\n\s*: r\.rejected_at \? "rejected"/,
                 `${name}: a rejected one still reads as pending`);
    assert.match(src, /<option value="rejected">Rejected<\/option>/, `${name}: no filter`);
    assert.match(src, /Approve after all/, `${name}: no way to change your mind`);
    assert.match(src, /rejectedLine\(/, `${name}: the reason is not shown`);
    assert.match(src, /<RejectReasonDialog/, `${name}: reject does not ask why`);
  }
});

test("Approve after all is the plain Approve (the server clears the rejection)", () => {
  assert.match(riders, /status === "rejected" && \(\s*<Button[^>]*onClick=\{\(\) => approve\(r\)\}/);
  // Mock 165 (6 Oct 2026): the same 5-product rule now stands in front of it -
  // under 5 a sub-admin sees why, the main admin gets "Approve anyway".
  assert.match(stores, /deriveStatus\(restaurant\) === "rejected" && \([\s\S]{0,200}?approveState\(restaurant, isMain\)[\s\S]{0,400}?handleApprove\(restaurant\.id\)/);
  assert.match(server, /def clear_rejection/);
});

test("the shop label never borrows the ORDER word for rejected", () => {
  assert.match(stores, /if \(status === "rejected"\) \{\s*return <Badge tone="bad"/);
});

test("only takal colours that exist", () => {
  for (const src of [dialog, riders, stores]) {
    assert.ok(!src.includes("takal-surface"));
  }
});
