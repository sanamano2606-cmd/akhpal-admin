// Change 5 (Sana, 8 Nov 2026): "one tap" - the Stores line of the menu shows
// how many shops are ready for the Main Admin's Show switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const code = (p: string) => readFileSync(new URL(p, root), "utf8");

const HOOK = code("src/lib/hooks/useReadyToShowCount.ts");
const LAYOUT = code("src/app/dashboard/layout.tsx");

test("only the Main Admin is asked for the number - only she can press Show", () => {
  assert.match(HOOK, /if \(getMyPerms\(\)\.isSuper\) \{/);
});

test("it reads the server's kept copy, every 5 minutes - never ?fresh=1", () => {
  assert.match(HOOK, /apiClient\.getReadyToShow\(\)/);
  assert.doesNotMatch(HOOK, /getReadyToShow\(true\)/);
  assert.match(HOOK, /READY_COUNT_EVERY_MS = 5 \* 60 \* 1000/);
  assert.match(HOOK, /setInterval\(ask, READY_COUNT_EVERY_MS\)/);
});

test("a failed read shows no number, not a wrong one", () => {
  assert.match(HOOK, /\} catch \{\s*n = 0;\s*\}/);
});

test("the menu draws it on the Stores line, green, saying Ready", () => {
  assert.match(LAYOUT, /const readyShops = useReadyToShowCount\(\);/);
  assert.match(LAYOUT, /item\.href === "\/dashboard\/stores" && readyShops > 0 && \(/);
  assert.match(LAYOUT, /data-testid="ready-shops-count"/);
  assert.match(LAYOUT, /bg-takal-green/);
  assert.match(LAYOUT, /`Ready \$\{readyShops > 99 \? "99\+" : readyShops\}`/);
});

test("pressing Show asks for the number again at once", () => {
  for (const f of ["src/app/dashboard/stores/parts-ready-to-show.tsx", "src/app/dashboard/stores/parts-customers-see.tsx"]) {
    const c = code(f);
    assert.match(c, /import \{ refreshReadyToShowCount \} from "@\/lib\/hooks\/useReadyToShowCount";/, f);
    assert.match(c, /void refreshReadyToShowCount\(\);/, f);
  }
});

test("the server's push opens this same list", () => {
  const ta = code("../swat-delivery-app/backend/takal_assistant.py");
  assert.match(ta, /READY_LINK_PATH = "\/dashboard\/stores\?status=ready"/);
  // and the Stores page really opens a view from ?status=
  assert.match(code("src/app/dashboard/stores/page.tsx"), /setView\(readView\(params\.get\("status"\)\)\);/);
});
