// FIX 8 - THE PRODUCT WINDOW ASKS BEFORE IT THROWS WORK AWAY
// (All Stores audit 9 Nov 2026, P1. Sana: "GO Fix 8".)
//
// The product window used to close at once - a click on the dark area
// outside it, the X, Cancel, the Esc key, "‹ prev / next ›" - and everything
// typed was gone: name, price, sizes, photos just uploaded. The store's
// Settings and Location tabs already asked first; the product window did not.
//
// The rule, in one place so it can be tested for real:
//   * a picture of every box the person can change is taken when the window
//     is ready (a new product: when it opens; an old one: when it has loaded),
//   * "unsaved" = the boxes are not what they were, OR a photo / video is
//     still uploading (closing then throws the upload away too),
//   * before the window is ready nothing has been typed, so nothing is unsaved.
//
// Example: open "Pepsi 1.5L", change the price 180 -> 190, click outside
// -> "Leave without saving?" Press Stay and the 190 is still there.

/** The boxes, as one line of text. The keys are sorted, so the same boxes in
 *  a different order are the same picture. */
export function editorSnapshot(boxes: Record<string, unknown>): string {
  const keys = Object.keys(boxes).sort();
  return JSON.stringify(keys.map((k) => [k, boxes[k] === undefined ? null : boxes[k]]));
}

/** Is there anything that closing the window would throw away? */
export function hasUnsavedEdits(
  start: string | null,
  now: string,
  busy: { uploading?: boolean; videoBusy?: boolean; pending?: number } = {},
): boolean {
  if (busy.uploading || busy.videoBusy || (busy.pending || 0) > 0) return true;
  if (start === null) return false;
  return start !== now;
}

/** A click on the dark area closes the window only when the press ALSO began
 *  there. Selecting the words in a box and letting go outside it used to count
 *  as a click outside - and closed the window. */
export function closesFromBackdrop(pressedOnBackdrop: boolean, releasedOnBackdrop: boolean): boolean {
  return pressedOnBackdrop && releasedOnBackdrop;
}
