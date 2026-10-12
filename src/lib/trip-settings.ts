/**
 * SEVERAL SHOPS IN ONE ORDER - the panel's card (Mock 181, Sana 12 Oct 2026).
 *
 *   "B + C. all the control must be in admin panel too, from where i can
 *    change any of the rate later and even swich off" -> "approved".
 *
 * B  one rider for nearby rider shops: the whole trip's km + a fee per extra
 *    shop for the customer; the rider's trip pay + a bonus per extra shop.
 * C  one parcel fee for parcel shops sending to the same Takal office.
 *
 * This file holds the card's rules with no screen attached, so they can be
 * checked with plain values (tests/several-shops-one-order.test.ts). The
 * server refuses exactly the same things (routers/admin_settings.py) and the
 * database a third time (migration 130, admin_settings_trip_rates_sane).
 *
 * The worked example under the rates is NOT worked out here: it is asked for
 * from /admin/settings/trip-example, which uses the code that bills a real
 * trip. A second copy of a price formula is how the Rider Pay page once
 * showed a price nobody was ever charged.
 */

import { money } from "./format.ts";

export const MOST_RUPEES = 5000;
export const MOST_KM = 50;

export interface TripForm {
  trip_enabled: boolean;
  parcel_basket_enabled: boolean;
  trip_stop_fee: string;
  trip_stop_bonus: string;
  trip_within_km: string;
  trip_max_shops: string;
}

export type TripPayload = Partial<{
  trip_enabled: boolean;
  parcel_basket_enabled: boolean;
  trip_stop_fee: number;
  trip_stop_bonus: number;
  trip_within_km: number;
  trip_max_shops: number;
}>;

const text = (v: unknown, fallback: string) =>
  v === null || v === undefined || v === "" ? fallback : String(Number(v));

/** The form as the saved settings say. `bonusIsMine` is false when this admin
 *  does not own Rider pay rules: the server then leaves trip_stop_bonus out of
 *  the settings it sends, and the box is shown locked rather than blank. */
export function tripFormFrom(s: Record<string, unknown> | null | undefined): {
  form: TripForm;
  bonusIsMine: boolean;
  notRunYet: boolean;
} {
  const row = s ?? {};
  return {
    form: {
      trip_enabled: row.trip_enabled === true,
      parcel_basket_enabled: row.parcel_basket_enabled === true,
      trip_stop_fee: text(row.trip_stop_fee, "50"),
      trip_stop_bonus: text(row.trip_stop_bonus, "30"),
      trip_within_km: text(row.trip_within_km, "2"),
      trip_max_shops: text(row.trip_max_shops, "3"),
    },
    bonusIsMine: "trip_stop_bonus" in row,
    // Migration 130 not run: the row has none of the six. Saving would be
    // refused by the database, so the card says so instead of pretending.
    notRunYet: !("trip_enabled" in row) && !("trip_stop_fee" in row),
  };
}

function wholeRupees(raw: string, what: string): number | string {
  const n = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(n) || n < 0 || n > MOST_RUPEES || !Number.isInteger(n)) {
    return `${what} must be whole rupees from ${money(0)} to ${money(MOST_RUPEES)}.`;
  }
  return n;
}

/** What Save sends: ONLY what changed since the settings were read, so an
 *  admin who owns the delivery fees but not rider pay can still save the fee
 *  without the server refusing the whole save over the bonus. Returns the
 *  words to show instead when a box is wrong. */
export function tripChanges(
  was: TripForm,
  now: TripForm,
  bonusIsMine: boolean,
): { payload: TripPayload } | { error: string } {
  const out: TripPayload = {};
  if (now.trip_enabled !== was.trip_enabled) out.trip_enabled = now.trip_enabled;
  if (now.parcel_basket_enabled !== was.parcel_basket_enabled) {
    out.parcel_basket_enabled = now.parcel_basket_enabled;
  }
  if (now.trip_stop_fee !== was.trip_stop_fee) {
    const n = wholeRupees(now.trip_stop_fee, "The fee per extra shop");
    if (typeof n === "string") return { error: n };
    out.trip_stop_fee = n;
  }
  if (bonusIsMine && now.trip_stop_bonus !== was.trip_stop_bonus) {
    const n = wholeRupees(now.trip_stop_bonus, "The rider's bonus per extra shop");
    if (typeof n === "string") return { error: n };
    out.trip_stop_bonus = n;
  }
  if (now.trip_within_km !== was.trip_within_km) {
    const n = Number(now.trip_within_km.trim());
    if (now.trip_within_km.trim() === "" || !Number.isFinite(n) || n <= 0 || n > MOST_KM) {
      return { error: `How far apart the shops may be must be more than 0 km and at most ${MOST_KM} km.` };
    }
    out.trip_within_km = Math.round(n * 100) / 100;
  }
  if (now.trip_max_shops !== was.trip_max_shops) {
    const n = Number(now.trip_max_shops.trim());
    if (!Number.isInteger(n) || n < 2 || n > 5) {
      return { error: "The most shops in one trip must be from 2 to 5." };
    }
    out.trip_max_shops = n;
  }
  return { payload: out };
}

/** What /admin/settings/trip-example answers. */
export interface TripExample {
  trip_enabled: boolean;
  parcel_basket_enabled: boolean;
  shop_a_km: number;
  shop_b_km: number;
  apart_km: number;
  goes_together: boolean;
  too_far_apart: boolean;
  separately: number;
  separately_each: number[];
  trip_km: number;
  trip_fee: number;
  stop_fee: number;
  together: number;
  saves: number;
  rider_trip_pay: number;
  rider_stop_bonus: number;
  rider_pays: number;
  parcel_fee: number;
}

const rs = money;
const km = (n: number) => `${Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(1)} km`;

/** The worked example, in the words the card prints. Plain lines - every
 *  figure in them came from the server. */
export function tripExampleLines(e: TripExample): string[] {
  const lines = [
    `Two rider shops ${km(e.apart_km)} apart, ${km(e.shop_a_km)} and ${km(e.shop_b_km)} from the customer:`,
    `Separately: ${rs(e.separately_each[0])} + ${rs(e.separately_each[1])} = ${rs(e.separately)}.`,
  ];
  if (e.too_far_apart) {
    lines.push("With the distance set below, these two shops are too far apart - they go separately.");
  } else if (!e.goes_together) {
    lines.push(`One trip would cost ${rs(e.together)} - more than separately, so they go separately.`);
  } else {
    lines.push(
      `One trip: ${km(e.trip_km)} = ${rs(e.trip_fee)} + ${rs(e.stop_fee)} for the second shop = ` +
        `${rs(e.together)}. The customer saves ${rs(e.saves)}.`,
    );
    lines.push(
      `The rider is paid ${rs(e.rider_trip_pay)} for the trip + ${rs(e.rider_stop_bonus)} for the ` +
        `second shop = ${rs(e.rider_pays)}.`,
    );
  }
  lines.push(`Parcel shops to the same Takal office pay ${rs(e.parcel_fee)} once, not once each.`);
  return lines;
}
