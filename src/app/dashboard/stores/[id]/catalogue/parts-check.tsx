"use client";

/**
 * Step 4 of a whole catalogue: CHECK - totals first, only the rows that need
 * you. (Mock 184, Sana 13 Oct 2026.)
 *
 * 15,212 rows are never drawn at once: four tabs, 50 rows a page, search by
 * name. A product with options opens to show every option with its price,
 * stock and the PRIVATE buying price. Rows to fix do NOT stop the others.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Lock, Upload } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { money } from "@/lib/format";
import {
  fromPrice, linesFor, optionColumns, pageOf,
  type CheckResult, type Leaf, type Tab,
} from "@/lib/catalogue-flow";

export function CheckStep({ result, leaves, onBack, onSave, onFixFile }: {
  result: CheckResult;
  leaves: Leaf[];
  onBack: () => void;
  onSave: () => void;
  onFixFile: () => void;
}) {
  const r = result;
  const c = r.counts;
  const add = r.mode === "add";
  const [tab, setTab] = useState<Tab>(c.problem_rows ? "fix" : c.with_options ? "options" : "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const leafName = useMemo(() => Object.fromEntries(leaves.map((l) => [l.id, l.name])), [leaves]);

  const lines = useMemo(() => linesFor(r, tab, search), [r, tab, search]);
  const shown = pageOf(lines, page);
  const tabs: [Tab, string, number][] = [
    ["fix", "Needs fixing", c.problem_rows],
    ["options", "With options", c.with_options],
    ["all", "All", c.products],
    ["already", add ? "Already in shop" : "Not in this shop", add ? c.already : c.not_found],
  ];
  const overLimit = r.room_today !== null && add && c.products > r.room_today;

  return (
    <Card>
      <CardHeader title="4. Check - totals first, only the rows that need you"
                  hint={`${r.rows_read.toLocaleString()} rows read. Nothing is saved yet.`} />
      <CardBody>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge tone="good">✔ {c.products.toLocaleString()} product{c.products === 1 ? "" : "s"} {add ? "to add" : "to update"}</Badge>
          {c.with_options > 0 && (
            <Badge tone="neutral">☰ {c.with_options.toLocaleString()} with options ({c.rows_joined.toLocaleString()} rows joined)</Badge>
          )}
          {add && c.already > 0 && <Badge tone="busy">{c.already.toLocaleString()} already in shop</Badge>}
          {!add && c.not_found > 0 && <Badge tone="busy">{c.not_found.toLocaleString()} not in this shop</Badge>}
          {c.problem_rows > 0 && <Badge tone="warn">⚠ {c.problem_rows.toLocaleString()} rows to fix</Badge>}
          {c.with_buying > 0 && <Badge tone="neutral">🔒 buying prices on {c.with_buying.toLocaleString()}</Badge>}
          {c.prescription > 0 && <Badge tone="neutral">℞ {c.prescription.toLocaleString()} prescription</Badge>}
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
            <button key={t} type="button" onClick={() => { setTab(t); setPage(0); }}
                    className={`px-3 py-2 text-sm font-semibold border-b-4 -mb-px
                      ${tab === t ? "border-takal-yellow text-takal-ink" : "border-transparent text-takal-ink-soft hover:text-takal-ink"}`}>
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
                <th className="px-4 py-3">{tab === "fix" ? "WHAT TO FIX" : tab === "already" ? "WHAT HAPPENS" : "PRICE"}</th>
              </tr>
            </thead>
            <tbody>
              {shown.items.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-takal-ink-soft">Nothing here.</td></tr>
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
                return [
                  <tr key={`p${key}`} className={`border-t border-takal-line ${opts.length ? "cursor-pointer hover:bg-takal-yellow-soft" : ""}`}
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
                    </td>
                    <td className="px-4 py-2 text-takal-ink">
                      {opts.length ? fromPrice(p) : typeof p.price === "number" ? money(p.price) : "—"}
                      {typeof p.stock === "number" && <span className="ml-2 text-xs text-takal-ink-soft">stock {p.stock}</span>}
                      {typeof p.buying_price === "number" && (
                        <span className="ml-2 text-xs text-takal-ink-soft"><Lock className="w-3 h-3 inline" /> {money(p.buying_price)}</span>
                      )}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`o${key}`} className="bg-takal-yellow-soft">
                      <td />
                      <td colSpan={2} className="px-4 pb-3">
                        <table className="text-xs bg-white border border-takal-line rounded w-full max-w-2xl">
                          <thead>
                            <tr className="bg-takal-page font-bold text-takal-ink-soft">
                              {cols.heads.map((h) => <td key={h} className="px-3 py-1.5">{h}</td>)}
                              <td className="px-3 py-1.5">Price</td>
                              <td className="px-3 py-1.5">Stock</td>
                              <td className="px-3 py-1.5">Buying <Lock className="w-3 h-3 inline" /></td>
                            </tr>
                          </thead>
                          <tbody>
                            {opts.map((o) => (
                              <tr key={o.value} className="border-t border-takal-line">
                                {cols.cells(o).map((v, i) => <td key={i} className="px-3 py-1.5 text-takal-ink">{v}</td>)}
                                <td className="px-3 py-1.5 text-takal-ink">{typeof o.price === "number" ? money(o.price) : "—"}</td>
                                <td className="px-3 py-1.5 text-takal-ink">{typeof o.stock === "number" ? o.stock : "—"}</td>
                                <td className="px-3 py-1.5 text-takal-ink">{typeof o.buying_price === "number" ? money(o.buying_price) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onSave} disabled={c.products === 0}>
            <Upload className="w-4 h-4 mr-2 inline" />
            {add ? "Save" : "Update"} {c.products.toLocaleString()} product{c.products === 1 ? "" : "s"}
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
