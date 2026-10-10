"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORE NAMES  (Mock 177, approved by Sana 9 October 2026)
//
// Sana: "the Store inside the Mall must be with the same name, The 13 main
// types stores" - "i want this setting in the admin panel so there will be no
// need of code changing."
//
// One switch on the mall: "Name every store after its kind". ON = every store
// of this mall is called "<mall> — <kind>" (the kind's name from Stores ->
// Catalogue - one of the 13), one store per kind. The DATABASE keeps it so
// (migration 129), whoever saves the store. OFF = names are free, as before.
//
// Turning it ON first lists every name it will change, and asks. Turning it
// OFF changes no name. Shown only when the server sends the card (a database
// before migration 129 has no switch).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Mall } from "@/lib/api-stores";
import { namesToChange, shortName } from "@/lib/malls";
import { verticalEmoji } from "@/lib/verticals";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";

export function StoreNamesCard({ mall, onSaved }: { mall: Mall; onSaved: () => void }) {
  const card = mall.store_names;
  const [asking, setAsking] = useState<"on" | "off" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!card) return null;

  const changes = namesToChange(card);
  const blocked = !card.follow && !!card.kind_taken;
  const wrong = card.stores.filter((r) => !r.matches).length;

  const save = async (on: boolean) => {
    setBusy(true);
    try {
      const r = await apiClient.updateMall(mall.id, { store_names_follow_kind: on });
      toast(r.message || "Saved", "success");
      setAsking(null);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Not saved", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 rounded-2xl border border-takal-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-takal-ink">Store names</h3>
          <p className="text-[13px] text-takal-ink-soft">Every store of this mall is named after its kind</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={card.follow}
          aria-label="Name every store after its kind"
          disabled={busy || blocked}
          onClick={() => setAsking(card.follow ? "off" : "on")}
          className="group inline-flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={card.follow ? "text-takal-green" : "text-takal-ink-soft"}>{card.follow ? "On" : "Off"}</span>
          <span className={`relative h-[26px] w-[46px] rounded-full transition-colors ${
            card.follow ? "bg-takal-green group-hover:bg-takal-green/90" : "bg-takal-line group-hover:bg-takal-ink-soft/40"}`}>
            <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${card.follow ? "right-[3px]" : "left-[3px]"}`} />
          </span>
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-[#F3E58A] bg-takal-yellow-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-takal-ink">
        {card.follow ? (
          <>Saved as <b>{mall.name} — <i>kind</i></b>. Inside the mall customers see only the kind:{" "}
            <b>Fashion</b>, <b>Beauty &amp; Personal Care</b>…<br />
            The kinds’ names come from <b>Stores → Catalogue</b> — rename a kind there and these stores follow. No code change.</>
        ) : (
          <>Off: every store keeps the name typed on its own store page. Nothing is renamed.</>
        )}
      </div>

      {blocked && (
        <p role="alert" className="mt-3 rounded-xl border border-[#F3C2C7] bg-takal-red-soft px-3.5 py-2.5 text-[13.5px] text-takal-red">
          This mall has two {card.kind_taken} stores, so they cannot both be named after their kind.
          Move the products into one store first.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm sm:min-w-[420px]">
          <thead>
            <tr className="border-b-[1.5px] border-takal-line text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
              <th className="py-2 pr-3">Kind</th>
              <th className="px-3 py-2">Saved as</th>
              <th className="hidden px-3 py-2 sm:table-cell">Customers see</th>
              <th className="py-2 pl-3"><span className="sr-only">Matches</span></th>
            </tr>
          </thead>
          <tbody>
            {/* read-safe: this card draws only from the mall the page has already read. */}
            {card.stores.map((r) => (
              <tr key={r.id} className="border-b border-[#F0F0F0] align-top">
                <td className="py-2.5 pr-3 font-bold text-takal-ink">
                  <span aria-hidden>{verticalEmoji(r.kind)}</span> {r.kind_name || "—"}
                </td>
                <td className="px-3 py-2.5 text-[12.5px] text-takal-ink-soft">
                  {r.matches ? r.saved_as : (
                    <>
                      <s>{r.saved_as}</s>
                      <span className="block font-bold text-[#B4441A]">→ {r.will_be}</span>
                    </>
                  )}
                  {!r.will_be && <span className="block text-[11.5px]">Not one of the 13 kinds — its name stays as it is</span>}
                </td>
                {/* What customers see TODAY - the name as it is saved now. */}
                <td className="hidden px-3 py-2.5 sm:table-cell">{shortName(r.saved_as, mall.name)}</td>
                <td className={`py-2.5 pl-3 text-right font-extrabold ${r.matches ? "text-takal-green" : "text-[#B4441A]"}`}>
                  {r.matches ? "✓" : "!"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Two stores of one kind: the red note above says why the switch stays off -
          never "turning it on renames them", which it cannot. */}
      {!blocked && (
        <p className={`mt-3 text-sm font-bold ${wrong ? "text-[#B4441A]" : "text-takal-green"}`}>
          {wrong === 0
            ? `✓ All ${card.stores.length} name${card.stores.length === 1 ? "" : "s"} match their kind`
            : `${wrong} name${wrong === 1 ? " does" : "s do"} not match — turning the switch on renames ${wrong === 1 ? "it" : "them"}`}
        </p>
      )}

      <ConfirmDialog
        open={asking === "on"}
        busy={busy}
        danger={false}
        onCancel={() => setAsking(null)}
        onConfirm={() => save(true)}
        title={`Name every store of ${mall.name} after its kind?`}
        confirmLabel={changes.length ? `Turn on and rename ${changes.length} store${changes.length === 1 ? "" : "s"}` : "Turn on"}
        message={(
          <>
            {changes.length ? (
              <>
                <p>These names change now:</p>
                <ul className="mt-1 space-y-1 text-[13px]">
                  {changes.map((c) => (
                    <li key={c.from}><s className="text-takal-ink-soft">{c.from}</s> → <b>{c.to}</b></li>
                  ))}
                </ul>
              </>
            ) : <p>Every name already matches its kind - nothing is renamed.</p>}
            <p className="mt-2 text-[13px] text-takal-ink-soft">
              From then on the names follow the mall and the kind by themselves. Products, orders and money are not touched.
            </p>
          </>
        )}
      />
      <ConfirmDialog
        open={asking === "off"}
        busy={busy}
        danger={false}
        onCancel={() => setAsking(null)}
        onConfirm={() => save(false)}
        title="Turn off “Name every store after its kind”?"
        confirmLabel="Turn off"
        message={<p>No name changes now. From then on each store’s name can be typed freely on its own store page.</p>}
      />
    </div>
  );
}
