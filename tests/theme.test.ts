// Is the look actually consistent?
//
// WHY THIS TEST EXISTS: the panel had SEVEN separate status-colour maps that
// disagreed with each other, three different yellows, and two different sets
// of chart colours for the same revenue line. Consistency that lives only in
// people's heads is consistency that drifts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND, BRAND_PRESSED, BRAND_WASH, BRAND_DARK, ON_BRAND,
  ACCENT, ACCENT_SOFT, PLAIN, CHART, CHART_SERIES,
  TONE_CLASS, TONE_HEX, STATUS_TONE, ORDER_KIND_TONE, ORDER_STATUS,
  toneFor, statusLabel, statusHex,
} from "../src/components/ui/theme.ts";

test("the brand colour is Takal yellow", () => {
  assert.equal(BRAND.toUpperCase(), "#FFFF00");
});

test("text on yellow is pure black, exactly as the Brand Kit says", () => {
  // TAKAL_STYLE_GUIDE.md section 1: "Text on yellow is always pure black."
  assert.equal(ON_BRAND, "#000000");
});

test("the code matches Takal_Brand_Kit/takal-colors.css value for value", () => {
  // If somebody edits a colour here without editing the Brand Kit, or the
  // other way round, this is the test that says so.
  assert.equal(BRAND, "#FFFF00");          // --takal-yellow
  assert.equal(BRAND_PRESSED, "#E6E600");  // --takal-yellow-dark
  assert.equal(BRAND_WASH, "#FFFDE0");     // --takal-yellow-soft
  assert.equal(ACCENT.green, "#1F6F4A");
  assert.equal(ACCENT.orange, "#FF6B35");
  assert.equal(ACCENT.blue, "#004E89");
  assert.equal(ACCENT.red, "#D62839");
  assert.equal(ACCENT.purple, "#6A3FA0");  // marketplace / parcel
  assert.equal(ACCENT.teal, "#0F7B8A");    // grocery
  assert.equal(PLAIN.text, "#000000");
  assert.equal(PLAIN.textSoft, "#4A4A4A");
  assert.equal(PLAIN.line, "#E5E5E5");
  assert.equal(PLAIN.page, "#FAFAFA");
  assert.equal(PLAIN.disabledBg, "#D9D9D9");
  assert.equal(PLAIN.disabledText, "#8A8A8A");
});

test("every meaning colour has a soft background to sit on", () => {
  for (const name of Object.keys(ACCENT)) {
    assert.ok(
      (ACCENT_SOFT as any)[name],
      `"${name}" has no soft background - the Brand Kit gives every meaning colour one`
    );
  }
});

test("the Brand Kit's colours are NOT Tailwind's lookalikes", () => {
  // The panel used to reach for Tailwind's general set - #10b981, #f59e0b,
  // #ef4444, #3b82f6 - which are close to Takal's but not Takal's.
  const tailwindDefaults = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"];
  for (const c of Object.values(ACCENT)) {
    assert.ok(
      !tailwindDefaults.includes(c.toLowerCase()),
      `${c} is a Tailwind default, not a Takal colour`
    );
  }
});

test("parcel jobs are purple and grocery is teal, as the Brand Kit says", () => {
  assert.equal(TONE_HEX[ORDER_KIND_TONE.parcel], ACCENT.purple);
  assert.equal(TONE_HEX[ORDER_KIND_TONE.marketplace], ACCENT.purple);
  assert.equal(TONE_HEX[ORDER_KIND_TONE.grocery], ACCENT.teal);
});

test("every colour is a real hex code", () => {
  const all = [
    BRAND, BRAND_PRESSED, BRAND_WASH, BRAND_DARK, ON_BRAND,
    ...Object.values(ACCENT), ...Object.values(ACCENT_SOFT),
    ...Object.values(PLAIN), ...CHART_SERIES,
    ...Object.values(CHART), ...Object.values(TONE_HEX),
  ];
  for (const c of all) {
    assert.match(c, /^#[0-9a-fA-F]{6}$/, `"${c}" is not a hex colour`);
  }
});

test("brand yellow leads the chart colours, and none repeat", () => {
  // The DARK yellow, not the pure one - a #FFFF00 line on white paper cannot
  // be seen, which is how these charts ended up purple.
  assert.equal(CHART_SERIES[0], BRAND_DARK);
  assert.equal(CHART.line, BRAND_DARK);
  assert.equal(CHART.fill, BRAND);
  assert.equal(new Set(CHART_SERIES).size, CHART_SERIES.length, "a chart colour is used twice");
});

test("the chart line is dark enough to see on white", () => {
  // Rough perceived lightness. Pure #FFFF00 scores about 0.93 - near white.
  const lightness = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  assert.ok(lightness(BRAND) > 0.85, "pure brand yellow really is that light");
  assert.ok(
    lightness(CHART.line) < 0.55,
    `the chart line is too light to read (${lightness(CHART.line).toFixed(2)})`
  );
});

test("a status is the same colour in the chart as on the pill beside it", () => {
  assert.equal(statusHex("delivered"), TONE_HEX.good);
  assert.equal(statusHex("cancelled"), TONE_HEX.bad);
  assert.equal(statusHex("pending"), TONE_HEX.warn);
  assert.equal(statusHex("anything_unknown"), TONE_HEX.neutral);
});

test("every status has exactly one tone, and that tone exists", () => {
  for (const [status, tone] of Object.entries(STATUS_TONE)) {
    assert.ok(TONE_CLASS[tone], `status "${status}" uses unknown tone "${tone}"`);
  }
});

test("a delivered order is good and a cancelled one is bad, everywhere", () => {
  assert.equal(toneFor("delivered"), "good");
  assert.equal(toneFor("cancelled"), "bad");
  assert.equal(toneFor("rejected"), "bad");
  assert.equal(toneFor("pending"), "warn");
});

test("suspended means the same on riders and on stores", () => {
  // It used to be red on one page and grey on the other, for one meaning.
  assert.equal(toneFor("suspended"), "bad");
  assert.equal(toneFor("blocked"), "bad");
  assert.equal(statusHex("suspended"), ACCENT.red);
});

test("every tone has both a set of classes and a solid colour", () => {
  for (const tone of Object.keys(TONE_CLASS)) {
    assert.ok((TONE_HEX as any)[tone], `tone "${tone}" has no solid colour for charts`);
  }
  for (const tone of Object.keys(TONE_HEX)) {
    assert.ok((TONE_CLASS as any)[tone], `tone "${tone}" has no classes for a pill`);
  }
});

test("status matching ignores capitals", () => {
  assert.equal(toneFor("DELIVERED"), toneFor("delivered"));
  // "on_the_way" is grocery/teal, and this test used to say "busy" because
  // STATUS_TONE carried its own second copy of the order lifecycle. The two
  // copies had drifted: an at-hub order came out blue from one and grey from
  // the other. STATUS_TONE is now filled in from ORDER_STATUS, so there is one
  // answer, and this is it.
  assert.equal(toneFor("On_The_Way"), "grocery");
});

test("the order statuses in STATUS_TONE are the same eleven ORDER_STATUS has", () => {
  // WHAT THIS CATCHES: somebody adding a status to one list and not the other.
  for (const [status, meta] of Object.entries(ORDER_STATUS)) {
    assert.equal(
      toneFor(status),
      meta.tone,
      `${status} is painted two different ways`
    );
  }
  // And the words the system never sends are gone from both.
  for (const ghost of ["cooking", "delivering", "confirmed", "returned"]) {
    assert.equal(toneFor(ghost), "neutral", `${ghost} is not a real status`);
  }
});

test("an unknown status goes quiet grey instead of guessing", () => {
  assert.equal(toneFor("something_new_from_the_server"), "neutral");
  assert.equal(toneFor(null), "neutral");
  assert.equal(toneFor(undefined), "neutral");
});

test("a raw status is turned into words a person can read", () => {
  assert.equal(statusLabel("on_the_way"), "On the way");
  assert.equal(statusLabel("out_of_stock"), "Out of stock");
  assert.equal(statusLabel("delivered"), "Delivered");
  assert.equal(statusLabel(null), "—");
});

test("every order status the backend can send has a colour", () => {
  // Straight from backend/routers/orders_status.py - the eight statuses that
  // trigger a push to the customer, plus the two entry states.
  const fromServer = [
    "pending", "accepted", "preparing", "ready", "picked_up",
    "on_the_way", "delivered", "cancelled", "rejected",
  ];
  for (const s of fromServer) {
    assert.notEqual(toneFor(s), "neutral", `order status "${s}" has no colour of its own`);
  }
});
