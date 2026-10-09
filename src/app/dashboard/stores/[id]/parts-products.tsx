// ─────────────────────────────────────────────────────────────────────────────
// THE PRODUCTS TAB OF A STORE.  (Mock 132, approved by Sana 30 September 2026.)
//
// WHY IT WAS REBUILT
// The store page listed products in a box 288 px tall, sixth thing down the
// page, with no pictures, no search, and only the first 100 products - so
// Cupbar.cafe had 61 products nobody could reach. Adding ONE picture took ten
// steps. (Audit: docs/Audit/AUDIT-REPORT-STORE-MANAGEMENT-2026-09-30.md.)
//
// WHAT THIS DOES
//   * one page of 50 at a time from GET /restaurants/{id}/products/manage,
//     with search, the five filter buttons and a category box;
//   * a picture square on every row - a product with NO picture takes one by a
//     click or a dropped photo, and saves by itself;
//   * price and stock typed straight into the row, On/Off as a switch;
//   * a change updates ONLY its own row. Nothing reloads the whole store.
//   * (step 3) tick boxes and a "selected" bar: On, Off, stock, discount,
//     category, remove - for the ticked products on THIS page only. The tick
//     boxes empty whenever the list changes, so nothing ticked can be hidden
//     off screen when the button is pressed.
//   * EDIT IN THE LIST (fixed-price stores plan, Step 5a - Mock 171-2,
//     APPROVED by Sana 8 October 2026): name, price, discount, stock and
//     category are typed straight into the row too. Enter saves, Esc cancels,
//     Tab saves and moves to the next box. A wrong value keeps its box open,
//     red, with the reason under the name - it is never sent. ▾ opens the
//     product's sizes and extras INSIDE the list, each with its own price,
//     stock and on/off (parts-products-edit.tsx). The ✏️ editor stays for
//     pictures and the description.
//   * A FIXED-PRICE STORE (Steps 5b-5c - Mock 171-1/171-4/171-5): Buying,
//     Selling, Discount and "Takal earns" in the row, through the one prices
//     door (parts-products-prices.tsx); the red buttons "Buying price
//     missing" and "Loss"; "Change prices" for the ticked products; a prices
//     sheet; each product's price history. `buyingFirst` = a STANDARD store
//     filling its buying prices before it is switched (Mock 171-3).
//
// THE ONE TRAP
// The quick picture square is for products with NO picture only. A product
// with a picture opens the full editor instead. Reason: a product imported
// from a spreadsheet can have its picture in image_url with no photo list, and
// adding a photo would make the NEW one the cover and lose the old one from
// view (product_extras._sync_cover). The editor shows every photo and lets the
// person choose.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera, Check, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, FolderInput, ImagePlus, Loader2,
  MoreHorizontal, Package, Pencil, Percent, Plus, Power, PowerOff, ArrowLeftRight, Search, Star,
  Trash2, UploadCloud, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type {
  BulkProductAction, ShopProduct, ShopProductShow, ShopProductsPage,
} from "@/lib/api-stores";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ConfirmDialog, ErrorState, Modal } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";
import { pathLabel } from "@/lib/category-search";
import ProductEditorModal from "./ProductEditorModal";
import { EditBox, Key, OptionRows } from "./parts-products-edit";
import {
  ChangePricesDialog, FixedOptionCells, FixedPriceCells, LossDialog, PriceHistoryDialog,
  PricesSheetDialog, priceSummary, useStorePrices, type LossLine, type PriceChange,
} from "./parts-products-prices";
import {
  afterDiscount, checkDiscount, checkName, checkPrice, checkStock, optionWords, tabTarget,
  type RowField,
} from "@/lib/edit-in-the-list";
import { ManyPicturesDialog } from "./parts-many-pictures";
import { MoveProductDialog, type MoveTarget } from "./parts-move";

const PER_PAGE = 50;

/** The filter buttons, in the order Mock 132 draws them. */
const FILTERS: { id: ShopProductShow; label: string; tone: "plain" | "orange" | "red" | "alarm" }[] = [
  { id: "all", label: "All", tone: "plain" },
  { id: "no_picture", label: "No picture", tone: "orange" },
  { id: "out_of_stock", label: "Out of stock", tone: "red" },
  { id: "off", label: "Switched off", tone: "plain" },
  { id: "featured", label: "Featured", tone: "plain" },
];
/** A fixed-price store's two red buttons, right after "All" (Mock 171-1). */
const PRICE_FILTERS: typeof FILTERS = [
  { id: "missing_buying", label: "Buying price missing", tone: "alarm" },
  { id: "loss", label: "Loss", tone: "alarm" },
];

type Counts = ShopProductsPage["counts"];
type RowNote = {
  busy?: "picture" | "name" | "price" | "discount" | "stock" | "category" | "switch" | "featured";
  saved?: string;
  failed?: string;
};

/** The list's columns. On a smaller screen the picture hides and the category
 *  has no column of its own (Mock 171-7) - it is the line under the product's
 *  name, and it is clickable there too. Measured 8 Oct 2026: with the side menu
 *  open, everything fits from 1024 px wide without scrolling sideways. */
const SHOW_PICTURE = "hidden xl:table-cell";
const SHOW_CATEGORY = "hidden xl:table-cell";
const COLUMNS = 9;
/** A fixed-price store: Buying, Selling, Discount, Takal earns instead of
 *  Price and Discount, and no category column (Mock 171-1). */
const COLUMNS_FIXED = 10;

/** A number the server could not count is shown as a dash, never as 0. */
const shown = (n: number | null | undefined) =>
  n === null || n === undefined ? "–" : n.toLocaleString();

export function ProductsTab({
  restaurantId,
  vendorType,
  onCounts,
  staffView = false,
  buyingFirst = false,
  onPriceSummary,
  moveTo,
  mallName = "",
}: {
  restaurantId: string;
  vendorType: string;
  /** A Mall's own staff (Mock 133 picture H). "Featured" is Takal's - its
   *  filter, its menu line and its tick are not shown; "Whole catalogue"
   *  opens the same page inside the Shop panel (/shop/catalogue/{id}), on the
   *  shop's own doors. Featured is ALSO refused on the server; this only keeps
   *  a button that would fail off the screen. */
  staffView?: boolean;
  /** The page header shows "Products" and "Need a picture" from these. */
  onCounts?: (c: Counts | null) => void;
  /** A standard store's "Fill buying prices first" (Mock 171-3): a Buying
   *  column to fill before the store is switched. */
  buyingFirst?: boolean;
  /** The store header's "Buying price missing", "Sold at a loss" and "Takal
   *  earns (avg)" (Mock 171-1). */
  onPriceSummary?: (s: { missing: number; loss: number; avgPercent: number | null } | null) => void;
  /** A mall's staff window (Mock 172-5, Step 5): the OTHER stores of the
   *  mall. Given, each product's "..." menu offers "Move to another store". */
  moveTo?: MoveTarget[];
  mallName?: string;
}) {
  // ── What is being asked for ──────────────────────────────────────────────
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<ShopProductShow>("all");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // ── What came back ───────────────────────────────────────────────────────
  const [data, setData] = useState<ShopProductsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReadFailure>(null);
  const asked = useRef(0);   // only the newest answer is ever drawn

  // ── Row-level work ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  // The ONE box being typed in. `bad` = the value was refused; the box stays
  // open and red until it is changed or cancelled.
  const [edit, setEdit] = useState<{ id: string; field: RowField; val: string; bad?: boolean } | null>(null);
  // The products whose sizes and extras are open inside the list.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  // The category being chosen for ONE product.
  const [catFor, setCatFor] = useState<{ p: ShopProduct; value: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // The "..." menu is drawn at a fixed place on the screen, NOT inside the
  // table: the table scrolls sideways on a small screen, and anything inside
  // it is cut off at its edge - the menu on the last rows was cut in half.
  const [menu, setMenu] = useState<{ p: ShopProduct; x: number; y: number } | null>(null);
  const menuFor = menu?.p.id ?? null;
  const [editor, setEditor] = useState<{ open: boolean; product: any | null }>({ open: false, product: null });
  const [pendingDelete, setPendingDelete] = useState<ShopProduct | null>(null);
  const [moving, setMoving] = useState<ShopProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickFor = useRef<ShopProduct | null>(null);
  const flipping = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("mousedown", close);
    };
  }, [menu]);

  // ── Step 4: a whole folder of photos ─────────────────────────────────────
  const [manyOpen, setManyOpen] = useState(false);

  // ── Step 3: the ticked products ──────────────────────────────────────────
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [ask, setAsk] = useState<null | { action: "stock" | "discount" | "category" | "remove"; value: string }>(null);

  // ── Categories for the box ───────────────────────────────────────────────
  const [cats, setCats] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = (await apiClient.getCategoryTree(vendorType)) as any;
        const out: { id: string; label: string }[] = [];
        // The whole path ("Food › Burgers"), so a typed word finds a
        // category by its parent too (Mock 134 - CategoryPicker).
        const walk = (nodes: any[], path: string[]) => {
          for (const n of nodes || []) {
            const here = [...path, String(n.name)];
            out.push({ id: String(n.id), label: pathLabel(here) });
            if (Array.isArray(n.children)) walk(n.children, here);
          }
        };
        walk(res?.tree || [], []);
        if (alive) setCats(out);
      } catch {
        // The box simply offers "All categories". Nothing on the list is
        // hidden by this - it is a way to narrow, not a way to see.
        if (alive) setCats([]);
      }
    })();
    return () => { alive = false; };
  }, [vendorType]);

  // Search waits until the person stops typing, so a word is one request.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [typed]);

  const load = useCallback(async () => {
    const mine = ++asked.current;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await apiClient.getShopProducts(restaurantId, {
        page, perPage: PER_PAGE, search, show, categoryId: categoryId || undefined,
      });
      if (mine !== asked.current) return;
      setData(d);
      onCounts?.(d.counts);
    } catch (err) {
      if (mine !== asked.current) return;
      setLoadError(readFailure(err, "this store's products"));
    } finally {
      if (mine === asked.current) setLoading(false);
    }
    // onCounts is a setter from the page and does not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, page, search, show, categoryId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // ── A fixed-price store (Steps 5b-5c) ────────────────────────────────────
  // Known from the list itself, so the tab needs nothing from the page. Mall
  // staff never see buying prices here - the vendor side shows only what the
  // vendor GETS, in the Partners app (decision 3).
  const fixed = !staffView && data?.price_mode === "fixed";
  const prepare = !staffView && !fixed && buyingFirst;
  const { prices, byId: priceOf, reload: reloadPrices, failed: pricesFailed } =
    useStorePrices(restaurantId, fixed || prepare);
  const summary = useMemo(() => (prices ? priceSummary(prices.items) : null), [prices]);
  useEffect(() => { onPriceSummary?.(fixed ? summary : null); }, [fixed, summary, onPriceSummary]);
  const [lossAsk, setLossAsk] = useState<{ changes: PriceChange[]; losses: LossLine[] } | null>(null);
  const [lossBusy, setLossBusy] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<{ id: string; name: string } | null>(null);
  const lossDone = useRef<((ok: boolean) => void) | null>(null);

  /** After prices are saved: read them again, and change the rows' own price
   *  and discount - nothing else on the page moves. */
  const afterPrices = (changes: PriceChange[]) => {
    reloadPrices();
    for (const c of changes) {
      if (c.variant_id) continue;
      const change: Partial<ShopProduct> = {};
      if (c.selling_price !== undefined) change.price = c.selling_price;
      if (c.discount_percent !== undefined) change.discount_percent = c.discount_percent;
      if (Object.keys(change).length) patchRow(c.product_id, change);
    }
  };

  /** Every price change of this store goes through here: ONE door on the
   *  server, which writes the history. A loss comes back as a list, and is
   *  saved only after "Save at a loss?" (rule R6). */
  const savePrices = async (changes: PriceChange[]): Promise<boolean> => {
    if (!changes.length) return true;
    const rowId = changes.length === 1 ? changes[0].product_id : null;
    try {
      const res = await apiClient.setStorePrices(restaurantId, changes, false);
      afterPrices(changes);
      if (rowId) note(rowId, { saved: "Saved" });
      else toast(`${res.saved} price${res.saved === 1 ? "" : "s"} saved`, "success");
      return true;
    } catch (err) {
      const e = err as { status?: number; detail?: { losses?: LossLine[] } };
      if (e?.status === 409 && Array.isArray(e.detail?.losses)) {
        return new Promise<boolean>((resolve) => {
          lossDone.current = resolve;
          setLossAsk({ changes, losses: e.detail!.losses! });
        });
      }
      const msg = err instanceof Error ? err.message : "Not saved - try again";
      if (rowId) note(rowId, { failed: msg }); else toast(msg, "error");
      return false;
    }
  };

  const confirmLoss = async () => {
    if (!lossAsk) return;
    setLossBusy(true);
    let ok = false;
    try {
      const res = await apiClient.setStorePrices(restaurantId, lossAsk.changes, true);
      afterPrices(lossAsk.changes);
      toast(`${res.saved} price${res.saved === 1 ? "" : "s"} saved - sold at a loss, as you chose`, "success");
      ok = true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Not saved - try again", "error");
    } finally {
      setLossBusy(false);
      setLossAsk(null);
      lossDone.current?.(ok);
      lossDone.current = null;
    }
  };
  const cancelLoss = () => {
    setLossAsk(null);
    lossDone.current?.(false);
    lossDone.current = null;
  };

  // A new page, filter, search or reload empties the tick boxes. Something
  // ticked and then scrolled away must never be changed by a button pressed
  // later on a different list.
  useEffect(() => { setPicked(new Set()); }, [restaurantId, page, search, show, categoryId, reloadKey]);
  // A different list: nothing stays open or half-typed from the old one.
  useEffect(() => { setEdit(null); setOpened(new Set()); }, [restaurantId, page, search, show, categoryId, reloadKey]);

  // ── Changing ONE row, and the button numbers that go with it ─────────────
  const patchRow = (id: string, change: Partial<ShopProduct>) =>
    setData((d) => (d ? { ...d, items: d.items.map((p) => (p.id === id ? { ...p, ...change } : p)) } : d));

  const bump = (key: ShopProductShow, by: number) =>
    setData((d) => {
      if (!d) return d;
      const now = d.counts[key];
      if (now === null || now === undefined) return d;
      const counts = { ...d.counts, [key]: Math.max(0, now + by) };
      onCounts?.(counts);
      return { ...d, counts };
    });

  const note = (id: string, n: RowNote) => {
    setNotes((all) => ({ ...all, [id]: n }));
    if (n.saved) {
      setTimeout(() => setNotes((all) => (all[id]?.saved === n.saved ? { ...all, [id]: {} } : all)), 3000);
    }
  };

  // ── The picture square ───────────────────────────────────────────────────
  const openEditor = (p: ShopProduct) => {
    setMenu(null);
    setEditor({ open: true, product: p });
  };

  const squareClicked = (p: ShopProduct) => {
    if (notes[p.id]?.busy) return;
    if (p.image_url) { openEditor(p); return; }
    pickFor.current = p;
    fileRef.current?.click();
  };

  const uploadPicture = async (p: ShopProduct, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast(`${file.name} is not a picture`, "error");
      return;
    }
    note(p.id, { busy: "picture" });
    try {
      // uploadImage shrinks the photo first and applies the server's own size
      // limit (src/lib/picture-upload.ts).
      const up = await apiClient.uploadImage(file);
      if (!up?.url) throw new Error("The picture did not upload");
      // Position 0: this product had no picture, so this one is the cover.
      await apiClient.addProductPhoto(p.id, up.url, 0);
      patchRow(p.id, { image_url: up.url, photo_count: 1 });
      bump("no_picture", -1);
      note(p.id, { saved: "Picture saved" });
    } catch (err) {
      note(p.id, { failed: err instanceof Error ? err.message : "Picture not saved - try again" });
    }
  };

  const dropped = (p: ShopProduct, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    if (p.image_url) {
      toast("This product already has a picture - add more in its editor", "success");
      openEditor(p);
      return;
    }
    if (files.length > 1) toast("One picture per square - the first one was used", "success");
    uploadPicture(p, files[0]);
  };

  // ── Name, price, discount, stock - typed in the row, each saves ONLY its
  //    own row (Step 5a). One function for all four, so they cannot drift.
  const valueOf = (p: ShopProduct, f: RowField): string =>
    f === "name" ? p.name
      : f === "price" ? (p.price == null ? "" : String(p.price))
        : f === "discount" ? (p.discount_percent ? String(p.discount_percent) : "")
          : (p.stock == null ? "" : String(p.stock));

  /** A product sold only in sizes with their own prices shows "from Rs 650"
   *  and its price is changed size by size, under ▾. */
  const priceIsFromSizes = (p: ShopProduct) =>
    (p.choice_count ?? 0) > 0 && p.from_price !== null && p.from_price !== undefined;

  const openBox = (p: ShopProduct, field: RowField) => {
    setMenu(null);
    if (field === "price" && priceIsFromSizes(p)) {
      // Nothing to type here - the sizes carry the prices. Open them instead.
      setOpened((o) => new Set(o).add(p.id));
      setEdit(null);
      return;
    }
    setEdit({ id: p.id, field, val: valueOf(p, field) });
  };

  const tabFrom = (p: ShopProduct, field: RowField, back: boolean) => {
    const ids = (data?.items || []).map((x) => x.id);
    let t = tabTarget(ids, p.id, field, back);
    // Skip a price that is set size by size - there is no box there. In a
    // fixed-price store the price and the discount are not these boxes at all
    // (Buying / Selling / Discount have their own), so Tab goes name -> stock.
    while (t && (t.field === "price" || t.field === "discount")) {
      if (fixed) { t = tabTarget(ids, t.id, t.field, back); continue; }
      if (t.field === "discount") break;
      const q = (data?.items || []).find((x) => x.id === t!.id);
      if (!q || !priceIsFromSizes(q)) break;
      t = tabTarget(ids, t.id, t.field, back);
    }
    if (!t) { setEdit(null); return; }
    const q = (data?.items || []).find((x) => x.id === t!.id);
    if (q) setEdit({ id: q.id, field: t.field, val: valueOf(q, t.field) }); else setEdit(null);
  };

  const saveField = async (p: ShopProduct, then?: { back: boolean }) => {
    if (!edit || edit.id !== p.id) return;
    const field = edit.field;
    const moveOn = () => (then ? tabFrom(p, field, then.back) : setEdit(null));
    if (edit.val.trim() === valueOf(p, field).trim()) { moveOn(); return; }   // nothing changed
    const c = field === "name" ? checkName(edit.val)
      : field === "price" ? checkPrice(edit.val)
        : field === "discount" ? checkDiscount(edit.val)
          : checkStock(edit.val);
    if (!c.ok) {
      // Stay in the box, red, with the reason on the row - nothing is sent.
      setEdit({ ...edit, bad: true });
      note(p.id, { failed: `Not saved - ${c.reason}` });
      return;
    }
    const value = c.value;
    const key = field === "discount" ? "discount_percent" : field;
    if ((p as any)[key] === value) { moveOn(); return; }
    moveOn();
    note(p.id, { busy: field });
    try {
      await apiClient.updateMenuItem(p.id, { [key]: value });
      patchRow(p.id, { [key]: value } as Partial<ShopProduct>);
      if (field === "stock") {
        const wasOut = p.stock === 0;
        const isOut = value === 0;
        if (wasOut && !isOut) bump("out_of_stock", -1);
        if (!wasOut && isOut) bump("out_of_stock", 1);
      }
      note(p.id, { saved: "Saved" });
    } catch (err) {
      note(p.id, { failed: err instanceof Error ? err.message : "Not saved - try again" });
    }
  };

  const saveCategory = async () => {
    if (!catFor) return;
    const { p, value } = catFor;
    if (!value) { toast("Choose a category", "error"); return; }
    setCatFor(null);
    if (value === (p.category_id || "")) return;
    note(p.id, { busy: "category" });
    try {
      await apiClient.updateMenuItem(p.id, { category_id: value });
      const label = cats.find((c) => c.id === value)?.label || "";
      // The last part of "Food › Burgers" is the category's own name.
      patchRow(p.id, { category_id: value, category_name: label.split("›").pop()!.trim() });
      note(p.id, { saved: "Saved" });
    } catch (err) {
      note(p.id, { failed: err instanceof Error ? err.message : "Not saved - try again" });
    }
  };

  const toggleOpen = (id: string) =>
    setOpened((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const flip = async (p: ShopProduct) => {
    // THE SERVER FLIPS whatever it holds, so two quick clicks would be two
    // flips and the product would end where it started. A ref, not state:
    // a second click can arrive before React has drawn the first one.
    if (flipping.current.has(p.id)) return;
    flipping.current.add(p.id);
    note(p.id, { busy: "switch" });
    try {
      const res = (await apiClient.toggleMenuItem(p.id)) as any;
      const on = res?.is_available !== undefined ? res.is_available === true : !p.is_available;
      patchRow(p.id, { is_available: on });
      if (on !== p.is_available) bump("off", on ? -1 : 1);
      note(p.id, { saved: on ? "Turned ON" : "Turned OFF" });
    } catch (err) {
      note(p.id, { failed: err instanceof Error ? err.message : "Not changed - try again" });
    } finally {
      flipping.current.delete(p.id);
    }
  };

  const feature = async (p: ShopProduct) => {
    setMenu(null);
    note(p.id, { busy: "featured" });
    try {
      await apiClient.setProductFeatured(p.id, !p.is_featured);
      patchRow(p.id, { is_featured: !p.is_featured });
      bump("featured", p.is_featured ? -1 : 1);
      note(p.id, { saved: p.is_featured ? "No longer featured" : "Featured" });
    } catch (err) {
      note(p.id, { failed: err instanceof Error ? err.message : "Not changed - try again" });
    }
  };

  const doDelete = async () => {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      // Say what the server ACTUALLY did - removed, or switched off because
      // customers have ordered it.
      const res = (await apiClient.deleteProduct(pendingDelete.id)) as any;
      toast(res?.message || "Product removed", "success");
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove it", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── Step 3: one thing to every ticked product ────────────────────────────
  const pickedOnPage = (data?.items || []).filter((p) => picked.has(p.id));
  const allPicked = !!data && data.items.length > 0 && pickedOnPage.length === data.items.length;

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setPicked(allPicked ? new Set() : new Set((data?.items || []).map((p) => p.id)));

  const runBulk = async (action: BulkProductAction, value?: number | string) => {
    const ids = pickedOnPage.map((p) => p.id);
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await apiClient.bulkChangeProducts(restaurantId, ids, action, value);
      const bad = res.failed || [];
      if (bad.length) {
        const names = bad.slice(0, 3).map((f) => f.name || "a product").join(", ");
        toast(`${res.message}. Not changed: ${names}${bad.length > 3 ? ` and ${bad.length - 3} more` : ""}`, "error");
      } else {
        toast(res.message, "success");
      }
      setAsk(null);
      // Many rows and every button number may have moved - read the page again.
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Nothing was changed - try again", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmAsk = () => {
    if (!ask) return;
    if (ask.action === "remove") { runBulk("remove"); return; }
    if (ask.action === "category") {
      if (!ask.value) { toast("Choose a category", "error"); return; }
      runBulk("category", ask.value);
      return;
    }
    const n = Number(ask.value);
    const max = ask.action === "discount" ? 100 : 10_000_000;
    if (ask.value.trim() === "" || !Number.isInteger(n) || n < 0 || n > max) {
      toast(ask.action === "discount" ? "Enter a whole number from 0 to 100" : "Enter a whole number of 0 or more", "error");
      return;
    }
    if (ask.action === "discount" && fixed) {
      // A fixed-price store's discount is a PRICE: it goes through the one
      // prices door, which writes the history and asks before a loss. The
      // ordinary bulk door refuses it (fixed_price_rules.py).
      setBulkBusy(true);
      savePrices(pickedOnPage.map((p) => ({ product_id: p.id, discount_percent: n })))
        .then((ok) => { if (ok) setAsk(null); })
        .finally(() => setBulkBusy(false));
      return;
    }
    runBulk(ask.action, n);
  };

  // ── Drawing ──────────────────────────────────────────────────────────────
  const counts = data?.counts;
  const total = data?.total ?? null;
  const pages = total !== null && total !== undefined ? Math.max(1, Math.ceil(total / PER_PAGE)) : null;
  const withPicture =
    counts && counts.all !== null && counts.no_picture !== null ? counts.all - counts.no_picture : null;
  const pct = withPicture !== null && counts?.all ? Math.round((withPicture / counts.all) * 100) : null;
  const narrowed = !!(search || categoryId || show !== "all");
  const cols = fixed || prepare ? COLUMNS_FIXED : COLUMNS;
  const showCategory = fixed ? "hidden" : SHOW_CATEGORY;

  const pageButtons = useMemo(() => {
    if (!pages) return [] as number[];
    const out = new Set<number>([1, pages, page, page - 1, page + 1]);
    return Array.from(out).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  }, [pages, page]);

  return (
    <div className="space-y-3">
      {/* ── Search, category, buttons ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex-1 min-w-[240px] flex items-center gap-2 rounded-xl border-2 border-takal-ink bg-white px-3 py-2">
          <Search className="w-4 h-4 text-takal-ink-soft shrink-0" />
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Search ${counts?.all != null ? counts.all.toLocaleString() + " " : ""}products by name…`}
            className="flex-1 outline-none text-sm bg-transparent"
            aria-label="Search products"
          />
          {typed && (
            <button onClick={() => setTyped("")} title="Clear search" className="text-takal-ink-soft hover:text-takal-ink">
              <X className="w-4 h-4" />
            </button>
          )}
        </label>
        {cats.length > 0 && (
          <CategoryPicker options={cats} value={categoryId}
            onChange={(id) => { setCategoryId(id); setPage(1); }}
            emptyLabel="All categories" ariaLabel="Category" className="w-[240px] max-w-full" />
        )}
        <button
          onClick={() => setManyOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-takal-blue px-3.5 py-2.5 text-sm font-bold text-white hover:bg-[#003D6B]"
          title="Add pictures to many products at once - matched by the photo's file name"
        >
          <ImagePlus className="w-4 h-4" /> Many pictures
        </button>
        {fixed ? (
          // A fixed-price store's products and prices are Takal's: a sheet
          // CHANGES the buying and selling prices of products already here.
          <button
            onClick={() => setSheetOpen(true)}
            disabled={!prices}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-takal-yellow bg-white px-3.5 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-soft disabled:opacity-50"
            title="Upload a sheet with buying and selling prices - Excel or .csv"
          >
            <FileSpreadsheet className="w-4 h-4" /> Prices sheet
          </button>
        ) : (
        <Link
          // Staff open the same page inside the Shop panel (Sana: "Yes Catalogue").
          href={staffView ? `/shop/catalogue/${restaurantId}` : `/dashboard/stores/${restaurantId}/catalogue`}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-takal-yellow bg-white px-3.5 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-soft"
          title="Upload a whole price list - Excel, .csv or pasted from Excel"
        >
          <FileSpreadsheet className="w-4 h-4" /> Whole catalogue
        </Link>
        )}
        <button
          onClick={() => setEditor({ open: true, product: null })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-takal-yellow px-4 py-2.5 text-sm font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark"
        >
          <Plus className="w-4 h-4" /> Add product
        </button>
      </div>

      {/* ── Filter buttons ── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show">
        {(fixed ? [FILTERS[0], ...PRICE_FILTERS, ...FILTERS.slice(1)] : FILTERS)
          .filter((f) => !staffView || f.id !== "featured").map((f) => {
          const on = show === f.id;
          // The red numbers follow a price change at once (from the prices
          // just read again); the list's own numbers otherwise.
          const n = f.id === "missing_buying" ? (summary?.missing ?? counts?.missing_buying)
            : f.id === "loss" ? (summary?.loss ?? counts?.loss)
              : counts?.[f.id];
          const base = "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition";
          const look = on
            ? "bg-black border-black text-white"
            : f.tone === "orange"
              ? "bg-takal-orange-soft border-[#FFB597] text-[#C8410F] hover:border-takal-orange"
              : f.tone === "alarm"
                ? "bg-takal-red-soft border-[#F5B5BC] text-takal-red hover:border-takal-red"
                : "bg-white border-takal-line text-takal-ink hover:border-takal-ink-soft";
          const pill = on
            ? "bg-takal-yellow text-black"
            : f.tone === "orange"
              ? "bg-takal-orange text-white"
              : f.tone === "alarm"
                ? "bg-takal-red text-white"
                : f.tone === "red"
                  ? "bg-takal-red-soft text-takal-red"
                  : "bg-[#EEEEEE] text-takal-ink";
          return (
            <button key={f.id} role="tab" aria-selected={on}
              onClick={() => { setShow(f.id); setPage(1); }}
              className={`${base} ${look}`}>
              {f.id === "no_picture" && <Camera className="w-3.5 h-3.5" />}
              {f.id === "featured" && <Star className="w-3.5 h-3.5" />}
              {f.id === "missing_buying" && <span aria-hidden>⛔</span>}
              {f.id === "loss" && <span aria-hidden>📉</span>}
              {f.label}
              <span className={`rounded-full px-1.5 text-[11px] leading-5 ${pill}`}>{shown(n)}</span>
            </button>
          );
        })}
      </div>

      {/* ── How many have a picture ── */}
      {pct !== null && counts?.all ? (
        <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-[#EDE88A] bg-takal-yellow-soft px-3.5 py-2 text-[13px]">
          <Camera className="w-4 h-4 shrink-0" />
          <span><b>{withPicture!.toLocaleString()} of {counts.all.toLocaleString()}</b> products have a picture</span>
          <div className="flex-1 h-2.5 rounded-full bg-white border border-[#E4DF7E] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-takal-green to-[#2FA36B]" style={{ width: `${pct}%` }} />
          </div>
          <b className="text-takal-green">{pct}%</b>
        </div>
      ) : null}

      {loadError && (
        <ErrorState message={loadError.message} denied={loadError.denied} onRetry={() => setReloadKey((k) => k + 1)} />
      )}

      {/* ── How to type in the list (Step 5a, Mock 171-2) ── */}
      {data && data.items.length > 0 && (
        <div className="rounded-xl border-[1.5px] border-[#EDE88A] bg-takal-yellow-soft px-3.5 py-2 text-[13px] text-takal-ink leading-7">
          <b>{fixed
            ? "Click any buying or selling price, name, stock or discount to change it."
            : "Click any name, price, discount, stock or category to change it."}</b>{" "}
          <Key>Enter</Key> saves <Key>Esc</Key> cancels <Key>Tab</Key> next box.{" "}
          <span className="whitespace-nowrap">▾ opens sizes and extras inside the list.</span>{" "}
          <span className="whitespace-nowrap"><Pencil className="inline w-3.5 h-3.5" /> is still there for pictures and the description.</span>
        </div>
      )}

      {prepare && (
        <div className="rounded-xl border-[1.5px] border-[#BBD3E8] bg-takal-blue-soft px-3.5 py-2 text-[13px] text-takal-blue">
          <b>Filling buying prices before the switch.</b> The store keeps selling exactly as it is until it is
          made fixed-price in Store settings.{" "}
          {summary && <b>{summary.missing} still need one.</b>}
        </div>
      )}
      {(fixed || prepare) && pricesFailed && (
        <ErrorState message={pricesFailed} onRetry={reloadPrices} />
      )}

      {/* ── The list ── */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const p = pickFor.current;
          const f = e.target.files?.[0];
          e.target.value = "";
          if (p) uploadPicture(p, f);
        }}
      />
      {data && (
        <div className={`overflow-x-auto rounded-xl border border-takal-line bg-white transition-opacity ${loading ? "opacity-60" : ""}`}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                <th className="pl-3 py-2.5 border-b-[1.5px] border-takal-line w-[36px]">
                  <input type="checkbox" checked={allPicked} onChange={toggleAll}
                    disabled={!data.items.length}
                    aria-label="Tick every product on this page"
                    className="w-[18px] h-[18px] accent-black cursor-pointer align-middle" />
                </th>
                <th className={`px-3 py-2.5 border-b-[1.5px] border-takal-line w-[76px] ${SHOW_PICTURE}`}>Picture</th>
                <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">Product</th>
                {(fixed || prepare) && (
                  <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">
                    Buying price<span className="block normal-case tracking-normal font-normal text-[11px]">the vendor gets</span>
                  </th>
                )}
                {fixed ? (
                  <>
                    <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">
                      Selling price<span className="block normal-case tracking-normal font-normal text-[11px]">the customer pays</span>
                    </th>
                    <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">
                      Discount<span className="block normal-case tracking-normal font-normal text-[11px]">off selling</span>
                    </th>
                    <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">
                      Takal earns<span className="block normal-case tracking-normal font-normal text-[11px]">selling − buying</span>
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">
                      Price<span className="block normal-case tracking-normal font-normal text-[11px]">shop&apos;s own price</span>
                    </th>
                    <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">Discount</th>
                  </>
                )}
                <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line">Stock</th>
                <th className={`px-3 py-2.5 border-b-[1.5px] border-takal-line ${showCategory}`}>Category</th>
                <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line whitespace-nowrap">On / Off</th>
                <th className="px-3 py-2.5 border-b-[1.5px] border-takal-line w-[56px] 2xl:w-[92px]" />
              </tr>
            </thead>
            <tbody>
              {loadError && data.items.length === 0 ? (
                // The read failed: say nothing about what the shop has.
                <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-takal-ink-soft">The products could not be read - see above.</td></tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-10 text-center text-sm text-takal-ink-soft">
                    {!narrowed
                      ? "No products yet. Press “Add product”, or upload a whole catalogue."
                      : show === "no_picture" && !search && !categoryId
                        ? "Every product has a picture."
                        : show === "missing_buying" && !search && !categoryId
                          ? "Every product has a buying price - customers can order them all."
                          : show === "loss" && !search && !categoryId
                            ? "Nothing is sold at a loss."
                        : "Nothing matches. Try another word or filter."}
                  </td>
                </tr>
              ) : (
                data.items.map((p) => {
                  const n = notes[p.id] || {};
                  const off = !p.is_available;
                  const over = dragOver === p.id;
                  const typing = edit?.id === p.id ? edit : null;
                  const isOpen = opened.has(p.id);
                  const hasOptions = (p.option_count ?? 0) > 0;
                  const words = optionWords(p.choice_count ?? 0, p.extra_count ?? 0, p.sizes === true)
                    || (hasOptions ? `${p.option_count} option${p.option_count > 1 ? "s" : ""}` : "");
                  const after = afterDiscount(p.price, p.discount_percent);
                  // A fixed-price store: red when customers cannot order it (no
                  // buying price) or when it is sold at a loss (Mock 171-1).
                  const priced = fixed ? priceOf.get(p.id) : undefined;
                  const red = !!n.failed || !!priced?.missing || !!priced?.loss;
                  const rowLook = red
                    ? "bg-[#FFF1F2]"
                    : typing || picked.has(p.id) ? "bg-[#FFFDD0]" : "hover:bg-[#FFFEE8]";
                  const edge = red
                    ? "shadow-[inset_4px_0_0_#D62839]"
                    : typing || picked.has(p.id) ? "shadow-[inset_4px_0_0_#FFFF00]" : "";
                  return (
                    <Fragment key={p.id}>
                    <tr className={`group ${rowLook}`}>
                      <td className={`pl-3 py-2 border-b border-[#F0F0F0] ${edge}`}>
                        <input type="checkbox" checked={picked.has(p.id)} onChange={() => togglePick(p.id)}
                          aria-label={`Tick ${p.name}`}
                          className="w-[18px] h-[18px] accent-black cursor-pointer align-middle" />
                      </td>
                      {/* Picture square */}
                      <td className={`px-3 py-2 border-b border-[#F0F0F0] ${SHOW_PICTURE}`}>
                        <button
                          type="button"
                          onClick={() => squareClicked(p)}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(p.id); }}
                          onDragLeave={() => setDragOver((d) => (d === p.id ? null : d))}
                          onDrop={(e) => dropped(p, e)}
                          title={p.image_url ? "Open this product to change its pictures" : "Click to choose a photo, or drop one here"}
                          className={[
                            "relative w-14 h-14 rounded-xl flex flex-col items-center justify-center overflow-visible shrink-0 transition",
                            n.busy === "picture"
                              ? "bg-[#F3F3F3] border-2 border-takal-line"
                              : over
                                ? "bg-takal-blue-soft border-[2.5px] border-takal-blue text-takal-blue"
                                : p.image_url
                                  ? "bg-[#F6F6F2] border border-takal-line"
                                  : "bg-takal-yellow-soft border-2 border-dashed border-[#C9C600] text-[#5A5800] hover:bg-takal-yellow hover:border-solid",
                          ].join(" ")}
                        >
                          {n.busy === "picture" ? (
                            <Loader2 className="w-6 h-6 animate-spin text-takal-green" />
                          ) : over ? (
                            <>
                              <UploadCloud className="w-5 h-5" />
                              <span className="text-[9.5px] font-extrabold">Drop here</span>
                            </>
                          ) : p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" loading="lazy"
                              className={`w-full h-full object-cover rounded-[11px] ${off ? "opacity-50" : ""}`} />
                          ) : (
                            <>
                              <Camera className="w-5 h-5" />
                              <span className="text-[9.5px] font-bold group-hover:hidden">Add</span>
                              <span className="text-[9.5px] font-bold hidden group-hover:block">Choose</span>
                            </>
                          )}
                          {p.photo_count > 1 && !n.busy && (
                            <span className="absolute left-1 bottom-1 rounded-md bg-black/65 px-1 text-[10px] text-white">{p.photo_count}</span>
                          )}
                          {n.saved === "Picture saved" && (
                            <span className="absolute -right-1.5 -bottom-1.5 w-5 h-5 rounded-full bg-takal-green text-white border-2 border-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Name - typed in the row (Step 5a) */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0] min-w-[170px]">
                        {typing?.field === "name" ? (
                          <EditBox
                            wide hint
                            value={typing.val}
                            bad={typing.bad}
                            label={`Name of ${p.name}`}
                            onChange={(val) => setEdit({ ...typing, val, bad: false })}
                            onSave={() => saveField(p)}
                            onCancel={() => { setEdit(null); note(p.id, {}); }}
                            onTab={(back) => saveField(p, { back })}
                          />
                        ) : (
                          <div className="flex items-start gap-2">
                            {hasOptions && (
                              <button
                                type="button"
                                onClick={() => toggleOpen(p.id)}
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? "Close" : "Open"} the sizes and extras of ${p.name}`}
                                title={isOpen ? "Close the sizes and extras" : "Open the sizes and extras here"}
                                className={`mt-0.5 inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-md ${isOpen ? "bg-black text-takal-yellow" : "bg-takal-ink text-white hover:bg-black"}`}
                              >
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openBox(p, "name")}
                                disabled={n.busy === "name"}
                                title="Click to change the name"
                                className={`text-left font-semibold text-sm rounded-md px-0.5 -mx-0.5 hover:bg-white hover:outline hover:outline-1 hover:outline-takal-line ${off ? "text-takal-disabled-text line-through" : "text-takal-ink"}`}
                              >
                                {n.busy === "name" ? "Saving…" : p.name}
                              </button>
                              {p.is_featured && (
                                <span className="ml-1.5 align-middle rounded bg-takal-yellow px-1.5 py-px text-[11px] font-extrabold text-black inline-block">★ Featured</span>
                              )}
                              {n.saved && <span className="ml-2 text-xs font-bold text-takal-green inline-block">✓ {n.saved}</span>}
                              <div className="text-xs text-takal-ink-soft mt-0.5">
                                {/* Below a wide screen the category has no column of its own,
                                    so it is clickable here (Mock 171-7). */}
                                <button type="button"
                                  onClick={() => setCatFor({ p, value: p.category_id || "" })}
                                  title="Click to change the category"
                                  className={fixed ? "hover:underline" : "xl:pointer-events-none hover:underline xl:hover:no-underline"}>
                                  {n.busy === "category" ? "Saving…" : (p.category_name || "No category")}
                                </button>
                                {[words, off ? "switched off" : ""].filter(Boolean).map((w) => (
                                  <span key={w}> · {w}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {n.failed && (
                          <div className="mt-1 text-xs font-bold text-takal-red">✕ {n.failed}</div>
                        )}
                        {priced?.missing && p.is_available && (
                          <div className="mt-1 text-xs font-bold text-takal-red">
                            ⛔ Customers cannot order it until {(p.option_count ?? 0) > 0 ? "every size and extra has" : "it has"} a buying price
                          </div>
                        )}
                      </td>

                      {/* Buying | Selling | Discount | Takal earns - a fixed-price
                          store (Mock 171-1). Buying alone, then the ordinary
                          price - a standard store filling buying prices first. */}
                      {(fixed || prepare) && (
                        <FixedPriceCells
                          item={priceOf.get(p.id)}
                          save={savePrices}
                          prepare={prepare}
                          onOpenSizes={() => setOpened((o) => new Set(o).add(p.id))}
                        />
                      )}
                      {!fixed && (<>
                      {/* Price - the shop's own price */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0]">
                        {typing?.field === "price" ? (
                          <EditBox
                            numeric prefix="Rs"
                            value={typing.val}
                            bad={typing.bad}
                            label={`Price of ${p.name}`}
                            onChange={(val) => setEdit({ ...typing, val, bad: false })}
                            onSave={() => saveField(p)}
                            onCancel={() => { setEdit(null); note(p.id, {}); }}
                            onTab={(back) => saveField(p, { back })}
                          />
                        ) : priceIsFromSizes(p) ? (
                          <button type="button" onClick={() => openBox(p, "price")}
                            title="Each size has its own price - change them under ▾"
                            className="whitespace-nowrap rounded-lg px-2 py-1 text-[13px] text-takal-ink-soft hover:bg-white">
                            from {money(p.from_price)}
                          </button>
                        ) : (
                          <button
                            onClick={() => openBox(p, "price")}
                            disabled={n.busy === "price"}
                            className="whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-takal-line px-2 py-1 text-sm font-bold text-takal-ink hover:border-takal-ink-soft hover:bg-white"
                            title="Click to change the price"
                          >
                            {n.busy === "price" ? "Saving…" : money(p.price)}
                          </button>
                        )}
                        {after !== null && !priceIsFromSizes(p) && typing?.field !== "price" && (
                          <div className="mt-0.5 px-2 text-[11.5px] leading-4 text-takal-ink-soft max-w-[112px]">
                            after {p.discount_percent}% off: <b className="text-takal-ink whitespace-nowrap">{money(after)}</b>
                          </div>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0] whitespace-nowrap">
                        {typing?.field === "discount" ? (
                          <EditBox
                            numeric
                            value={typing.val}
                            bad={typing.bad}
                            label={`Discount of ${p.name}`}
                            onChange={(val) => setEdit({ ...typing, val, bad: false })}
                            onSave={() => saveField(p)}
                            onCancel={() => { setEdit(null); note(p.id, {}); }}
                            onTab={(back) => saveField(p, { back })}
                          />
                        ) : (
                          <button
                            onClick={() => openBox(p, "discount")}
                            disabled={n.busy === "discount"}
                            title="Click to type a discount (0 takes it off)"
                            className={`rounded-lg px-2 py-1 text-sm ${p.discount_percent > 0
                              ? "bg-takal-red-soft font-bold text-takal-red"
                              : "text-takal-ink-soft hover:bg-white hover:outline hover:outline-1 hover:outline-takal-line"}`}
                          >
                            {n.busy === "discount" ? "Saving…" : p.discount_percent > 0 ? `−${p.discount_percent}%` : "—"}
                          </button>
                        )}
                      </td>

                      </>)}

                      {/* Stock */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0] whitespace-nowrap">
                        {typing?.field === "stock" ? (
                          <EditBox
                            numeric
                            value={typing.val}
                            bad={typing.bad}
                            label={`Stock of ${p.name}`}
                            onChange={(val) => setEdit({ ...typing, val, bad: false })}
                            onSave={() => saveField(p)}
                            onCancel={() => { setEdit(null); note(p.id, {}); }}
                            onTab={(back) => saveField(p, { back })}
                          />
                        ) : (
                          <button
                            onClick={() => openBox(p, "stock")}
                            disabled={n.busy === "stock"}
                            title={p.stock == null ? "Not counted - click to change the stock" : "Click to change the stock"}
                            className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold ${
                              p.stock === 0 ? "bg-takal-red-soft text-takal-red"
                                : p.stock != null && p.stock <= 5 ? "bg-takal-orange-soft text-[#C8410F]"
                                  : p.stock == null ? "bg-[#EAF6EF] text-takal-green"
                                    : "bg-[#F2F2F2] text-takal-ink"}`}
                          >
                            {n.busy === "stock" ? "Saving…"
                              // "Not counted" in words on a wide screen; ∞ alone on a
                              // smaller one, so the row fits without scrolling.
                              // (A fixed-price store's row has four price columns: ∞ alone.)
                              : p.stock == null ? <>∞<span className={fixed ? "hidden" : "hidden xl:inline"}> Not counted</span></>
                                : p.stock === 0 ? "Out of stock"
                                  : p.stock <= 5 ? `${p.stock} left` : p.stock.toLocaleString()}
                          </button>
                        )}
                      </td>

                      {/* Category - its own column on a wide screen */}
                      <td className={`px-3 py-2 border-b border-[#F0F0F0] ${showCategory}`}>
                        <button
                          type="button"
                          onClick={() => setCatFor({ p, value: p.category_id || "" })}
                          disabled={n.busy === "category"}
                          title="Click to change the category"
                          className="inline-flex max-w-[180px] items-center gap-1 rounded-lg border-[1.5px] border-dashed border-takal-line bg-white px-2 py-1 text-[13px] font-semibold text-takal-ink hover:border-takal-ink-soft"
                        >
                          <span className="truncate">{n.busy === "category" ? "Saving…" : (p.category_name || "No category")}</span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </td>

                      {/* On / Off */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0]">
                        <button
                          role="switch" aria-checked={p.is_available}
                          onClick={() => flip(p)}
                          disabled={!!n.busy}
                          title={p.is_available ? "On - customers can order it. Click to turn off." : "Off - hidden from customers. Click to turn on."}
                          className={`relative inline-block w-10 h-[22px] rounded-full transition disabled:opacity-50 ${p.is_available ? "bg-takal-green" : "bg-[#C9C9C9]"}`}
                        >
                          <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${p.is_available ? "right-[3px]" : "left-[3px]"}`} />
                        </button>
                      </td>

                      {/* Edit, more */}
                      <td className="px-3 py-2 border-b border-[#F0F0F0] whitespace-nowrap">
                        <div className="flex flex-col 2xl:flex-row gap-1">
                        <button onClick={() => openEditor(p)} title="Edit everything - photos, options, category"
                          className="inline-flex w-8 h-8 items-center justify-center rounded-lg border-[1.5px] border-takal-line bg-white hover:border-takal-ink-soft">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            if (menuFor === p.id) { setMenu(null); return; }
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            // Open upwards when there is no room below.
                            const y = r.bottom + 150 > window.innerHeight ? r.top - 142 : r.bottom + 6;
                            setMenu({ p, x: Math.max(8, r.right - 208), y });
                          }}
                          title="More"
                          className="inline-flex w-8 h-8 items-center justify-center rounded-lg border-[1.5px] border-takal-line bg-white hover:border-takal-ink-soft">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <OptionRows
                        product={p}
                        vendorType={vendorType}
                        columns={cols}
                        showPicture={SHOW_PICTURE}
                        showCategory={showCategory}
                        onProduct={(change) => patchRow(p.id, change)}
                        priceMode={fixed ? "fixed" : prepare ? "prepare" : "plain"}
                        priceCells={(v) => {
                          const item = priceOf.get(p.id);
                          return (
                            <FixedOptionCells
                              item={item}
                              option={item?.options.find((o) => o.id === v.id)}
                              save={savePrices}
                              prepare={prepare}
                            />
                          );
                        }}
                      />
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {!data && loading && <div className="py-10 text-center text-sm text-takal-ink-soft">Loading products…</div>}

      {/* ── What the colours mean (Mock 171-1) ── */}
      {fixed && data && data.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-takal-ink-soft">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-takal-green align-middle" />Takal earns 5% or more</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-takal-orange align-middle" />under 5% - low</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-takal-red align-middle" />a loss, or no buying price</span>
          <span>Takal earns = selling price after discount − buying price, per item</span>
        </div>
      )}

      <LossDialog losses={lossAsk?.losses ?? null} busy={lossBusy} onCancel={cancelLoss} onConfirm={confirmLoss} />
      {fixed && (
        <>
          <ChangePricesDialog
            open={changeOpen}
            items={pickedOnPage.map((p) => priceOf.get(p.id)).filter((x): x is NonNullable<typeof x> => !!x)}
            onClose={() => setChangeOpen(false)}
            save={savePrices}
          />
          <PricesSheetDialog
            open={sheetOpen}
            restaurantId={restaurantId}
            items={prices?.items || []}
            onClose={() => setSheetOpen(false)}
            save={savePrices}
          />
        </>
      )}
      <PriceHistoryDialog restaurantId={restaurantId} product={historyOf} onClose={() => setHistoryOf(null)} />

      {/* ── Pages ── */}
      {data && data.items.length > 0 && (
        <div className="flex items-center justify-between text-[13px] text-takal-ink-soft">
          <span>
            Showing <b className="text-takal-ink">{((page - 1) * PER_PAGE + 1).toLocaleString()} – {((page - 1) * PER_PAGE + data.items.length).toLocaleString()}</b>
            {total !== null ? <> of {total.toLocaleString()}</> : null}
          </span>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} title="Previous page"
              className="h-8 min-w-8 px-2 rounded-lg border-[1.5px] border-takal-line bg-white disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageButtons.map((n, i) => (
              <span key={n} className="flex items-center gap-1.5">
                {i > 0 && n - pageButtons[i - 1] > 1 && <span>…</span>}
                <button onClick={() => setPage(n)} disabled={loading}
                  className={`h-8 min-w-8 px-2 rounded-lg border-[1.5px] font-semibold ${n === page ? "bg-takal-yellow border-[#DADA00] text-black" : "bg-white border-takal-line text-takal-ink"}`}>
                  {n}
                </button>
              </span>
            ))}
            <button disabled={!data.has_more || loading} onClick={() => setPage(page + 1)} title="Next page"
              className="h-8 min-w-8 px-2 rounded-lg border-[1.5px] border-takal-line bg-white disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── The "selected" bar ──
          STICKY, not fixed: it stays at the bottom of the screen while the list
          scrolls, and it is always centred over the list itself - whether the
          sidebar is open, closed or not there at all. */}
      {pickedOnPage.length > 0 && (
        <div role="toolbar" aria-label="Change the ticked products"
          className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-[#111] px-2.5 py-2 text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
          <b className="px-1.5 text-[15px] text-takal-yellow whitespace-nowrap">
            {bulkBusy ? <Loader2 className="inline w-4 h-4 animate-spin mr-1" /> : null}
            {pickedOnPage.length} selected
          </b>
          {[
            { label: "Turn ON", Icon: Power, go: () => runBulk("on") },
            { label: "Turn OFF", Icon: PowerOff, go: () => runBulk("off") },
            { label: "Set stock", Icon: Package, go: () => setAsk({ action: "stock", value: "" }) },
            // A fixed-price store: "Rs Change prices" (Mock 171-4) - buying,
            // selling or both, before -> after shown first.
            ...(fixed ? [{ label: "Rs Change prices", Icon: Percent, go: () => setChangeOpen(true), yellow: true }] : []),
            { label: "Discount %", Icon: Percent, go: () => setAsk({ action: "discount", value: "" }), yellow: !fixed },
            { label: "Category", Icon: FolderInput, go: () => setAsk({ action: "category", value: "" }) },
          ].map((b) => (
            <button key={b.label} onClick={b.go} disabled={bulkBusy}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                b.yellow ? "bg-takal-yellow text-black hover:bg-takal-yellow-dark" : "bg-[#2A2A2A] hover:bg-[#3A3A3A]"}`}>
              <b.Icon className="hidden 2xl:inline w-4 h-4" /> {b.label}
            </button>
          ))}
          <button onClick={() => setAsk({ action: "remove", value: "" })} disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#3A1A1E] px-2.5 py-2 text-[13px] font-semibold text-[#FF8A95] hover:bg-[#4A2025] disabled:opacity-50">
            <Trash2 className="hidden 2xl:inline w-4 h-4" /> Remove
          </button>
          <button onClick={() => setPicked(new Set())} disabled={bulkBusy} title="Untick all"
            className="rounded-xl bg-[#2A2A2A] p-2 hover:bg-[#3A3A3A]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Ask the one number or category the button needs ── */}
      <Modal
        open={!!ask && ask.action !== "remove"}
        onClose={() => { if (!bulkBusy) setAsk(null); }}
        size="sm"
        title={ask?.action === "stock" ? `Set stock for ${pickedOnPage.length} products`
          : ask?.action === "discount" ? `Discount for ${pickedOnPage.length} products`
            : `Move ${pickedOnPage.length} products to a category`}
        hint={ask?.action === "discount" ? "0 takes the discount off. The customer sees the lower price at once."
          : ask?.action === "stock" ? "The same number is written on every ticked product."
            : "Only the ticked products move. Their photos, prices and options stay as they are."}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setAsk(null)} disabled={bulkBusy}
              className="flex-1 rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
            <button onClick={confirmAsk} disabled={bulkBusy}
              className="flex-1 rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink hover:bg-takal-yellow-dark disabled:opacity-50">
              {bulkBusy ? "Saving…" : "Apply"}
            </button>
          </div>
        }
      >
        {ask?.action === "category" ? (
          <CategoryPicker options={cats} value={ask.value}
            onChange={(id) => setAsk({ ...ask, value: id })}
            emptyLabel="Choose a category…" ariaLabel="Move to category" />
        ) : ask ? (
          <label className="flex items-center gap-2">
            <input autoFocus type="number" min={0} max={ask.action === "discount" ? 100 : undefined} step={1}
              value={ask.value}
              onChange={(e) => setAsk({ ...ask, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") confirmAsk(); }}
              aria-label={ask.action === "discount" ? "Discount percent" : "Stock"}
              className="w-40 rounded-lg border-[1.5px] border-takal-ink px-3 py-2 text-base font-bold outline-none shadow-[0_0_0_3px_#FFFF00]" />
            {ask.action === "discount" && <span className="text-lg font-bold">%</span>}
          </label>
        ) : null}
      </Modal>

      {/* ── The category of ONE product (Step 5a) ── */}
      <Modal
        open={!!catFor}
        onClose={() => setCatFor(null)}
        size="sm"
        title={catFor ? `Category of ${catFor.p.name}` : "Category"}
        hint="Only this product moves. Its photos, prices and options stay as they are."
        footer={
          <div className="flex gap-3">
            <button onClick={() => setCatFor(null)}
              className="flex-1 rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
            <button onClick={saveCategory}
              className="flex-1 rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink hover:bg-takal-yellow-dark">
              Save
            </button>
          </div>
        }
      >
        {catFor && (
          cats.length > 0 ? (
            <CategoryPicker options={cats} value={catFor.value}
              onChange={(id) => setCatFor({ ...catFor, value: id })}
              emptyLabel="Choose a category…" ariaLabel={`Category of ${catFor.p.name}`} />
          ) : (
            <p className="text-sm text-takal-red">The category list could not be read. Close this and try again in a moment.</p>
          )
        )}
      </Modal>

      <ConfirmDialog
        open={ask?.action === "remove"}
        busy={bulkBusy}
        onCancel={() => setAsk(null)}
        title={`Remove ${pickedOnPage.length} product${pickedOnPage.length === 1 ? "" : "s"}?`}
        confirmLabel={`Yes, remove ${pickedOnPage.length}`}
        message={
          <>
            <p>
              {pickedOnPage.slice(0, 8).map((p) => p.name).join(", ")}
              {pickedOnPage.length > 8 ? ` and ${pickedOnPage.length - 8} more` : ""}
            </p>
            <p className="mt-2">
              A product customers have ordered is kept for their old receipts but
              disappears from the app. The others are deleted outright.
            </p>
          </>
        }
        onConfirm={() => runBulk("remove")}
      />

      {menu && (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: menu.x, top: menu.y }}
          className="z-50 w-52 rounded-xl border border-takal-line bg-white py-1 shadow-lg text-sm"
        >
          <button role="menuitem" onClick={() => openEditor(menu.p)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-takal-page">
            <Pencil className="w-4 h-4" /> Edit all details
          </button>
          {(fixed || prepare) && (
            <button role="menuitem" onClick={() => { const p = menu.p; setMenu(null); setHistoryOf({ id: p.id, name: p.name }); }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-takal-page">
              <FileSpreadsheet className="w-4 h-4" /> Price history
            </button>
          )}
          {!staffView && (
          <button role="menuitem" onClick={() => feature(menu.p)} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-takal-page">
            <Star className="w-4 h-4" /> {menu.p.is_featured ? "Remove Featured" : "Mark as Featured"}
          </button>
          )}
          {!!moveTo?.length && (
            <button role="menuitem" onClick={() => { const p = menu.p; setMenu(null); setMoving(p); }}
              className="flex w-full items-center gap-2 px-3 py-2 font-semibold hover:bg-[#FFFEE0]">
              <ArrowLeftRight className="w-4 h-4" /> Move to another store
            </button>
          )}
          <button role="menuitem" onClick={() => { const p = menu.p; setMenu(null); setPendingDelete(p); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-takal-red hover:bg-takal-red-soft">
            <Trash2 className="w-4 h-4" /> Remove product
          </button>
        </div>
      )}

      {moving && !!moveTo?.length && (
        <MoveProductDialog
          product={moving}
          fromStoreId={restaurantId}
          fromVendorType={vendorType}
          mallName={mallName}
          targets={moveTo}
          onClose={() => setMoving(null)}
          onMoved={(message) => { setMoving(null); toast(message, "success"); setReloadKey((k) => k + 1); }}
        />
      )}

      <ManyPicturesDialog
        restaurantId={restaurantId}
        open={manyOpen}
        onClose={(changed) => { setManyOpen(false); if (changed) setReloadKey((k) => k + 1); }}
      />

      {editor.open && (
        <ProductEditorModal
          restaurantId={restaurantId}
          vendorType={vendorType}
          product={editor.product}
          onClose={() => setEditor({ open: false, product: null })}
          onSaved={() => { setEditor({ open: false, product: null }); setReloadKey((k) => k + 1); }}
          canFeature={!staffView}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        title="Remove this product?"
        confirmLabel="Yes, remove it"
        message={
          <>
            <p><b>{pendingDelete?.name}</b> will be taken out of the shop.</p>
            <p className="mt-2">
              If it has never been ordered it is deleted outright. If customers
              have ordered it, it is kept for their old receipts but disappears
              from the app - and from this list.
            </p>
          </>
        }
        onConfirm={doDelete}
      />
    </div>
  );
}
