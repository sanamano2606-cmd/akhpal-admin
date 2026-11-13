"use client";
/* eslint-disable @next/next/no-img-element -- the panel shows pictures with a plain <img>: images are unoptimized (next.config.js) and come from Takal's own picture store or the panel itself */

// 📚 COLLECTIONS (Mock 244): a named row on Home - picked products, picked
// shops, or a rule that fills itself ("Under Rs 300", "New this week"). Each
// collection becomes a block in 🧱 Blocks, where it is placed, switched and
// given its dates. Only what a customer can order is shown; the line under
// each one says how many of its picks are on sale right now.

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { TAB_NAMES, TOWN_POINTS, newCollection, type Collection, type Layout } from "@/lib/app-home";
import { Choices, Label, WordsPair } from "./parts-fields";

const MAX_COLLECTIONS = 12;
const MAX_ITEMS = 30;

type Found = { id: string; name: string; image_url?: string; store_name?: string };

export function CollectionsPart({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  const [openId, setOpenId] = useState<string | null>(layout.collections[0]?.id ?? null);
  const set = (cs: Collection[]) => onChange({ ...layout, collections: cs });
  const add = () => {
    if (layout.collections.length >= MAX_COLLECTIONS) return;
    const c = newCollection();
    // A new collection also gets its block, switched off until it is ready.
    onChange({
      ...layout,
      collections: [...layout.collections, c],
      blocks: [...layout.blocks, { key: `collection:${c.id}`, on: false, where: "all", when: {} }],
    });
    setOpenId(c.id);
  };
  const remove = (id: string) => onChange({
    ...layout,
    collections: layout.collections.filter((c) => c.id !== id),
    blocks: layout.blocks.filter((b) => b.key !== `collection:${id}`),
  });
  const patch = (id: string, p: Partial<Collection>) => set(layout.collections.map((c) => (c.id === id ? { ...c, ...p } : c)));

  return (
    <div data-part="collections">
      <p className="mb-3 text-[13px] text-takal-ink-soft">
        A collection is a row on Home with its own title. After you make one, place it and switch it on in 🧱 Blocks - there you can also give it dates or a ready time.
      </p>
      {layout.collections.map((c) => (
        <CollectionBox key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)}
          onChange={(p) => patch(c.id, p)} onRemove={() => remove(c.id)}
          blockOn={!!layout.blocks.find((b) => b.key === `collection:${c.id}` && b.on)} />
      ))}
      <button type="button" onClick={add} disabled={layout.collections.length >= MAX_COLLECTIONS}
        className="h-[44px] rounded-xl border-2 border-dashed border-[#b5b5b5] px-4 text-[13px] font-bold disabled:opacity-50">
        + New collection
      </button>
      {layout.collections.length >= MAX_COLLECTIONS && <span className="ml-2 text-[12px] text-takal-ink-soft">{MAX_COLLECTIONS} is the most - remove one first.</span>}
    </div>
  );
}

function CollectionBox({ c, open, onToggle, onChange, onRemove, blockOn }: {
  c: Collection; open: boolean; onToggle: () => void; onChange: (p: Partial<Collection>) => void;
  onRemove: () => void; blockOn: boolean;
}) {
  const [onSale, setOnSale] = useState<{ shown: number; of: number } | null | "failed">(null);
  const [confirm, setConfirm] = useState(false);

  // "N of M on sale" - asked of the server with the same rules Home uses.
  const key = JSON.stringify([c.fill, c.ids, c.rule]);
  useEffect(() => {
    let gone = false;
    const t = setTimeout(async () => {
      try {
        const r: any = await apiClient.appHomeCollectionRows(c, TOWN_POINTS.mingora.lat, TOWN_POINTS.mingora.lon);
        const shown = (r?.products || r?.shops || []).length;
        if (!gone) setOnSale({ shown, of: c.fill === "rule" ? shown : c.ids.length });
      } catch {
        if (!gone) setOnSale("failed");
      }
    }, 600);
    return () => { gone = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const line = onSale === null ? "checking…" : onSale === "failed" ? "could not be checked"
    : c.fill === "rule" ? `${onSale.shown} on sale in Mingora now`
    : `${onSale.shown} of ${onSale.of} on sale in Mingora now`;

  return (
    <div className={`mb-2.5 rounded-xl border bg-white ${open ? "border-takal-ink shadow-[inset_0_0_0_1px_#000]" : "border-takal-line"}`} data-collection={c.id}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left">
        <span className="text-[14px]">{open ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">📚 {c.title_en || "New collection"}</span>
        <span className="text-[12px] text-takal-ink-soft" data-on-sale>{line}</span>
        <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${blockOn ? "bg-takal-green-soft text-takal-green" : "bg-[#F2F2EF]"}`}>{blockOn ? "On Home" : "Off"}</span>
      </button>
      {open && (
        <div className="border-t border-[#F0F0F0] px-3.5 pb-3.5">
          <WordsPair label="Title" en={c.title_en} ur={c.title_ur} max={40} placeholder="Under Rs 300"
            onEn={(v) => onChange({ title_en: v })} onUr={(v) => onChange({ title_ur: v })} />
          <Label>What fills it</Label>
          <Choices value={c.fill} onChange={(v) => onChange({ fill: v, ids: [] })}
            options={[{ key: "products", name: "Products I pick" }, { key: "shops", name: "Shops I pick" }, { key: "rule", name: "A rule fills it" }]} />
          {c.fill === "products" && <ProductPicker ids={c.ids} onChange={(ids) => onChange({ ids })} />}
          {c.fill === "shops" && <ShopPicker ids={c.ids} onChange={(ids) => onChange({ ids })} />}
          {c.fill === "rule" && <RuleBox c={c} onChange={onChange} />}
          {onSale !== null && onSale !== "failed" && onSale.shown === 0 && (
            <div className="mt-2 rounded-lg bg-takal-orange-soft px-3 py-2 text-[12px] font-semibold">
              Nothing in it is on sale now - customers will not see this row until something is.
            </div>
          )}
          <div className="mt-3">
            {!confirm ? (
              <button type="button" onClick={() => setConfirm(true)} className="h-[30px] rounded-lg border border-takal-red px-3 text-[13px] font-semibold text-takal-red">Remove collection</button>
            ) : (
              <span className="text-[13px]">Remove it and its block?{" "}
                <button type="button" onClick={onRemove} className="ml-1 h-[30px] rounded-lg bg-takal-red px-3 font-bold text-white">Yes, remove</button>
                <button type="button" onClick={() => setConfirm(false)} className="ml-1 h-[30px] rounded-lg border border-takal-line px-3">Keep</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleBox({ c, onChange }: { c: Collection; onChange: (p: Partial<Collection>) => void }) {
  const rule = c.rule || {};
  const types = Object.keys(TAB_NAMES);
  return (
    <div className="mt-1">
      <Choices value={rule.kind || "under_price"} onChange={(v) => onChange({ rule: { ...rule, kind: v } })}
        options={[{ key: "under_price", name: "Products under a price" }, { key: "new_shops", name: "Shops new on Takal" }]} />
      {(rule.kind || "under_price") === "under_price" ? (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <Label>Up to (Rs)</Label>
            <input type="number" min={1} step={1} value={rule.max ?? ""} onChange={(e) => onChange({ rule: { ...rule, kind: "under_price", max: e.target.value === "" ? undefined : Math.round(Number(e.target.value)) } })}
              className="h-[32px] w-[110px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]" />
          </div>
          <div>
            <Label>From</Label>
            <select value={rule.type || ""} onChange={(e) => onChange({ rule: { ...rule, kind: "under_price", type: e.target.value || undefined } })}
              className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]">
              <option value="">Every kind of shop</option>
              {types.map((t) => <option key={t} value={t}>{TAB_NAMES[t]}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Label>Approved in the last</Label>
          <select value={rule.days ?? 7} onChange={(e) => onChange({ rule: { ...rule, kind: "new_shops", days: Number(e.target.value) } })}
            className="w-auto h-[32px] rounded-lg border-[1.5px] border-takal-line px-2 text-[13px]">
            {[7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function ProductPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [known, setKnown] = useState<Record<string, Found>>({});
  useEffect(() => {
    let gone = false;
    const t = setTimeout(async () => {
      try {
        const r: any = await apiClient.searchAppHomeProducts(q);
        if (gone) return;
        const list: Found[] = r?.products || [];
        setFound(list); setFailed(false);
        setKnown((k) => ({ ...k, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
      } catch { if (!gone) { setFound([]); setFailed(true); } }
    }, 350);
    return () => { gone = true; clearTimeout(t); };
  }, [q]);
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_ITEMS ? ids : [...ids, id]);
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= ids.length) return;
    const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="mt-2">
      <Label>Picked, in this order ({ids.length} of {MAX_ITEMS})</Label>
      {ids.length === 0 && <div className="text-[12px] text-takal-ink-soft">Nothing picked yet - search below.</div>}
      <div className="flex flex-wrap gap-2">
        {ids.map((id, i) => (
          <div key={id} className="flex items-center gap-1.5 rounded-lg border border-takal-line py-1 pl-1 pr-1.5 text-[12px]">
            {known[id]?.image_url ? <img src={known[id].image_url} alt="" className="h-7 w-7 rounded object-cover" /> : <span className="h-7 w-7 rounded bg-[#F2F2EF]" />}
            <span className="max-w-[140px] truncate">{known[id]?.name || "Product"}</span>
            <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="px-1">‹</button>
            <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="px-1">›</button>
            <button type="button" aria-label="Take out" onClick={() => toggle(id)} className="px-1 text-takal-red">✕</button>
          </div>
        ))}
      </div>
      <Label>Find a live product (with a photo)</Label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a product name"
        className="h-[34px] w-full max-w-[360px] rounded-lg border-[1.5px] border-takal-line px-2.5 text-[13px]" />
      {failed && <div className="mt-1 text-[12px] text-takal-red">The products could not be read - try again.</div>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
        {(found || []).map((p) => {
          const on = ids.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => toggle(p.id)} data-pick={p.id}
              className={`rounded-lg border-[1.5px] p-1.5 text-left text-[12px] ${on ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line"}`}>
              {p.image_url && <img src={p.image_url} alt="" className="mb-1 aspect-square w-full rounded object-cover" />}
              <div className="line-clamp-2 font-semibold">{p.name}</div>
              <div className="truncate text-takal-ink-soft">{p.store_name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShopPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [shops, setShops] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    apiClient.getHomeShopChoices().then((r: any) => setShops(r?.restaurants || [])).catch(() => setShops([]));
  }, []);
  const byId = useMemo(() => Object.fromEntries((shops || []).map((s) => [String(s.id), s])), [shops]);
  const shown = (shops || []).filter((s) => !q || String(s.name || "").toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_ITEMS ? ids : [...ids, id]);
  return (
    <div className="mt-2">
      <Label>Picked ({ids.length} of {MAX_ITEMS})</Label>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <span key={id} className="flex items-center gap-1.5 rounded-lg border border-takal-line px-2 py-1 text-[12px]">
            {byId[id]?.name || "Shop"}
            <button type="button" aria-label="Take out" onClick={() => toggle(id)} className="text-takal-red">✕</button>
          </span>
        ))}
      </div>
      <Label>Find a shop</Label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Shop name"
        className="h-[34px] w-full max-w-[360px] rounded-lg border-[1.5px] border-takal-line px-2.5 text-[13px]" />
      {shops === null && <div className="mt-1 text-[12px] text-takal-ink-soft">Loading shops…</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        {shown.map((s) => (
          <button key={s.id} type="button" onClick={() => toggle(String(s.id))} data-pick-shop={s.id}
            className={`flex items-center gap-1.5 rounded-lg border-[1.5px] px-2 py-1 text-[12px] ${ids.includes(String(s.id)) ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line"}`}>
            {s.image_url ? <img src={s.image_url} alt="" className="h-6 w-6 rounded object-contain" /> : null}{s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
