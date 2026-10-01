// ─────────────────────────────────────────────────────────────────────────────
// EVERY takal-* COLOUR A SCREEN ASKS FOR MUST EXIST.  (1 October 2026.)
//
// Tailwind says nothing when a class names a colour that is not defined - it
// simply makes no CSS. `bg-takal-card` (Card.tsx, Modal.tsx) had no colour
// behind it, so every pop-up window in the panel was see-through; and
// `bg-takal-yellow-wash` (two Settings pages) drew no yellow at all. Found by
// building the panel and looking at it, not by any test - this is that test.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: the folder has spaces in its name and the
// tests also run on Windows (CLAUDE.md section 4).
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function definedColours(): Set<string> {
  const cfg = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
  const start = cfg.indexOf("takal: {");
  assert.ok(start >= 0, "the takal colour block was not found");
  const block = cfg.slice(start + 8, cfg.indexOf("},", start));
  return new Set([...block.matchAll(/^\s*"?([a-z-]+)"?\s*:/gm)].map((m) => m[1]));
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

const USE = /\b(?:[a-z0-9]+:)*(?:bg|text|border|border-[trblxy]|ring|from|to|via|accent|fill|stroke|outline|divide|placeholder|decoration|shadow|caret)-takal-([a-z]+(?:-[a-z]+)*)/g;

test("every takal-* colour used anywhere in the panel is defined", () => {
  const have = definedColours();
  const missing: string[] = [];
  for (const f of files(join(ROOT, "src"))) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(USE)) {
      if (!have.has(m[1])) missing.push(`${m[1]}  (${f.slice(ROOT.length)})`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test("cards and pop-up windows are white", () => {
  const have = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
  assert.match(have, /\bcard: "#FFFFFF"/);
});
