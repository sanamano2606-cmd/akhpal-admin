"use client";

/**
 * Step 4 of a whole catalogue: CHECK - totals first, only the rows that need
 * you. (Mock 184, Sana 13 Oct 2026; money and the loss check Mock 186.)
 *
 * 15,212 rows are never drawn at once: tabs, 50 rows a page, search by name.
 * A product with options opens to show every option with its price, stock and
 * the PRIVATE buying price. Rows to fix do NOT stop the others.
 *
 * MOCK 186 ("keep both and both must have same things at all"): every row
 * shows its prices now -> new, what the customer pays after the discount and
 * what Takal earns; rows that would sell at a LOSS are red, and Save stays
 * grey until a person ticks "I know these sell at a loss" or leaves them out.
 * The figures are the server's (backend/catalogue_money.py), the same sums as
 * the store's price list.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Lock, Upload } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { money } from "@/lib/format";
import {
  earnsHeading, earnsText, fromPrice, linesFor, lossProducts, lossWhy, nowNew, optionColumns, pageOf,
  productsToSave, saveAllowed,
  type CheckResult, type Leaf, type MoneyLine, type Tab,
} from "@/lib/catalogue-flow";

/** "Rs 38 → Rs 48": the old price struck through, the new one bold. */
function NowNew({ now, next, plain = false }: { now: number | null | undefined; next: number | null | undefined; plain?: boolean }) {
  const v = nowNew(now, next, plain ? (n) => n.toLocaleString() : money);
  return (
    <span className="whitespace-nowrap">
      {v.was && <span className="mr-1 text-takal-ink-soft line-through">{v.was}</span>}
      <span className={v.changed ? "font-bold" : ""}>{v.is}</span>
    </span>
  );
}

function Earns({ l }: { l: MoneyLine }) {
  return (
    <span className={`whitespace-nowrap font-bold ${l.loss ? "text-takal-red" : typeof l.earns === "number" ? "text-takal-green" : "text-takal-ink-soft"}`}>
      {earnsText(l)}
    </span>
  );
}

export function CheckStep({ result, leaves, onBack, onSave, onFixFile }: {
  result: CheckResult;
  leaves: Leaf[];
  onBack: () => void;
  /** confirmLoss: a person ticked "I know these sell at a loss".
   *  leaveOutLosses: "Leave out the N" was pressed. */
  onSave: (opts: { confirmLoss: boolean; leaveOutLosses: boolean }) => void;
  onFixFile: () => void;
}) {
  const r = result;
  const c = r.counts;
  const m = r.money;
  const add = r.mode === "add";
  const losses = m?.loss || 0;
  const [tab, setTab] = useState<Tab>(losses ? "loss" : c.problem_rows ? "fix" : !add && m ? "changes" : c.with_options ? "options" : "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [ticked, setTicked] = useState(false);
  const [leftOut, setLeftOut] = useState(false);
  const leafName = useMemo(() => Object.fromEntries(leaves.map((l) => [l.id, l.name])), [leaves]);
  const earnsHead = earnsHeading(r.fixed_price);

  const lines = useMemo(() => linesFor(r, tab, search), [r, tab, search]);
  const shown = pageOf(lines, page);
  const tabs: [Tab, string, number][] = [
    ...(losses ? [["loss", "Sell at a loss", losses] as [Tab, string, number]] : []),
    ["fix", "Needs fixing", c.problem_rows],
    ...(!add && m ? [["changes", "Prices change", m.price_changes] as [Tab, string, number],
      ["stock", "Stock only", m.stock_only] as [Tab, string, number]] : []),
    ["options", "With options", c.with_options],
    ["all", "All", c.products],
    ["already", add ? "Already in shop" : "Not in this shop", add ? c.already : c.not_found],
  ];
  const overLimit = r.room_today !== null && add && c.products > r.room_today;
  const toSave = productsToSave(r, leftOut).length;
  const canSave = saveAllowed(r, ticked, leftOut);
  const lossNames = lossProducts(r).slice(0, 3).map((p) => p.name);

  return (
    <Card>
      <CardHeader title={add ? "4. Check - totals first, only the rows that need you" : "Check - totals first, only the rows that need you"}
                  hint={`${r.rows_read.toLocaleString()} rows read. Nothing is saved yet.`} />
      <CardBody>
        <div className="flex flex-wrap gap-2 mb-4">
          {add ? (
            <Badge tone="good">✔ {c.products.toLocaleString()} product{c.products === 1 ? "" : "s"} to add</Badge>
          ) : m ? (
            <>
              <Badge tone="good">✔ {m.price_changes.toLocaleString()} price{m.price_changes === 1 ? "" : "s"} change</Badge>
              {m.stock_only > 0 && <Badge tone="neutral">{m.stock_only.toLocaleString()} stock only</Badge>}
              {m.same > 0 && <Badge tone="neutral">{m.same.toLocaleString()} already the same</Badge>}
            </>
          ) : (
            <Badge tone="good">✔ {c.products.toLocaleString()} product{c.products === 1 ? "" : "s"} to update</Badge>
          )}
          {c.with_options > 0 && (
            <Badge tone="neutral">☰ {c.with_options.toLocaleString()} with options ({c.rows_joined.toLocaleString()} rows joined)</Badge>
          )}
          {add && c.already > 0 && <Badge tone="busy">{c.already.toLocaleString()} already in shop</Badge>}
          {!add && c.not_found > 0 && <Badge tone="busy">{c.not_found.toLocaleString()} not in this shop</Badge>}
          {c.problem_rows > 0 && <Badge tone="warn">⚠ {c.problem_rows.toLocaleString()} rows to fix</Badge>}
          {c.with_buying > 0 && <Badge tone="neutral">🔒 buying prices on {c.with_buying.toLocaleString()}</Badge>}
          {c.prescription > 0 && <Badge tone="neutral">℞ {c.prescription.toLocaleString()} prescription</Badge>}
          {losses > 0 && <Badge tone="bad">⚠ {losses.toLocaleString()} would sell at a loss</Badge>}
          {r.fixed_price && add && (m?.missing_buying || 0) > 0 && (
            <Badge tone="bad">⚠ {m!.missing_buying.toLocaleString()} have no buying price - cannot be ordered in a fixed-price store</Badge>
          )}
          {m && typeof m.earns_pct === "number" && (
            <span className="inline-flex items-center rounded-full bg-takal-ink px-3 py-1 text-xs font-bold text-takal-yellow">
              {r.fixed_price ? "Takal earns" : "Margin"} on average {m.earns_pct}%
            </span>
          )}
        </div>

        {r.rows_dropped > 0 && (
          <p className="mb-3 text-sm font-semibold text-takal-red">
            {r.rows_dropped.toLocaleString()} rows past 20,000 were not read - upload them as a second list.
          </p>
        )}
        {overLimit && (
          <div className="mb-3 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
            A shop may add {r.daily_limit?.toLocaleString()} new products a day, and {r.room_today?.toLocaleString()} are
            left today. The first {r.room_today?.toLocaleString()} are saved now; press Save again tomorrow and it
            carries on - nothing is added twice.
          </div>
        )}
        {r.notes.length > 0 && (
          <details className="mb-3 text-sm text-takal-ink">
            <summary className="cursor-pointer font-semibold">
              {r.notes.length.toLocaleString()} buying price{r.notes.length === 1 ? "" : "s"} with paisa will be saved in whole rupees
            </summary>
            <ul className="mt-2 text-xs text-takal-ink-soft space-y-1">
              {r.notes.slice(0, 20).map((n) => <li key={n.row}>Row {n.row}: {n.note}</li>)}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-takal-line mb-3">
          {tabs.map(([t, label, n]) => (
            <button key={t} type="button" onClick={() => { setTab(t); setPage(0); }} data-tab={t}
                    className={`px-3 py-2 text-sm font-semibold border-b-4 -mb-px
                      ${tab === t ? "border-takal-yellow" : "border-transparent hover:text-takal-ink"}
                      ${t === "loss" ? "text-takal-red" : tab === t ? "text-takal-ink" : "text-takal-ink-soft"}`}>
              {label} ({n.toLocaleString()})
            </button>
          ))}
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                 placeholder="Search by name" aria-label="Search by name"
                 className="ml-auto mb-1 border-2 border-takal-line rounded-lg px-3 py-1.5 text-sm focus:border-takal-yellow focus:outline-none" />
        </div>

        <div className="overflow-x-auto border border-takal-line rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                <th className="px-4 py-3 w-20">ROW</th>
                <th className="px-4 py-3">PRODUCT</th>
                {tab === "fix" || tab === "already" ? (
                  <th className="px-4 py-3">{tab === "fix" ? "WHAT TO FIX" : "WHAT HAPPENS"}</th>
                ) : (
                  <>
                    <th className="px-4 py-3">BUYING PRICE (TP)<span className="block font-normal">{add ? "private" : "now → new"}</span></th>
                    <th className="px-4 py-3">SELLING PRICE<span className="block font-normal">{add ? "" : "now → new"}</span></th>
                    <th className="px-4 py-3">CUSTOMER PAYS<span className="block font-normal">after discount</span></th>
                    <th className="px-4 py-3">{earnsHead.toUpperCase()}<span className="block font-normal">each</span></th>
                    <th className="px-4 py-3">STOCK<span className="block font-normal">{add ? "" : "now → new"}</span></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-takal-ink-soft">Nothing here.</td></tr>
              )}
              {shown.items.map((l) => {
                if (l.kind === "fix") {
                  return (
                    <tr key={`f${l.row}`} className="border-t border-takal-line bg-takal-orange-soft">
                      <td className="px-4 py-2 text-takal-ink">{l.row.toLocaleString()}</td>
                      <td className="px-4 py-2 text-takal-ink">{l.name || <span className="text-takal-red">— no name —</span>}</td>
                      <td className="px-4 py-2 text-takal-ink">{l.error}</td>
                    </tr>
                  );
                }
                if (l.kind !== "product" || !l.product) {
                  return (
                    <tr key={`a${l.row}`} className="border-t border-takal-line">
                      <td className="px-4 py-2 text-takal-ink">{l.row.toLocaleString()}</td>
                      <td className="px-4 py-2 text-takal-ink">{l.name}</td>
                      <td className="px-4 py-2 text-takal-ink-soft">
                        {l.kind === "already" ? "Already in the shop - left as it is" : "Not in this shop - Update adds nothing new"}
                      </td>
                    </tr>
                  );
                }
                const p = l.product;
                const opts = p.options || [];
                const key = `${p.rows[0]}`;
                const isOpen = !!open[key];
                const cols = optionColumns(p);
                const specs = p.specs ? Object.entries(JSON.parse(p.specs) as Record<string, string>) : [];
                const sub = [
                  p.category_id ? leafName[p.category_id] || "" : "",
                  ...specs.slice(0, 3).map(([k, v]) => `${k} ${v}`),
                ].filter(Boolean).join(" · ");
                const ml = p.money?.lines || [];
                const one = !opts.length ? ml[0] : undefined;
                const red = !!p.money?.loss;
                const why = ml.filter((x) => x.loss).map(lossWhy)[0];
                const byLabel = new Map(ml.map((x) => [x.label.toLowerCase(), x]));
                return [
                  <tr key={`p${key}`} className={`border-t border-takal-line ${red ? "bg-takal-red-soft" : ""} ${opts.length ? "cursor-pointer hover:bg-takal-yellow-soft" : ""}`}
                      onClick={() => opts.length && setOpen({ ...open, [key]: !isOpen })}>
                    <td className="px-4 py-2 text-takal-ink-soft">{p.rows[0].toLocaleString()}</td>
                    <td className="px-4 py-2 text-takal-ink">
                      <div className="flex flex-wrap items-center gap-2">
                        {opts.length > 0 && (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        <span className="font-semibold">{p.name}</span>
                        {opts.length > 0 && (
                          <span className="rounded-full bg-takal-ink px-2 py-0.5 text-[11px] font-bold text-takal-yellow">
                            {opts.length} OPTIONS
                          </span>
                        )}
                        {p.rx && <span className="rounded-full border border-takal-ink px-2 py-0.5 text-[11px] font-bold">℞ PRESCRIPTION</span>}
                      </div>
                      {sub && <div className="text-xs text-takal-ink-soft mt-0.5">{sub}</div>}
                      {red && why && <div className="text-xs font-bold text-takal-red mt-0.5">✕ {why}</div>}
                    </td>
                    {one ? (
                      <>
                        <td className="px-4 py-2 text-takal-ink"><NowNew now={one.buy_now} next={one.buy_new} /></td>
                        <td className="px-4 py-2 text-takal-ink"><NowNew now={one.sell_now} next={one.sell_new} /></td>
                        <td className="px-4 py-2 text-takal-ink">
                          {typeof one.pays === "number" ? money(one.pays) : "—"}
                          {one.discount_percent > 0 && <span className="ml-1 text-xs text-takal-ink-soft">({one.discount_percent}% off)</span>}
                        </td>
                        <td className="px-4 py-2"><Earns l={one} /></td>
                        <td className="px-4 py-2 text-takal-ink"><NowNew now={one.stock_now} next={one.stock_new} plain /></td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-4 py-2 text-takal-ink">
                        {opts.length ? fromPrice(p) : typeof p.price === "number" ? money(p.price) : "—"}
                        {opts.length > 0 && <span className="ml-2 text-xs text-takal-ink-soft">open to see every option</span>}
                      </td>
                    )}
                  </tr>,
                  isOpen && (
                    <tr key={`o${key}`} className="bg-takal-yellow-soft">
                      <td />
                      <td colSpan={6} className="px-4 pb-3">
                        <table className="text-xs bg-white border border-takal-line rounded w-full max-w-4xl">
                          <thead>
                            <tr className="bg-takal-page font-bold text-takal-ink-soft">
                              {cols.heads.map((h) => <td key={h} className="px-3 py-1.5">{h}</td>)}
                              <td className="px-3 py-1.5">Buying <Lock className="w-3 h-3 inline" /></td>
                              <td className="px-3 py-1.5">Selling</td>
                              <td className="px-3 py-1.5">Customer pays</td>
                              <td className="px-3 py-1.5">{earnsHead}</td>
                              <td className="px-3 py-1.5">Stock</td>
                            </tr>
                          </thead>
                          <tbody>
                            {opts.map((o) => {
                              const x = byLabel.get(o.value.toLowerCase());
                              return (
                                <tr key={o.value} className={`border-t border-takal-line ${x?.loss ? "bg-takal-red-soft" : ""}`}>
                                  {cols.cells(o).map((v, i) => <td key={i} className="px-3 py-1.5 text-takal-ink">{v}</td>)}
                                  <td className="px-3 py-1.5 text-takal-ink">{x ? <NowNew now={x.buy_now} next={x.buy_new} /> : typeof o.buying_price === "number" ? money(o.buying_price) : "—"}</td>
                                  <td className="px-3 py-1.5 text-takal-ink">{x ? <NowNew now={x.sell_now} next={x.sell_new} /> : typeof o.price === "number" ? money(o.price) : "—"}</td>
                                  <td className="px-3 py-1.5 text-takal-ink">{x && typeof x.pays === "number" ? money(x.pays) : "—"}</td>
                                  <td className="px-3 py-1.5">{x ? <Earns l={x} /> : "—"}</td>
                                  <td className="px-3 py-1.5 text-takal-ink">{x ? <NowNew now={x.stock_now} next={x.stock_new} plain /> : typeof o.stock === "number" ? o.stock : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {!add && opts.length > ml.length && (
                          <p className="mt-1 text-xs text-takal-ink-soft">An option with no figures is not on this product in the shop - it is left out, and listed after saving.</p>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {shown.pages > 1 && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Button size="sm" variant="secondary" disabled={shown.page === 0} onClick={() => setPage(shown.page - 1)}>Previous</Button>
            <span className="text-takal-ink">Page {shown.page + 1} of {shown.pages.toLocaleString()} · {lines.length.toLocaleString()} rows</span>
            <Button size="sm" variant="secondary" disabled={shown.page >= shown.pages - 1} onClick={() => setPage(shown.page + 1)}>Next</Button>
          </div>
        )}

        {losses > 0 && (
          <div className="mt-5 rounded-xl border-2 border-takal-red bg-takal-red-soft p-4" data-loss-box>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 font-bold text-takal-ink cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-takal-ink" checked={ticked && !leftOut} disabled={leftOut}
                       onChange={(e) => setTicked(e.target.checked)} />
                I know {losses === 1 ? "this product" : `these ${losses.toLocaleString()} products`} will sell at a loss - save {losses === 1 ? "it" : "them"} anyway
              </label>
              <Button variant="secondary" size="sm" onClick={() => { setLeftOut(!leftOut); setTicked(false); }}>
                {leftOut ? "Put them back" : `Leave out the ${losses.toLocaleString()}`}
              </Button>
            </div>
            <p className="mt-2 text-xs text-takal-ink-soft">
              {leftOut
                ? `Left out: ${lossNames.join(", ")}${losses > 3 ? ` and ${losses - 3} more` : ""}. Everything else is saved.`
                : `${lossNames.join(", ")}${losses > 3 ? ` and ${losses - 3} more` : ""}. Untick = Save stays grey. Every change goes into the store's price history.`}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => onSave({ confirmLoss: ticked && !leftOut, leaveOutLosses: leftOut })} disabled={!canSave}>
            <Upload className="w-4 h-4 mr-2 inline" />
            {add ? "Save" : "Update"} {toSave.toLocaleString()} product{toSave === 1 ? "" : "s"}
          </Button>
          {c.problem_rows > 0 && (
            <Button variant="secondary" onClick={onFixFile}>
              <Download className="w-4 h-4 mr-2 inline" /> Rows to fix (Excel)
            </Button>
          )}
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <span className="text-sm text-takal-ink-soft">
            {c.problem_rows > 0
              ? "Rows to fix do NOT stop the others - correct them in the Excel and upload it again."
              : "Nothing has been saved yet."}
            {r.parts > 1 ? ` Saved in ${r.parts} parts of about 500 rows.` : ""}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
