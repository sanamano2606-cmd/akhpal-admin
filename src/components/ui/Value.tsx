"use client";

/**
 * Money and dates, always drawn the same way.
 *
 * There are shared helpers for both in lib/format.ts, written specifically to
 * fix two real bugs - a rounded RATE that no longer matched the server, and
 * server times with no timezone marker landing about five hours out in
 * Pakistan. Six places went around them and called the browser's own date
 * formatter instead. Two of those six were the AUDIT LOG and PROMO EXPIRY
 * DATES, where being five hours out is the whole point of the field.
 *
 * Using a component instead of a function call makes going around it something
 * you have to do on purpose.
 */

import { money, moneyExact, fmtDate, fmtDateTime } from "@/lib/format";

/** An AMOUNT somebody acts on - an order total, a payout, a balance.
 *  Whole rupees, because the figure on screen must equal the figure paid. */
export function Money({ value, tone }: { value: any; tone?: "in" | "out" }) {
  // Brand Kit meaning colours - green is money in, red is money out.
  const cls =
    tone === "in" ? "text-takal-green" : tone === "out" ? "text-takal-red" : "";
  return <span className={`tabular-nums ${cls}`}>{money(value)}</span>;
}

/** A RATE or a SETTING - Rs 12.5 per km. Keeps the decimals, because a rate
 *  rounded to Rs 13 is not a rounded number, it is a wrong setting. */
export function Rate({ value }: { value: any }) {
  return <span className="tabular-nums">{moneyExact(value)}</span>;
}

/** A date, in Pakistan time. */
export function DateText({ value }: { value: any }) {
  return <span className="whitespace-nowrap">{fmtDate(value)}</span>;
}

/** A date and time, in Pakistan time. */
export function DateTimeText({ value }: { value: any }) {
  return <span className="whitespace-nowrap">{fmtDateTime(value)}</span>;
}
