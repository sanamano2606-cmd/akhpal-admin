// FIX 3 - A MENU ALWAYS FITS ON THE SCREEN
// (All Stores audit 9 Nov 2026, A3/B5. Sana: "GO Fix 3".)
//
// The ⋯ menu of a product guessed its own height (142-150 px). It is really
// 188 px (5 items) to 260 px (7 items), so on the last rows of the list it
// opened DOWNWARDS past the bottom of the screen - and "Remove product", its
// last item, could not be reached (scrolling to it closes the menu).
//
// Now the menu is MEASURED once it is drawn, and placed by this rule:
//   1. under the button, when it fits;
//   2. otherwise above the button, when it fits;
//   3. otherwise as low as it can go inside the screen, scrolling inside
//      itself when even the whole screen is too short.
// Example: screen 700 high, ⋯ at 600-620, menu 224 high -> top 370 (above).

export type MenuPlace = { top: number; maxHeight: number | null };

export function placeMenu(
  anchorTop: number,
  anchorBottom: number,
  menuHeight: number,
  screenHeight: number,
  gap = 6,
  margin = 8,
): MenuPlace {
  const below = anchorBottom + gap;
  if (below + menuHeight <= screenHeight - margin) return { top: below, maxHeight: null };
  const above = anchorTop - gap - menuHeight;
  if (above >= margin) return { top: above, maxHeight: null };
  const room = screenHeight - 2 * margin;
  if (menuHeight <= room) return { top: Math.max(margin, screenHeight - margin - menuHeight), maxHeight: null };
  return { top: margin, maxHeight: Math.max(0, room) };
}
