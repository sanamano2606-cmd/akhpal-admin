/**
 * WHERE TAKAL SENDS A VENDOR HIS MONEY.  (Mock 111, approved 22 Sep 2026.)
 *
 * The rules, away from the screen that draws them, so they can be checked on
 * their own. The SERVER holds the same rules and the database holds two of
 * them as CHECKs - none of this is the real gate. What it buys is that the
 * office is told what is wrong while they are still looking at the field,
 * instead of after a round trip to a server that may still be waking up.
 *
 * NO CNIC. Sana, in plain words on 22 September 2026: "NO CNIC". A CNIC is a
 * government identity number. The account TITLE is what stops a payout
 * reaching the wrong person, and it is checked against his CNIC by eye when he
 * is signed up. Do not add a field for one without asking her again.
 */

import { mayOpen } from "./tabs.ts";

/** The permission the SERVER asks before it saves a shop's payout account -
 *  the first one or a change (vendor_intake.py SEE_FULL_NUMBER, final money
 *  audit AREA-4-18). The same key, through the same mayOpen() question. */
export const PAYOUT_ACCOUNT_PERMISSION = "payments.balances";

/** May this admin Add / Change a shop's payout account? (review N8, 22 Oct
 *  2026) A store clerk ("Add & edit shops") was shown "Add" and then refused
 *  with a 403 - the button is shown only to somebody the server will let save. */
export function mayEditPayoutAccount(
  saved: readonly string[] | null | undefined, isSuper = false,
): boolean {
  return mayOpen(PAYOUT_ACCOUNT_PERMISSION, saved, isSuper);
}

export const PAYOUT_METHODS = [
  { key: "easypaisa", label: "Easypaisa", needsNumber: true, numberLabel: "Easypaisa number" },
  { key: "jazzcash", label: "JazzCash", needsNumber: true, numberLabel: "JazzCash number" },
  { key: "bank", label: "Bank transfer", needsNumber: true, numberLabel: "Bank account number" },
  { key: "cash", label: "Cash in person", needsNumber: false, numberLabel: "" },
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number]["key"];

export const methodLabel = (key: string): string =>
  PAYOUT_METHODS.find((m) => m.key === key)?.label ?? "";

const digitsOf = (s: string) => (s || "").replace(/\D/g, "");

/**
 * Why these details cannot be saved, in words. "" when they can.
 *
 * The twin of payout_problem() in backend/routers/vendor_intake.py. Kept
 * word-for-word the same where it matters, and checked against it in
 * tests/where-takal-sends-the-money.test.ts.
 */
export function payoutProblem(
  method: string, title: string, num: string, bank: string,
): string {
  const m = (method || "").trim().toLowerCase();
  if (!PAYOUT_METHODS.some((x) => x.key === m)) {
    return "Choose how Takal pays this shop.";
  }
  if (m === "cash") return "";
  if (!(title || "").trim()) {
    return "Type the name ON the account. It is the one thing that stops a "
      + "payout reaching the wrong person.";
  }
  if (!(num || "").trim()) {
    return m === "bank"
      ? "Type the bank account number."
      : "Type the number the money is sent to.";
  }
  const d = digitsOf(num);
  if (m === "easypaisa" || m === "jazzcash") {
    // A Pakistani mobile is 11 digits as 03xxxxxxxxx, or 12 as 923xxxxxxxxx.
    if (d.length !== 11 && d.length !== 12) {
      return "That does not look like a mobile number. An Easypaisa or "
        + "JazzCash number is the vendor's own mobile, like 0315 0000000.";
    }
  } else if (d.length < 6) {
    return "That bank account number looks too short — please check it.";
  }
  if (m === "bank" && !(bank || "").trim()) return "Say which bank it is.";
  return "";
}

/** A change the shop asked for in the Partners app (Mock 233-2, 8 Nov 2026).
 *  Until the payments office approves it, Takal keeps paying the saved one. */
export type WaitingPayoutChange = {
  method: string;
  method_label?: string;
  account_title?: string;
  account_number?: string;
  bank_name?: string;
  asked_at: string;
};

/** "JazzCash · Majid Khan · 0333 *** 6543" - one line for the orange box. */
export function waitingLine(w: WaitingPayoutChange): string {
  return [w.method_label || methodLabel(w.method), w.bank_name, w.account_title, w.account_number]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Ready reasons for refusing a change - the shop is told the one picked. */
export const PAYOUT_REFUSE_REASONS = [
  "The name does not match the shop owner",
  "This number is not the shop owner's own",
  "Please call Takal first to confirm this change",
];
