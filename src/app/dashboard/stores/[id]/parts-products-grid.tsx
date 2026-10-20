// ─────────────────────────────────────────────────────────────────────────────
// THE PRODUCT CARDS - GRID VIEW.  (MOCK 203 v2, approved by Sana 20 Oct 2026:
// "i want the more editable things on the cards like purchase rate selling
// rate. Quick changeable things must be change on that card.")
//
// One card per product, 7 a row on a laptop. Everything quick is ON the card:
//   * the pictures, with DOTS like the customer app's product page and ‹ ›
//     to slide on hover; a card with no picture IS the upload box (click or
//     drop); "+ Add", "★ Cover", "⤢" all pictures;
//   * four boxes - BUY (what the vendor is paid), SELL, DISC %, STOCK - click,
//     type, Enter saves, Esc cancels, Tab next box / next card, ↓ ↑ the same
//     box on the card below / above;
//   * the name and the category (click to change), ☆/★ Featured, ON switch;
//   * a green line: what the customer pays and what Takal makes - red, and
//     the whole card red, on a loss.
// Every save goes through the SAME doors as the list (parts-products.tsx):
// the card only draws and reports what was clicked.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pencil, UploadCloud } from "lucide-react";
import type { ShopProduct } from "@/lib/api-stores";
import { customerPays, takalEarns, type PriceItem } from "@/lib/fixed-prices";
import { pictureCount } from "@/lib/product-pictures";

export type CardField = "name" | "buy" | "sell" | "disc" | "stock";

export type CardNote = { busy?: string; saved?: string; failed?: string };

/** The order Tab walks through on one card. No Buy box for a Mall's own
 *  staff (they never see buying prices). */
export const cardFields = (withBuy: boolean): CardField[] =>
  withBuy ? ["buy", "sell", "disc", "stock"] : ["sell", "disc", "stock"];

/** Whole rupees with thousands - "4,125". */
const n0 = (v: number | null | undefined) => (v === null || v === undefined ? "–" : Math.round(v).toLocaleString());

/** Sold in sizes, each with its own price: the card says "from Rs 650" and
 *  its prices are changed in the Edit window, size by size. */
export const soldInSizes = (p: ShopProduct) =>
  (p.choice_count ?? 0) > 0 && p.from_price !== null && p.from_price !== undefined;

/** The money line of one card: what the customer pays and what Takal makes.
 *  A fixed-price store's own figures come from the prices door (the server's
 *  arithmetic); a standard store's are worked out from its price, discount
 *  and buying price - the same customerPays / takalEarns. */
export function cardMoney(p: ShopProduct, priced: PriceItem | undefined, fixed: boolean) {
  const sell = fixed && priced ? priced.selling_price : p.price;
  const disc = fixed && priced ? priced.discount_percent : p.discount_percent;
  const pays = fixed && priced ? priced.customer_pays : customerPays(sell, disc);
  const buy = priced ? priced.buying_price : null;
  const makes = fixed && priced ? priced.takal_earns : takalEarns(pays, buy);
  return { sell, disc, pays, buy, makes, loss: (fixed && !!priced?.loss) || (makes !== null && makes < 0) };
}

export function ProductCard(props: {
  p: ShopProduct;
  note: CardNote;
  priced?: PriceItem;
  fixed: boolean;
  showBuy: boolean;
  canFeature: boolean;
  picked: boolean;
  anyPicked: boolean;
  typing: { field: CardField; val: string; bad?: boolean } | null;
  slide: number;
  slidePic: string | null;
  dragOver: boolean;
  onBox: (f: CardField) => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onTab: (back: boolean) => void;
  onArrow: (down: boolean) => void;
  onPick: (shift: boolean) => void;
  onFlip: () => void;
  onFeature: () => void;
  onCategory: () => void;
  onEdit: () => void;
  onMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onChoose: (how: "add" | "change") => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onPictures: () => void;
  onSlide: (by: number) => void;
  onCover: () => void;
  onHover: (on: boolean) => void;
}) {
  const { p, note: n, priced, fixed, showBuy, typing } = props;
  const off = !p.is_available;
  const count = pictureCount(p.photo_count, !!p.image_url);
  const sizes = soldInSizes(p);
  const m = cardMoney(p, priced, fixed);
  const missingBuy = showBuy && !!priced && (fixed ? priced.missing : priced.buying_price === null) && !sizes;
  const red = !!n.failed || (showBuy && m.loss);
  const busyPic = n.busy === "picture";
  const pic = props.slidePic || p.image_url;

  // ── One box: a figure, or the open box being typed in ───────────────────
  // A plain function, not a component: a component made inside the card would
  // be a NEW component on every keystroke and the open box would lose focus.
  const box = ({ f, label, value, tone = "", title }: {
    f: CardField; label: string; value: React.ReactNode; tone?: string; title: string;
  }) => {
    if (typing?.field === f) return <TypingBox f={f} label={label} {...props} />;
    return (
      <button type="button" data-card-box={f} onClick={() => props.onBox(f)} title={title}
        disabled={n.busy === f}
        className="flex h-[23px] min-w-0 items-center justify-between gap-1 rounded-md border border-[#E6E8EB] bg-[#FAFBFC] px-1.5 text-left hover:border-takal-ink hover:bg-white">
        <span className="text-[9.5px] font-semibold uppercase text-[#888]">{label}</span>
        <b className={`truncate text-[12.5px] ${tone}`}>{n.busy === f ? "…" : value}</b>
      </button>
    );
  };

  return (
    <div
      data-product-card={p.id}
      onMouseEnter={() => props.onHover(true)}
      onMouseLeave={() => props.onHover(false)}
      className={[
        "group relative overflow-hidden rounded-[11px] bg-white",
        red ? "border-2 border-takal-red" : props.picked ? "border-2 border-takal-ink" : "border border-[#E3E5E8]",
        off ? "opacity-60" : "",
      ].join(" ")}
      title={missingBuy && fixed ? "Customers cannot order it until it has a buying price" : m.loss && showBuy ? "Sold at a loss" : undefined}
    >
      {/* ── The picture ── */}
      <div
        className="relative h-[112px] bg-[#F2F3F5]"
        onDragOver={(e) => { e.preventDefault(); props.onDragOver(); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) props.onDragLeave(); }}
        onDrop={props.onDrop}
      >
        {busyPic ? (
          <div data-card-uploading className="flex h-full flex-col items-center justify-center gap-1.5 border-2 border-takal-green bg-[#F0FBF4] text-[12px] font-bold text-takal-green">
            <Loader2 className="h-5 w-5 animate-spin" /> Uploading…
            <span className="text-[10.5px] font-semibold text-takal-ink-soft">saves by itself</span>
          </div>
        ) : props.dragOver ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 border-[2.5px] border-takal-blue bg-takal-blue-soft text-[12px] font-extrabold text-takal-blue">
            <UploadCloud className="h-6 w-6" /> Drop here
          </div>
        ) : !pic ? (
          <button type="button" data-card-upload onClick={() => props.onChoose("add")}
            title="Click to choose photos (many at once), or drop them here - the first one is the cover"
            className="flex h-full w-full flex-col items-center justify-center gap-1 border-2 border-dashed border-[#C9CC00] bg-[#FFFFF0] text-[11.5px] text-takal-ink-soft hover:bg-takal-yellow-soft">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-takal-yellow text-[20px] font-black text-takal-ink">＋</span>
            <b className="text-takal-ink">Click or drop photos</b>
          </button>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pic} alt="" loading="lazy" onClick={props.onPictures}
              className="h-full w-full cursor-pointer object-cover" />
            {count > 1 && (
              <>
                <span data-card-count className="absolute right-1.5 top-1.5 rounded-lg bg-black/65 px-1.5 text-[10.5px] font-bold text-white">📷 {count}</span>
                {/* THE DOTS - like the customer app's product page. */}
                <div data-card-dots className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
                  {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                    <b key={i} className={`h-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,.5)] ${i === props.slide ? "w-3.5 bg-takal-yellow" : "w-1.5 bg-white/70"}`} />
                  ))}
                </div>
                <button type="button" onClick={() => props.onSlide(-1)} aria-label="Previous picture"
                  className="absolute left-1 top-[36px] hidden h-[26px] w-[26px] items-center justify-center rounded-full bg-white/95 shadow group-hover:flex">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => props.onSlide(1)} aria-label="Next picture"
                  className="absolute right-1 top-[36px] hidden h-[26px] w-[26px] items-center justify-center rounded-full bg-white/95 shadow group-hover:flex">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            {/* Hover: what can be done with the pictures, without Edit. */}
            <div className="absolute inset-x-1 bottom-4 hidden justify-center gap-[3px] group-hover:flex">
              {count > 1 ? (
                <>
                  <button type="button" onClick={() => props.onChoose("add")} className="whitespace-nowrap rounded-md bg-[#111]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">＋ Add</button>
                  {props.slide > 0 && (
                    <button type="button" onClick={props.onCover} title="Make the picture you see the first one" className="whitespace-nowrap rounded-md bg-[#111]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">★ Cover</button>
                  )}
                  <button type="button" onClick={props.onPictures} title="All pictures" className="whitespace-nowrap rounded-md bg-[#111]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">⤢</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => props.onChoose("add")} className="whitespace-nowrap rounded-md bg-[#111]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">＋ Add more</button>
                  <button type="button" onClick={() => props.onChoose("change")} className="whitespace-nowrap rounded-md bg-[#111]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">↺ Change</button>
                </>
              )}
            </div>
          </>
        )}
        {/* Tick box: on hover, or once anything is ticked. */}
        <button type="button" role="checkbox" aria-checked={props.picked} aria-label={`Tick ${p.name}`}
          onClick={(e) => props.onPick(e.shiftKey)}
          className={`absolute left-1.5 top-1.5 h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 border-takal-ink text-[11px] font-black ${
            props.picked ? "flex bg-takal-ink text-takal-yellow" : props.anyPicked ? "flex bg-white" : "hidden bg-white group-hover:flex"}`}>
          {props.picked ? "✓" : ""}
        </button>
        {props.canFeature && !busyPic && (
          <button type="button" onClick={props.onFeature} disabled={n.busy === "featured"}
            aria-label={p.is_featured ? `Remove Featured from ${p.name}` : `Mark ${p.name} as Featured`}
            title={p.is_featured ? "Featured - click to take it off" : "Click to make it Featured"}
            className={`absolute top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${
              props.picked || props.anyPicked ? "left-7" : "left-1.5 group-hover:left-7"} ${p.is_featured ? "bg-takal-yellow" : "bg-white/90"}`}>
            {p.is_featured ? "★" : "☆"}
          </button>
        )}
        {n.saved && (
          <span className="absolute right-1.5 top-7 inline-flex items-center gap-0.5 rounded-md bg-takal-green px-1.5 text-[10.5px] font-bold text-white">
            <Check className="h-3 w-3" /> {n.saved}
          </span>
        )}
      </div>

      {/* ── Name, category, the four boxes, the money line ── */}
      <div className="px-1.5 pb-1.5 pt-1">
        {typing?.field === "name" ? (
          <TypingBox f="name" label="Name" {...props} />
        ) : (
          <button type="button" data-card-name onClick={() => props.onBox("name")} title={`${p.name} - click to rename`}
            className={`block w-full truncate text-left text-[12px] font-bold ${off ? "line-through text-takal-disabled-text" : "text-takal-ink"}`}>
            {n.busy === "name" ? "Saving…" : p.name}
            {p.needs_prescription === true && <span className="ml-1 rounded bg-takal-red px-1 text-[9.5px] text-white">Rx</span>}
          </button>
        )}
        <button type="button" data-card-category onClick={props.onCategory} title="Click to change the category"
          className="block w-full truncate text-left text-[10.5px] text-[#888] hover:underline">
          {n.busy === "category" ? "Saving…" : (p.category_name || "No category")} ▾
          {(p.choice_count ?? 0) > 0 && <span> · {p.choice_count} {p.sizes ? "sizes" : "options"}</span>}
        </button>

        <div className="mt-1 grid grid-cols-2 gap-[3px]">
          {showBuy && (sizes ? (
            <button type="button" onClick={props.onEdit} title="Each size has its own buying price - open Edit"
              className="flex h-[23px] items-center justify-between rounded-md border border-[#E6E8EB] bg-[#FAFBFC] px-1.5">
              <span className="text-[9.5px] font-semibold uppercase text-[#888]">Buy</span><b className="text-[11px]">sizes ›</b>
            </button>
          ) : missingBuy && typing?.field !== "buy" ? (
            <button type="button" data-card-box="buy" onClick={() => props.onBox("buy")}
              title={fixed ? "Add a buying price - customers cannot order it until it has one" : "Add the buying price (what the vendor is paid)"}
              className="flex h-[23px] items-center justify-between rounded-md border border-[#F5B5BC] bg-takal-red-soft px-1.5">
              <span className="text-[9.5px] font-semibold uppercase text-[#888]">Buy</span><b className="text-[11.5px] text-takal-red">＋ add</b>
            </button>
          ) : (
            box({ f: "buy", label: "Buy", value: n0(m.buy), title: "Buying price - what the vendor is paid. Click to change." })
          ))}
          {sizes ? (
            <button type="button" onClick={props.onEdit} title="Each size has its own price - open Edit"
              className="flex h-[23px] items-center justify-between rounded-md border border-[#E6E8EB] bg-[#FAFBFC] px-1.5">
              <span className="text-[9.5px] font-semibold uppercase text-[#888]">Sell</span><b className="text-[11px]">from {n0(p.from_price)}</b>
            </button>
          ) : (
            box({ f: "sell", label: "Sell", value: n0(m.sell), title: "Selling price - before the discount. Click to change." })
          )}
          {box({ f: "disc", label: "Disc", value: m.disc ? `${m.disc}%` : "—", title: "Discount % - click to change (0 takes it off)" })}
          {box({ f: "stock", label: "Stock",
            value: p.stock == null ? "∞" : p.stock.toLocaleString(),
            tone: p.stock === 0 ? "text-takal-red" : p.stock != null && p.stock <= 5 ? "text-[#B45309]" : "",
            title: p.stock == null ? "Not counted - click to set a number" : p.stock === 0 ? "Out of stock (red 0) - click to change" : "Stock - click to change (empty = not counted)" })}
          {!showBuy && <span />}
        </div>

        <div className="mt-1 flex items-center justify-between gap-1 text-[10.5px]">
          {n.failed ? (
            <span className="truncate font-bold text-takal-red" title={n.failed}>✕ {n.failed}</span>
          ) : sizes ? (
            <span className="truncate text-takal-ink-soft">Sizes · from {n0(p.from_price)}</span>
          ) : missingBuy ? (
            <span data-card-money className="truncate font-bold text-takal-red">Add a buying price</span>
          ) : (
            <span data-card-money title={showBuy ? "What the customer pays · what Takal makes (customer pays − buying price)" : "What the customer pays"}
              className={`truncate font-bold ${showBuy && m.loss ? "text-takal-red" : "text-takal-green"}`}>
              Pays {n0(m.pays)}
              {showBuy && m.makes !== null && (m.makes >= 0 ? ` · +${n0(m.makes)}` : ` · LOSS ${n0(-m.makes)}`)}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={props.onEdit} aria-label={`Edit ${p.name}`} title="Edit everything - sizes, colours, extras, description"
              className="hidden h-5 w-5 items-center justify-center rounded border border-takal-line bg-white group-hover:flex">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={props.onMenu} aria-label={`More for ${p.name}`} title="More"
              className="hidden h-5 w-5 items-center justify-center rounded border border-takal-line bg-white group-hover:flex">
              <MoreHorizontal className="h-3 w-3" />
            </button>
            <button type="button" role="switch" aria-checked={p.is_available} aria-label={`${p.is_available ? "Turn off" : "Turn on"} ${p.name}`}
              onClick={props.onFlip} disabled={!!n.busy}
              title={p.is_available ? "On - customers can order it. Click to turn off." : "Off - hidden from customers. Click to turn on."}
              className={`relative inline-block h-[17px] w-[30px] rounded-full transition disabled:opacity-50 ${p.is_available ? "bg-takal-green" : "bg-[#C5C8CD]"}`}>
              <span className={`absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-all ${p.is_available ? "right-[2px]" : "left-[2px]"}`} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** The open box on a card: Enter saves, Esc cancels, Tab next, ↓ ↑ the same
 *  box on the card below / above. Red when the value was refused. */
function TypingBox({ f, label, typing, onChange, onSave, onCancel, onTab, onArrow, p }: {
  f: CardField; label: string;
  typing: { field: CardField; val: string; bad?: boolean } | null;
  onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
  onTab: (back: boolean) => void; onArrow: (down: boolean) => void; p: ShopProduct;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const bad = !!typing?.bad;
  return (
    <label className={`flex h-[23px] items-center gap-1 rounded-md border-2 px-1 ${bad ? "border-takal-red bg-white" : "border-takal-ink bg-[#FFFFF0]"} ${f === "name" ? "w-full" : ""}`}>
      {f !== "name" && <span className="text-[9.5px] font-semibold uppercase text-[#888]">{label}</span>}
      <input
        ref={ref}
        data-card-typing={f}
        value={typing?.val ?? ""}
        inputMode={f === "name" ? undefined : "decimal"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onSave(); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          else if (e.key === "Tab") { e.preventDefault(); onTab(e.shiftKey); }
          else if (f !== "name" && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); onArrow(e.key === "ArrowDown"); }
        }}
        aria-label={`${label} of ${p.name}`}
        aria-invalid={bad || undefined}
        className={`min-w-0 flex-1 bg-transparent text-right text-[12.5px] font-bold outline-none ${f === "name" ? "text-left" : ""} ${bad ? "text-takal-red" : ""}`}
      />
    </label>
  );
}
