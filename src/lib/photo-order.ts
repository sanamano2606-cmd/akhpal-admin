/**
 * A PRODUCT'S PHOTOS, IN ORDER.  (Mock 134, approved 1 October 2026 - audit SM15.)
 *
 * The first photo is the cover - the one customers see in every list. These
 * are plain functions so the order rules can be tested by running them.
 */

/** Move the photo at `from` to `to`. Anything out of range: nothing moves. */
export function movePhoto<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list.slice();
  }
  const out = list.slice();
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it);
  return out;
}

/** "Make cover": the chosen photo goes first, the rest keep their order. */
export const makeCover = <T,>(list: T[], i: number): T[] => movePhoto(list, i, 0);

/** A link someone pasted - only a real web address is accepted, never a
 *  piece of text that would show as a broken square. */
export function isPictureLink(text: string): boolean {
  const t = (text || "").trim();
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}
