// THE WELCOME SCREENS ARE EDITED HERE - Mock 149 Idea 4, Sana 4 Oct 2026:
// "idea 4 keep it editable from admin panel too include all things to be
// editable" ... "if i want to turn off so i could from admin panel".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = readFileSync("src/app/dashboard/marketing/welcome/page.tsx", "utf8");
const API = readFileSync("src/lib/api-money.ts", "utf8");

test("the welcome screens can be switched off for everybody", () => {
  assert.ok(PAGE.includes("Show the welcome screens"));
  assert.ok(PAGE.includes("updateOnboardingSettings"));
  assert.ok(API.includes("async updateOnboardingSettings("));
  assert.ok(API.includes("/admin/onboarding/settings"));
});

test("every setting for all screens has a control", () => {
  for (const k of ["show_skip", "wall_motion", "wall_speed", "next_en", "next_ur",
                   "start_en", "start_ur", "skip_en", "skip_ur"]) {
    assert.ok(PAGE.includes(k), `${k} cannot be set`);
  }
});

test("every box on a screen can be edited, in English and Urdu", () => {
  for (const k of ["title", "highlight", "body"]) {
    assert.ok(PAGE.includes(`pair("${k}"`), `${k} has no English + Urdu boxes`);
  }
  for (const k of ["title_ur", "highlight_ur", "body_ur", "photos", "highlight_color", "is_active", "video_url"]) {
    assert.ok(PAGE.includes(k), `${k} is not saved`);
  }
});

test("the photo wall holds up to 12, added, moved and removed here", () => {
  assert.ok(/const MAX_PHOTOS = 12;/.test(PAGE));
  assert.ok(PAGE.includes("Add photos"));
  assert.ok(PAGE.includes("movePhoto"));
  assert.ok(PAGE.includes("multiple"));
});

test("there is a live phone preview, in both languages", () => {
  assert.ok(PAGE.includes("function PhonePreview("));
  assert.ok(PAGE.includes("setUrduPreview"));
});
