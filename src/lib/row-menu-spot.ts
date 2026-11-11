// MOCK 238/239: where a ⋯ menu goes on the screen (see parts-row-menu.tsx).
/** Where the menu goes: under the button, or above it when there is no room. */
export function menuSpot(button: { top: number; bottom: number; right: number },
  menu: { width: number; height: number }, screen: { width: number; height: number }) {
  const gap = 6;
  const below = button.bottom + gap + menu.height <= screen.height - 8;
  const top = below ? button.bottom + gap : Math.max(8, button.top - gap - menu.height);
  const left = Math.min(Math.max(8, button.right - menu.width), screen.width - menu.width - 8);
  return { top, left, up: !below };
}
