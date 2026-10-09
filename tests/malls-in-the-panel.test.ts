// ─────────────────────────────────────────────────────────────────────────────
// MALLS IN THE PANEL  (Mock 172-6, approved by Sana 8 October 2026; Step 4).
//
// Sana: "if i add a Mall like this in Future, so all must be same as this
// one." The office makes, shows and runs every mall the same way:
//   Stores -> Malls          the list, and Create mall from existing stores
//   a mall's page            stores (add / take out), delivery, staff
//   Create store, several    = a mall, with ONE logo (required)
//   a store's page           "Part of <mall>", and the mall's logo
//   the parcels desk         a mall parcel goes out together
// The money rules are checked as functions; the screens are checked for the
// calls and words that carry the rules.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  wholeRupees, deliveryText, minimumText, rateText, storesWithoutLogo, emptyStores,
  mallFromChoices, readyToMake, partsTravellingWith, shortName,
} from "../src/lib/malls.ts";
import { NAVIGATION, SERVER_RULES, serverSectionFor } from "../src/lib/navigation.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── 1. The money rules ──────────────────────────────────────────────────────

test("mall money is whole rupees: 1000 yes, 999.5 and -1 no, an empty box means its default", () => {
  assert.deepEqual(wholeRupees("1000"), { value: 1000, error: null });
  assert.deepEqual(wholeRupees("1,000"), { value: 1000, error: null });
  assert.equal(wholeRupees("999.5").error, "Whole rupees only, e.g. 1000");
  assert.equal(wholeRupees("-1").error, "Whole rupees only, e.g. 1000");
  assert.deepEqual(wholeRupees("", 0), { value: 0, error: null });
  assert.deepEqual(wholeRupees("  ", null), { value: null, error: null });
});

test("the delivery line says ONE delivery, and whose fee", () => {
  assert.equal(deliveryText({ admin_delivery_fee: null }, 150), "One · Rs 150 (standard fee)");
  assert.equal(deliveryText({ admin_delivery_fee: 200 }, 150), "One · Rs 200 (the mall's own fee)");
  assert.equal(deliveryText({ admin_delivery_fee: null }, null), "One · the standard parcel fee");
  assert.equal(minimumText(1000), "Rs 1,000 · whole mall");
  assert.equal(minimumText(0), "None");
});

test("a store's commission: its own rate, or its department's", () => {
  assert.equal(rateText({ commission_percent: 12 }, "Fashion"), "12% (own rate)");
  assert.equal(rateText({ commission_percent: null }, "Fashion"), "Fashion rate");
});

test("inside its mall a store is called by its own part of the name", () => {
  assert.equal(shortName("Wakeel Shopping Mall - Beauty & Personal Care", "Wakeel Shopping Mall"), "Beauty & Personal Care");
  assert.equal(shortName("Wakeel Shopping Mall – Kids & Toys", "Wakeel Shopping Mall"), "Kids & Toys");
  assert.equal(shortName("Swat Shoes", "Wakeel Shopping Mall"), "Swat Shoes", "another name is shown whole");
  assert.equal(shortName("Wakeel Shopping Mall", "Wakeel Shopping Mall"), "Wakeel Shopping Mall");
});

test("Wakeel today: 4 stores with no logo, 4 with no products", () => {
  const s = [{ has_own_logo: true, products: 48 },
             ...Array.from({ length: 4 }, () => ({ has_own_logo: false, products: 0 }))];
  assert.equal(storesWithoutLogo(s), 4);
  assert.equal(emptyStores(s), 4);
});

const C = (id: string, can: boolean, logo: string | null = null) => ({
  id, name: id, vendor_type: "clothing_store", speed: "standard" as const, image_url: logo,
  has_own_logo: !!logo, is_approved: true, is_open: true, commission_percent: null,
  products: 1, mall_id: null, can_join: can, why_not: can ? null : "Already in a mall",
});

test("only stores that can join are made into a mall, and the logo comes from the first that has one", () => {
  const choices = [C("fa", true), C("home", true, "https://x/logo.png"), C("other", false, "https://x/o.png")];
  const p = mallFromChoices(choices, ["fa", "home", "other", "ghost"]);
  assert.deepEqual(p.ok, ["fa", "home"]);
  assert.deepEqual(p.refused, ["other", "ghost"]);
  assert.equal(p.logoFromStore, "https://x/logo.png", "never the refused store's logo");
});

test("Create mall says what is missing: a name, a store, a logo", () => {
  assert.equal(readyToMake("", ["a"], "x"), "Give the mall a name");
  assert.equal(readyToMake("Wakeel", [], "x"), "Tick at least one store");
  assert.match(readyToMake("Wakeel", ["a"], null) || "", /needs a logo/);
  assert.equal(readyToMake("Wakeel Shopping Mall", ["a"], "x"), null);
});

test("the parcels desk counts the other stores' parts of the same mall order", () => {
  const all = [{ id: "a", mall_order_id: "a" }, { id: "b", mall_order_id: "a" },
               { id: "c", mall_order_id: "a" }, { id: "d", mall_order_id: null }];
  assert.equal(partsTravellingWith(all[0], all), 2);
  assert.equal(partsTravellingWith(all[1], all), 2);
  assert.equal(partsTravellingWith(all[3], all), 0);
});

// ── 2. Where it sits and who may open it ────────────────────────────────────

test("Stores -> Malls is a Stores job, and the server agrees", () => {
  const stores = NAVIGATION.find((i) => i.href === "/dashboard/stores")!;
  const tab = stores.tabs!.find((t) => t.label === "Malls")!;
  assert.equal(tab.href, "/dashboard/stores/malls");
  assert.equal(tab.section, "stores.all");
  assert.ok(SERVER_RULES.some(([p, s]) => p === "/admin/malls" && s === "stores.all"));
  assert.equal(serverSectionFor("/admin/malls/x/stores", "write"), "stores.all");
  assert.ok(tab.calls!.includes("optional:/admin/shop-staff"),
    "the staff logins are the Main Admin's - an extra, never a dead link");
});

test("the mall calls go to the mall doors, and only the Main Admin's go to staff", () => {
  const src = read("src/lib/api-stores.ts");
  const block = src.slice(src.indexOf("── MALLS"), src.indexOf("/** A mall's owner"));
  for (const m of block.matchAll(/`(\/[^`$?]*)/g)) {
    assert.ok(m[1].startsWith("/admin/malls") || m[1] === "/delivery-fee/preview-mall",
      `unexpected door: ${m[1]}`);
  }
  for (const name of ["getMalls", "getMall", "getMallStoreChoices", "createMall", "updateMall",
                      "addMallStores", "removeMallStore", "getMallDeliveryQuote"]) {
    assert.ok(block.includes(`async ${name}(`), name);
  }
  const people = read("src/lib/api-people.ts");
  assert.ok(people.includes("/admin/shop-staff/${encodeURIComponent(staffId)}/mall"));
});

// ── 3. The screens carry the rules ──────────────────────────────────────────

test("the Malls page: Create mall from an owner's stores, only those that can join", () => {
  const src = read("src/app/dashboard/stores/malls/page.tsx");
  assert.ok(src.includes("apiClient.getMallStoreChoices(v.id)"));
  assert.ok(src.includes("disabled={!c.can_join}"), "a store that cannot join cannot be ticked");
  assert.ok(src.includes("{c.why_not}"), "and says why");
  assert.ok(src.includes("readyToMake(name, plan.ok, usedLogo)"));
});

test("a mall's page: add / take out stores, delivery in whole rupees, staff for the Main Admin only", () => {
  const src = read("src/app/dashboard/stores/malls/[id]/page.tsx");
  assert.ok(src.includes("apiClient.removeMallStore(id, takeOut.id)"));
  assert.ok(src.includes("Its products, orders and payouts stay exactly as they are"));
  assert.ok(src.includes("apiClient.addMallStores(mall.id, ticked)"));
  assert.ok(src.includes("admin_delivery_fee: own ? feeRead.value : null"));
  assert.ok(src.includes("wholeRupees(minimum, 0)"));
  assert.ok(src.includes("{isMain && ("), "staff drawn for the Main Admin only");
  assert.ok(src.includes("A mall needs a logo - it cannot be removed"));
});

test("Create store with several kinds makes a MALL, with a required logo, and no rider store", () => {
  const src = read("src/app/dashboard/stores/parts-create-store.tsx");
  assert.ok(src.includes("const makingMall = many && picked.length > 1;"));
  assert.ok(src.includes('if (makingMall && !logo) e.logo ='), "the logo is required for a mall");
  assert.ok(src.includes("apiClient.createMall({"), "the mall is made right after its stores");
  assert.ok(src.includes("store_ids: res.stores.map((st) => st.id)"));
  assert.ok(src.includes("const notInMall = many && byRider(v.value);"), "a rider kind cannot be ticked");
  assert.ok(src.includes("if (byRider(v)) return;"), "...nor slip in another way");
  assert.ok(src.includes("The shops were made, but the mall was not"), "a failed mall says so and where to finish");
});

test("a store's page shows where it belongs, and the mall's logo when it has none", () => {
  const src = read("src/app/dashboard/stores/[id]/page.tsx");
  assert.ok(src.includes("🛍️ Part of {mall.name} ›"));
  assert.ok(src.includes("r.image_url || mall?.image_url"));
  assert.ok(src.includes("mall={mall ? { id: mall.id, name: mall.name, storeCount: mall.store_count } : null}"));
});

test("a staff login can be given the whole mall - and back - by the Main Admin", () => {
  const src = read("src/app/dashboard/stores/[id]/parts-staff.tsx");
  assert.ok(src.includes("apiClient.setShopStaffMall(s.id, on ? mall.id : null)"));
  assert.ok(src.includes("...(mall && wholeMall ? { mall_id: mall.id } : {}),"));
  assert.ok(src.includes('"Give the whole mall"'));
});

test("the parcels desk marks a mall parcel", () => {
  const src = read("src/app/dashboard/orders/parcels/page.tsx");
  assert.ok(src.includes("partsTravellingWith(p, parcels)"));
  assert.ok(src.includes("🛍️ Mall order"));
});
