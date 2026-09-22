/**
 * HOW STRONG A NEW ADMIN PASSWORD LOOKS.
 *
 * Mock 108 v2, approved by Sana on 22 September 2026.
 *
 * It lives in its own file, away from the screen that draws it, so it can be
 * checked on its own - a meter buried inside a component is a meter nobody
 * ever tests, and this one decides what a person is told about the password
 * they are about to rely on.
 *
 * IT IS ADVICE, NOT A GATE.
 * The only hard rule is the server's: an admin password must be at least ten
 * characters (`check_admin_password_length` in backend/core_auth.py). A meter
 * that REFUSED things the server accepts would be the panel lying to somebody
 * about their own account, and the lesson they would learn is to ignore it.
 *
 * So there are three steps and no fourth:
 *   0  Too short          - below the server's bar. The Save button is off.
 *   1  Could be stronger  - long enough. It will be accepted.
 *   2  Strong             - 14 or more, and at least three of the four kinds
 *                           of character.
 */

/** The server's own bar for an admin. backend/core_auth.py holds the twin. */
export const MIN_ADMIN_PASSWORD = 10;

/** 14 is not a magic number: it is the length at which a password made of
 *  ordinary words stops being worth guessing at. Below it, mixing in a symbol
 *  buys very little, which is why BOTH are required for "Strong". */
export const STRONG_LENGTH = 14;

export type PasswordStrength = {
  step: 0 | 1 | 2;
  word: "Too short" | "Could be stronger" | "Strong";
  /** How many of lower, upper, digit, other are present. 0-4. */
  kinds: number;
};

export function strengthOf(pw: string): PasswordStrength {
  const text = pw ?? "";
  if (text.length < MIN_ADMIN_PASSWORD) {
    return { step: 0, word: "Too short", kinds: 0 };
  }
  const kinds =
    Number(/[a-z]/.test(text)) +
    Number(/[A-Z]/.test(text)) +
    Number(/[0-9]/.test(text)) +
    Number(/[^a-zA-Z0-9]/.test(text));
  if (text.length >= STRONG_LENGTH && kinds >= 3) {
    return { step: 2, word: "Strong", kinds };
  }
  return { step: 1, word: "Could be stronger", kinds };
}

/**
 * May the Save button be pressed?
 *
 * Written here rather than inside the screen so it can be checked on its own.
 * Every one of these is a reason a person would otherwise get a refusal from
 * the server after waiting for a round trip on a 3G connection.
 *
 * The CURRENT password is only checked for being present. Whether it is right
 * is the server's business, and it must stay the server's business - five
 * wrong tries lock the account, and a browser that thought it knew the answer
 * could hand somebody a lock-out without ever asking.
 */
export function whyNotSave(
  current: string, next: string, again: string,
): string {
  if (!current) return "Type your current password.";
  if (next.length < MIN_ADMIN_PASSWORD) {
    return `The new password needs at least ${MIN_ADMIN_PASSWORD} characters.`;
  }
  if (!again) return "Type the new password again.";
  if (next !== again) return "The two new passwords are not the same.";
  if (next === current) return "The new password is the same as the old one.";
  return "";
}
