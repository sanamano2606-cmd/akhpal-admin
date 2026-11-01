// Sana, 1 Nov 2026: "The change Shelf does not work".
//
// It DID work - on a big screen. On her laptop (about 1366 x 698) the shelf
// lists were a FIXED 560px tall, so the window ran out of room and the bar with
// Cancel and "Choose this shelf" was drawn BELOW the window, where nobody can
// press it. A shelf could be picked and never saved.
//
// Measured in a real browser with the real component (1 Nov 2026):
//   before  1366x698: window ends 663, button at 721-759  -> cannot press
//   after   1366x698: window ends 663, button at 613-650  -> saved
// Big screens (1920x1000) and phones (390 wide) came out exactly the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PICKER = readFileSync(new URL("../src/components/CategoryPicker.tsx", import.meta.url), "utf8");

/** The class words of the first <div> that follows [marker]. Split into
 *  words so "flex-none" is never found inside a longer word. */
function divAfter(marker: string): string[] {
  const at = PICKER.indexOf(marker);
  assert.ok(at > 0, `"${marker}" is no longer in CategoryPicker.tsx`);
  const m = PICKER.slice(at).match(/<div className="([^"]+)"/);
  assert.ok(m, `no <div className> after "${marker}"`);
  return m![1].split(/\s+/);
}

test("the shelf lists may SHRINK on a short screen - never a fixed height that cannot give way", () => {
  const cls = divAfter("── The columns ──");
  assert.ok(!cls.includes("sm:flex-none"),
    "sm:flex-none locks the lists at 560px and pushes Choose this shelf off a laptop screen");
  assert.ok(!cls.includes("flex-none") && !cls.includes("shrink-0") && !cls.includes("sm:shrink-0"),
    "the lists must be the part that shrinks");
  assert.ok(cls.includes("min-h-0"), "without min-h-0 a flex box will not shrink below its content");
});

test("the Cancel / Choose this shelf bar never shrinks or hides", () => {
  const cls = divAfter("── What is chosen, in full, before pressing Choose ──");
  assert.ok(cls.includes("shrink-0"), "the bar with the buttons must keep its full height");
  assert.ok(PICKER.includes("Choose this shelf"), "the button itself is still there");
});

test("the window is held inside the screen, so whatever shrinks, it is never taller than the screen", () => {
  assert.match(PICKER, /role="dialog"[^>]*sm:max-h-\[90vh\]/);
});
