/**
 * ALSO SELLS (Mock 233 piece 5, Sana 9 Nov 2026) - the words, away from the
 * screen, so they can be checked on their own.
 */

/** What the box says under its title. Example: ["Fashion"] -> "Also listed under Fashion". */
export function alsoSellsLine(names: string[]): string {
  return names.length ? `Also listed under ${names.join(", ")}` : "Listed under its main type only";
}
