"use client";

/**
 * Step 3 of a whole catalogue: CHECK THE SHELVES - one shelf per PRODUCT.
 * (Mock 201, board 4, picture 2. Sana, 19 October 2026: "Approved".)
 *
 * WHY THIS REPLACES "one word, one shelf". On 15 October the two big
 * pharmacies' sheets said only 7 broad words ("household", "medicine",
 * "cosmetics & personal care"...). Each word went to ONE shelf, so 20,000
 * products landed on 6 shelves: tissue rolls on Family Planning, shampoo on
 * Mother & Baby Care, insulin on Over the Counter. Now the SERVER chooses a
 * shelf for each product from its own name ("ariel" -> Laundry Detergent),
 * says how sure it is, and keeps the sheet's word only as a hint ("Sheet
 * said"). A person checks the "Not sure" ones; nothing goes on a shelf with
 * more than 100 products without being seen.
 *
 * The counting and filtering are lib/shelves.ts (tests/mock-201-shelves.test.ts).
 */

import { useMemo, useState } from "react";
import { ChevronDown, FileText, X } from "lucide-react";
import { CategoryPicker } from "@/components/CategoryPicker";
import { pageOf } from "@/lib/catalogue-flow";
import {
  bigShelves, bigShelvesLine, deptColour, isRx, isSure, saveLabel, shelfFilter, shelfOf, shelfTotals,
  type LeafInfo, type Overrides, type ShelfCheckResult, type ShelfFilter, type ShelfOption,
} from "@/lib/shelves";

export function ShelvesStep({ result, leaves, options, overrides, setOverrides, onBack, onNext }: {
  result: ShelfCheckResult;
  leaves: Map<string, LeafInfo>;
  options: ShelfOption[];
  overrides: Overrides;
  setOverrides: (o: Overrides) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);

  const totals = useMemo(() => shelfTotals(result, overrides, leaves), [result, overrides, leaves]);
  const big = useMemo(() => bigShelves(result, overrides, leaves), [result, overrides, leaves]);
  const rows = useMemo(() => shelfFilter(result, filter, overrides, leaves, search),
    [result, filter, overrides, leaves, search]);
  const shown = pageOf(rows, page);
  const noShelf = useMemo(
    () => (result.products || []).filter((p, i) => !shelfOf(p, i, overrides)).length, [result, overrides]);

  const choose = (f: ShelfFilter) => { setFilter(f); setPage(0); };
  const chip = (f: ShelfFilter, label: string) => (
    <button key={f} type="button" onClick={() => choose(f)} aria-pressed={filter === f}
      className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-bold ${
        filter === f ? "border-[#111111] bg-[#111111] text-white" : "border-[#D7D7D7] bg-white text-takal-ink hover:border-black"}`}>
      {label}
    </button>
  );
  const shelfChip = filter.startsWith("shelf:") ? leaves.get(filter.slice(6))?.name
    || big.find((b) => b.category_id === filter.slice(6))?.shelf || "one shelf" : "";

  return (
    <div className="space-y-3" data-testid="check-the-shelves">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile n={totals.sheet} label="products in the sheet" />
        <Tile n={totals.sure} label="Sure — shelf found from the name" colour="#1F6F4A" />
        <Tile n={totals.notSure} label="Not sure — please choose" colour="#C25E00" />
        <Tile n={totals.rx} label="medicines that need a prescription (Rx)" colour="#D62839" />
      </div>

      {big.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border-[1.5px] border-[#FFB74D] bg-[#FFF4E5] px-3.5 py-2.5 text-[13px] text-[#7A4100]">
          <FileText className="h-4 w-4 flex-none" />
          <span className="min-w-0 flex-1">
            <b className="text-black">No shelf gets more than 100 products without you seeing it.</b>{" "}
            Biggest: {bigShelvesLine(big)} — open each to check.
          </span>
          <button type="button" onClick={() => choose(`shelf:${big[0].category_id}`)}
            className="ml-auto inline-flex h-8 items-center whitespace-nowrap rounded-[9px] border-2 border-black bg-white px-2.5 text-[12.5px] font-bold text-black">
            Check biggest
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "All")}
        {chip("not_sure", `Not sure (${totals.notSure.toLocaleString()})`)}
        {chip("rx", `Rx (${totals.rx.toLocaleString()})`)}
        {chip("changed", `Changed by you (${totals.changed.toLocaleString()})`)}
        {shelfChip && (
          <button type="button" onClick={() => choose("all")}
            className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[#111111] bg-[#111111] px-3.5 py-1.5 text-[13px] font-bold text-white">
            {shelfChip} ({rows.length.toLocaleString()}) <X className="h-3.5 w-3.5" />
          </button>
        )}
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by name…"
          aria-label="Search the products"
          className="ml-auto w-56 rounded-lg border border-takal-line px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-takal-yellow" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-takal-line bg-white px-3.5 py-1">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[11.5px] font-bold uppercase tracking-wide text-[#666666]">
              <th className="border-b border-[#EEEEEE] px-2.5 py-2">Product (from the sheet)</th>
              <th className="border-b border-[#EEEEEE] px-2.5 py-2">Shelf</th>
              <th className="border-b border-[#EEEEEE] px-2.5 py-2">How sure</th>
              <th className="border-b border-[#EEEEEE] px-2.5 py-2">Sheet said</th>
            </tr>
          </thead>
          <tbody>
            {shown.items.length === 0 && (
              <tr><td colSpan={4} className="px-2.5 py-6 text-center text-takal-ink-soft">Nothing here.</td></tr>
            )}
            {shown.items.map((i) => {
              const p = result.products[i];
              const id = shelfOf(p, i, overrides);
              const leaf = id ? leaves.get(id) : undefined;
              const [deep] = deptColour(leaf?.dept);
              const sure = isSure(p, i, overrides);
              const rx = isRx(p, i, overrides, leaves);
              const img = typeof p.image_url === "string" && p.image_url.startsWith("http") ? p.image_url : "";
              return (
                <tr key={i} data-testid="shelf-row">
                  <td className="border-b border-[#F2F2EE] px-2.5 py-2">
                    <span className="flex items-center">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="mr-2 h-[34px] w-[34px] flex-none rounded-lg border border-[#EEEEEE] bg-white object-contain" />
                      ) : (
                        <span className="mr-2 inline-block h-[34px] w-[34px] flex-none rounded-lg border border-[#EEEEEE] bg-white" />
                      )}
                      <b className="text-takal-ink">{p.name}</b>
                    </span>
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2.5 py-2">
                    {editing === i ? (
                      <CategoryPicker options={options} value={id} autoFocus className="w-[320px]"
                        emptyLabel="Choose a shelf…" ariaLabel={`Shelf for ${p.name}`}
                        onClose={() => setEditing(null)}
                        onChange={(v) => {
                          const next = { ...overrides };
                          // Choosing the shelf Takal was already sure of changes nothing;
                          // choosing any shelf on a "Not sure" product makes it sure.
                          if (v) { if (v === p.category_id && p.shelf_sure === "sure") delete next[i]; else next[i] = v; }
                          else next[i] = "";
                          setOverrides(next);
                          setEditing(null);
                        }} />
                    ) : (
                      <button type="button" onClick={() => setEditing(i)} title={p.shelf_why || "Change the shelf"}
                        className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#CFCFCF] bg-white px-2.5 py-[5px] font-semibold text-takal-ink hover:border-black">
                        <span className="h-3 w-3 rounded" style={{ background: leaf ? deep : "#999999" }} />
                        {leaf?.name || (id ? "A shelf" : "Choose a shelf…")}
                        {rx && <span className="rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2.5 py-2">
                    {sure
                      ? <span className="rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-[12px] font-extrabold text-[#1F6F4A]">Sure</span>
                      : <span className="rounded-full bg-[#FFF4E5] px-2.5 py-0.5 text-[12px] font-extrabold text-[#C25E00]">Not sure</span>}
                    {i in overrides && <span className="ml-1.5 text-[11px] font-bold text-takal-blue">changed</span>}
                  </td>
                  <td className="border-b border-[#F2F2EE] px-2.5 py-2 text-[12px] text-[#888888]">{p.sheet_said || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.pages > 1 && (
          <p className="flex items-center justify-end gap-2 py-2 text-sm text-takal-ink-soft">
            <button type="button" className="underline disabled:opacity-40" disabled={shown.page === 0} onClick={() => setPage(shown.page - 1)}>‹ Back</button>
            Page {shown.page + 1} of {shown.pages} · {rows.length.toLocaleString()} products
            <button type="button" className="underline disabled:opacity-40" disabled={shown.page >= shown.pages - 1} onClick={() => setPage(shown.page + 1)}>Next ›</button>
          </p>
        )}
      </div>

      {noShelf > 0 && (
        <p className="text-sm font-semibold text-[#C25E00]">
          {noShelf.toLocaleString()} product{noShelf === 1 ? " has" : "s have"} no shelf yet — choose one, or
          {noShelf === 1 ? " it goes" : " they go"} to &ldquo;Rows to fix&rdquo;.
        </p>
      )}

      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onBack}
          className="inline-flex h-[38px] items-center rounded-[11px] border-2 border-black bg-white px-3.5 text-[13.5px] font-bold text-black">
          Back
        </button>
        <button type="button" onClick={onNext} data-testid="save-sure"
          className="ml-auto inline-flex h-[38px] items-center rounded-[11px] border-2 border-black bg-takal-yellow px-3.5 text-[13.5px] font-bold text-black shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000]">
          {saveLabel(totals)}
        </button>
      </div>
    </div>
  );
}

function Tile({ n, label, colour }: { n: number; label: string; colour?: string }) {
  return (
    <div className="rounded-[14px] border border-takal-line bg-white px-3.5 py-3">
      <b className="block text-[26px] font-extrabold leading-tight" style={colour ? { color: colour } : undefined}>
        {n.toLocaleString()}
      </b>
      <span className="text-[12.5px] text-[#555555]">{label}</span>
    </div>
  );
}
