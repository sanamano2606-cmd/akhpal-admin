"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › PRODUCT SORTING › FIND & MOVE.  (Mock 210-4, approved by Sana
// 27 October 2026.) Search every product in EVERY shop, tick as many as you
// like, choose one shelf with the shelf chooser (Mock 210-1) and move them in
// one press. The server pages the list 50 at a time; the move is one undoable
// batch, put back by the "Undo" here or Shelf check's Undo history.
//
// "Also remember" (ticked by default, Mock 210-4): when the search is a name
// and every ticked product starts with it, the move also adds that name to
// the Sorting list (Mock 210-5), so new uploads of it land on the shelf by
// themselves. It only remembers - it moves nothing beyond what was ticked.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ErrorState, LoadingState } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { SortingItem, SortingShop } from "@/lib/api-stores";
import { shelfOptions, type ShelfOption } from "@/lib/shelves";
import { buildDepartments } from "@/lib/shelf-chooser";
import {
  EMPTY_FIND, QUICK_CHIPS, RX_CHOICES, findQuery, movedWords, readFindAddress,
  type FindState, type Quick, type RxChoice,
} from "@/lib/product-sorting";
import { rxForLine, wordToRemember } from "@/lib/sorting-list";

export default function FindAndMovePage() {
  const [find, setFind] = useState<FindState>(EMPTY_FIND);
  const [typed, setTyped] = useState("");
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<SortingItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [to, setTo] = useState("");
  const [rx, setRx] = useState<RxChoice>("keep");
  const [moving, setMoving] = useState(false);
  const [done, setDone] = useState<{ words: string; batch: string | null } | null>(null);
  const [one, setOne] = useState<string | null>(null);
  const [cats, setCats] = useState<ShelfOption[]>([]);
  const [shops, setShops] = useState<SortingShop[]>([]);
  const [remember, setRemember] = useState(true);
  const asked = useRef(0);

  // The address first ("Sort now" on the Overview sends dept/shop/quick).
  useEffect(() => {
    const s = readFindAddress(typeof window === "undefined" ? "" : window.location.search);
    setFind(s);
    setTyped(s.q);
    setReady(true);
    apiClient.getShelfTree().then((res) => setCats(shelfOptions(res))).catch(() => setCats([]));
    apiClient.getSortingOverview().then((o) => setShops(o.shops || [])).catch(() => setShops([]));
  }, []);

  const depts = useMemo(() => buildDepartments(cats), [cats]);

  const load = useCallback(async (state: FindState, offset = 0) => {
    const mine = ++asked.current;
    setLoading(true);
    try {
      const page = await apiClient.findSortingProducts(findQuery(state, offset));
      if (mine !== asked.current) return; // an older question answered late
      setItems((old) => (offset ? [...old, ...page.items] : page.items));
      setTotal(page.total);
      setMore(page.more);
      setFailed("");
    } catch (e) {
      if (mine === asked.current) setFailed(e instanceof Error ? e.message : "The products could not be read");
    } finally {
      if (mine === asked.current) setLoading(false);
    }
  }, []);

  // A new question: the ticks empty, so a button never moves a product that
  // is not on the screen. The address follows, so a refresh keeps the search.
  useEffect(() => {
    if (!ready) return;
    setTicked(new Set());
    load(find, 0);
    try {
      const q = findQuery(find);
      window.history.replaceState(null, "", `/dashboard/stores/sorting/find${q ? `?${q}` : ""}`);
    } catch { /* the address is a convenience */ }
  }, [find, ready, load]);

  // Typing waits a moment, so each letter is not a request.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setFind((f) => (f.q === typed ? f : { ...f, q: typed })), 350);
    return () => clearTimeout(t);
  }, [typed, ready]);

  const toggleQuick = (k: Quick) =>
    setFind((f) => ({ ...f, quick: f.quick.includes(k) ? f.quick.filter((x) => x !== k) : [...f.quick, k] }));
  const tick = (id: string) => setTicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allTicked = items.length > 0 && items.every((i) => ticked.has(i.id));
  const tickAll = () => setTicked(allTicked ? new Set() : new Set(items.map((i) => i.id)));

  const doMove = async (ids: string[], shelf: string, mark: RxChoice, word = "") => {
    if (!ids.length || !shelf) return;
    setMoving(true);
    try {
      const out = await apiClient.moveSortingProducts({ ids, to: shelf, rx: mark });
      let words = movedWords(out);
      if (word) {
        const rxOn = items.filter((i) => ids.includes(i.id)).map((i) => i.rx);
        try {
          await apiClient.saveSortingWord({ word, match: "starts", category_id: shelf, rx: rxForLine(mark, rxOn), move_now: false });
          words += ` · “${word.toUpperCase()}” remembered`;
        } catch (e) {
          toast(`Moved - but “${word.toUpperCase()}” was not added to the Sorting list: ${e instanceof Error ? e.message : "try again there"}`, "error");
        }
      }
      setDone({ words, batch: out.batch_id });
      setTicked(new Set());
      setTo("");
      setOne(null);
      load(find, 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nothing was moved", "error");
    } finally {
      setMoving(false);
    }
  };

  const undo = async () => {
    if (!done?.batch) return;
    try {
      const out = await apiClient.undoShelfCheck(done.batch);
      toast(`${(out.put_back || 0).toLocaleString()} products put back`, "success");
      setDone(null);
      load(find, 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not put them back", "error");
    }
  };

  const n = ticked.size;
  const toRemember = useMemo(
    () => wordToRemember(find.q, items.filter((i) => ticked.has(i.id)).map((i) => i.name)), [find.q, items, ticked]);
  const filterSel = "!w-auto rounded-[9px] border-[1.5px] border-takal-ink bg-white px-3 py-2 text-[13px] font-bold";
  return (
    <div className="space-y-3 pb-28">
      {/* The search and the filters */}
      <div className="rounded-xl border border-takal-line bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex min-w-[240px] flex-1 items-center gap-2.5 rounded-[11px] border-2 border-takal-ink bg-white px-3.5 py-2.5 shadow-[0_0_0_3px_#FFFF00]">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-takal-ink-soft" />
            <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Search every product in every shop"
              placeholder="Search every product in every shop - a name or part of one"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-takal-disabled-text" />
            {typed && (
              <button type="button" aria-label="Clear the search" onClick={() => setTyped("")} className="text-takal-ink-soft"><X className="h-4 w-4" /></button>
            )}
            <span className="shrink-0 text-xs text-takal-ink-soft">
              {total === null ? "" : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
            </span>
          </label>
          <select aria-label="Department" value={find.dept} className={filterSel}
            onChange={(e) => setFind((f) => ({ ...f, dept: e.target.value, shelf: "" }))}>
            <option value="">Every department</option>
            {depts.filter((d) => d.slug).map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </select>
          <div className="w-[210px]">
            <CategoryPicker options={cats} value={find.shelf} compact emptyLabel="Any shelf" ariaLabel="Shelf" title="Show one shelf"
              onChange={(id) => setFind((f) => ({ ...f, shelf: id, dept: id ? "" : f.dept }))} />
          </div>
          <select aria-label="Shop" value={find.shop} className={`${filterSel} max-w-[220px]`}
            onChange={(e) => setFind((f) => ({ ...f, shop: e.target.value }))}>
            <option value="">Every shop</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.products.toLocaleString()})</option>)}
          </select>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-takal-ink-soft">Quick:</span>
          {QUICK_CHIPS.map((c) => {
            const on = find.quick.includes(c.key);
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => toggleQuick(c.key)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-black text-takal-yellow" : "border border-[#ddd] bg-white hover:border-takal-ink"}`}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {done && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-takal-green px-4 py-2.5 text-white">
          <b>{done.words}</b>
          {done.batch && (
            <button type="button" onClick={undo} className="rounded-[7px] bg-white px-2.5 py-1 text-xs font-bold text-takal-ink">Undo</button>
          )}
          <button type="button" aria-label="Close" onClick={() => setDone(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {failed && !items.length ? <ErrorState message={failed} onRetry={() => load(find, 0)} /> : (
        <div className="rounded-xl border border-takal-line bg-white">
          {/* Laptop and tablet: a table */}
          <table className="hidden w-full text-[13px] md:table">
            <thead>
              <tr className="border-b border-takal-line text-left text-[11.5px] font-bold text-takal-ink-soft">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" aria-label="Tick every product on the screen" checked={allTicked} onChange={tickAll}
                    className="h-4 w-4 accent-black" />
                </th>
                <th className="px-2 py-2.5">Product</th><th className="px-2 py-2.5">Shop</th>
                <th className="px-2 py-2.5">Shelf now</th><th className="px-2 py-2.5">Prescription</th>
                <th className="w-[230px] px-2 py-2.5">Change one</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const on = ticked.has(it.id);
                return (
                  <tr key={it.id} className={`border-b border-takal-line last:border-0 ${on ? "bg-takal-yellow-soft" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Tick ${it.name}`} checked={on} onChange={() => tick(it.id)} className="h-4 w-4 accent-black" />
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2.5">
                        <Thumb url={it.image_url} />
                        <span className="font-medium">{it.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-takal-ink-soft">{it.shop}</td>
                    <td className="px-2 py-2"><ShelfChip it={it} /></td>
                    <td className="px-2 py-2">{it.rx ? <Rx /> : <span className="text-xs text-takal-ink-soft">no</span>}</td>
                    <td className="px-2 py-2">
                      {one === it.id ? (
                        <CategoryPicker options={cats} value={it.category_id || ""} autoFocus emptyLabel="Choose a shelf…"
                          ariaLabel={`Shelf for ${it.name}`} title={`Choose a shelf for ${it.name}`}
                          onClose={() => setOne(null)} onChange={(id) => { if (id) doMove([it.id], id, "keep"); }} />
                      ) : (
                        <button type="button" onClick={() => setOne(it.id)} disabled={moving || !cats.length}
                          className="text-xs font-bold text-takal-ink underline underline-offset-2 disabled:opacity-40">Change one</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Phone: cards */}
          <div className="md:hidden">
            <label className="flex items-center gap-2 border-b border-takal-line px-3.5 py-2.5 text-xs font-bold">
              <input type="checkbox" checked={allTicked} onChange={tickAll} className="h-4 w-4 accent-black" /> Tick all on the screen
            </label>
            {items.map((it) => (
              <label key={it.id} className={`flex items-center gap-3 border-b border-takal-line px-3.5 py-2.5 ${ticked.has(it.id) ? "bg-takal-yellow-soft" : ""}`}>
                <input type="checkbox" checked={ticked.has(it.id)} onChange={() => tick(it.id)} className="h-4 w-4 accent-black" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{it.name} {it.rx && <Rx />}</span>
                  <span className="block text-xs text-takal-ink-soft">{it.shop} · {it.shelf || "No shelf"}</span>
                </span>
              </label>
            ))}
          </div>

          {loading && <LoadingState label="Finding products…" />}
          {!loading && items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-takal-ink-soft">
              No product matches. Try fewer words, or switch a quick button off.
            </p>
          )}
          {more && !loading && (
            <div className="border-t border-takal-line p-3 text-center">
              <button type="button" onClick={() => load(find, items.length)}
                className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-[13px] font-bold hover:bg-takal-yellow">
                Show 50 more {total !== null && <span className="font-normal text-takal-ink-soft">({items.length.toLocaleString()} of {total.toLocaleString()})</span>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* The black bar: appears once something is ticked */}
      {n > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex flex-wrap items-center gap-3 rounded-2xl bg-black px-4 py-3 text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] md:left-auto md:right-6 md:max-w-[1100px]">
          <b className="text-[15px] text-takal-yellow">{n.toLocaleString()} ticked</b>
          <span className="text-[#999]">|</span>
          <span className="text-sm">Move to</span>
          <div className="w-[260px] max-w-full">
            <CategoryPicker options={cats} value={to} onChange={setTo} emptyLabel="Choose a shelf…" ariaLabel="Move to shelf"
              title={`Choose a shelf for ${n.toLocaleString()} ${n === 1 ? "product" : "products"}`} />
          </div>
          <span className="text-sm">Prescription</span>
          <div role="radiogroup" aria-label="Prescription" className="flex rounded-[9px] bg-[#222] p-[3px]">
            {RX_CHOICES.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={rx === c.key} onClick={() => setRx(c.key)}
                className={`rounded-[7px] px-2.5 py-1 text-[12.5px] ${rx === c.key ? "bg-takal-yellow font-bold text-takal-ink" : "text-white"}`}>
                {c.label}
              </button>
            ))}
          </div>
          {toRemember && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#FFFF00]" />
              Also remember “{toRemember.toUpperCase()}” → this shelf
            </label>
          )}
          <button type="button" disabled={!to || moving}
            onClick={() => doMove(Array.from(ticked), to, rx, remember && toRemember ? toRemember : "")}
            className="ml-auto rounded-[9px] border-[1.5px] border-takal-yellow bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink disabled:border-[#555] disabled:bg-[#444] disabled:text-[#aaa]">
            {moving ? "Moving…" : `Move ${n.toLocaleString()} ${n === 1 ? "product" : "products"}`}
          </button>
        </div>
      )}
    </div>
  );
}

function ShelfChip({ it }: { it: SortingItem }) {
  return (
    <span title={it.where ? `${it.where} › ${it.shelf}` : it.shelf || ""}
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${it.in_pile ? "bg-takal-orange-soft text-[#C2410C]" : "bg-takal-green-soft text-takal-green"}`}>
      {it.shelf || "No shelf"}
    </span>
  );
}

function Rx() {
  return <span className="rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>;
}

function Thumb({ url }: { url: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-[7px] border border-takal-line object-contain" />
    : <span aria-hidden className="h-9 w-9 shrink-0 rounded-[7px] bg-[#e9eef3]" />;
}
