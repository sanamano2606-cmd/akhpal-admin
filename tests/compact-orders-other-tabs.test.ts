/**
 * MOCK 193 - COMPACT ORDERS, the other three tabs: Returns & Refunds, Parcels,
 * Offices (Sana 14 Oct 2026: "GO").
 *
 * Measured in a browser on the same fake data at 1536 x 864: the whole
 * Parcels page went from 1,130 px to 864 px (one screen). Only spacing and
 * placement changed - these guard the new look, and that every word, box and
 * button that was on these screens is still there.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const RETURNS = read("app/dashboard/orders/returns/page.tsx");
const PARCELS = read("app/dashboard/orders/parcels/page.tsx");
const OFFICES = read("app/dashboard/orders/offices/page.tsx");

test("Returns: title, sentence, count, list box and Refresh on ONE line - the separate filter box is gone", () => {
  assert.match(RETURNS, /<div className="space-y-2\.5">/);
  assert.match(RETURNS, /<div className="ml-auto flex items-center gap-2">[\s\S]{0,200}awaiting review[\s\S]{0,700}<Button onClick=\{fetchReturns\}>Refresh<\/Button>/);
  assert.doesNotMatch(RETURNS, /bg-white rounded-lg border border-takal-line p-4 flex items-center gap-4 flex-wrap/, "no filter card");
  assert.doesNotMatch(RETURNS, /px-6 py-4/, "cells half as roomy");
  for (const w of ["Returns &amp; Refunds", "Customer return requests", "awaiting review", "Pending", "Approved",
    "Rejected", "All", "Order", "Customer", "Amount", "Reason", "Requested", "Status", "Actions"]) {
    assert.ok(RETURNS.includes(w), w);
  }
});

test("Parcels: one header line, the sentence whole on hover; tighter staff strip and cards", () => {
  assert.match(PARCELS, /<h2 className="shrink-0 text-lg font-bold text-takal-ink">Parcels<\/h2>\s*<p className="min-w-0 flex-1 truncate text-sm text-takal-ink-soft"\s+title="Standard \(marketplace\) orders handled through a Takal office\./);
  assert.match(PARCELS, /<div className="bg-white border border-takal-line rounded-xl px-4 py-2\.5">/, "staff strip");
  assert.match(PARCELS, /<th className="py-1 pr-3 font-bold">STAFF<\/th>/);
  assert.match(PARCELS, /<td className="py-1\.5 px-3 whitespace-nowrap">/, "each person's figures on one line");
  assert.match(PARCELS, /<div key=\{p\.id\} className="border border-takal-line rounded-lg px-3 py-2 bg-white">/, "cards");
  assert.match(PARCELS, /\[p\.vendor_phone \? `Vendor: \$\{p\.vendor_phone\}` : "", p\.receiver_name \? `To: \$\{p\.receiver_name\}` : ""\]\.filter\(Boolean\)\.join\(" · "\)/,
    "Vendor and To on one line");
  assert.match(PARCELS, /title=\{p\.delivery_address\}/, "a long address is whole on hover");
  assert.match(PARCELS, /<div className="flex gap-3 flex-col lg:flex-row">/);
  for (const w of ["Delivery staff today", "is what the parcels are worth", "should hand back", "HANDED TODAY",
    "DELIVERED TODAY", "STILL WITH THEM", "Quick", "food orders go straight to a rider"]) {
    assert.ok(PARCELS.includes(w), w);
  }
});

test("Offices: one header line, cards 2-3 across, the cash note on the label's hover, address · phone on one line", () => {
  assert.match(OFFICES, /<h2 className="shrink-0 text-lg font-bold text-takal-ink">Takal Offices<\/h2>/);
  assert.match(OFFICES, /title="Drop-off points for Standard \(marketplace\) parcels\./);
  assert.match(OFFICES, /<div className="grid gap-2\.5 md:grid-cols-2 xl:grid-cols-3">/);
  assert.match(OFFICES, /title="“Cash in the room” is what the parcels held here are worth, not notes in a drawer\.">\s*Cash in the room ⓘ/);
  assert.doesNotMatch(OFFICES, /<p className="mt-1\.5 text-\[10\.5px\] leading-snug text-takal-ink-soft">/, "the note line under each card is gone");
  assert.match(OFFICES, /\[h\.address, h\.phone \? `Phone: \$\{h\.phone\}` : ""\]\.filter\(Boolean\)\.join\(" · "\)/);
  for (const w of ["Quick food", "orders never use an office", "Cash in the room"]) assert.ok(OFFICES.includes(w), w);
});

test("only looks changed: every server call, click, box and choice is still there", () => {
  // Counted on the three files BEFORE Mock 193 - exactly the same after it.
  const count = (s: string) => {
    const out: Record<string, number> = {};
    for (const m of s.match(/apiClient\.\w+|onClick=|onChange=|<option /g) ?? []) out[m] = (out[m] ?? 0) + 1;
    return out;
  };
  assert.deepEqual(count(RETURNS), {
    "apiClient.getReturns": 1, "apiClient.approveReturn": 1, "apiClient.rejectReturn": 1,
    "onChange=": 1, "onClick=": 2, "<option ": 4,
  });
  assert.deepEqual(count(PARCELS), {
    "apiClient.deliverParcel": 2, "apiClient.dispatchParcel": 1, "apiClient.getDeliveryStaff": 2,
    // getOrderFull 1, was 2 (money audit M11, 21 Oct 2026): the receipts and
    // the labels now read the parcels through ONE shared reader
    // (gatherPapers), so one mall parcel prints one paper. Same server call.
    "apiClient.getHubParcels": 1, "apiClient.getHubs": 1, "apiClient.getOrderFull": 1, "apiClient.getSettings": 1,
    "apiClient.receiveParcel": 1, "apiClient.resetParcel": 1, "onChange=": 3, "onClick=": 5, "<option ": 4,
  });
  assert.deepEqual(count(OFFICES), {
    "apiClient.createHub": 1, "apiClient.getHubs": 1, "apiClient.updateHub": 2, "onChange=": 6, "onClick=": 5,
  });
});
