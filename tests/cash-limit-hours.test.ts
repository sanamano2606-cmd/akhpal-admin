/**
 * THE HOURS ALLOWED OVER THE CASH LIMIT (migration 120, Sana 5 October 2026).
 *
 * "above then 10000 that i set from admin panel should not be Blocked for the
 *  next 12 hours after reaching to 10 thousands. If i change the value ... that
 *  must change and apply."
 *
 * The box lives on Riders -> Cash limits. These checks hold the panel and the
 * server to the same field name, so a rename on one side cannot leave the box
 * saving into nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const page = readFileSync(join(root, "src/app/dashboard/riders/cash-limits/page.tsx"), "utf8");
const api = readFileSync(join(root, "src/lib/api-people.ts"), "utf8");
const backend = join(root, "..", "swat-delivery-app", "backend");

test("the page has the hours box and it is wired to the form", () => {
  assert.match(page, /id="cash-limit-hours"/);
  assert.match(page, /value=\{form\.cash_limit_grace_hours\}/);
  assert.match(page, /set\("cash_limit_grace_hours", e\.target\.value\)/);
});

test("Save sends the hours, as a whole number, and refuses more than 720", () => {
  const save = page.slice(page.indexOf("const save = async"), page.indexOf("const on = "));
  assert.match(save, /"cash_limit_grace_hours"\] as const/);
  assert.match(save, /n > 720/);
  assert.match(save, /k === "cash_limit_grace_hours" \? Math\.round\(n\)/);
});

test("the test drive measures the hours being typed", () => {
  const payload = page.slice(page.indexOf("const payload = () =>"), page.indexOf("const set = "));
  assert.match(payload, /cash_limit_grace_hours: num\(form\.cash_limit_grace_hours\)/);
  assert.match(api, /cash_limit_grace_hours\?: number \| null;/);
});

test("the server knows the same field name, on the model, the save and the owner map", () => {
  const model = readFileSync(join(backend, "routers", "admin_shared.py"), "utf8");
  const save = readFileSync(join(backend, "routers", "admin_settings.py"), "utf8");
  const tabs = readFileSync(join(backend, "core_tabs.py"), "utf8");
  assert.match(model, /cash_limit_grace_hours: Optional\[int\] = None/);
  assert.match(save, /data\["cash_limit_grace_hours"\] = payload\.cash_limit_grace_hours/);
  assert.match(tabs, /"cash_limit_grace_hours":\s+"riders\.pay-rules"/);
});
