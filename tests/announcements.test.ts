// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS — the panel and the server must agree, word for word.
//
// WHY THIS FILE EXISTS
//
// The strip this replaces had a preview. It drew the bar in TAKAL YELLOW while
// the customer app drew it BLACK, and it had been wrong since the day it was
// written. Nobody noticed for months, because the only way to notice was to
// hold a phone next to the screen.
//
// That could happen because the panel and the app had no shared idea of
// anything. Now they do, and this file is what stops the two drifting apart
// again: it reads the REAL server file and the REAL migration off disk and
// checks that every word this panel offers is a word they accept.
//
// If this fails after a change, the panel is offering something the phone
// cannot draw, or the database will refuse.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALIGNMENTS, COLOUR_MOTION, ENTRANCES, FONTS, GRADIENTS, READABLE_FLOOR,
  SECOND_LINE_PX, SHAPES, SIZES, WEIGHTS,
  announcementBackground, announcementColourWarning, announcementInk, appsLine,
  gradientStops, previewText, tapRate, timingLine, whenLine,
} from "../src/lib/announcements.ts";
import { contrast } from "../src/lib/marketing.ts";

const BACKEND = "../swat-delivery-app/backend";
const core = readFileSync(join(BACKEND, "core_announcements.py"), "utf8");
const migration = readFileSync(
  join(BACKEND, "migrations", "065_announcements.sql"), "utf8");

/** The words inside a Python tuple such as FONTS = ("poppins", "roboto"). */
function pythonTuple(name: string): string[] {
  const m = new RegExp(`${name}\\s*=\\s*\\(([^)]*)\\)`, "s").exec(core);
  assert.ok(m, `${name} is not in core_announcements.py any more`);
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// ── 1. Every choice this panel offers, the server accepts ───────────────────

const PAIRS: [string, readonly { value: string }[]][] = [
  ["FONTS", FONTS], ["SIZES", SIZES], ["WEIGHTS", WEIGHTS],
  ["SHAPES", SHAPES], ["ALIGNMENTS", ALIGNMENTS],
  ["ENTRANCES", ENTRANCES], ["COLOUR_MOTION", COLOUR_MOTION],
];

for (const [name, options] of PAIRS) {
  test(`the panel's ${name} are exactly the server's ${name}`, () => {
    const server = pythonTuple(name);
    const panel = options.map((o) => o.value);
    assert.deepEqual(
      [...panel].sort(), [...server].sort(),
      `the panel offers [${panel}] and the server accepts [${server}]`
    );
  });
}

test("every choice the panel offers is also allowed by the database", () => {
  // The CHECK constraints are the last thing that can say no. A word the panel
  // offers and the database refuses is a save that fails with a constraint name
  // nobody can read.
  const inCheck = (constraint: string) => {
    const m = new RegExp(`${constraint}[\\s\\S]*?IN \\(([^)]*)\\)`).exec(migration);
    assert.ok(m, `${constraint} is not in migration 065 any more`);
    return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  const checks: [string, readonly { value: string }[]][] = [
    ["announcements_font_ck", FONTS],
    ["announcements_size_ck", SIZES],
    ["announcements_weight_ck", WEIGHTS],
    ["announcements_shape_ck", SHAPES],
    ["announcements_align_ck", ALIGNMENTS],
    ["announcements_entrance_ck", ENTRANCES],
    ["announcements_motion_ck", COLOUR_MOTION],
  ];
  for (const [constraint, options] of checks) {
    const allowed = new Set(inCheck(constraint));
    for (const o of options) {
      assert.ok(allowed.has(o.value),
        `the panel offers "${o.value}" but ${constraint} would refuse it`);
    }
  }
});

test("the three kinds of rolling Sana asked for are all offered", () => {
  // She said "rolling", which is three different motions. Offering all three
  // is what stopped this being a guess.
  const names = ENTRANCES.map((e) => e.value);
  for (const roll of ["roll_down", "roll_across", "ticker"]) {
    assert.ok(names.includes(roll), `${roll} is missing from the panel`);
  }
});

test("every entrance the panel offers has a way to be drawn", () => {
  // A movement with no animation is a setting that appears to do nothing.
  const css = readFileSync("src/app/globals.css", "utf8");
  for (const e of ENTRANCES) {
    assert.ok(css.includes(`.anim-${e.value}`),
      `globals.css has no .anim-${e.value}, so choosing "${e.label}" would do nothing`);
  }
});

test("every entrance and colour movement is explained in words", () => {
  // A control nobody can understand is a control nobody uses.
  for (const e of ENTRANCES) assert.ok(e.hint && e.hint.length > 5, e.value);
  for (const m of COLOUR_MOTION) assert.ok(m.hint && m.hint.length > 5, m.value);
});

// ── 2. The gradients, and the mistake they already caught ───────────────────

test("the panel's gradients are exactly the server's gradients", () => {
  const names = [...core.matchAll(/^\s{4}"([a-z]+)":\s*\[/gm)].map((m) => m[1]);
  assert.deepEqual(Object.keys(GRADIENTS).sort(), names.sort());
});

test("every gradient can carry writing at the readable floor", () => {
  // THE TEST THAT ALREADY EARNED ITS PLACE. The first version of this list had
  // a "sea" running deep teal into pale green: white measured 1.8 to 1 at the
  // pale end, which is invisible. Every set now stays inside one lightness
  // band, and this refuses any future set that does not.
  for (const [name, stops] of Object.entries(GRADIENTS)) {
    const ink = announcementInk({ bg_gradient: name });
    const worst = Math.min(...stops.map((s) => contrast(s, ink)));
    assert.ok(worst >= READABLE_FLOOR,
      `${name} reads at only ${worst.toFixed(1)} to 1 in ${ink}`);
    assert.equal(announcementColourWarning({ bg_gradient: name }), "", name);
  }
});

test("a gradient is judged by its worst stop, not its darkest", () => {
  assert.equal(announcementInk({ bg_gradient: "sea" }), "#FFFFFF");   // all dark
  assert.equal(announcementInk({ bg_gradient: "mint" }), "#000000");  // all light
});

test("an unknown gradient name is nothing, not a crash", () => {
  assert.deepEqual(gradientStops("rainbow-of-doom"), []);
  assert.deepEqual(gradientStops(null), []);
});

test("the background is a gradient when there is one and a colour when there is not", () => {
  assert.ok(announcementBackground({ bg_gradient: "sunrise" }).startsWith("linear-gradient"));
  assert.equal(announcementBackground({ bg_color: "#FFFF00" }), "#FFFF00");
});

// ── 3. The writing colour ───────────────────────────────────────────────────

test("black on Takal yellow, white on a dark blue", () => {
  assert.equal(announcementInk({ bg_color: "#FFFF00" }), "#000000");
  assert.equal(announcementInk({ bg_color: "#1E3C72" }), "#FFFFFF");
});

test("a hand-picked writing colour wins", () => {
  assert.equal(announcementInk({ bg_color: "#FFFF00", text_color: "#004E89" }), "#004E89");
});

test("rubbish in the colour gives black, never white", () => {
  // White writing on a white app is a blank strip that still takes up room.
  assert.equal(announcementInk({ bg_color: "not a colour" }), "#000000");
});

test("no plain colour is unreadable once the ink is chosen for it", () => {
  // The worst case is a mid grey, where black gives 4.62 and white 4.54 — the
  // better of the two still clears the floor. So the warning below is only ever
  // about a hand-picked ink or a gradient, which is exactly when it is needed.
  assert.equal(announcementColourWarning({ bg_color: "#767676" }), "");
  assert.equal(announcementColourWarning({ bg_color: "#000000" }), "");
});

test("a forced unreadable pairing is warned about, not silently allowed", () => {
  const warning = announcementColourWarning({ bg_color: "#FFFF00", text_color: "#FFFFFF" });
  assert.match(warning, /hard to read/);
  assert.match(warning, /#FFFF00/);
});

// ── 4. The words the list prints ────────────────────────────────────────────

test("it says which apps see it, and says plainly when nobody will", () => {
  assert.equal(appsLine({ for_customer: true }), "Customers");
  assert.equal(appsLine({ for_customer: true, for_rider: true, for_vendor: true }),
    "Customers · Riders · Partners");
  assert.match(appsLine({}), /Nobody/);
});

test("the timing line reads as a sentence", () => {
  assert.equal(timingLine({ stay_secs: 6, dismissible: false }),
    "stays 6s · cannot be closed");
  assert.equal(timingLine({ stay_secs: 0, dismissible: true, return_hours: 24 }),
    "stays until it is closed · can be closed, back after 24h");
});

test("no dates reads as “always on”, not as two blanks", () => {
  assert.equal(whenLine({}), "always on");
});

test("a day list and an hour window are spelled out", () => {
  const line = whenLine({ days: [5, 6], hour_from: 18, hour_to: 22 });
  assert.match(line, /Fri, Sat/);
  assert.match(line, /18:00–22:00/);
});

test("the tap rate stays quiet until there is enough to say", () => {
  // 4 taps out of 4 is not "100%". It is four taps.
  assert.equal(tapRate({ shown_count: 4, tap_count: 4 }), null);
  assert.equal(tapRate({ shown_count: 200, tap_count: 20 }), 10);
});

test("capitals are applied by the preview, not typed by the operator", () => {
  assert.equal(previewText("free delivery", true), "FREE DELIVERY");
  assert.equal(previewText("free delivery", false), "free delivery");
});

// ── 5. The sizes the preview draws are the sizes the app draws ──────────────

test("the preview's three sizes are three of the app's own six", () => {
  // THE ONE THE APP'S OWN GUARD CAUGHT. The panel draws in px; the app is sent
  // the WORD. The customer app has exactly six text sizes and a test that fails
  // on a seventh, and this preview first used 11 / 12.5 / 14 — two numbers that
  // are not on that scale. A preview showing a size the phone cannot produce is
  // the same class of fault as a preview showing the wrong colour.
  const appScale = [20, 16.5, 14, 12, 11.5, 9.5];   // customer_app AppType
  assert.deepEqual(SIZES.map((s) => s.value), ["small", "normal", "large"]);
  for (const size of SIZES) {
    assert.ok(appScale.includes(size.px),
      `${size.label} is ${size.px}px, which is not one of the app's six sizes`);
  }
  for (const [word, px] of Object.entries(SECOND_LINE_PX)) {
    assert.ok(appScale.includes(px),
      `the second line under "${word}" is ${px}px, which is off the scale`);
  }
});

test("the second line is one step down, never a subtraction", () => {
  // `size - 2` invents 9.5 from 11.5 by luck and 10.5 from 12.5 by accident.
  const order = [14, 12, 11.5, 9.5];
  for (const size of SIZES) {
    const second = SECOND_LINE_PX[size.value];
    assert.equal(second, order[order.indexOf(size.px) + 1],
      `${size.label}'s second line should be the next size down`);
  }
});
