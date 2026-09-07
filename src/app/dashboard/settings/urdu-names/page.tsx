"use client";

// ─────────────────────────────────────────────────────────────────────────────
// NAMES IN URDU — the Urdu name of each kind of shop.
//
// Approved by Sana as Mock 33 on 7 September 2026. Audit finding P-9.
//
// WHY THIS PAGE EXISTS
// `shop_types.name_ur` has been in the database for a while and the public
// /shop-types endpoint has always sent it to the phones. Nothing ever wrote
// it: on the live database ALL 21 rows were empty, because there was no screen
// anywhere in this panel that could edit a kind of shop at all.
//
// So a customer using the app in Urdu read an Urdu page with English shop
// names on it — not because anything ignored what Sana had typed, but because
// there was nowhere for her to type it.
//
// WHAT IT DELIBERATELY CANNOT DO
// Only the Urdu name. The delivery speed decides whether a rider is sent and
// what the customer is charged; a screen that can change a word and a price at
// the same time is a screen where the wrong click costs money. The speed is
// shown here, greyed, so it is clear which shops are which — and it is not
// editable.
//
// EMPTY IS A REAL ANSWER. The app falls back to the English name whenever this
// is blank, so the list is never half blank while it is being filled in, and
// there is no need to do all 21 in one sitting.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

type ShopType = {
  code: string;
  name: string;
  name_ur?: string | null;
  speed?: string | null;
  is_active?: boolean;
};

export default function UrduNamesPage() {
  const [types, setTypes] = useState<ShopType[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ReadFailure | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const res = (await apiClient.getAdminShopTypes()) as {
        shop_types?: ShopType[];
      };
      const rows: ShopType[] = res?.shop_types ?? [];
      setTypes(rows);
      const d: Record<string, string> = {};
      rows.forEach((t) => (d[t.code] = t.name_ur || ""));
      setDraft(d);
    } catch (e) {
      setFailure(readFailure(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // SAVED WHEN THE BOX IS LEFT, not on a Save button.
  //
  // Twenty-one boxes and one Save button at the bottom is a Save button that
  // gets forgotten, and twenty-one lost translations. Saving one row as it is
  // left means the worst thing that can be lost is the row being typed.
  const commit = async (t: ShopType) => {
    const next = (draft[t.code] ?? "").trim();
    const before = (t.name_ur || "").trim();
    if (next === before) return;
    setSaving(t.code);
    try {
      await apiClient.setShopTypeUrduName(t.code, next || null);
      setTypes((list) =>
        list.map((x) =>
          x.code === t.code ? { ...x, name_ur: next || null } : x
        )
      );
      setJustSaved(t.code);
      setTimeout(
        () => setJustSaved((c) => (c === t.code ? null : c)),
        1800
      );
    } catch (e) {
      // Put the box back to what is really stored. Leaving the typed text on
      // screen after a failed save is how somebody walks away believing it
      // saved.
      setDraft((d) => ({ ...d, [t.code]: before }));
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(null);
    }
  };

  const filled = types.filter((t) => (t.name_ur || "").trim()).length;

  // A blank table and a broken one used to look identical on other screens:
  // "nothing translated yet" and "the request failed" read the same. This says
  // which it is before anybody starts typing into a list that will not save.
  if (failure) {
    return (
      <div className="p-6">
        <ErrorState
          message={
            <>
              <strong>The list of shop types could not be loaded.</strong>{" "}
              {failure.message}
            </>
          }
          denied={failure.denied}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-takal-ink">Names in Urdu</h1>
        <p className="text-sm text-takal-ink-soft mt-1">
          The names a customer sees when their app is set to Urdu.
        </p>
      </div>

      <div className="bg-takal-yellow-soft border border-takal-yellow-dark rounded-lg p-4 text-sm text-takal-ink">
        <b>Leave any box empty and that name stays in English.</b> Nothing
        breaks, and you can fill them in over time — every box you type improves
        the app the moment it saves, with no app update.
      </div>

      {loading ? (
        <div className="text-sm text-takal-ink-soft">Loading…</div>
      ) : (
        <div className="bg-white border border-takal-line rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-takal-line flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
              Kinds of shop
            </span>
            <span className="text-xs font-semibold text-takal-ink-soft">
              {filled} of {types.length} translated
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft w-2/5">
                  Kind of shop (English)
                </th>
                <th className="px-5 py-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft w-2/5">
                  Urdu name
                </th>
                <th className="px-5 py-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
                  Speed
                </th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.code} className="border-t border-takal-line">
                  <td className="px-5 py-2.5 font-semibold text-takal-ink">
                    {t.name}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        dir="rtl"
                        lang="ur"
                        value={draft[t.code] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [t.code]: e.target.value }))
                        }
                        onBlur={() => commit(t)}
                        placeholder={`not set — shows "${t.name}"`}
                        className="w-full px-3 py-1.5 border border-takal-line rounded-lg text-right focus:ring-2 focus:ring-takal-yellow outline-none"
                      />
                      {saving === t.code && (
                        <Loader2 className="w-4 h-4 animate-spin text-takal-ink-soft shrink-0" />
                      )}
                      {justSaved === t.code && saving !== t.code && (
                        <Check className="w-4 h-4 text-takal-green shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        "text-xs font-bold px-2 py-0.5 rounded-full " +
                        ((t.speed || "") === "instant"
                          ? "bg-takal-green-soft text-takal-green"
                          : "bg-takal-blue-soft text-takal-blue")
                      }
                    >
                      {(t.speed || "") === "instant" ? "Express" : "Standard"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-takal-line text-xs text-takal-disabled-text">
            Saved as you leave each box — there is no Save button to forget. The
            delivery speed is shown for context and cannot be changed here.
          </div>
        </div>
      )}
    </div>
  );
}
