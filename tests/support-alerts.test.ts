// CAN A SUPPORT ALERT ACTUALLY REACH A PERSON?
//
// WHY THIS FILE EXISTS
// Until 16 September 2026 a customer could write to Takal Support and nobody
// was told. The conversation was marked unread and then waited for somebody to
// happen to open the panel. The fix has four separate pieces, and EVERY ONE OF
// THEM FAILS SILENTLY:
//
//   1. The server has to send the alert.          (backend tests cover that.)
//   2. The panel has to ask the browser for an    <- this file
//      address to send it to.
//   3. The browser has to be allowed to load      <- this file
//      Google's alert library and talk to it.
//   4. Both halves have to agree on ONE address   <- this file
//      for the settings.
//
// Nothing here fails a build, a type check or a lint. A wrong line in the
// security header does not throw; the alert simply never arrives, with nothing
// in any log a person would think to look at. That is the worst kind of
// broken, and it is what these tests are for.
//
// Two of these tests were written because the mistake had ALREADY been made,
// not in case it might be: the panel was asking for "/admin/push-config" while
// the server answers on "/push-config", and the security header would have
// blocked Google's library on its very first line.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CONFIG = readFileSync("next.config.js", "utf8");
const ALERTS = readFileSync("src/lib/alerts.ts", "utf8");
const WORKER = "src/app/firebase-messaging-sw.js/route.ts";
const SETTINGS = readFileSync("src/app/dashboard/settings/page.tsx", "utf8");

/** The security header, with the code comments stripped out of it. */
const CSP = CONFIG.split("\n")
  .filter((l) => !l.trimStart().startsWith("//"))
  .join("\n");

// ── 3. THE BROWSER HAS TO BE ALLOWED ──────────────────────────────────────

test("the browser is allowed to load Google's alert library", () => {
  // The worker's first line is importScripts("https://www.gstatic.com/...").
  // A worker is governed by this same header. Take this address out and the
  // worker dies on line one and no alert ever arrives.
  const scriptLines = CSP.split("\n").filter((l) => l.includes("script-src"));
  assert.ok(scriptLines.length > 0, "there is no script-src line at all any more");
  for (const line of scriptLines) {
    assert.ok(
      line.includes("https://www.gstatic.com"),
      `this script-src would block Google's alert library:\n  ${line.trim()}`
    );
  }
});

test("the browser is allowed to ask for this device's alert address", () => {
  // Asked once, when an admin switches alerts on. Without these two, the
  // switch turns itself back off with an error nobody can act on.
  for (const host of [
    "https://fcmregistrations.googleapis.com",
    "https://firebaseinstallations.googleapis.com",
  ]) {
    assert.ok(
      CSP.includes(host),
      `connect-src does not allow ${host}, so alerts can never be switched on`
    );
  }
});

test("the security header still keeps everything else closed", () => {
  // The point of opening three doors is that they are THREE, not "Google".
  // A wildcard here would also cover Drive, Gmail and everything else Google
  // runs, which is exactly what this header exists to prevent.
  assert.ok(
    !CSP.includes("*.googleapis.com") && !CSP.includes("https://*.google"),
    "a wildcard Google address has crept into the security header"
  );
  assert.ok(CSP.includes(`"default-src 'self'"`), "default-src 'self' has gone");
  assert.ok(CSP.includes(`"object-src 'none'"`), "object-src 'none' has gone");
  assert.ok(CSP.includes(`"frame-ancestors 'none'"`), "frame-ancestors 'none' has gone");
});

test("the panel is allowed to run its own alert worker and nobody else's", () => {
  assert.ok(
    CSP.includes(`"worker-src 'self'"`),
    "worker-src 'self' has gone, so the alert worker may not start"
  );
});

// ── 4. BOTH HALVES MUST AGREE ON ONE ADDRESS ──────────────────────────────

test("the panel asks for the alert settings at the address the server answers on", () => {
  assert.ok(
    !ALERTS.includes("/admin/push-config"),
    "src/lib/alerts.ts asks for /admin/push-config; the server answers on /push-config"
  );
  assert.ok(
    ALERTS.includes("/push-config"),
    "src/lib/alerts.ts no longer asks for the alert settings at all"
  );

  // The worker must ask for the SAME one. Two copies of a setting is how the
  // two come to disagree, and the symptom is alerts that stop arriving.
  assert.ok(existsSync(WORKER), `${WORKER} is missing, so no alert can arrive`);
  const worker = readFileSync(WORKER, "utf8");
  assert.ok(
    worker.includes("/push-config") && !worker.includes("/admin/push-config"),
    "the alert worker asks for the settings at a different address than the page does"
  );
});

test("the server really does answer on that address", () => {
  // Cross-project on purpose. The server lives in another folder; if it is not
  // there this test says so rather than passing quietly.
  const server = "../swat-delivery-app/backend/routers/fcm.py";
  assert.ok(existsSync(server), `${server} is missing - has the backend moved?`);
  const py = readFileSync(server, "utf8");
  assert.ok(
    /@router\.get\(\s*["']\/push-config["']/.test(py),
    "the server no longer answers on /push-config, so the panel's alerts cannot start"
  );
});

test("the page and the worker use the SAME Firebase version", () => {
  // The page loads Firebase from node_modules; the worker loads it from
  // Google's address. Two different versions of one library have disagreed
  // about the shape of an alert address before, and the symptom is alerts
  // that simply stop - no error, no log line.
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const wanted = String(pkg.dependencies.firebase).replace(/^[\^~]/, "");
  const worker = readFileSync(WORKER, "utf8");
  const used = /const FIREBASE_VERSION = "([^"]+)"/.exec(worker)?.[1];
  assert.ok(used, "the worker no longer says which Firebase version it loads");
  assert.equal(
    used,
    wanted,
    `the worker loads Firebase ${used} but package.json installs ${wanted}`
  );
  // And it must be written once, not copied into each importScripts line.
  assert.ok(
    !/firebasejs\/[0-9]/.test(worker),
    "a Firebase version number has been written straight into an address again"
  );
});

// ── ONE ADDRESS FOR THE SERVER, WRITTEN THE SAME WAY EVERYWHERE ───────────

test("no screen calls a server address the browser is not allowed to reach", () => {
  // WHY THIS EXISTS. next.config.js builds the browser's security header from
  // its own fallback address, and the browser then REFUSES every other address.
  // On 16 September 2026 the alerts card fell back to "api.takalapp.com" while
  // the header allowed "swat-delivery-api.onrender.com". The request was
  // blocked, the code caught the error, and the card read "not set up yet" -
  // no error on screen, nothing in any log. It shipped, and only a live check
  // found it.
  //
  // So: every fallback address written anywhere in src/ must be the SAME one
  // next.config.js writes into the header.
  const conf = readFileSync("next.config.js", "utf8");
  const wanted = /NEXT_PUBLIC_API_URL\s*\|\|\s*"([^"]+)"/.exec(conf)?.[1];
  assert.ok(wanted, "next.config.js no longer has a fallback API address");

  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const text = readFileSync(full, "utf8");
      const re = /NEXT_PUBLIC_API_URL\s*\|\|\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[1] !== wanted) offenders.push(`${full} falls back to ${m[1]}`);
      }
    }
  };
  walk("src");

  assert.deepEqual(offenders, [],
    `these would be blocked by the security header, which only allows ` +
    `${wanted}:\n${offenders.join("\n")}`);
});

// ── WHO IS SHOWN WHAT A CUSTOMER WROTE ────────────────────────────────────

test("the card admits it when this admin will never be told", () => {
  // Sana, 16 September 2026: support alerts go only to admins holding the
  // Support permission, because the alert carries the first 90 characters of
  // the customer's message. Without this box on the card, a sub-admin without
  // that permission switches alerts on, reads "Alerts are on", and waits for
  // ever - the exact silent failure this whole feature exists to end.
  const card = readFileSync("src/app/dashboard/settings/parts-alerts.tsx", "utf8");
  assert.ok(
    card.includes("you_will_be_told") || card.includes("youWillBeTold"),
    "the card no longer asks whether this admin will actually be told"
  );
  assert.ok(
    card.includes("You will not receive support alerts"),
    "the card no longer warns an admin who cannot receive support alerts"
  );
  assert.ok(
    /youWillBeTold === false/.test(card),
    "the warning is not tied to a definite no - 'not known' must never be shown as 'no'"
  );
});

test("the server sends that answer, and counts only people it would really tell", () => {
  const server = "../swat-delivery-app/backend/routers/fcm.py";
  assert.ok(existsSync(server), `${server} is missing - has the backend moved?`);
  const py = readFileSync(server, "utf8");
  assert.ok(
    py.includes("you_will_be_told"),
    "the server no longer tells the panel whether this admin will be told"
  );
  // Matched as a CALL, with the section in it - not just as a word anywhere in
  // the file. A near-miss name would sail through a looser check and the count
  // would quietly go back to meaning something else.
  assert.ok(
    /_admins_who_may_be_told\(\s*["']support["']\s*\)/.test(py),
    "the settings card is counting a different set of people than the sender " +
    "uses, so the number on screen can promise more than any message delivers"
  );
});

test("the support alert still asks for the support section", () => {
  const sup = "../swat-delivery-app/backend/routers/support.py";
  assert.ok(existsSync(sup), `${sup} is missing`);
  assert.ok(
    /section\s*=\s*["']support["']/.test(readFileSync(sup, "utf8")),
    "the support alert stopped naming its section, so it would go to every " +
    "admin again, permission or not"
  );
});

// ── 2. THE CARD HAS TO BE REACHABLE ───────────────────────────────────────

test("the switch is actually on a page a person can open", () => {
  // A control nobody can find is a control that is off. This card is the ONLY
  // way anybody turns support alerts on.
  // Checked as it is WRITTEN ON THE PAGE, not as it is imported. An import
  // left behind after the card itself was deleted would pass a laxer test
  // while the switch had quietly vanished from the screen.
  assert.ok(
    SETTINGS.includes("<SupportAlerts"),
    "the support-alerts card is not drawn on the settings page any more"
  );
  assert.ok(
    /from\s+["']\.\/parts-alerts["']/.test(SETTINGS),
    "the settings page no longer loads ./parts-alerts"
  );
});
