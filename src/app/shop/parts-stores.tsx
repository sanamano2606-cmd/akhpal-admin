// ─────────────────────────────────────────────────────────────────────────────
// A MALL'S STAFF WINDOW: the store buttons and "All stores".
// (Mock 172-4, approved by Sana 8 October 2026; Step 5, 9 October 2026.)
//
// Sana: "staff log in should have access to all stores of that Mall." The row
// of store buttons is always at the top; the chosen one is black. "All
// stores" is one overview: each store's products, pictures still needed, out
// of stock and new orders - and the mall's orders waiting, as one line each.
//
// Every number is read through the SHOP's own doors (products/manage and
// /orders/restaurant), the ones the server walls in for a staff login. A
// number that could not be read is shown as "–", never as 0.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShopOrder } from "@/lib/api-orders";
import type { ShopProductsPage } from "@/lib/api-stores";
import { orderLabel } from "@/lib/format";
import { shortName } from "@/lib/malls";
import { wholeOrders, type StaffShop } from "@/lib/mall-staff-window";
import { verticalEmoji } from "@/lib/verticals";

type Counts = ShopProductsPage["counts"];
export type StoreFigures = Record<string, { counts: Counts | null; orders: ShopOrder[] | null }>;

/** Read every store's figures once (products counts and orders in the store). */
export function useStoreFigures(stores: StaffShop[], reloadKey: number): {
  figures: StoreFigures; loading: boolean; failed: string[];
} {
  const [figures, setFigures] = useState<StoreFigures>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const ids = stores.map((s) => String(s.id)).join(",");

  useEffect(() => {
    if (!ids) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const out: StoreFigures = {};
      const bad: string[] = [];
      await Promise.all(stores.map(async (s) => {
        const id = String(s.id);
        const [counts, orders] = await Promise.all([
          apiClient.getShopProducts(id, { perPage: 1 }).then((r) => r?.counts ?? null).catch(() => null),
          apiClient.getShopOrders(id).then((r) => (Array.isArray(r?.orders) ? r.orders : null)).catch(() => null),
        ]);
        out[id] = { counts, orders };
        if (counts === null || orders === null) bad.push(s.name);
      }));
      if (!alive) return;
      setFigures(out);
      setFailed(bad);
      setLoading(false);
    })();
    return () => { alive = false; };
    // `stores` is read through `ids` - a new array with the same stores must
    // not read everything again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, reloadKey]);

  return { figures, loading, failed };
}

const shown = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString());

/** The row of store buttons. "all" = All stores. */
export function StoreSwitcher({ stores, mallName, picked, figures, onPick }: {
  stores: StaffShop[];
  mallName: string;
  picked: string;
  figures: StoreFigures;
  onPick: (id: string) => void;
}) {
  const total = stores.reduce<number | null>((t, s) => {
    const n = figures[String(s.id)]?.counts?.all;
    return t == null || n == null ? null : t + n;
  }, 0);
  const Chip = ({ id, label, emoji, n }: { id: string; label: string; emoji?: string; n: number | null | undefined }) => {
    const on = picked === id;
    return (
      <button type="button" onClick={() => onPick(id)} aria-pressed={on}
        className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-[1.5px] px-4 py-2.5 text-[15px] font-bold transition ${
          on ? "border-[#111111] bg-[#111111] text-white"
            : "border-takal-line bg-white text-takal-ink hover:border-[#DADA00] hover:bg-[#FFFEE0]"}`}>
        {emoji && <span aria-hidden>{emoji}</span>}
        {label}
        <span className="rounded-full bg-takal-yellow px-2 text-[11.5px] leading-5 text-black">{shown(n)}</span>
      </button>
    );
  };
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-takal-ink">Choose a store - one login works in every store of this mall</p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Stores of the mall">
        <Chip id="all" label="All stores" n={total} />
        {stores.map((s) => (
          <Chip key={s.id} id={String(s.id)} label={shortName(s.name, mallName)}
            emoji={verticalEmoji(s.vendor_type)} n={figures[String(s.id)]?.counts?.all} />
        ))}
      </div>
    </div>
  );
}

/** "All stores": one card per store, and the orders waiting. */
export function AllStores({ stores, mallName, figures, loading, failed, onPick, onOrders }: {
  stores: StaffShop[];
  mallName: string;
  figures: StoreFigures;
  loading: boolean;
  failed: string[];
  onPick: (id: string) => void;
  onOrders: () => void;
}) {
  const names = new Map(stores.map((s) => [String(s.id), shortName(s.name, mallName)]));
  const everyOrder = stores.flatMap((s) => figures[String(s.id)]?.orders || []);
  const waiting = wholeOrders(everyOrder).filter((o) => o.stage === "new");
  const Row = ({ label, n, warn = false }: { label: string; n: number | null | undefined; warn?: boolean }) => (
    <p className="flex justify-between py-1 text-[15px]">
      <span className="text-takal-ink">{label}</span>
      <b className={warn && (n ?? 0) > 0 ? "text-takal-red" : "text-takal-ink"}>{loading ? "…" : shown(n)}</b>
    </p>
  );

  return (
    <div className="space-y-4">
      {failed.length > 0 && !loading && (
        <p role="alert" className="rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">
          Some figures could not be read for: {failed.join(", ")}. They show “–”. Open the store to see it.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stores.map((s) => {
          const f = figures[String(s.id)];
          const fresh = f?.orders ? f.orders.filter((o) => o.status === "pending").length : null;
          return (
            <div key={s.id} className="flex flex-col rounded-2xl border border-takal-line bg-white p-4">
              <div className="mb-2 flex items-center gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F7F1EA] text-2xl">
                  {verticalEmoji(s.vendor_type)}
                </span>
                <h3 className="min-w-0 text-lg font-extrabold leading-tight text-takal-ink">{shortName(s.name, mallName)}</h3>
              </div>
              <Row label="Products" n={f?.counts?.all} />
              <Row label="Need a picture" n={f?.counts?.no_picture} warn />
              <Row label="Out of stock" n={f?.counts?.out_of_stock} />
              <Row label="New orders" n={fresh} warn />
              <button type="button" onClick={() => onPick(String(s.id))}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#111111] bg-white px-4 py-2.5 text-[15px] font-bold text-takal-ink shadow-[0_3px_0_#111111] hover:bg-[#FFFEE0]">
                Open store <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-takal-line bg-white px-4 py-3">
        <h3 className="text-lg font-extrabold text-takal-ink">Orders waiting</h3>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {/* read-safe: "nothing new" is said only when every store's orders were read. */}
          {loading ? (
            <span className="text-sm text-takal-ink-soft">Reading…</span>
          ) : waiting.length === 0 ? (
            <span className="text-sm text-takal-ink-soft">
              {failed.length ? "Not every store could be read - open Orders to check." : "No new order right now."}
            </span>
          ) : waiting.slice(0, 4).map((o) => (
            <span key={o.key} className="rounded-full bg-takal-red-soft px-3 py-1 text-[13px] font-bold text-takal-red">
              NEW · {orderLabel(o.parts[0])} · {o.parts.map((p) => names.get(String(p.restaurant_id)) || "Store").join(" + ")}
              {o.isMall && o.parts.length > 1 ? " · one parcel" : ""}
            </span>
          ))}
          {waiting.length > 4 && <span className="text-sm font-bold text-takal-red">+{waiting.length - 4} more</span>}
        </div>
        <button type="button" onClick={onOrders}
          className="inline-flex items-center gap-1.5 rounded-xl bg-takal-yellow px-4 py-2.5 text-[15px] font-bold text-takal-ink shadow-[0_3px_0_#E6E600] hover:bg-takal-yellow-dark">
          Open Orders <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
