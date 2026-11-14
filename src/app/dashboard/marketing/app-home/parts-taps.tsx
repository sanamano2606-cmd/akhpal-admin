"use client";

// 📊 TAPS (Mock 244): how many times customers tapped each part of Home -
// so a block that nobody uses can be moved down or switched off. Counted on
// the phone, sent at most once a minute, kept per Pakistan day. Nothing about
// WHO tapped is kept - only the number.

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { blockName, CARD_NAMES, type Layout, tabName } from "@/lib/app-home";
import { Choices } from "./parts-fields";

type Row = { block: string; taps: number; items: { item: string; taps: number }[] };

function itemName(block: string, item: string): string {
  if (block === "departments") return (CARD_NAMES as Record<string, string>)[item] || item;
  if (block === "tabs") return tabName(item);
  return item;
}

export function TapsPart({ layout, onTaps }: { layout: Layout; onTaps?: (t: Record<string, number>) => void }) {
  const [days, setDays] = useState<"7" | "30">("7");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "off" | "ok">("loading");
  useEffect(() => {
    let gone = false;
    setState("loading");
    apiClient.getAppHomeTaps(Number(days)).then((r: any) => {
      if (gone) return;
      const list: Row[] = r?.blocks || [];
      setRows(list); setState("ok");
      onTaps?.(Object.fromEntries(list.map((b) => [b.block, b.taps])));
    }).catch((e: any) => {
      if (gone) return;
      setState(e?.status === 501 ? "off" : "failed");
    });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);
  const most = Math.max(1, ...(rows || []).map((r) => r.taps));
  const name = (b: string) => (b === "tabs" ? "Top round tabs" : blockName(b, layout));

  return (
    <div className="rounded-[14px] border border-takal-line bg-white p-4" data-part="taps">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-extrabold">Taps on Home</h3>
        <div className="ml-auto"><Choices value={days} onChange={setDays} options={[{ key: "7", name: "Last 7 days" }, { key: "30", name: "Last 30 days" }]} /></div>
      </div>
      <p className="mb-3 text-[12px] text-takal-ink-soft">Only the number of taps is kept - never who tapped. Phones send their taps about once a minute, so the last minute may be missing.</p>
      {state === "loading" && rows === null && <div className="text-[13px] text-takal-ink-soft">Loading…</div>}
      {state === "failed" && <div className="text-[13px] text-takal-red">The taps could not be read - try again in a moment.</div>}
      {state === "off" && <div className="text-[13px] text-takal-ink-soft">Not switched on yet.</div>}
      {state === "ok" && rows && rows.length === 0 && <div className="text-[13px] text-takal-ink-soft">No taps yet. They start once the new customer app is on phones.</div>}
      {(rows || []).map((r) => (
        <div key={r.block} className="border-t border-[#F0F0F0] py-2" data-taps-block={r.block}>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="w-[180px] shrink-0 truncate font-bold">{name(r.block)}</span>
            <div className="h-3 flex-1 rounded-full bg-[#F2F2EF]">
              <div className="h-3 rounded-full bg-takal-yellow ring-1 ring-inset ring-takal-ink" style={{ width: `${Math.round((r.taps / most) * 100)}%` }} />
            </div>
            <span className="w-[70px] shrink-0 text-right font-extrabold">{r.taps.toLocaleString("en-US")}</span>
          </div>
          {r.items.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5 pl-[188px] max-sm:pl-0">
              {r.items.map((i) => <span key={i.item} className="rounded-full bg-[#F2F2EF] px-2 py-0.5 text-[12px]">{itemName(r.block, i.item)} · {i.taps}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
