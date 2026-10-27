"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › PRODUCT SORTING › OVERVIEW.  (Mock 210-3, approved by Sana
// 27 October 2026.) One question at a glance: how much of Takal is on its
// right shelf, and what is left? "Sort now" opens Find & move already
// filtered to that department's (or shop's) catch-all piles. The latest moves
// can be put back from here, through the same Undo as Shelf check.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog, ErrorState, LoadingState } from "@/components/ui";
import type { SortingMoveLine, SortingOverview } from "@/lib/api-stores";
import { deptColour } from "@/lib/shelves";
import { slugOf } from "@/lib/shelf-chooser";
import { barWidth, sortNowHref, whenWords } from "@/lib/product-sorting";

export default function SortingOverviewPage() {
  const [data, setData] = useState<SortingOverview | null>(null);
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState(false);
  const [undoing, setUndoing] = useState<SortingMoveLine | null>(null);

  const load = useCallback(async (fresh = false) => {
    setBusy(true);
    try {
      setData(await apiClient.getSortingOverview(fresh));
      setFailed("");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "The numbers could not be read");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const undo = async () => {
    if (!undoing) return;
    const line = undoing;
    setBusy(true);
    let back = 0;
    try {
      for (const id of line.batch_ids) back += (await apiClient.undoShelfCheck(id)).put_back || 0;
      toast(`${back.toLocaleString()} products put back`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not put them back", "error");
    } finally {
      setUndoing(null);
      setBusy(false);
      load(true);
    }
  };

  if (!data && failed) return <ErrorState message={failed} onRetry={() => load(true)} />;
  if (!data) return <LoadingState label="Counting every product…" />;

  const piles = data.pile_shelves.map((p) => p.name).filter(Boolean).join(" · ");
  return (
    <div className="space-y-3.5">
      {/* The four numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="ALL PRODUCTS" value={data.total} sub={`in ${data.shops.length.toLocaleString()} shops`} edge="border-l-black" subCls="text-takal-ink" />
        <Tile label="ON THEIR RIGHT SHELF" value={data.right_shelf} sub={`${data.sorted_percent}% of all products`} edge="border-l-takal-green" subCls="text-takal-green" />
        <Tile label="STILL IN CATCH-ALL PILES" value={data.in_piles} sub={piles || "Over the Counter · Other Medical Devices · Mother & Baby Care"} edge="border-l-takal-orange" subCls="text-takal-orange" />
        <Tile label="MOVED THIS WEEK" value={data.moved_this_week} sub="every move can be undone" edge="border-l-takal-blue" subCls="text-takal-blue" />
      </div>

      {/* The whole of Takal in one bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-takal-line bg-white px-4 py-3">
        <b className="text-sm">Whole of Takal</b>
        <div className="flex h-3.5 min-w-[200px] flex-1 overflow-hidden rounded-full bg-[#eee]"
          role="img" aria-label={`${data.sorted_percent}% on the right shelf`}>
          <div className="bg-takal-green" style={{ width: `${barWidth(data.sorted_percent)}%` }} />
          <div className="bg-takal-orange" style={{ width: `${barWidth(100 - data.sorted_percent)}%` }} />
        </div>
        <span className="text-xs text-takal-ink-soft">
          <b className="text-takal-green">■</b> right shelf {data.sorted_percent}% &nbsp;
          <b className="text-takal-orange">■</b> in piles {100 - data.sorted_percent}%
        </span>
        <button type="button" onClick={() => load(true)} disabled={busy} title="Count again now"
          className="flex items-center gap-1.5 rounded-lg border border-takal-line px-2.5 py-1 text-xs font-bold hover:border-takal-ink disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Count again
        </button>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1.25fr_1fr]">
        {/* By department */}
        <div className="min-w-0 rounded-xl border border-takal-line bg-white p-4">
          <b className="text-[15px]">By department</b>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-takal-line text-left text-[11.5px] font-bold text-takal-ink-soft">
                  <th className="px-2 py-2">Department</th><th className="px-2 py-2 text-right">Products</th>
                  <th className="px-2 py-2">Sorted</th><th className="px-2 py-2 text-right">In piles</th><th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.slug || d.name} className="border-b border-takal-line last:border-0">
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[11px] font-black text-white"
                          style={{ background: deptColour(d.slug || slugOf(d.name))[0] }}>
                          {d.name.replace(/[^A-Za-z]/g, "").charAt(0)}
                        </span>
                        <span className="font-medium">{d.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">{d.products.toLocaleString()}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-block h-2 w-28 overflow-hidden rounded-full bg-[#eee] align-middle">
                        <span className={`block h-full ${d.piles ? "bg-takal-orange" : "bg-takal-green"}`} style={{ width: `${barWidth(d.sorted_percent)}%` }} />
                      </span>
                      <span className="ml-2 text-xs text-takal-ink-soft">{d.sorted_percent}%</span>
                    </td>
                    <td className={`px-2 py-2.5 text-right font-bold ${d.piles ? "text-takal-orange" : "text-takal-disabled-text"}`}>{d.piles.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-right">
                      {d.piles && d.slug ? (
                        <Link href={sortNowHref({ dept: d.slug })}
                          className="rounded-[7px] border-[1.5px] border-takal-ink bg-takal-yellow px-2.5 py-1 text-xs font-bold">Sort now</Link>
                      ) : <span className="text-xs text-takal-ink-soft">✓ done</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-3.5">
          {/* Shops that need sorting */}
          <div className="rounded-xl border border-takal-line bg-white p-4">
            <b className="text-[15px]">Shops that need sorting</b>
            {data.shops_to_sort.length === 0 && <p className="mt-2 text-sm text-takal-green">✓ Every shop is sorted.</p>}
            {data.shops_to_sort.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-takal-line py-3 last:border-0">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-takal-green text-base font-black text-white">
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block">{s.name}</b>
                  <span className="text-xs text-takal-ink-soft">{s.products.toLocaleString()} products · <b className="text-takal-orange">{(s.piles || 0).toLocaleString()} in piles</b></span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="inline-block h-2 w-40 overflow-hidden rounded-full bg-[#eee]">
                      <span className="block h-full bg-takal-orange" style={{ width: `${barWidth(s.sorted_percent)}%` }} />
                    </span>
                    <span className="text-xs text-takal-ink-soft">{s.sorted_percent}% sorted</span>
                  </span>
                </div>
                <Link href={sortNowHref({ shop: s.id })}
                  className="rounded-[7px] border-[1.5px] border-takal-ink bg-white px-2.5 py-1 text-xs font-bold hover:bg-takal-yellow">Open in Find &amp; move</Link>
              </div>
            ))}
            {data.shops_to_sort.length > 0 && (
              <p className="mt-2 text-xs text-takal-ink-soft">Every other shop ({data.shops_all_sorted.toLocaleString()}) is 100% sorted.</p>
            )}
          </div>

          {/* What happened lately */}
          <div className="rounded-xl border border-takal-line bg-white p-4">
            <b className="text-[15px]">What happened lately</b>
            {data.recent === null && <p className="mt-2 text-sm text-takal-orange">The latest moves could not be read just now.</p>}
            {data.recent?.length === 0 && <p className="mt-2 text-sm text-takal-ink-soft">Nothing moved in the last two weeks.</p>}
            {data.recent?.map((m) => (
              <div key={m.batch_ids.join(",")} className="flex flex-wrap items-center gap-2.5 border-b border-takal-line py-2.5 last:border-0">
                <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${String(m.by || "").startsWith("Takal") ? "bg-takal-blue-soft text-takal-blue" : "bg-takal-green-soft text-takal-green"}`}>
                  {whenWords(m.moved_at)}
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <b>{m.count.toLocaleString()} {m.undone ? "put back" : "moved"}</b> · {m.by || "Takal"}
                  {m.batches > 1 && <span className="text-takal-ink-soft"> ({m.batches} shelves)</span>}
                </div>
                {!m.undone && (
                  <button type="button" onClick={() => setUndoing(m)} disabled={busy}
                    className="rounded-[7px] border-[1.5px] border-takal-ink bg-white px-2.5 py-1 text-xs font-bold hover:bg-takal-yellow-soft disabled:opacity-50">
                    Undo…
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!undoing} onCancel={() => setUndoing(null)} onConfirm={undo} busy={busy}
        title="Put these products back?" confirmLabel="Put them back"
        message={undoing ? <>All <b>{undoing.count.toLocaleString()}</b> products moved {whenWords(undoing.moved_at)} by <b>{undoing.by}</b> go back to the shelf they were on. A product moved again since then stays where it is.</> : null} />
    </div>
  );
}

function Tile({ label, value, sub, edge, subCls }: { label: string; value: number | null; sub: string; edge: string; subCls: string }) {
  return (
    <div className={`rounded-xl border border-l-[5px] border-takal-line bg-white px-4 py-3 ${edge}`}>
      <p className="text-[11.5px] font-bold text-takal-ink-soft">{label}</p>
      <p className="my-0.5 text-[28px] font-black leading-tight">{value === null ? "—" : value.toLocaleString()}</p>
      <p className={`text-[12.5px] font-bold ${subCls}`}>{sub}</p>
    </div>
  );
}
