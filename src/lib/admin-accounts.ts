// SWITCHING AN ADMIN OFF, INSTEAD OF DELETING THEM.
//
// Mock 100, approved by Sana on 20 September 2026.
//
// The rules live here as plain functions, not inside the screen, so a test can
// check them without a browser - the same way order-rules.ts and
// shop-location.ts are written. A rule buried in a component is a rule nobody
// can check.
//
// NOTHING HERE IS A LOCK. The server refuses these two cases itself
// (backend/routers/admin_people.py -> admin_update_user). This exists so the
// answer arrives BEFORE the click, greyed out with the reason written under it,
// instead of as a red toast afterwards.

export type AdminRow = {
  id: string | number;
  is_super_admin?: boolean;
  is_active?: boolean;
};

/** Is this account able to sign in?
 *
 *  A row that has never had the value set counts as ON. Reading a missing
 *  value as "off" would show every older admin as switched off on the day this
 *  shipped. */
export function isWorking(u: AdminRow): boolean {
  return u.is_active !== false;
}

/** The Main Admins who can still get IN.
 *
 *  Counting ALL Main Admins is the mistake this exists to avoid: two exist, one
 *  is already switched off, the count says "two, go ahead" - and the company is
 *  left with nobody who can sign in. */
export function mainAdminsStillIn(users: readonly AdminRow[]): number {
  return users.filter((u) => u.is_super_admin && isWorking(u)).length;
}

/** Why this admin cannot be switched off, or null when they can be.
 *
 *  The words are what the person reading them can act on - not "forbidden". */
export function whyNotSwitchOff(
  u: AdminRow,
  currentAdminId: string,
  users: readonly AdminRow[],
): string | null {
  if (String(u.id) === String(currentAdminId) && currentAdminId !== "") {
    return "You cannot switch off your own account — you would be locked out "
         + "straight away, and only a Main Admin can switch anyone back on.";
  }
  if (u.is_super_admin && mainAdminsStillIn(users) <= 1) {
    return "This is the last Main Admin who can sign in. There must always be one.";
  }
  return null;
}

/** Switching somebody back ON is never refused.
 *
 *  Its own function so the screen cannot accidentally apply the reasons above
 *  to it. Refusing to switch somebody on would be a way to lock a person out
 *  for good by accident. */
export function canSwitchOn(): boolean {
  return true;
}
