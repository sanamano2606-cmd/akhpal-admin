/**
 * SEVERAL SHOPS IN ONE ORDER (Mock 181, Sana 12 October 2026).
 *
 *   "B + C. all the control must be in admin panel too, from where i can
 *    change any of the rate later and even swich off" -> "approved".
 *
 * The card lives on Settings -> Delivery fees. These checks hold its rules
 * (src/lib/trip-settings.ts), the page, and the server to the same field names
 * and the same limits, so a rename on one side cannot leave a box saving into
 * nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  tripFormFrom,
  tripChanges,
  tripExampleLines,
  type TripExample,
} from "../src/lib/trip-settings.ts";

const root = join(import.meta.dirname, "..");
const page = readFileSync(join(root, "src/app/dashboard/settings/delivery-fees/page.tsx"), "utf8");
const card = readFileSync(
  join(root, "src/app/dashboard/settings/delivery-fees/parts-several-shops.tsx"), "utf8");
const nav = readFileSync(join(root, "src/lib/navigation.ts"), "utf8");
const api = readFileSync(join(root, "src/lib/api-money.ts"), "utf8");
const backend = join(root, "..", "swat-delivery-app", "backend");

const SAVED = {
  trip_enabled: false, parcel_basket_enabled: false, trip_stop_fee: 50,
  trip_stop_bonus: 30, trip_within_km: 2, trip_max_shops: 3,
};

test("the card reads the six saved settings", () => {
  const { form, bonusIsMine, notRunYet } = tripFormFrom(SAVED);
  assert.deepEqual(form, {
    trip_enabled: false, parcel_basket_enabled: false, trip_stop_fee: "50",
    trip_stop_bonus: "30", trip_within_km: "2", trip_max_shops: "3",
  });
  assert.equal(bonusIsMine, true);
  assert.equal(notRunYet, false);
});

test("an admin without Rider pay rules sees the bonus locked, not blank", () => {
  const { trip_stop_bonus: _gone, ...row } = SAVED;
  const { bonusIsMine } = tripFormFrom(row);
  assert.equal(bonusIsMine, false);
  const was = tripFormFrom(row).form;
  const out = tripChanges(was, { ...was, trip_stop_bonus: "99", trip_stop_fee: "60" }, false);
  assert.deepEqual(out, { payload: { trip_stop_fee: 60 } }, "the bonus is never sent");
});

test("before migration 130 the card says so", () => {
  assert.equal(tripFormFrom({ base_delivery_fee: 100 }).notRunYet, true);
  assert.match(card, /migration 130/);
});

test("Save sends ONLY what changed - each switch on its own", () => {
  const was = tripFormFrom(SAVED).form;
  assert.deepEqual(tripChanges(was, was, true), { payload: {} });
  assert.deepEqual(tripChanges(was, { ...was, trip_enabled: true }, true),
                   { payload: { trip_enabled: true } });
  assert.deepEqual(tripChanges(was, { ...was, parcel_basket_enabled: true }, true),
                   { payload: { parcel_basket_enabled: true } });
  assert.deepEqual(
    tripChanges(was, { ...was, trip_stop_fee: "40", trip_stop_bonus: "35",
                       trip_within_km: "1.5", trip_max_shops: "4" }, true),
    { payload: { trip_stop_fee: 40, trip_stop_bonus: 35, trip_within_km: 1.5, trip_max_shops: 4 } });
});

test("the same limits as the server and the database", () => {
  const was = tripFormFrom(SAVED).form;
  const bad: [Partial<typeof was>, RegExp][] = [
    [{ trip_stop_fee: "-1" }, /whole rupees/],
    [{ trip_stop_fee: "50.5" }, /whole rupees/],
    [{ trip_stop_fee: "" }, /whole rupees/],
    [{ trip_stop_bonus: "5001" }, /whole rupees from Rs 0 to Rs 5,000/],
    [{ trip_within_km: "0" }, /more than 0 km/],
    [{ trip_within_km: "51" }, /at most 50 km/],
    [{ trip_max_shops: "1" }, /from 2 to 5/],
    [{ trip_max_shops: "6" }, /from 2 to 5/],
    [{ trip_max_shops: "2.5" }, /from 2 to 5/],
  ];
  for (const [change, words] of bad) {
    const out = tripChanges(was, { ...was, ...change }, true);
    assert.ok("error" in out, JSON.stringify(change));
    assert.match((out as { error: string }).error, words);
  }
  const server = readFileSync(join(backend, "routers", "admin_settings.py"), "utf8");
  assert.match(server, /must be whole rupees from Rs 0 to/);
  assert.match(server, /must be more than 0 km and at most 50 km/);
  assert.match(server, /The most shops in one trip must be from 2 to 5/);
});

test("the server takes every field the card sends", () => {
  const shared = readFileSync(join(backend, "routers", "admin_shared.py"), "utf8");
  for (const f of ["trip_enabled", "parcel_basket_enabled", "trip_stop_fee",
                   "trip_stop_bonus", "trip_within_km", "trip_max_shops"]) {
    assert.match(shared, new RegExp(`\\b${f}: Optional\\[`), f);
    assert.match(card + readFileSync(join(root, "src/lib/trip-settings.ts"), "utf8"),
                 new RegExp(f), f);
  }
});

const EXAMPLE: TripExample = {
  trip_enabled: true, parcel_basket_enabled: false, shop_a_km: 3, shop_b_km: 4, apart_km: 1,
  goes_together: true, too_far_apart: false, separately: 515, separately_each: [235, 280],
  trip_km: 4, trip_fee: 280, stop_fee: 50, together: 330, saves: 185, rider_trip_pay: 220,
  rider_stop_bonus: 30, rider_pays: 250, parcel_fee: 300,
};

test("the worked example prints the server's figures, worked out nowhere else", () => {
  const lines = tripExampleLines(EXAMPLE);
  assert.equal(lines[1], "Separately: Rs 235 + Rs 280 = Rs 515.");
  assert.equal(lines[2], "One trip: 4 km = Rs 280 + Rs 50 for the second shop = Rs 330. The customer saves Rs 185.");
  assert.equal(lines[3], "The rider is paid Rs 220 for the trip + Rs 30 for the second shop = Rs 250.");
  assert.equal(lines[4], "Parcel shops to the same Takal office pay Rs 300 once, not once each.");
  assert.match(tripExampleLines({ ...EXAMPLE, too_far_apart: true, goes_together: false }).join(" "),
               /too far apart/);
  assert.match(tripExampleLines({ ...EXAMPLE, goes_together: false }).join(" "),
               /more than separately/);
  const lib = readFileSync(join(root, "src/lib/trip-settings.ts"), "utf8");
  assert.doesNotMatch(lib, /per_km_rate|base_delivery_fee/, "no second copy of the fee formula");
  assert.match(api, /getTripExample\(\) \{\s*return this\.request\("\/admin\/settings\/trip-example"\)/);
});

test("the example is guarded by the delivery-fee key, above /admin/settings", () => {
  const i = nav.indexOf('["/admin/settings/trip-example", "settings.delivery-fees"]');
  assert.ok(i > 0 && i < nav.indexOf('["/admin/settings", ['));
  const guard = readFileSync(join(backend, "app_guard.py"), "utf8");
  assert.ok(guard.includes('("/admin/settings/trip-example", "settings.delivery-fees")'));
});

test("the page shows the card, with its own Save, under the fee Save", () => {
  assert.match(page, /import SeveralShopsCard from "\.\/parts-several-shops";/);
  assert.match(page, /<SeveralShopsCard settings=\{saved\} \/>/);
  assert.ok(page.indexOf("Save Changes") < page.indexOf("<SeveralShopsCard"));
  assert.doesNotMatch(page, /sticky bottom-6/, "the fee Save no longer floats over the card");
  assert.match(card, /role="switch"/);
  assert.equal((card.match(/<OnOff /g) || []).length, 2, "two switches: B and C");
  assert.match(card, /tripChanges\(was, form, bonusIsMine\)/);
  assert.match(card, /setWas\(form\)/, "after a save, the saved values are the new start");
});
