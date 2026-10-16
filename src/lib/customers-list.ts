/**
 * THE CUSTOMERS LIST - the small rules behind what each row says.
 * (Mock 200, Sana 15 October 2026: "Re arrange and add if something need to
 * be added. make it compacted".)
 *
 * Plain functions, so tests/compact-customers.test.ts runs them.
 */

/** A customer who signed up with only a phone number is given a made-up
 *  address ("03001234567_customer@noemail.akhpal.pk") because the account
 *  system needs one. It is not a real email - nobody can write to it - so the
 *  list says "phone sign-up" instead of showing it as if it were. Measured on
 *  the live database 15 Oct 2026: 7 of the 16 customers. */
export function isMadeUpEmail(email: unknown): boolean {
  return /@noemail\.akhpal\.pk$/i.test(String(email ?? "").trim());
}

/** Does this look like a Pakistani mobile number (03xx xxxxxxx, +92 3xx…)?
 *  The customer types it themselves; 4 of the 16 live numbers do not match,
 *  one of them starting "++92". Shown as a small "check" tag - never changed
 *  here, because only the customer knows the right number. */
export function phoneLooksRight(phone: unknown): boolean {
  const digits = String(phone ?? "").replace(/[\s-]/g, "");
  if (!digits) return true; // nothing typed - "—" says that already
  return /^(?:\+92|0092|92|0)3\d{9}$/.test(digits);
}

/** Joined within the last 7 days. */
export function isNew(createdAt: unknown, now = Date.now()): boolean {
  const t = new Date(String(createdAt ?? "")).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t < 7 * 24 * 3600e3;
}

export type CustomerFilter = "all" | "active" | "blocked" | "new" | "never";

/** The counts on the chips - counted across EVERY customer, not the search. */
export function customerCounts(rows: any[], now = Date.now()) {
  const hasOrders = rows.some((c) => c && c.orders_count !== undefined && c.orders_count !== null);
  return {
    all: rows.length,
    active: rows.filter((c) => c?.is_active !== false).length,
    blocked: rows.filter((c) => c?.is_active === false).length,
    new: rows.filter((c) => isNew(c?.created_at, now)).length,
    // Only known once the server sends each customer's order count.
    never: hasOrders ? rows.filter((c) => Number(c?.orders_count ?? 0) === 0).length : null,
  };
}

export function matchesFilter(c: any, f: CustomerFilter, now = Date.now()): boolean {
  if (f === "active") return c?.is_active !== false;
  if (f === "blocked") return c?.is_active === false;
  if (f === "new") return isNew(c?.created_at, now);
  if (f === "never") return Number(c?.orders_count ?? 0) === 0;
  return true;
}
