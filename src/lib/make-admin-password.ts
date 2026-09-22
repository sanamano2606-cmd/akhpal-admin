/**
 * A FIRST PASSWORD SOMEBODY CAN READ DOWN A BAD PHONE LINE.
 *
 * Mock 110, approved by Sana on 22 September 2026.
 *
 * WHY NOT THE EXISTING ONE
 * `makePassword()` in the Create-store form makes ten characters like
 * "K7MPQR39XB". That is fine for a vendor typing it from a WhatsApp message,
 * and wrong here for two reasons:
 *
 *   1. Ten characters is EXACTLY the admin minimum, so every reset would hand
 *      somebody the weakest password the server will accept.
 *   2. An admin password is often read out loud - down a line to Mingora, or
 *      across a shop counter - and "K7MPQR39XB" cannot be. "Is that M or N?"
 *
 * So: two ordinary words, four digits and two letters, joined by hyphens.
 *     Swat-Takal-9241-Kx
 *
 * Eighteen characters, easy to say, easy to type, and above the "Strong" line
 * in password-strength.ts.
 *
 * THIS IS A FIRST PASSWORD AND NOTHING ELSE. The account is marked so the
 * panel makes the person choose their own on the very next sign-in, so it is
 * alive for one sign-in. It is never stored: the server keeps a hash, and the
 * only plain copy that ever exists is the one on the screen of whoever pressed
 * the button.
 */

/** Ordinary, neutral, easy to say. No brand names anybody could mistake for
 *  meaningful, and nothing that could read as an insult in Pashto or Urdu. */
const WORDS = [
  "Swat", "Takal", "River", "Green", "Apple", "Cloud", "Stone", "Peach",
  "Tiger", "Lemon", "Maple", "Pearl", "Amber", "Coral", "Delta", "Honey",
  "Ivory", "Jasmin", "Kiwi", "Larch", "Mango", "Olive", "Pine", "Quartz",
] as const;

/** No I, O, l, 0 or 1 anywhere: the four pairs people get wrong when reading
 *  a password out or copying it off a screen. */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const SMALL = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

/**
 * A random whole number below `max`, without modulo bias.
 *
 * `buf[0] % max` is very slightly more likely to land on the low numbers,
 * because 2^32 does not divide evenly by most values of `max`. It does not
 * matter much for one password, but a biased generator is the kind of thing
 * that is never noticed and never fixed, and throwing away the unusable top
 * slice costs nothing.
 */
function below(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

const pick = (set: string | readonly string[]): string =>
  set[below(set.length)] as string;

/** "Swat-Takal-9241-Kx" — and never the same word twice in one password. */
export function makeAdminPassword(): string {
  const first = pick(WORDS);
  let second = pick(WORDS);
  // "Swat-Swat-..." looks like a mistake and halves the words in play.
  while (second === first) second = pick(WORDS);
  const digits = Array.from({ length: 4 }, () => pick(DIGITS)).join("");
  return `${first}-${second}-${digits}-${pick(LETTERS)}${pick(SMALL)}`;
}
