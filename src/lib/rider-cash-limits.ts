// ─────────────────────────────────────────────────────────────────────────────
// ONE RIDER'S OWN CASH LIMITS — the rule, with no screen around it.
//
// WHY THIS FILE EXISTS. These two functions used to live inside
// src/domains/riders/RiderCashLimits.tsx. The panel's test runner is plain
// Node, and plain Node cannot read a .tsx file at all — it stops at the
// extension before it reads a line. So the test that guards this rule could
// never run, and `npm test` failed on 24 September 2026 with
// ERR_UNKNOWN_FILE_EXTENSION, which blocked the whole deploy.
//
// The rule now lives here, in a plain .ts file, exactly like every other rule
// in src/lib. The screen imports it and draws it. Nothing about the rule
// itself changed — same words, same numbers, same behaviour.
//
// THE ONE RULE:
//
//     empty -> follow the office, now and whenever the office figure changes
//     0     -> this limit is OFF for him, on purpose
//     5     -> his own figure
//
// A blank box must never be able to switch a limit off.
// ─────────────────────────────────────────────────────────────────────────────

export type Form = {
  cash_limit_amount: string;
  cash_limit_days: string;
  cash_limit_min_amount: string;
  cash_limit_enabled: string;   // "" = follow the office | "yes" | "no"
};

const str = (v: any) => (v == null ? "" : String(v));

export function formFromRider(rider: any): Form {
  return {
    cash_limit_amount:
      rider?.cash_limit_amount == null ? "" : String(Math.round(Number(rider.cash_limit_amount))),
    cash_limit_days: str(rider?.cash_limit_days),
    cash_limit_min_amount:
      rider?.cash_limit_min_amount == null
        ? ""
        : String(Math.round(Number(rider.cash_limit_min_amount))),
    cash_limit_enabled:
      rider?.cash_limit_enabled == null ? "" : rider.cash_limit_enabled ? "yes" : "no",
  };
}

/** The sentences this screen must say before a Save can switch a limit off.
 *
 *  Kept out of the component so the test can read the rule rather than the
 *  paint: a warning that is only in the JSX is a warning that can be moved
 *  below the button and still look right. */
export function offSwitchWarnings(form: Form): string[] {
  const out: string[] = [];
  if (form.cash_limit_amount.trim() === "0")
    out.push("0 in “most he may hold” means NO AMOUNT LIMIT for him — he can hold any amount.");
  if (form.cash_limit_days.trim() === "0")
    out.push("0 in “for how many days” means NO DAY LIMIT for him — he can hold cash for ever.");
  if (form.cash_limit_enabled === "no")
    out.push("“No” in “cash limit on” means he is never stopped for cash, whatever the figures.");
  return out;
}
