/**
 * WHAT A MALL STAFF MEMBER TYPED IN THE SIGN-IN BOX, MADE READY FOR THE SERVER.
 * (Mock 133, 1 October 2026.)
 *
 * The box says "Phone number or email". The server looks the person up by the
 * EXACT text stored when the Main Admin added them, and it stored the phone
 * with spaces, dashes and brackets taken out (routers/shop_staff.py:
 * re.sub(r"[\s\-()]", "", phone)). So the same three are taken out here -
 * otherwise "0312 3456789" would never find "03123456789".
 *
 * Anything with an "@" in it is an email. The server stores a staff email
 * trimmed and in small letters (shop_staff.py: .strip().lower()) and compares
 * exactly, so it is trimmed and put in small letters here too - otherwise
 * "Bilal@CityMall.pk" would never find "bilal@citymall.pk".
 */
export type StaffSignInId = { phone: string } | { email: string };

export function staffSignInId(typed: string): StaffSignInId | null {
  const t = (typed || "").trim();
  if (!t) return null;
  if (t.includes("@")) return { email: t.toLowerCase() };
  const phone = t.replace(/[\s\-()]/g, "");
  return phone ? { phone } : null;
}

/** The server's own wording is written for the phone apps ("Please register
 *  first") - wrong for a staff member, who never registers. The panel says the
 *  true thing instead. Any other message is shown exactly as the server wrote it. */
export function staffSignInMessage(serverText: string): string {
  if (/no account found/i.test(serverText || "")) {
    return "No staff login with this phone number or email. Type it exactly as Takal gave it to you.";
  }
  return serverText;
}

/** The role a Mall staff login carries (core_auth.STAFF_ROLE on the server). */
export const STAFF_ROLE = "shop_staff";

/** Is the person signed in on this browser a Mall staff member?
 *
 *  ONLY for sending them to the right screen - the Shop panel instead of the
 *  Admin dashboard. It is NOT a lock: what a staff member may do is decided
 *  by the server on every single request (core_auth.require_shop_side), and a
 *  faked value here opens nothing. */
export function signedInAsStaff(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const me = JSON.parse(localStorage.getItem("admin_user") || "null");
    return me?.role === STAFF_ROLE;
  } catch {
    // A stored profile that will not parse is treated as "not staff"; the
    // server still refuses anything they may not do.
    return false;
  }
}

/** The three things a new staff member needs, as one message to copy or send
 *  on WhatsApp (Mock 133 picture F). The password is in it ONCE, here, and is
 *  never stored by Takal. */
export function staffWelcomeText(o: {
  name: string; shop: string; phone?: string; email?: string; password: string; address: string;
}): string {
  return [
    `Takal - your staff login for ${o.shop}`,
    "",
    `1. Open ${o.address} and choose "Shop staff"`,
    o.phone ? `2. Phone: ${o.phone}` : `2. Email: ${o.email || ""}`,
    `3. Password: ${o.password}`,
    "",
    "You will be asked to choose your own password the first time you sign in.",
  ].join("\n");
}
