// ─────────────────────────────────────────────────────────────────────────────
// ALSO SELLS - ON STORE SETTINGS.  (Mock 233 piece 5, approved by Sana 8 Nov
// 2026; "Go 5" 9 Nov 2026.)
//
// A shop's main type (the box above - only "Shop money" changes it) decides
// delivery and commission. This list is up to 3 MORE types the shop also
// sells, so it is listed under them too. The shop sets it in the Partners app
// (Profile -> What do you sell?); the office can see and correct it here.
//
// Example: Nilam Ghar (Home & Living) also sells Fashion - its ladies' bags.
// Rules (the server's, routers/shop_also_sells.py): at most 3, never Health &
// Pharmacy (a pharmacy needs its own licence), never the main type.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { canAccess } from "@/lib/perms";
import { toast } from "@/lib/toast";
import { alsoSellsLine } from "@/lib/also-sells";

type Choice = { code: string; name: string; allowed: boolean; why: string; on: boolean };
type View = {
  main: { code: string; name: string };
  also_sells: string[];
  max: number;
  choices: Choice[];
  switched_on: boolean;
};

export function AlsoSellsCard({ restaurantId }: { restaurantId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [on, setOn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const mayEdit = canAccess("stores.all");

  const load = async () => {
    try {
      const v = (await apiClient.getAlsoSells(restaurantId)) as View;
      setView(v);
      setOn(v.also_sells || []);
    } catch {
      setView(null);
    }
  };
  useEffect(() => { load(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return null;
  const max = view.max || 3;
  const changed = JSON.stringify(on) !== JSON.stringify(view.also_sells || []);
  const names = view.choices.filter((c) => on.includes(c.code)).map((c) => c.name);

  const tap = (c: Choice) => {
    if (!mayEdit || busy) return;
    if (!c.allowed) { toast(c.why || "This one cannot be ticked.", "error"); return; }
    if (on.includes(c.code)) setOn(on.filter((x) => x !== c.code));
    else if (on.length >= max) toast(`At most ${max} - untick one first.`, "error");
    else setOn([...on, c.code]);
  };

  const save = async () => {
    setBusy(true);
    try {
      const out: any = await apiClient.setAlsoSells(restaurantId, on);
      toast(out?.message || "Saved", "success");
      setView(out as View);
      setOn(out?.also_sells || []);
    } catch (e: any) {
      toast(e?.message || "It could not be saved.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-takal-line bg-white p-5" data-testid="also-sells-card">
      <h3 className="font-semibold text-takal-ink">Also sells</h3>
      <p className="text-sm text-takal-ink-soft mb-3">
        Main type <b className="text-takal-ink">{view.main?.name}</b>. {alsoSellsLine(names)}.
        {" "}Up to {max} - the shop sets it in the Partners app (Profile → What do you sell?).
      </p>
      {!view.switched_on ? (
        <p className="text-sm text-takal-red">Not switched on yet (database update 160).</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {view.choices.map((c) => {
              const ticked = on.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  title={c.allowed ? "" : c.why}
                  disabled={!mayEdit || busy}
                  onClick={() => tap(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    ticked
                      ? "border-black bg-black text-takal-yellow"
                      : c.allowed
                        ? "border-takal-line bg-white text-takal-ink hover:bg-takal-yellow-soft"
                        : "border-takal-line bg-takal-page text-takal-ink-soft cursor-not-allowed"
                  }`}
                >
                  {ticked && <Check className="w-3.5 h-3.5 mr-1 inline" />}
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-takal-ink-soft">
            Health &amp; Pharmacy is never an &quot;also sells&quot; - a pharmacy needs its own licence.
            Delivery and commission always follow the main type.
          </p>
          {mayEdit && changed && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="mt-3 rounded-lg border-2 border-black bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink"
            >
              {busy ? <Loader2 className="w-4 h-4 inline animate-spin" /> : "Save also sells"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
