/**
 * THE PANEL'S PREVIEW AND THE REAL WEBSITE MUST AGREE.
 *
 * The Website screen shows a preview of the top bar so a colour can be judged
 * before it is published. The preview uses the panel's copy of the rule; the
 * real bar uses the website's. Two copies of a rule is how a preview starts
 * lying, so these run BOTH copies over the same colours and fail if a single
 * answer differs.
 *
 * If this test fails, one of the two files was changed and the other was not.
 * The website's copy is the real one - the panel's has to follow it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { barInk, expand, brightness, SUGGESTED_BAR_COLOURS } from "../src/lib/bar-ink.ts";

const websiteRule = join(
  import.meta.dirname, "..", "..", "takal-website", "src", "lib", "topbar-colour.ts",
);

/** Every colour worth checking: the brand's own, the awkward middle, and the
 *  ones that are not colours at all. */
const COLOURS = [
  "#FFFF00", "#FFFFFF", "#000000", "#0B0C0E", "#FF6B35", "#004E89",
  "#1F6F4A", "#D62839", "#FFFCE0", "#F2F2F2", "#808080", "#7F7F7F",
  "#123456", "#ABCDEF", "#ff0", "#FF0",
  "rgb(255,255,0)", "yellow", "#GGGGGG", "", "   ",
];

test("the preview in the panel matches the real website, colour for colour", async () => {
  assert.ok(existsSync(websiteRule),
    `The website's copy of this rule is missing at ${websiteRule}. ` +
    "The two live in the same project folder and are meant to be checked together.");

  // A plain path cannot be imported on Windows: "C:\\..." is read as a web
  // address whose scheme is "c:" (ERR_UNSUPPORTED_ESM_URL_SCHEME). Turning it
  // into a file:// address works on Windows, Mac and Linux alike.
  // (Found 16 September 2026, the first time DEPLOY.ps1 ran the panel tests.)
  const real = await import(pathToFileURL(websiteRule).href);

  for (const colour of COLOURS) {
    assert.deepEqual(barInk(colour), real.barInk(colour),
      `The panel previews ${colour || "(empty)"} differently from the website.`);
    assert.equal(expand(colour), real.expand(colour),
      `The panel reads ${colour || "(empty)"} differently from the website.`);
  }
});

test("the writing colour is whichever one is actually easier to read", () => {
  const contrast = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  for (const colour of COLOURS.filter((c) => expand(c))) {
    const l = brightness(colour);
    const better = contrast(l, 0) >= contrast(l, 1) ? "#000000" : "#FFFFFF";
    assert.equal(barInk(colour).text, better,
      `${colour} was given the harder of the two colours to read`);
  }
});

test("the button never disappears into the bar", () => {
  for (const colour of COLOURS) {
    const ink = barInk(colour);
    assert.notEqual(ink.buttonBackground.toUpperCase(), ink.background.toUpperCase(),
      `the Get the app button vanishes on a ${colour || "(empty)"} bar`);
  }
});

test("every suggested colour is a real colour", () => {
  // A typo in this list would put a swatch on the screen that saves nothing.
  for (const c of SUGGESTED_BAR_COLOURS) {
    assert.equal(expand(c.hex), c.hex, `${c.name} (${c.hex}) is not a colour`);
  }
  assert.equal(SUGGESTED_BAR_COLOURS[0].hex, "#FFFF00",
    "Takal yellow must be the first choice offered");
});

test("nothing that is not a colour can reach the page", () => {
  for (const bad of ["rgb(255,255,0)", "yellow", "#GGGGGG", "#FFFF0", "", "   ",
                     "#FFF; background: url(https://evil.example.com/x)"]) {
    assert.equal(expand(bad), null, `${bad} was read as a colour`);
  }
});
