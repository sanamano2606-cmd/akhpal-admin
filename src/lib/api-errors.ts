/**
 * WHY A SEPARATE KIND OF ERROR EXISTS FOR "NOT ALLOWED".
 *
 * Every failure used to arrive as a plain Error with a message, and pages
 * handled them all the same way: catch it, set the list to empty, move on. So
 * a sub-admin who was not allowed to see riders was told:
 *
 *     "No approved riders available."
 *
 * That is not true. There ARE riders. The operator was told a fact about the
 * world when the truth was about their own account - and there is nothing they
 * can do with the false version, because the fix is to ask the Main Admin for
 * a permission, and nothing on screen said so.
 *
 * Six places in this panel did that, three of them on the Payouts page - the
 * page where somebody decides who gets money.
 *
 * A refusal is now its own kind of error, so a page can tell the two apart and
 * say the true thing. It also cannot be retried usefully, which is why the
 * "Try again" button is hidden when one of these is what went wrong.
 */

/** The server refused because of who you are, not because anything is broken. */
export class AccessDeniedError extends Error {
  /** The permission the server was asking for, when it says. */
  readonly section?: string;

  constructor(message?: string, section?: string) {
    super(message || "You do not have permission to see this.");
    this.name = "AccessDeniedError";
    this.section = section;
    // Needed so `instanceof` works after TypeScript compiles this down.
    Object.setPrototypeOf(this, AccessDeniedError.prototype);
  }
}

export function isAccessDenied(err: unknown): err is AccessDeniedError {
  return err instanceof AccessDeniedError;
}

/**
 * Turn whatever was caught into a sentence worth showing someone.
 *
 * Pass `what` - the thing the page was trying to load, in the operator's own
 * words ("riders", "the payout history"). A refusal then reads as
 * "You do not have permission to see riders", which names both the problem and
 * who can fix it.
 */
export function errorMessage(err: unknown, what?: string): string {
  if (isAccessDenied(err)) {
    return what
      ? `You do not have permission to see ${what}. Ask the Main Admin to give you access.`
      : err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return what ? `Could not load ${what}.` : "Something went wrong.";
}

/**
 * WHY THIS EXISTS.
 *
 * A screen that failed to read needs two things, and they are not the same
 * thing: a sentence to show, and the answer to "was this a refusal?".
 *
 * Pages were working the second one out by looking for the word "permission"
 * inside the first one. That is guessing. Change the wording of a refusal by
 * one word and every page quietly starts calling it a breakage instead, and
 * offers a "Try again" button that can never work.
 *
 * The catch block already holds the real error. Ask it once, here, and carry
 * both answers together.
 */
export function readFailure(
  err: unknown,
  what?: string
): { message: string; denied: boolean } {
  return { message: errorMessage(err, what), denied: isAccessDenied(err) };
}

/** What a screen holds while a read has failed. `null` means it has not. */
export type ReadFailure = { message: string; denied: boolean } | null;
