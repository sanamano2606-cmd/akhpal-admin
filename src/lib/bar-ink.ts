/**
 * WHAT THE TOP BAR OF THE WEBSITE WILL LOOK LIKE.
 *
 * This is the panel's copy of the rule the website uses. It exists for ONE
 * reason: so the preview on the Website screen shows what the bar will really
 * look like before Save is pressed, instead of a guess.
 *
 * THE REAL COPY IS THE WEBSITE'S, at takal-website/src/lib/topbar-colour.ts.
 * That one decides what visitors see. If these two ever disagree, the preview
 * is lying, so tests/bar-ink.test.ts runs both of them side by side over a
 * list of colours and fails if a single answer differs. Change one, and the
 * test tells you to change the other.
 *
 * The rule itself: only the BAR colour is chosen. The writing, the hairline
 * and the button all follow from it, which is why a colour picked in the panel
 * can never produce yellow writing on a yellow bar.
 */

export type BarInk = {
  background: string;
  text: string;
  muted: string;
  line: string;
  buttonBackground: string;
  buttonText: string;
};

/** How light a colour looks to the eye, 0 (black) to 1 (white). Green counts
 *  far more than blue, which is why this is not an average of the three. */
export function brightness(hex: string): number {
  const h = expand(hex);
  if (!h) return 1;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** "#FF0" and "#ffff00" both become "#FFFF00". Anything else becomes null. */
export function expand(hex: unknown): string | null {
  if (typeof hex !== "string") return null;
  const t = hex.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(t)) return t;
  if (/^#[0-9A-F]{3}$/.test(t)) return "#" + [...t.slice(1)].map((c) => c + c).join("");
  return null;
}

/** Everything the top bar needs, from the one colour that was chosen. */
export function barInk(chosen: string | null | undefined): BarInk {
  const background = expand(chosen) ?? "#FFFFFF";
  // 0.179 is the exact point where black stops being the easier colour to read
  // and white starts. It comes out of the readability standard, not out of what
  // looks light or dark - see the website's copy for why that matters.
  const light = brightness(background) > 0.179;

  return {
    background,
    text: light ? "#000000" : "#FFFFFF",
    muted: light ? "rgba(0,0,0,.72)" : "rgba(255,255,255,.78)",
    line: light ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.16)",
    buttonBackground: light ? "#0B0C0E" : "#FFFF00",
    buttonText: light ? "#FFFFFF" : "#000000",
  };
}

/** The colours offered as one-click choices on the Website screen.
 *  Takal yellow first, because it is the brand colour and the one the site
 *  ships with. Any other colour can still be typed in. */
export const SUGGESTED_BAR_COLOURS: { hex: string; name: string }[] = [
  { hex: "#FFFF00", name: "Takal yellow" },
  { hex: "#FFFFFF", name: "White" },
  { hex: "#0B0C0E", name: "Near-black" },
  { hex: "#FF6B35", name: "Orange" },
  { hex: "#1F6F4A", name: "Green" },
  { hex: "#004E89", name: "Blue" },
];
