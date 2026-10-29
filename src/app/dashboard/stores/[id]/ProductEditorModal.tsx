"use client";

import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog, useDialogKeys } from "@/components/ui";
import { PictureViewer } from "@/components/PictureViewer";
import { findContactInfo } from "@/lib/contact-info";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { CategoryOption } from "@/lib/category-search";
import { deptColour, findShelf, shelfHomes, shelfOptions, suggestionLook, type ShelfHome } from "@/lib/shelves";
import { AddShelfDialog } from "@/components/AddShelfDialog";
import EasyChoices from "./parts-easy-choices";
import { draftsFromBuilt } from "@/lib/option-wizard";
import type { ShelfSuggestion } from "@/lib/api-stores";
import { isPictureLink, makeCover, movePhoto } from "@/lib/photo-order";
import { picturesOf, sendPictures } from "@/lib/product-pictures";
import { money } from "@/lib/format";
import { checkDiscount, checkName, checkPrice, MAX_DISCOUNT } from "@/lib/edit-in-the-list";
import { buyingPriceProblem, partsFailedMessage, sellsAtALoss, type ProductPart } from "@/lib/product-save";
import {
  MAX_SPECS, answerWasLost, cooksFood, draftsFromOptions, existingIdOf, extraDrafts, isSameName,
  lossOf, onlyChanged, optionChanges, optionsAfterSave, optionsProblem, prepFromBox, productBaseline,
  sameCatalogueName, samePhotos, sizeDrafts, specsChanged, specsFromText, specsProblem, specsToText,
  stockFromBox, tidyName, wearsSizes,
  type LoadedOption, type OptionDraft, type SpecRow,
} from "@/lib/product-edit";
import {
  QUICK_SETS, SizeRow, cheapestSize, quickFill, sizesFromVariants,
  sizesProblem, usedSizes, variantsAreSizes,
  ExtraRow, QUICK_EXTRAS, extrasFromVariants, extrasProblem, isExtra,
} from "@/lib/product-sizes";
import { MAX_PRODUCT_VIDEO_MB, MAX_PRODUCT_VIDEO_SECONDS, productVideoProblem, videoSeconds } from "@/lib/product-video";
import { checkFixedPrice, commissionOf, customerPays, takalEarns, type PriceItem } from "@/lib/fixed-prices";

/** A product's video as the editor holds it. */
type Video = { url: string; thumb: string | null; seconds: number; mb: number };

/** A size guide as the server keeps it (Partners app, Mock 93 D). */
type SizeGuide = { unit?: string; columns?: string[]; rows?: unknown[][] } | null;

/** A product video: 15 seconds and 10 MB at most (lib/product-video.ts, 19 Oct 2026). */
const MAX_VIDEO_MB = MAX_PRODUCT_VIDEO_MB;

/** "1:05" from 65 seconds. */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** A small On / Off switch for one option row (audit 203, A6). */
function OnOff({ on, onClick, label, disabled = false }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      title={on ? "On - customers can choose it. Click to switch it off." : "Off - kept, but customers cannot choose it. Click to switch it on."}
      className={`relative inline-block h-[22px] w-10 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-takal-green" : "bg-[#C9C9C9]"}`}>
      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${on ? "right-[3px]" : "left-[3px]"}`} />
    </button>
  );
}

export default function ProductEditorModal({
  restaurantId,
  vendorType,
  product,
  onClose,
  onSaved,
  onChanged,
  canFeature = true,
  fixedPrice = false,
  priced,
  showBuy = false,
  commission = null,
  nav,
  onSavedNext,
}: {
  restaurantId: string;
  vendorType: string;
  product: any | null; // null = new
  onClose: () => void;
  onSaved: () => void;
  /** Read the list again WITHOUT closing this box - used when the product
   *  was saved but its pictures or options were not (audit 202, A1), so the
   *  new product shows in the list while the person presses Save again. */
  onChanged?: () => void;
  /** False for a Mall's own staff (Mock 133): "Featured" is Takal's to set,
   *  so the tick is not shown and never sent. The server refuses it anyway. */
  canFeature?: boolean;
  /** A fixed-price store (Stores page fix 6, Sana 12 Oct 2026; audit S8). */
  fixedPrice?: boolean;
  /** MOCK 203 v2: this product's buying / selling prices from the prices
   *  door - Buy · Sell · Disc · Stock on one line, and each size's own. */
  priced?: PriceItem;
  /** Show the Buy box - a fixed-price store, or one filling its buying
   *  prices (never an ordinary standard store, never a Mall's own staff). */
  showBuy?: boolean;
  /** An ordinary standard store's commission % (21 Oct 2026): the money line
   *  shows what Takal takes and what the shop gets. */
  commission?: number | null;
  /** "‹ prev · 2 of 97 · next ›" - moving on WITHOUT saving. */
  nav?: { index: number; total: number; prev?: () => void; next?: () => void };
  /** "Save & next ›": called instead of onSaved after a save. */
  onSavedNext?: () => void;
}) {
  // THE PRODUCT THIS BOX EDITS. Usually the one it was opened on. But when a
  // first "Add product" got no answer (the server was slow) and the second
  // press is told "this shop already has it", the first press DID make it -
  // and the box switches to editing THAT product (audit 203, A10).
  const [adoptedId, setAdoptedId] = useState<string | null>(null);
  const [adoptNote, setAdoptNote] = useState<string | null>(null);
  const editId: string | null = product && product.id ? String(product.id) : adoptedId;
  const editing = !!editId;
  // THE PRODUCT THIS BOX HAS ALREADY MADE (audit 202, A1). A new product is
  // saved first, then its pictures and options. If one of those fails, the
  // product is already in the shop - so the next press of Save must finish
  // THIS product, not make a second one. Null = nothing made yet.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Said beside the buttons, not only in a toast that fades: what did not
  // save, and what to do about it.
  const [problem, setProblem] = useState<string | null>(null);
  // IN A FIXED-PRICE STORE THE PRICE IS NOT CHANGED HERE. Its prices are set
  // on the Products tab (buying and selling price), which keeps the history
  // and the loss check; the server refuses a price or discount from this box
  // (fixed_price_rules.py). This box used to send them on EVERY save, so even
  // changing only the description failed. Now they are shown, greyed out, and
  // never sent. A NEW product still needs its first price here - and once the
  // first press has made it, it is no longer new. The options' own prices are
  // locked the same way (audit 203, A4).
  const pricesLocked = (editing || !!createdId) && fixedPrice;
  // A NEW product in a fixed-price store also needs its BUYING price - what
  // Takal pays the shop (audit 202, A2). Without one the server saves it
  // switched off ("hidden until it has a buying price").
  const needsBuying = fixedPrice && !editing && !createdId;
  const [buying, setBuying] = useState("");
  const [hiddenNote, setHiddenNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // "This sells below its buying price - save anyway?" (audit 203, A5).
  const [lossAsk, setLossAsk] = useState<{ name: string; lossEach: number } | null>(null);
  // The first "Add product" got no answer: it may have made the product.
  const lostCreate = useRef(false);

  // Mock 215-1: the big picture opens WHOLE when clicked.
  const [bigOpen, setBigOpen] = useState(false);
  // Escape closes it, and the page behind stops scrolling. (With the full-size
  // picture open, Esc closes the picture first.)
  useDialogKeys(true, onClose, saving || !!lossAsk || bigOpen);
  const [cats, setCats] = useState<CategoryOption[]>([]);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [discount, setDiscount] = useState(String(product?.discount_percent ?? 0));
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "");
  const [available, setAvailable] = useState(product?.is_available !== false);
  const [featured, setFeatured] = useState(product?.is_featured === true);
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  // A picture imported from a spreadsheet lives only in image_url - its photo
  // list is empty. It is SHOWN here as photo 1 (Mock 187, 13 Oct 2026: it used
  // to show "no photos", and adding one then lost it) and sent back with the
  // rest; removed, it is taken off properly (lib/product-pictures.ts).
  const [imported, setImported] = useState<string | null>(null);
  // Preparation time in minutes - shops that cook only (audit 203, A6).
  const [prep, setPrep] = useState("");
  // Key details - "Brand", "Barcode", ... (audit 203, A6).
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [specsEditable, setSpecsEditable] = useState(true);
  const [video, setVideo] = useState<Video | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  // Set by the server only - shown, never sent.
  const [rx, setRx] = useState(product?.needs_prescription === true);
  const [sizeGuide, setSizeGuide] = useState<SizeGuide>(null);

  // WHAT THE FRESH READ SAID (audit 203, A2). Save compares the boxes with
  // these and sends ONLY what the person changed - never a value read from
  // the list row, which can be minutes old.
  const [base, setBase] = useState<Record<string, unknown> | null>(null);
  const [loadedPhotos, setLoadedPhotos] = useState<string[]>([]);
  const [loadedOptions, setLoadedOptions] = useState<LoadedOption[]>([]);
  const [loadedSpecs, setLoadedSpecs] = useState<SpecRow[]>([]);
  const [loadedFeatured, setLoadedFeatured] = useState(false);
  // An adopted product (A10) keeps what the person typed; only "what the
  // product really is" comes from the read.
  const keepTyped = useRef(false);
  // Pressing Retry reads the product again.
  const [loadTry, setLoadTry] = useState(0);

  // TRUE when the product could not be read.
  //
  // Before audit 203 Save still ran then, with "text and price" - and it sent
  // the description box, which had never been filled, so a product's
  // description could be wiped by a failed read. Now Save stays LOCKED until
  // the read works, and the box says so with a Retry button (audit 203, A1).
  const [detailFailed, setDetailFailed] = useState(false);
  // TRUE once the product has actually ARRIVED.
  //
  // AUDIT 15 SEPTEMBER 2026. The server sleeps on the free plan and can take
  // 30 seconds to answer; during that time both lists were empty, Save was
  // live, and pressing it replaced every photo and option on the product with
  // nothing - "Product updated". Save now waits for the read.
  const [detailLoaded, setDetailLoaded] = useState(!editing);
  // Same rule for the category list. "No categories for this store type"
  // used to be printed whenever the read failed, so the operator saved the
  // product uncategorised and it never appeared under its heading in the app.
  const [catsFailed, setCatsFailed] = useState(false);
  // Where a missing shelf can be added, and the shop's own department(s) -
  // both from the same tree as the picker (audit 23 October 2026).
  const [homes, setHomes] = useState<ShelfHome[]>([]);
  const [ownSlugs, setOwnSlugs] = useState<string[]>([]);
  const [addShelf, setAddShelf] = useState<string | null>(null);
  const [treeTick, setTreeTick] = useState(0);
  const pendingShelf = useRef<{ name: string; home: string } | null>(null);
  const [variants, setVariants] = useState<OptionDraft[]>([]);
  // A RESTAURANT DISH SOLD IN SIZES (Mock 162, Sana 5 Oct 2026) - the same
  // "How is it sold? One price / In sizes" the Partners app asks. The rules
  // are in src/lib/product-sizes.ts.
  const isRestaurant = vendorType === "restaurant";
  const food = cooksFood(vendorType);
  const [inSizes, setInSizes] = useState(false);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  // A restaurant dish whose options are NOT sizes (rare - typed in the old
  // grid) keeps the old grid, so nothing it has is hidden or lost.
  const [otherOptions, setOtherOptions] = useState(false);
  // EXTRAS on a restaurant dish (Mock 166, Sana 6 Oct 2026, choice A) -
  // "Extra cheese + Rs 150". The rules are in src/lib/product-sizes.ts.
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [uploading, setUploading] = useState(false);
  // How many photos are on their way - one spinning square each (Mock 134).
  const [pending, setPending] = useState(0);
  // Photo being dragged, and the square it is over (Mock 134: drag to reorder).
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  // MOCK 203 v2: the big picture on the left shows this one (the dots).
  const [viewPic, setViewPic] = useState(0);
  // The Buy box (every store), and a fixed-price store's Sell / Disc boxes -
  // all saved through the ONE prices door after the product itself.
  const priceStart = {
    buy: priced?.buying_price != null ? String(priced.buying_price) : "",
    sell: priced ? String(priced.selling_price) : "",
    disc: priced ? String(priced.discount_percent || 0) : "",
  };
  const [buyBox, setBuyBox] = useState(priceStart.buy);
  const [fixSell, setFixSell] = useState(priceStart.sell);
  const [fixDisc, setFixDisc] = useState(priceStart.disc);
  // A fixed-price store's sizes and extras: their own buying / selling price.
  const [optPrices, setOptPrices] = useState<Record<string, { buy: string; sell: string }>>(() =>
    Object.fromEntries((priced?.options || []).map((o) => [o.id, {
      buy: o.buying_price != null ? String(o.buying_price) : "",
      sell: String(o.selling_price),
    }])));
  // "Sell at a loss?" for a price change (the prices door said 409).
  const [priceLoss, setPriceLoss] = useState<null | { changes: any[]; lossEach: number }>(null);
  // Save & next was pressed: after saving, open the next product.
  const andNext = useRef(false);

  // A size with no price of its own is sold at the product's price (A8).
  const sizeFallback = editing && base && typeof base.price === "number" ? (base.price as number) : null;

  // Upload one or more images picked from the device; append their URLs.
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setPending(files.length);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        // NO SIZE NUMBER HERE ANY MORE. This screen kept its own copy of a
        // 5 MB limit that did not match the server's 10 MB. uploadImage now
        // shrinks the picture and applies the one real limit - and says which
        // file was too big, in words - so one bad photo out of five no longer
        // takes the other four down with it.
        try {
          const res = await apiClient.uploadImage(file);
          if (res?.url) urls.push(res.url);
        } catch (err) {
          toast(`${file.name}: ${err instanceof Error ? err.message : "could not be uploaded"}`,
                "error");
        } finally {
          setPending((n) => Math.max(0, n - 1));
        }
      }
      if (urls.length) {
        setPhotos((p) => [...p.filter((u) => u.trim()), ...urls]);
        toast(`${urls.length} photo${urls.length > 1 ? "s" : ""} uploaded`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      setPending(0);
    }
  };

  // A product video, through the same upload door the Partners app uses
  // (POST /restaurants/upload-video). It is put on the product by Save.
  const uploadVideoFile = async (file: File | undefined) => {
    if (!file) return;
    // 15 seconds and 10 MB at most - checked here so nothing is sent for
    // nothing; the server checks the same again.
    const problem = productVideoProblem(file.size, await videoSeconds(file));
    if (problem) {
      toast(problem, "error");
      return;
    }
    setVideoBusy(true);
    try {
      const res = await apiClient.uploadVideo(file);
      if (!res?.video_url) throw new Error("The video could not be uploaded");
      setVideo({
        url: res.video_url, thumb: null,
        seconds: Number(res.duration_seconds) || 0,
        mb: Math.ceil(Number(res.file_size_mb) || file.size / (1024 * 1024)),
      });
      toast("Video uploaded - press Save to put it on the product", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The video could not be uploaded", "error");
    } finally {
      setVideoBusy(false);
    }
  };

  // A pasted link becomes a photo square like the others (Mock 134) - never
  // a text box left in the list. Only a real https address is taken.
  const addLink = () => {
    const t = link.trim();
    if (!isPictureLink(t)) {
      toast("Paste a full picture address that starts with https://", "error");
      return;
    }
    setPhotos((p) => [...p.filter((u) => u.trim()), t]);
    setLink("");
    setLinkOpen(false);
  };

  // The shelves this product may go on. MOCK 201 (Sana, 19 Oct 2026): EVERY
  // department, the shop's own first, then "Other departments" - a pharmacy
  // may put Surf Excel on Laundry Detergent. Leaves only ("Laundry & Cleaning
  // › Laundry Detergent"). An older server answers with the shop's own
  // department only, and the list then looks exactly as before.
  useEffect(() => {
    (async () => {
      try {
        const res = (await apiClient.getShelfTree(vendorType)) as any;
        const opts = shelfOptions(res);
        setCats(opts);
        setHomes(shelfHomes(res));
        setOwnSlugs(Array.isArray(res?.own_slugs) ? res.own_slugs : []);
        setCatsFailed(false);
        // A shelf just added from here goes straight onto this product.
        const want = pendingShelf.current;
        if (want) {
          pendingShelf.current = null;
          const hit = findShelf(opts, want.name, want.home);
          if (hit) setCategoryId(hit.id);
          else toast("The shelf was added - choose it from the list", "info");
        }
      } catch {
        // A FAILED READ MUST NOT BECOME A FACT ABOUT THE CATALOGUE.
        setCats([]);
        setCatsFailed(true);
      }
    })();
  }, [vendorType, treeTick]);

  // "TAKAL SUGGESTS" (Mock 201): a shelf from the name, worked out by the
  // server - the same answer the Partners app gets. Asked once the person
  // stops typing. No answer (an older server, no internet) = no box; the
  // picker above works exactly as before.
  const [suggest, setSuggest] = useState<ShelfSuggestion | null>(null);
  useEffect(() => {
    const typed = name.trim();
    if (typed.length < 3) { setSuggest(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const s = await apiClient.suggestShelf(typed, restaurantId);
        if (alive) setSuggest(s && s.category_id ? s : null);
      } catch {
        if (alive) setSuggest(null);
      }
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [name, restaurantId]);
  const offer = suggest && suggest.category_id && suggest.category_id !== categoryId
    && cats.some((c) => c.id === suggest.category_id) ? suggest : null;
  const offerLook = suggestionLook(offer, ownSlugs);

  // READ THE PRODUCT FRESH when editing: the product itself (GET /menu/{id})
  // and EVERY option, the switched-off ones too (include_unavailable). Both
  // must arrive before Save is allowed - see detailLoaded / detailFailed.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    (async () => {
      try {
        setDetailFailed(false);
        setDetailLoaded(false);
        const [full, optionsRead] = await Promise.all([
          apiClient.getProduct(editId, { fresh: true }) as Promise<any>,
          apiClient.getProductVariants(editId, { fresh: true }),
        ]);
        if (!alive) return;
        const fill = !keepTyped.current;
        const all = ((optionsRead?.variants as any[]) || []) as LoadedOption[];
        setBase(productBaseline(full));
        setLoadedOptions(all);
        setLoadedFeatured(full?.is_featured === true);
        setRx(full?.needs_prescription === true);
        setSizeGuide(full?.size_guide && typeof full.size_guide === "object" ? full.size_guide : null);
        const sp = specsFromText(full?.specs);
        setLoadedSpecs(sp.rows);
        setSpecsEditable(sp.editable);
        if (fill) {
          const read = picturesOf(full);
          setPhotos(read.list);
          setImported(read.imported);
          setLoadedPhotos(read.list);
        } else {
          // Adopted (A10): what the server really has is the starting point;
          // the photos the person added are kept.
          const read = picturesOf(full);
          setImported(read.imported);
          setLoadedPhotos(read.list);
          setPhotos((p) => (p.some((u) => u.trim()) ? p : read.list));
        }
        if (fill) {
          // A restaurant's extras have their own section (Mock 166); everything
          // else is read exactly as before.
          const vs = isRestaurant ? all.filter((v) => !isExtra(v)) : all;
          if (isRestaurant) setExtras(extrasFromVariants(all));
          if (isRestaurant && variantsAreSizes(vs)) {
            setInSizes(true);
            setSizes(sizesFromVariants(vs));
          } else if (isRestaurant && vs.length > 0) {
            setOtherOptions(true);
          }
          setVariants(draftsFromOptions(vs));
          // The product's own boxes - from the FRESH read, never the list row.
          setName(String(full?.name ?? ""));
          setDescription(String(full?.description ?? ""));
          setPrice(full?.price != null ? String(full.price) : "");
          setDiscount(String(full?.discount_percent ?? 0));
          setStock(full?.stock != null ? String(full.stock) : "");
          setAvailable(full?.is_available !== false);
          setFeatured(full?.is_featured === true);
          if (full?.category_id) setCategoryId(String(full.category_id));
          setPrep(full?.preparation_time != null ? String(full.preparation_time) : "");
          setSpecs(sp.rows.map((r) => ({ ...r })));
          setVideo(String(full?.video_url ?? "").trim() ? {
            url: String(full.video_url).trim(),
            thumb: full?.video_thumbnail_url ? String(full.video_thumbnail_url) : null,
            seconds: Number(full?.video_duration_seconds) || 0,
            mb: Number(full?.video_file_size_mb) || 0,
          } : null);
        }
        setDetailLoaded(true);
      } catch {
        // THE READ FAILED, AND THAT CHANGES WHAT SAVE IS ALLOWED TO DO.
        //
        // Before 3 September 2026 this carried on with empty lists, and Save
        // then wrote those empty lists back - deleting every photograph and
        // every size/colour option on the product. Then Save sent "only the
        // text" - but the text it sent included a description it had never
        // read (audit 203, A1). Now nothing is sent until this read works.
        if (alive) setDetailFailed(true);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, loadTry]);

  /** Switch the box to the product the server says is already in the shop
   *  (audit 203, A10). Nothing more is written until the person presses Save. */
  const adopt = (id: string) => {
    keepTyped.current = true;
    setAdoptedId(id);
    setProblem(null);
    const said = "Your first Save did reach the server - this product was made then. "
      + "This box now edits THAT product (nothing is made twice). Check it and press Save changes to finish.";
    setAdoptNote(said);
    toast(said, "info");
    onChanged?.();
  };

  /** The product of this name in this shop, found by the name itself - for a
   *  server that does not let the browser read X-Existing-Product-Id. */
  const findSameName = async (n: string): Promise<string | null> => {
    try {
      const page = await apiClient.getShopProducts(restaurantId, { search: n, perPage: 20 });
      const hit = (page.items || []).find((p) => sameCatalogueName(p.name, n));
      return hit ? String(hit.id) : null;
    } catch {
      return null;
    }
  };

  /** The price changes typed in this window (MOCK 203 v2) - for the one
   *  prices door. Buying for every store; selling and discount for a
   *  fixed-price store; each size's / extra's own prices too. */
  const priceChanges = (): { changes: any[]; problem: string | null } => {
    const pid = editId || createdId;
    if (!pid || !priced || needsBuying) return { changes: [], problem: null };
    const out: any[] = [];
    const main: any = { product_id: pid };
    if (showBuy && buyBox.trim() !== priceStart.buy.trim() && buyBox.trim() !== "") {
      const c = checkFixedPrice(buyBox, "buying", "product");
      if (!c.ok) return { changes: [], problem: `Buy: ${c.reason}` };
      main.buying_price = c.value;
    }
    if (pricesLocked && fixSell.trim() !== priceStart.sell.trim()) {
      const c = checkFixedPrice(fixSell, "selling", "product");
      if (!c.ok) return { changes: [], problem: `Sell: ${c.reason}` };
      main.selling_price = c.value;
    }
    if (pricesLocked && fixDisc.trim() !== priceStart.disc.trim()) {
      const c = checkDiscount(fixDisc);
      if (!c.ok) return { changes: [], problem: `Discount: ${c.reason}` };
      main.discount_percent = Number(c.value);
    }
    if (Object.keys(main).length > 1) out.push(main);
    for (const o of priced.options || []) {
      const now = optPrices[o.id];
      if (!now) continue;
      const ch: any = { product_id: pid, variant_id: o.id };
      const startBuy = o.buying_price != null ? String(o.buying_price) : "";
      if (showBuy && now.buy.trim() !== startBuy && now.buy.trim() !== "") {
        const c = checkFixedPrice(now.buy, "buying", o.kind);
        if (!c.ok) return { changes: [], problem: `${o.label}: ${c.reason}` };
        ch.buying_price = c.value;
      }
      if (pricesLocked && now.sell.trim() !== String(o.selling_price)) {
        const c = checkFixedPrice(now.sell, "selling", o.kind);
        if (!c.ok) return { changes: [], problem: `${o.label}: ${c.reason}` };
        ch.selling_price = c.value;
      }
      if (Object.keys(ch).length > 2) out.push(ch);
    }
    return { changes: out, problem: null };
  };
  /** Sends the price changes; "loss" = the prices door asks first. */
  const sendPrices = async (changes: any[], confirm: boolean): Promise<"ok" | "loss" | "failed"> => {
    if (!changes.length) return "ok";
    try {
      await apiClient.setStorePrices(restaurantId, changes, confirm);
      return "ok";
    } catch (err) {
      const e = err as { status?: number; detail?: { losses?: { loss_each?: number; loss?: number }[] } };
      if (e?.status === 409 && Array.isArray(e.detail?.losses)) {
        const first = e.detail!.losses![0] || {};
        setPriceLoss({ changes, lossEach: Number(first.loss_each ?? first.loss ?? 0) });
        return "loss";
      }
      const said = err instanceof Error ? err.message : "The prices did not save";
      setProblem(`Prices not saved: ${said}`);
      toast(`Prices not saved: ${said}`, "error");
      return "failed";
    }
  };
  /** Closed after saving: the next product (Save & next) or the list. */
  const finished = () => {
    if (andNext.current && onSavedNext) { andNext.current = false; onSavedNext(); }
    else onSaved();
  };

  const save = async (confirmLoss = false) => {
    // Still reading this product - or the read failed (Retry first).
    if (editing && !detailLoaded) {
      toast(detailFailed
        ? "This product could not be loaded - press Retry first"
        : "Still loading this product - one moment", "error");
      return;
    }
    const sized = isRestaurant && inSizes;
    if (!name.trim() || (!sized && !pricesLocked && price.trim() === "")) {
      toast(sized ? "Name is required" : "Name and price are required", "error");
      return;
    }
    // Every box is checked in words BEFORE anything is sent - "abc" in the
    // price used to be sent as Rs 0, and "abc" in the stock as 0 in stock.
    const nameOk = checkName(name);
    if (!nameOk.ok) { toast(`Name: ${nameOk.reason}`, "error"); return; }
    const priceOk = !sized && !pricesLocked ? checkPrice(price) : null;
    if (priceOk && !priceOk.ok) { toast(`Price: ${priceOk.reason}`, "error"); return; }
    const discountOk = !pricesLocked ? checkDiscount(discount) : null;
    if (discountOk && !discountOk.ok) { toast(`Discount: ${discountOk.reason}`, "error"); return; }
    const stockOk = stockFromBox(stock);
    if (!stockOk.ok) { toast(stockOk.reason, "error"); return; }
    const prepOk = food ? prepFromBox(prep) : null;
    if (prepOk && !prepOk.ok) { toast(prepOk.reason, "error"); return; }
    // Every size needs a name and a price; the dish costs its cheapest size.
    // A size the server holds with no price of its own uses the product's (A8).
    const sizeProblem = sized ? sizesProblem(sizes, sizeFallback) : null;
    if (sizeProblem) {
      toast(sizeProblem, "error");
      return;
    }
    // Every extra needs a name and what it adds (Mock 166).
    const extraProblem = isRestaurant ? extrasProblem(extras) : null;
    if (extraProblem) {
      toast(extraProblem, "error");
      return;
    }
    const gridShown = !isRestaurant || otherOptions;
    const optionProblem = gridShown ? optionsProblem(variants) : null;
    if (optionProblem) { toast(optionProblem, "error"); return; }
    const specProblem = specsEditable ? specsProblem(specs) : null;
    if (specProblem) { toast(specProblem, "error"); return; }
    const pricePlan = priceChanges();
    if (pricePlan.problem) { toast(pricePlan.problem, "error"); return; }
    // A SUB-CATEGORY IS REQUIRED (Sana, 3 Oct 2026). 694 food products had
    // none, so they never reached the Pizza / Burgers lines or the shop's own
    // buttons. The list could not be read = do not save blind either.
    if (catsFailed) {
      toast("The category list could not be read - close and reopen this box", "error");
      return;
    }
    if (cats.length > 0 && !categoryId) {
      toast("Choose a sub-category - customers find products by it", "error");
      return;
    }
    // A new product in a fixed-price store: its buying price, whole rupees.
    const buyingProblem = needsBuying ? buyingPriceProblem(buying) : null;
    if (buyingProblem) {
      toast(buyingProblem, "error");
      return;
    }
    // EVERY BOX, AS THE SERVER WILL HOLD IT. For a product that already
    // exists only the ones that differ from the fresh read are sent (below).
    const payload: any = {
      name: tidyName(nameOk.value),
      description: description.trim(),
      price: sized ? (cheapestSize(sizes, sizeFallback) as number) : Number(priceOk?.ok ? priceOk.value : 0),
      discount_percent: Number(discountOk?.ok ? discountOk.value : 0),
      is_available: available,
    };
    if (pricesLocked) {
      delete payload.price;
      delete payload.discount_percent;
    }
    // Empty = null = "not counted" (audit 203, A3).
    payload.stock = stockOk.value;
    if (categoryId) payload.category_id = categoryId;
    if (prepOk) payload.preparation_time = prepOk.value;
    if (specsEditable && specsChanged(loadedSpecs, specs)) payload.specs = specsToText(specs);
    payload.video_url = video?.url ?? null;
    if (needsBuying) payload.buying_price = parseInt(buying.trim(), 10);
    if (needsBuying && confirmLoss) payload.confirm_loss = true;

    // True once THIS press has made the product - so even an unexpected
    // failure after that point still refreshes the list behind.
    let madeThisPress = false;
    // Did this press change anything at all?
    let didSomething = false;
    let productId = editId || createdId || "";
    const madeNow = !productId;
    try {
      setSaving(true);
      setProblem(null);
      // Already made by an earlier press of Save (createdId) or being edited:
      // that product is UPDATED, never made a second time (audit 202, A1) -
      // with ONLY the boxes that changed (audit 203, A2).
      if (!madeNow) {
        const send = onlyChanged(base || {}, payload);
        if ("video_url" in send) {
          send.video_duration_seconds = video ? video.seconds : 0;
          send.video_file_size_mb = video ? video.mb : 0;
          if (video?.thumb) send.video_thumbnail_url = video.thumb;
        }
        if (Object.keys(send).length > 0) {
          await apiClient.updateMenuItem(productId, send);
          didSomething = true;
          setBase((b) => ({ ...(b || {}), ...send }));
        }
      } else {
        // A new product: nothing empty is sent - the server's own defaults
        // (not counted, the usual preparation time, no details) apply.
        const create: any = { ...payload };
        for (const k of ["stock", "preparation_time", "specs", "video_url"]) if (create[k] == null) delete create[k];
        if (create.video_url && video) {
          create.video_duration_seconds = video.seconds;
          create.video_file_size_mb = video.mb;
        }
        const res = (await apiClient.createProduct(restaurantId, create)) as any;
        productId = String(res?.item?.id || "");
        if (!productId) throw new Error("Could not save the product");
        // Remember it AT ONCE - before anything else can fail.
        setCreatedId(productId);
        madeThisPress = true;
        didSomething = true;
        // What the product now is, so a second press sends only what differs.
        setBase(productBaseline({ ...create, ...(res?.item || {}) }));
        // A fixed-price store's product with no buying price is saved
        // switched off; the server says so in its own words. The tick follows,
        // so a second press of Save cannot switch it back on by accident.
        if (res?.hidden_until_buying_price === true) {
          setAvailable(false);
          setBase((b) => ({ ...(b || {}), is_available: false }));
          const note = String(res?.message || "Saved switched off - it needs a buying price before customers can see it.");
          setHiddenNote(note);
          toast(note, "info");
        }
      }

      // THE TWO WRITES THAT REPLACE A WHOLE LIST - now sent only when the
      // person changed that list (audit 203, A2). Each one is tried on its
      // own, so the person is told EXACTLY which part did not save (audit
      // 202, A1). Both are safe to try again.
      const failed: ProductPart[] = [];
      const list = photos.map((u) => u.trim()).filter(Boolean);
      if (!samePhotos(loadedPhotos, list)) {
        try {
          await sendPictures(apiClient, productId, photos.map((u) => u.trim()).filter(Boolean), imported);
          setLoadedPhotos(list);
          setImported(null);
          didSomething = true;
        } catch {
          failed.push("pictures");
        }
      }

      // The options, as one list of rows: a dish in sizes sends its sizes, a
      // dish at One price drops every choice (drop_choices), a restaurant's
      // extras go with them (Mock 166), and any other shop sends its grid.
      // Only the boxes that changed are sent; a deleted option goes in
      // remove_ids, on or off (audit 203, A2 / A6).
      const drafts: OptionDraft[] = isRestaurant
        ? [...(sized ? sizeDrafts(sizes) : otherOptions ? variants : []), ...extraDrafts(extras)]
        : variants;
      const body = optionChanges(loadedOptions, drafts, {
        fixedPrice: pricesLocked,
        dropChoices: isRestaurant && !sized && !otherOptions,
      });
      if (body) {
        try {
          const { variants: rows, ...more } = body;
          const res = (await apiClient.setProductVariants(productId, rows, more)) as any;
          didSomething = true;
          const after = optionsAfterSave(loadedOptions, body, res?.variants);
          if (after) {
            setLoadedOptions(after);
          } else {
            const again = await apiClient.getProductVariants(productId, { fresh: true }).catch(() => null);
            if (again) setLoadedOptions((again.variants || []) as LoadedOption[]);
          }
        } catch {
          failed.push("options");
        }
      }

      // The product is saved but a part of it is not: the box STAYS OPEN on
      // this product, says which part, and the list behind is read again so
      // the product is there to see.
      const partly = partsFailedMessage(madeNow || !!createdId, failed);
      if (partly) {
        setProblem(partly);
        toast(partly, "error");
        onChanged?.();
        return;
      }

      // Featured is admin-only (separate endpoint from the product update),
      // and only sent when the tick changed.
      let featuredFailed = false;
      if (canFeature && featured !== loadedFeatured) try {
        await apiClient.setProductFeatured(productId, featured);
        setLoadedFeatured(featured);
        didSomething = true;
      } catch {
        // Not fatal — the rest of the product did save. But it is not nothing
        // either: the tick did not apply, and saying "Product updated" without
        // mentioning it is how somebody comes back a week later wondering why
        // their featured item never appeared.
        featuredFailed = true;
      }

      // The prices typed here (MOCK 203 v2) - the one prices door, last.
      if (pricePlan.changes.length) {
        const sent = await sendPrices(pricePlan.changes, false);
        if (sent === "loss" || sent === "failed") return;
        didSomething = true;
      }

      if (!didSomething && !featuredFailed) {
        toast("Nothing was changed", "info");
        if (andNext.current && onSavedNext) { andNext.current = false; onSavedNext(); return; }
        onClose();
        return;
      }
      toast(
        featuredFailed
          ? "Saved, but the Featured setting did not apply — try that one again"
          : editing
            ? "Product updated"
            : "Product added",
        featuredFailed ? "error" : "success",
      );
      finished();
    } catch (err) {
      if (madeNow && !madeThisPress) {
        // A fixed-price store's new product sold below its buying price: ask,
        // then send it again with confirm_loss (audit 203, A5).
        const loss = needsBuying && !confirmLoss ? lossOf(err) : null;
        if (loss) {
          setLossAsk(loss);
          return;
        }
        // No answer to "Add product": it may have been made.
        if (answerWasLost(err)) lostCreate.current = true;
        // ...and now "this shop already has it": it WAS made - edit that one.
        else if (isSameName(err) && lostCreate.current) {
          const id = existingIdOf(err) || await findSameName(payload.name);
          if (id) {
            adopt(id);
            return;
          }
        }
      }
      // The server's own words - "already in this shop" (409), "Choose a
      // shelf ..." (400), "needs a buying price before it can be switched
      // on" (400) - shown beside the buttons as well as in the toast.
      const said = err instanceof Error ? err.message : "Failed to save product";
      const told = madeThisPress ? `Product saved, but the rest did not: ${said} - press Save to try again` : said;
      setProblem(told);
      toast(told, "error");
      if (madeThisPress) onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";
  const labelCls = "mb-1 block text-xs font-semibold text-takal-ink-soft";
  const smallCls = "px-2 py-1.5 border border-takal-line rounded text-sm min-w-0";
  const lockedCls = "bg-takal-page text-takal-ink-soft cursor-not-allowed";
  const shown = photos.filter((u) => u.trim());
  const locked = editing && !detailLoaded;
  // MOCK 203 v2: a product priced size by size has no one Buy / Sell.
  const sizedPrices = !!priced && priced.options.some((o) => o.kind === "size");
  // The money line: what the customer pays, and what Takal makes.
  const moneyLine = (() => {
    if (sizedPrices || (isRestaurant && inSizes)) return null;
    const sellN = pricesLocked ? Number(fixSell) : Number(price);
    const discN = pricesLocked ? Number(fixDisc) || 0 : Number(discount) || 0;
    if (!Number.isFinite(sellN) || (pricesLocked ? fixSell : price).trim() === "") return null;
    const pays = customerPays(sellN, discN);
    const b = needsBuying ? buying : buyBox;
    const buyN = showBuy && b.trim() !== "" && Number.isFinite(Number(b)) ? Number(b) : null;
    const mk = takalEarns(pays, buyN);
    const takes = !showBuy && commission != null ? commissionOf(pays, commission) : null;
    const text = `Customer pays ${money(pays)}` + (buyN !== null ? ` · vendor gets ${money(buyN)} · ${mk !== null && mk < 0 ? `LOSS ${money(-mk)}` : `Takal makes ${money(mk)}`}`
      : takes !== null && pays !== null ? ` · Takal ${commission}% = ${money(takes)} · shop gets ${money(pays - takes)}` : "");
    return { text, loss: mk !== null && mk < 0 };
  })();
  // Ctrl+S saves (MOCK 203 v2).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!saving) save(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const lockNote = (
    <p className="rounded-lg bg-takal-yellow-soft px-3 py-2 text-xs text-takal-ink">
      🔒 This is a fixed-price store. Option prices are set on the <b>Products</b> tab
      (buying and selling price), like the product&apos;s own price.
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      {/* ONE COMPACT WINDOW (MOCK 203 v2, approved by Sana 20 Oct 2026):
          pictures | name, category, Buy · Sell · Disc · Stock, sizes | the
          rest - nothing to scroll on a laptop. Save is always in sight. */}
      <div data-product-editor className="bg-white rounded-2xl w-full max-w-[1100px] max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-takal-line px-4 py-2">
          <h2 className="text-[16px] font-extrabold text-takal-ink truncate">
            {editing ? (name.trim() || "Edit product") : createdId ? "Product added - finish it" : "Add product"}
          </h2>
          {editing && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${available ? "bg-takal-green-soft text-takal-green" : "bg-[#EEEEEE] text-takal-ink-soft"}`}>{available ? "ON" : "OFF"}</span>}
          {nav && nav.total > 1 && (
            <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-takal-ink-soft" title="Moves on WITHOUT saving - use Save & next to keep the changes">
              <button type="button" onClick={nav.prev} disabled={!nav.prev || saving} className="rounded px-1.5 py-0.5 hover:bg-takal-page disabled:opacity-40">‹ prev</button>
              · {nav.index + 1} of {nav.total} ·
              <button type="button" onClick={nav.next} disabled={!nav.next || saving} className="rounded px-1.5 py-0.5 hover:bg-takal-page disabled:opacity-40">next ›</button>
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className={`${nav && nav.total > 1 ? "" : "ml-auto"} h-8 w-8 rounded-lg border border-takal-line hover:bg-takal-page`}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* The product is already in the shop (audit 202, A1): Save now
            finishes THIS one - it never makes a second copy. */}
        {createdId && !editing && (
          <div data-testid="already-made" className="mb-4 rounded-lg border-l-4 border-takal-green bg-takal-green-soft px-4 py-3 text-sm text-takal-green">
            <strong>✓ This product is in the shop.</strong> Pressing Save again finishes it - it does not make a second one.
          </div>
        )}
        {/* The first Save did make it (audit 203, A10). */}
        {adoptNote && (
          <div data-testid="adopted" className="mb-4 rounded-lg border-l-4 border-takal-blue bg-takal-blue-soft px-4 py-3 text-sm text-takal-blue">
            <strong>✓ Found it.</strong> {adoptNote}
          </div>
        )}
        {hiddenNote && (
          <div className="mb-4 rounded-lg border-l-4 border-takal-orange bg-takal-orange-soft px-4 py-3 text-sm text-[#C8410F]">
            {hiddenNote}
          </div>
        )}

        {/* SAID BEFORE THE SAVE, NOT AFTER IT - and Save stays locked
            (audit 203, A1). Nothing is sent from a product that was not read. */}
        {detailFailed && (
          <div role="alert" data-testid="load-failed" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
            <span className="flex-1 min-w-[200px]">
              <strong>Couldn&apos;t load this product.</strong> Save is locked so nothing on it is
              changed by mistake. Check the internet, then press Retry.
            </span>
            <button type="button" onClick={() => setLoadTry((n) => n + 1)}
              className="rounded-lg border-2 border-black bg-takal-yellow px-3 py-1.5 text-sm font-extrabold text-black shadow-[0_2px_0_#000] active:translate-y-0.5 active:shadow-none">
              ↻ Retry
            </button>
          </div>
        )}

        <div className={`grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_250px] ${locked ? "pointer-events-none opacity-60" : ""}`} aria-busy={locked}>
          <div data-editor-col="pictures" className="space-y-3 min-w-0">
          {/* PHOTOS, EACH SHOWN ONCE (Mock 134, approved 1 Oct 2026 - audit SM15).
              They used to be shown twice: as a picture AND as a box of
              computer text underneath. Now: squares only. The first is the
              cover. Drag to change the order - and because dragging does not
              work with a finger on a phone, every other square also has a
              "Make cover" star. A pasted link becomes a square too. */}
          <div>
            <span className={labelCls}>Photos — the first is the cover. Drag to change the order.</span>
            {/* THE BIG PICTURE with DOTS and ‹ › (MOCK 203 v2) - like the
                customer app's product page. The squares below are the order. */}
            {shown.length > 0 && (
              <div data-editor-picture className="relative mb-2 h-[220px] overflow-hidden rounded-xl border border-takal-line bg-[#F6F6F2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shown[Math.min(viewPic, shown.length - 1)]} alt="" onClick={() => setBigOpen(true)}
                  title="Click to see it full size" className="h-full w-full cursor-zoom-in object-cover" />
                <button type="button" data-see-big onClick={() => setBigOpen(true)}
                  className="absolute right-2 top-2 rounded-lg bg-takal-yellow px-2 py-1 text-[11.5px] font-extrabold text-black shadow">
                  🔍 See full size
                </button>
                {shown.length > 1 && (
                  <>
                    <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                      {shown.map((_, k) => (
                        <button key={k} type="button" onClick={() => setViewPic(k)} aria-label={`Picture ${k + 1}`}
                          className={`h-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,.5)] ${k === Math.min(viewPic, shown.length - 1) ? "w-3.5 bg-takal-yellow" : "w-1.5 bg-white/80"}`} />
                      ))}
                    </div>
                    <button type="button" aria-label="Previous picture" onClick={() => setViewPic((v) => (Math.min(v, shown.length - 1) - 1 + shown.length) % shown.length)}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 font-black shadow">‹</button>
                    <button type="button" aria-label="Next picture" onClick={() => setViewPic((v) => (Math.min(v, shown.length - 1) + 1) % shown.length)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 font-black shadow">›</button>
                  </>
                )}
              </div>
            )}
            <div
              className="flex flex-wrap gap-1.5"
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
              onDrop={(e) => {
                if (e.dataTransfer.files?.length) { e.preventDefault(); uploadFiles(e.dataTransfer.files); }
              }}
            >
              {shown.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  draggable
                  onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                  onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
                  onDrop={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault(); e.stopPropagation();
                    setPhotos(movePhoto(shown, dragFrom, i));
                    setDragFrom(null); setDragOver(null);
                  }}
                  className={`group relative h-[52px] w-[52px] cursor-grab overflow-hidden rounded-xl border bg-white ${
                    dragFrom === i ? "opacity-35 border-dashed border-[#999999]"
                      : dragOver === i ? "border-2 border-dashed border-takal-blue"
                      : "border-takal-line hover:ring-[3px] hover:ring-takal-yellow"}`}
                  title={i === 0 ? "The cover" : "Drag to move"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                  {i === 0 ? (
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10.5px] font-extrabold text-takal-yellow">★ Cover</span>
                  ) : (
                    <button type="button" onClick={() => setPhotos(makeCover(shown, i))}
                      title="Make this the cover"
                      className="absolute inset-x-0 bottom-0 bg-white/90 py-0.5 text-center text-[10.5px] font-bold text-takal-ink hover:bg-takal-yellow">
                      ☆ Cover
                    </button>
                  )}
                  <button type="button" onClick={() => setPhotos(shown.filter((_, j) => j !== i))}
                    aria-label={`Remove photo ${i + 1}`} title="Remove"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-takal-red text-[11px] text-white">
                    ✕
                  </button>
                </div>
              ))}
              {Array.from({ length: pending }).map((_, k) => (
                <div key={`up-${k}`} aria-label="Uploading" className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border-2 border-takal-line bg-[#F3F3F3]">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#E1E1E1] border-t-takal-green border-r-takal-green" />
                </div>
              ))}
              <label className={`flex h-[52px] w-[52px] flex-col items-center justify-center rounded-xl border-[2.5px] border-dashed border-[#C9C600] bg-takal-yellow-soft text-[#6B6900] ${
                uploading ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-takal-yellow"}`}>
                <span className="text-xl leading-none">＋</span>
                <span className="mt-0.5 text-[9.5px] font-bold">Add</span>
                <input type="file" accept="image/*" multiple disabled={uploading} className="hidden"
                  onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
              </label>
            </div>

            {linkOpen ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <input autoFocus value={link} onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                  placeholder="https://…" aria-label="Link to a picture" className={`${inputCls} flex-1 min-w-[200px]`} />
                <button type="button" onClick={addLink}
                  className="rounded-lg bg-takal-yellow px-3 py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow-dark">Add this picture</button>
                <button type="button" onClick={() => { setLinkOpen(false); setLink(""); }}
                  className="rounded-lg border border-takal-line px-3 py-2 text-sm font-semibold text-takal-ink">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setLinkOpen(true)}
                className="mt-2 text-[12.5px] font-semibold text-takal-blue underline">
                or paste a link to a picture
              </button>
            )}
          </div>

          {/* VIDEO (audit 203, A6) - seen only on the product's own page.
              Uploaded through the same door as the Partners app; Remove
              takes it off the product when Save is pressed. */}
          <div data-testid="video-section">
            <span className={labelCls}>Video <span className="font-normal">- optional · shown only on the product&apos;s own page</span></span>
            {video ? (
              <div className="flex items-center gap-3 rounded-xl border border-takal-line bg-[#FAFAF7] p-2">
                {video.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumb} alt="Video picture" className="h-14 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-takal-ink text-xl text-takal-yellow">▶</div>
                )}
                <div className="min-w-0 flex-1 text-xs text-takal-ink-soft">
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="font-bold text-takal-blue underline">Watch the video</a>
                  <div>
                    {video.seconds > 0 ? clock(video.seconds) : "Length not known"}
                    {video.mb > 0 ? ` · ${video.mb} MB` : ""}
                    {video.url !== (base?.video_url ?? null) && <b className="ml-1 text-[#C8410F]">· not saved yet</b>}
                  </div>
                </div>
                <button type="button" onClick={() => setVideo(null)} aria-label="Remove the video"
                  className="rounded-lg bg-takal-red-soft px-2.5 py-1.5 text-xs font-bold text-takal-red hover:opacity-80">✕ Remove</button>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 rounded-xl border-[2px] border-dashed border-takal-line px-3 py-2.5 text-sm font-bold text-takal-ink ${
                videoBusy ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-takal-yellow-soft"}`}>
                {videoBusy ? "Uploading the video…" : `🎬 Add a video (up to ${MAX_PRODUCT_VIDEO_SECONDS} seconds, ${MAX_VIDEO_MB} MB)`}
                <input type="file" accept="video/*" disabled={videoBusy} className="hidden"
                  onChange={(e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
            {!video && editing && base?.video_url != null && (
              <p className="mt-1 text-xs font-semibold text-[#C8410F]">The video will be removed when you press Save.</p>
            )}
          </div>

          </div>
          <div data-editor-col="details" className="space-y-2.5 min-w-0">
          {/* NAME + CATEGORY on one line (MOCK 203 v2). Half and half since
              the audit of 23 October 2026: at 1.5 : 1 the shelf box was too
              narrow to show the shelf's own name. */}
          <div className="grid grid-cols-2 gap-2">
          {/* LABELS ABOVE EVERY BOX (Mock 134 extra). A placeholder vanishes
              the moment something is typed, and then "1450" and "10" look
              alike - which one is the price? */}
            <label className="block">
            <span className={labelCls}>Name</span>
            <input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
            <div>
            <span className={labelCls}>Sub-category *</span>
            {cats.length > 0 ? (
              <CategoryPicker options={cats} value={String(categoryId || "")} onChange={setCategoryId}
                emptyLabel="Choose a sub-category…" ariaLabel="Sub-category"
                suggested={offer?.category_id ? [String(offer.category_id)] : undefined}
                onMissing={homes.length ? (typed) => setAddShelf(typed) : undefined} />
            ) : catsFailed ? (
              <div className="text-xs text-[#C8410F] self-center">
                The category list could not be read. Close and reopen this box —
                do not save yet, or the product goes in with no category.
              </div>
            ) : (
              <div className="text-xs text-takal-disabled-text self-center">No categories for this store type</div>
            )}
            {offer && (
              <div data-testid="takal-suggests" className="mt-2 overflow-hidden rounded-xl border-2 border-black bg-white shadow-[0_3px_0_#000]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold text-white"
                  style={{ background: `linear-gradient(120deg, ${deptColour(offer.department_slug)[0]}, ${deptColour(offer.department_slug)[1]})` }}>
                  ✦ Takal suggests
                  <span className={`ml-auto rounded-full bg-white px-2 py-px text-[11px] ${offerLook.sure ? "text-[#067A25]" : "text-[#C25E00]"}`}>
                    {offerLook.badge}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[14px] font-extrabold text-takal-ink">
                    {offer.shelf}
                    {offer.needs_prescription && (
                      <span className="ml-1.5 rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>
                    )}
                  </p>
                  {offer.path && <p className="text-[12px] font-semibold text-takal-ink-soft">{offer.path}</p>}
                  {offer.why && <p className="mt-1.5 rounded-lg bg-[#F6F4EC] px-2 py-1 text-[11.5px] text-takal-ink-soft">{offer.why}</p>}
                  {offerLook.warning && (
                    <p className="mt-1.5 rounded-lg bg-[#FFF4E5] px-2 py-1 text-[11.5px] font-semibold text-[#C25E00]">{offerLook.warning}</p>
                  )}
                  <button type="button" onClick={() => setCategoryId(String(offer.category_id))}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border-2 border-black bg-takal-yellow px-3 py-1 text-[12.5px] font-extrabold text-black shadow-[0_2px_0_#000] active:translate-y-0.5 active:shadow-none">
                    ✓ Use this
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
          {/* BUY · SELL · DISC · STOCK on ONE line (MOCK 203 v2). A fixed-price
              store's Sell and Disc, and every store's Buy, go through the one
              prices door when Save is pressed. A dish in sizes is priced size
              by size (below). */}
          <div className={`grid gap-2 ${showBuy ? "grid-cols-4" : "grid-cols-3"}`}>
            {showBuy && (
              <label className="block">
                <span className={labelCls}>Buy{needsBuying ? " *" : ""}</span>
                {sizedPrices ? (
                  <div className={`${inputCls} bg-takal-page text-takal-ink-soft`}>per size ↓</div>
                ) : (
                  <input type="number" inputMode="numeric" min={0} step={1} placeholder={needsBuying ? "e.g. 450" : "—"}
                    value={needsBuying ? buying : buyBox}
                    onChange={(e) => (needsBuying ? setBuying(e.target.value) : setBuyBox(e.target.value))}
                    aria-label="Buying price (Rs)" title="Buying price - what the vendor is paid"
                    className={`${inputCls} ${needsBuying && buying.trim() && buyingPriceProblem(buying) ? "border-takal-red" : ""}`}
                    disabled={!needsBuying && !priced} />
                )}
              </label>
            )}
            <label className="block">
              <span className={labelCls}>{needsBuying ? "Sell *" : "Sell"}</span>
              {pricesLocked ? (
                sizedPrices ? (
                  <div className={`${inputCls} bg-takal-page text-takal-ink-soft`}>per size ↓</div>
                ) : (
                  <input type="number" value={fixSell} onChange={(e) => setFixSell(e.target.value)} aria-label="Selling price (Rs)"
                    className={inputCls} disabled={!priced} />
                )
              ) : isRestaurant && inSizes ? (
                <div className={`${inputCls} bg-takal-green-soft font-semibold text-takal-green`} title="The cheapest size">
                  {cheapestSize(sizes, sizeFallback) != null ? `from ${money(cheapestSize(sizes, sizeFallback))}` : "by size"}
                </div>
              ) : (
                <input type="number" placeholder="Price (Rs)" value={price} onChange={(e) => setPrice(e.target.value)}
                  aria-label={needsBuying ? "Selling price (Rs)" : "Price (Rs)"} className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className={labelCls}>Disc %</span>
              {pricesLocked ? (
                <input type="number" min={0} max={MAX_DISCOUNT} step={1} value={fixDisc} onChange={(e) => setFixDisc(e.target.value)}
                  aria-label="Discount %" className={inputCls} disabled={!priced} />
              ) : (
                <input type="number" min={0} max={MAX_DISCOUNT} step={1} placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                  aria-label="Discount %" className={inputCls} />
              )}
            </label>
            <label className="block">
              <span className={labelCls}>Stock</span>
              {/* Emptied = "not counted" - and that is now SENT, so emptying the
                  box really clears the number (audit 203, A3). */}
              <input type="number" placeholder="Not counted" value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stock" className={inputCls} />
            </label>
          </div>
          {/* The money line, worked out while typing. */}
          {moneyLine && (
            <p data-testid="money-line" className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${moneyLine.loss ? "bg-takal-red-soft text-takal-red" : "bg-takal-green-soft text-takal-green"}`}>
              {moneyLine.text}
            </p>
          )}
          {pricesLocked && !priced && (
            <p className="rounded-lg bg-takal-yellow-soft px-3 py-1.5 text-xs text-takal-ink">
              🔒 This is a fixed-price store. Its prices are still being read - or set them on the card / in the list.
            </p>
          )}
          {needsBuying && (
            <div data-testid="buying-price" className="-mt-1 text-[11.5px] text-takal-ink">
              Takal pays the shop the <b>Buy</b> price; customers see the fixed selling price.
              {buying.trim() && buyingPriceProblem(buying) && (
                <span className="ml-1 font-semibold text-takal-red">{buyingPriceProblem(buying)}</span>
              )}
              {!buyingPriceProblem(buying) && sellsAtALoss(buying, price, discount) && (
                <span className="ml-1 font-semibold text-takal-red">
                  ⚠ The buying price is more than customers pay - Takal would lose money on each one.
                </span>
              )}
            </div>
          )}
          {/* PRESCRIPTION - set by the server only, shown so the office
              knows (audit 203, A6). */}
          {rx && (
            <p data-testid="rx-line" className="flex items-center gap-2 rounded-lg border border-[#F5B5BC] bg-takal-red-soft px-3 py-2 text-xs font-semibold text-takal-red">
              <span className="rounded-md bg-takal-red px-1.5 py-px text-[10px] font-extrabold text-white">Rx</span>
              Needs a prescription - set by its shelf / medicine rules. Change the shelf to change it.
            </p>
          )}

          {/* A fixed-price store's sizes and extras: each its own Buy and Sell
              (MOCK 203 v2), typed right here. */}
          {(pricesLocked || showBuy) && priced && priced.options.length > 0 && (
            <div data-testid="size-prices">
              <span className={labelCls}>Sizes and extras - each its own buy · sell</span>
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-[10.5px] uppercase text-takal-ink-soft">
                  <tr><th className="py-1 pr-2">Size / extra</th>{showBuy && <th className="py-1 pr-2">Buy</th>}<th className="py-1 pr-2">Sell</th><th className="py-1">Makes</th></tr>
                </thead>
                <tbody>
                  {priced.options.map((o) => {
                    const v = optPrices[o.id] || { buy: "", sell: String(o.selling_price) };
                    const sellN = pricesLocked ? Number(v.sell) : o.selling_price;
                    const pays = customerPays(sellN, pricesLocked ? Number(fixDisc) || 0 : priced.discount_percent);
                    const buyN = v.buy.trim() !== "" ? Number(v.buy) : (o.kind === "size" ? (buyBox.trim() !== "" ? Number(buyBox) : null) : null);
                    const mk = takalEarns(pays, buyN);
                    return (
                      <tr key={o.id} className="border-t border-[#F0F0F0]">
                        <td className="py-1 pr-2">{o.kind === "extra" ? "＋ " : ""}{o.label}</td>
                        {showBuy && (
                          <td className="py-1 pr-2">
                            <input type="number" value={v.buy} placeholder={o.kind === "size" ? "product's" : "—"} aria-label={`Buy of ${o.label}`}
                              onChange={(e) => setOptPrices((a) => ({ ...a, [o.id]: { ...v, buy: e.target.value } }))}
                              className={`${smallCls} w-20`} />
                          </td>
                        )}
                        <td className="py-1 pr-2">
                          {pricesLocked ? (
                            <input type="number" value={v.sell} aria-label={`Sell of ${o.label}`}
                              onChange={(e) => setOptPrices((a) => ({ ...a, [o.id]: { ...v, sell: e.target.value } }))}
                              className={`${smallCls} w-20`} />
                          ) : <span>{money(o.selling_price)}</span>}
                        </td>
                        <td className={`py-1 font-bold ${mk === null ? "text-takal-ink-soft font-normal" : mk < 0 ? "text-takal-red" : "text-takal-green"}`}>
                          {mk === null ? "—" : mk < 0 ? `LOSS ${money(-mk)}` : `+${money(mk)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* PREPARATION TIME - shops that cook (audit 203, A6). Empty = the
              shop's usual time. */}
          {food && (
            <label className="block max-w-[50%]">
              <span className={labelCls}>Preparation time (minutes)</span>
              <input type="number" inputMode="numeric" min={0} max={1440} placeholder="Usual time"
                value={prep} onChange={(e) => setPrep(e.target.value)} className={inputCls} aria-label="Preparation time (minutes)" />
            </label>
          )}

          {/* How is it sold? (restaurants, Mock 162) */}
          {isRestaurant && !otherOptions && (
            <div>
              <p className={labelCls}>How is it sold?</p>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-takal-page border border-takal-line p-1" role="radiogroup" aria-label="How is it sold?">
                {[{ on: false, label: "One price" }, { on: true, label: "📏 In sizes" }].map((o) => (
                  <button key={o.label} type="button" role="radio" aria-checked={inSizes === o.on}
                    onClick={() => {
                      if (o.on && !inSizes && usedSizes(sizes).length === 0) {
                        // The price already typed becomes the first size's price.
                        setSizes([{ name: "", price: price.trim() }, { name: "", price: "" }]);
                      }
                      if (!o.on && inSizes) {
                        const low = cheapestSize(sizes, sizeFallback);
                        if (low != null && price.trim() === "") setPrice(String(low));
                      }
                      setInSizes(o.on);
                    }}
                    className={`rounded-lg py-2 text-sm font-bold ${inSizes === o.on
                      ? "bg-takal-ink text-takal-yellow" : "text-takal-ink-soft hover:bg-white"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {!inSizes && loadedOptions.some((v) => !isExtra(v)) && (
                <p className="mt-2 rounded-lg bg-takal-orange-soft px-3 py-2 text-xs font-semibold text-[#C8410F]">
                  One price: Save takes off every size of this dish (the extras stay).
                </p>
              )}

              {inSizes && (
                <div className="mt-3">
                  {usedSizes(sizes).length < 2 && (
                    <div className="mb-3">
                      <p className={labelCls}>Quick start - one click fills the size names</p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_SETS.map((set) => (
                          <button key={set.join()} type="button" onClick={() => setSizes((a) => quickFill(a, set))}
                            className="rounded-lg border border-takal-ink/30 bg-takal-yellow-soft px-2.5 py-1.5 text-xs font-bold text-takal-ink hover:bg-takal-yellow">
                            ＋ {set.join(" · ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_110px_40px_36px] gap-1.5 text-xs font-semibold text-takal-ink-soft mb-1">
                    <span>Size name</span><span>Price (Rs)</span><span>On</span><span />
                  </div>
                  <div className="space-y-1.5">
                    {sizes.map((r, i) => (
                      <div key={i} className={`grid grid-cols-[1fr_110px_40px_36px] gap-1.5 items-center ${r.off ? "opacity-60" : ""}`}>
                        <input aria-label={`Size ${i + 1} name`} placeholder="Size name" value={r.name}
                          onChange={(e) => setSizes((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                          className={inputCls} />
                        <input aria-label={`Size ${i + 1} price`} type="number" value={r.price}
                          placeholder={sizeFallback != null ? "Product price" : "0"}
                          title={pricesLocked ? "Set on the Products tab" : sizeFallback != null ? `Empty = the product price (${money(sizeFallback)})` : undefined}
                          readOnly={pricesLocked}
                          onChange={(e) => setSizes((a) => a.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                          className={`${inputCls} ${pricesLocked ? lockedCls : ""} ${r.name.trim() && !(parseFloat(r.price) > 0) && !(sizeFallback != null && r.price.trim() === "") ? "border-takal-red" : ""}`} />
                        <OnOff on={!r.off} label={`${r.off ? "Switch on" : "Switch off"} size ${r.name || i + 1}`}
                          onClick={() => setSizes((a) => a.map((x, j) => (j === i ? { ...x, off: !x.off } : x)))} />
                        <button type="button" aria-label={`Remove size ${r.name || i + 1}`}
                          onClick={() => setSizes((a) => a.filter((_, j) => j !== i))}
                          className="h-9 w-9 rounded-lg bg-takal-red-soft text-takal-red font-bold hover:opacity-80">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setSizes((a) => [...a, { name: "", price: "" }])}
                    className="mt-2 w-full rounded-lg border-2 border-takal-ink py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow">
                    ＋ Add a size
                  </button>
                  {pricesLocked && <div className="mt-2">{lockNote}</div>}
                  {sizesProblem(sizes, sizeFallback) ? (
                    <p className="mt-2 text-xs font-semibold text-takal-red">{sizesProblem(sizes, sizeFallback)}</p>
                  ) : (
                    <p className="mt-2 rounded-lg bg-takal-green-soft px-3 py-2 text-xs font-semibold text-takal-green">
                      Customers see &ldquo;from {money(cheapestSize(sizes, sizeFallback))}&rdquo; and choose a size.
                      The order tells the shop which one. Sizes are saved cheapest first.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Extras (restaurants, Mock 166): "Extra cheese + Rs 150". */}
          {isRestaurant && (
            <div data-testid="extras-section">
              <p className={labelCls}>Extras <span className="font-normal">- optional · the customer may tick several or none</span></p>
              {extras.length > 0 && (
                <>
                  <div className="grid grid-cols-[1fr_110px_40px_36px] gap-1.5 text-xs font-semibold text-takal-ink-soft mb-1">
                    <span>Extra</span><span>Adds (Rs)</span><span>On</span><span />
                  </div>
                  <div className="space-y-1.5">
                    {extras.map((r, i) => (
                      <div key={i} className={`grid grid-cols-[1fr_110px_40px_36px] gap-1.5 items-center ${r.off ? "opacity-60" : ""}`}>
                        <input aria-label={`Extra ${i + 1} name`} placeholder="Extra name" value={r.name}
                          onChange={(e) => setExtras((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                          className={inputCls} />
                        <input aria-label={`Extra ${i + 1} adds`} type="number" placeholder="0" value={r.adds}
                          readOnly={pricesLocked} title={pricesLocked ? "Set on the Products tab" : undefined}
                          onChange={(e) => setExtras((a) => a.map((x, j) => (j === i ? { ...x, adds: e.target.value } : x)))}
                          className={`${inputCls} ${pricesLocked ? lockedCls : ""} ${r.name.trim() && r.adds.trim() === "" ? "border-takal-red" : ""}`} />
                        <OnOff on={!r.off} label={`${r.off ? "Switch on" : "Switch off"} extra ${r.name || i + 1}`}
                          onClick={() => setExtras((a) => a.map((x, j) => (j === i ? { ...x, off: !x.off } : x)))} />
                        <button type="button" aria-label={`Remove extra ${r.name || i + 1}`}
                          onClick={() => setExtras((a) => a.filter((_, j) => j !== i))}
                          className="h-9 w-9 rounded-lg bg-takal-red-soft text-takal-red font-bold hover:opacity-80">✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {extras.length === 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_EXTRAS.map((x) => (
                    <button key={x.name} type="button" onClick={() => setExtras((a) => [...a, { ...x }])}
                      className="rounded-lg border border-takal-ink/30 bg-takal-yellow-soft px-2.5 py-1.5 text-xs font-bold text-takal-ink hover:bg-takal-yellow">
                      ＋ {x.name} +{x.adds}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setExtras((a) => [...a, { name: "", adds: "" }])}
                className="mt-2 w-full rounded-lg border-2 border-takal-ink py-2 text-sm font-bold text-takal-ink hover:bg-takal-yellow">
                ＋ Add an extra
              </button>
              {pricesLocked && extras.length > 0 && <div className="mt-2">{lockNote}</div>}
              {extrasProblem(extras) ? (
                <p className="mt-2 text-xs font-semibold text-takal-red">{extrasProblem(extras)}</p>
              ) : extras.some((r) => r.name.trim()) ? (
                <p className="mt-2 rounded-lg bg-takal-blue-soft px-3 py-2 text-xs font-semibold text-takal-blue">
                  An extra ADDS to the price, whatever size is chosen. The dish&rsquo;s discount comes off the
                  whole line, extras included. The shop can switch one off in the Partners app when it runs out.
                </p>
              ) : null}
            </div>
          )}

          {/* Variants - shops that sell goods, and a restaurant dish whose
              options are not sizes. Every option, the switched-off ones too
              (greyed, with their switch), each with its own code / barcode
              (audit 203, A6). An empty box means "not counted" / "the
              product price" - and is sent, so it really clears (A3). */}
          {(!isRestaurant || otherOptions) && (
          <div data-testid="options-section">
            <p className="text-sm font-medium text-takal-ink mb-1">Options (size / colour — each with its own stock)</p>
            {/* MOCK 218 v2: the same six easy steps as the Partners app. */}
            {!isRestaurant && (
              <EasyChoices categoryId={categoryId || undefined} vendorType={vendorType} productName={name}
                basePrice={Number(String(price ?? "").replace(/,/g, "")) || null} drafts={variants} disabled={pricesLocked}
                onDone={(rows, detail) => {
                  setVariants((had) => draftsFromBuilt(had, rows));
                  // One colour only: "Colour: Red" goes into the details instead.
                  if (detail && specsEditable) {
                    setSpecs((a) => (a.some((x) => x.key.trim().toLowerCase() === detail.label.toLowerCase())
                      ? a : [...a, { key: detail.label, value: detail.value }]));
                  }
                }} />
            )}
            <div className="space-y-2">
              {variants.map((v, i) => {
                const put = (change: Partial<OptionDraft>) =>
                  setVariants((a) => a.map((x, j) => (j === i ? { ...x, ...change } : x)));
                const label = `${v.variant_type || "Option"} ${v.variant_value || i + 1}`.trim();
                return (
                  <div key={i} className={`rounded-lg border border-takal-line p-2 ${v.on ? "bg-white" : "bg-takal-page opacity-70"}`}>
                    <div className="grid grid-cols-[1fr_1fr_70px_90px_28px] gap-1 items-center">
                      <input placeholder="Type (Size)" aria-label={`Option ${i + 1} type`} value={v.variant_type} onChange={(e) => put({ variant_type: e.target.value })} className={smallCls} />
                      <input placeholder="Value (M)" aria-label={`Option ${i + 1} value`} value={v.variant_value} onChange={(e) => put({ variant_value: e.target.value })} className={smallCls} />
                      <input type="number" placeholder="Not counted" aria-label={`Stock of ${label}`} title="Empty = not counted" value={v.stock ?? ""} onChange={(e) => put({ stock: e.target.value })} className={smallCls} />
                      <input type="number" placeholder="Product price" aria-label={`Price of ${label}`}
                        title={pricesLocked ? "Set on the Products tab" : "Empty = the product price"}
                        readOnly={pricesLocked} value={v.price ?? ""} onChange={(e) => put({ price: e.target.value })}
                        className={`${smallCls} ${pricesLocked ? lockedCls : ""}`} />
                      <button type="button" aria-label={`Remove ${label}`} onClick={() => setVariants((a) => a.filter((_, j) => j !== i))} className="text-takal-red hover:opacity-80">✕</button>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input placeholder="Code / barcode (optional)" aria-label={`Code or barcode of ${label}`} value={v.sku ?? ""}
                        onChange={(e) => put({ sku: e.target.value })} className={`${smallCls} flex-1`} />
                      <span className={`text-[11px] font-bold ${v.on ? "text-takal-green" : "text-takal-ink-soft"}`}>{v.on ? "On" : "Off"}</span>
                      <OnOff on={v.on} label={`${v.on ? "Switch off" : "Switch on"} ${label}`} onClick={() => put({ on: !v.on })} />
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={() => setVariants((a) => [...a, { variant_type: "", variant_value: "", stock: "", price: "", sku: "", on: true }])} className="text-sm text-takal-ink hover:text-takal-ink">+ Add option</button>
              {pricesLocked && variants.length > 0 && lockNote}
              {optionsProblem(variants) && <p className="text-xs font-semibold text-takal-red">{optionsProblem(variants)}</p>}
            </div>
          </div>
          )}

          </div>
          <div data-editor-col="more" className="space-y-3 min-w-0">
          <label className="block">
            <span className={labelCls}>Description</span>
            <textarea placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
            {/* Mock 215: the server refuses a phone number or website here - said before Save. */}
            {(() => {
              const found = findContactInfo(`${name}\n${description}`);
              return found.length ? (
                <p data-contact-hint className="mt-1 text-[12px] font-semibold text-takal-red">
                  Phone numbers, websites and WhatsApp are not allowed - customers order through Takal. Please remove: {found.map((h) => h.text).join(", ")}
                </p>
              ) : null;
            })()}
          </label>

          <label className="flex items-center gap-2 text-sm text-takal-ink">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            Available for customers
          </label>

          {canFeature && (
          <label className="flex items-start gap-2 text-sm text-takal-ink">
            <input type="checkbox" className="mt-1" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            {/* The old wording said "shows the Top-Rated badge". That badge also
                lights up for any product from a featured SHOP, or anything
                rated 4.0 and above, so it never told you what this tick-box
                actually did. This says exactly what happens. */}
            {/* One line (MOCK 203 v2); what it does is on the ⓘ. */}
            <span title="Goes to the top of search, its category and the shop's own menu, and carries a yellow 'Featured' tag. Does not change an order the customer sorted themselves.">
              <b>⭐ Featured</b> <span className="cursor-help font-normal text-takal-disabled-text">ⓘ top of search &amp; its shelf</span>
            </span>
          </label>
          )}

          {/* KEY DETAILS (audit 203, A6) - every one, as the shop or the
              catalogue upload typed it: Brand, Weight, Barcode... */}
          <div data-testid="specs-section">
            <span className={labelCls}>Key details <span className="font-normal">- optional · up to {MAX_SPECS} · for example Brand, Weight, Barcode</span></span>
            {!specsEditable ? (
              <p className="rounded-lg bg-takal-page px-3 py-2 text-xs text-takal-ink-soft">
                This product&apos;s details are in a form this box cannot edit. They are kept exactly as they are.
              </p>
            ) : (
              <>
                {specs.length > 0 && (
                  <div className="space-y-1.5">
                    {specs.map((r, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_36px] gap-1.5 items-center">
                        <input aria-label={`Detail ${i + 1} name`} placeholder="Name (Brand)" value={r.key}
                          onChange={(e) => setSpecs((a) => a.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                          className={inputCls} />
                        <input aria-label={`Detail ${i + 1} value`} placeholder="Value" value={r.value}
                          onChange={(e) => setSpecs((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                          className={inputCls} />
                        <button type="button" aria-label={`Remove detail ${r.key || i + 1}`}
                          onClick={() => setSpecs((a) => a.filter((_, j) => j !== i))}
                          className="h-9 w-9 rounded-lg bg-takal-red-soft text-takal-red font-bold hover:opacity-80">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={specs.length >= MAX_SPECS}
                    onClick={() => setSpecs((a) => [...a, { key: "", value: "" }])}
                    className="rounded-lg border-2 border-takal-ink px-3 py-1.5 text-xs font-bold text-takal-ink hover:bg-takal-yellow disabled:opacity-40">
                    ＋ Add a detail
                  </button>
                  {!specs.some((r) => r.key.trim().toLowerCase() === "barcode") && specs.length < MAX_SPECS && (
                    <button type="button" onClick={() => setSpecs((a) => [...a, { key: "Barcode", value: "" }])}
                      className="rounded-lg border border-takal-ink/30 bg-takal-yellow-soft px-2.5 py-1.5 text-xs font-bold text-takal-ink hover:bg-takal-yellow">
                      ＋ Barcode
                    </button>
                  )}
                </div>
                {specsProblem(specs) && <p className="mt-1 text-xs font-semibold text-takal-red">{specsProblem(specs)}</p>}
              </>
            )}
          </div>

          {/* SIZE GUIDE (audit 203, A6) - shown, not edited here: the shop
              keeps it in the Partners app. */}
          {!isRestaurant && (sizeGuide || (editing && wearsSizes(vendorType))) && (
            <div data-testid="size-guide">
              <span className={labelCls}>Size guide <span className="font-normal">- view only · the shop edits it in the Partners app</span></span>
              {sizeGuide && Array.isArray(sizeGuide.columns) && sizeGuide.columns.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-takal-line">
                  <table className="w-full text-xs">
                    <thead className="bg-[#FAFAF7] text-left text-takal-ink-soft">
                      <tr>{sizeGuide.columns.map((c, i) => <th key={i} className="px-2 py-1.5 font-bold">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(sizeGuide.rows || []).map((r, i) => (
                        <tr key={i} className="border-t border-[#F0F0F0]">
                          {(Array.isArray(r) ? r : []).map((v, j) => <td key={j} className="px-2 py-1">{String(v ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-2 py-1 text-[11px] text-takal-ink-soft">Measurements in {sizeGuide.unit === "cm" ? "cm" : "inches"}.</p>
                </div>
              ) : (
                <p className="rounded-lg bg-takal-page px-3 py-2 text-xs text-takal-ink-soft">No size guide yet.</p>
              )}
            </div>
          )}
          </div>
        </div>

        </div>

        {/* What did not save, in the server's own words - it stays until the
            next press, unlike a toast. */}
        {problem && (
          <div role="alert" data-testid="save-problem" className="mx-4 mb-2 rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-2 text-sm font-semibold text-takal-red">
            {problem}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-takal-line bg-[#FAFAFA] px-4 py-2">
          <span className="hidden text-[11.5px] text-takal-ink-soft md:inline">Ctrl + S saves</span>
          <button onClick={onClose} className="ml-auto px-4 py-2 border border-takal-line rounded-lg bg-white hover:bg-takal-page">
            {/* Once the product is made, closing does not cancel it. */}
            {createdId ? "Close" : "Cancel"}
          </button>
          {editing && onSavedNext && nav?.next && (
            <button onClick={() => { andNext.current = true; save(); }} disabled={saving || (editing && !detailLoaded)}
              className="px-4 py-2 border border-takal-line rounded-lg bg-white font-semibold hover:bg-takal-page disabled:opacity-50"
              title="Save, then open the next product">
              Save &amp; next ›
            </button>
          )}
          <button
            onClick={() => { andNext.current = false; save(); }}
            disabled={saving || (editing && !detailLoaded)}
            className="w-[220px] px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text text-takal-ink font-bold rounded-lg"
          >
            {saving
              ? "Saving…"
              : editing && detailFailed
                ? "Locked - Retry above"
                : editing && !detailLoaded
                  ? "Loading…"
                  : editing ? "Save changes" : createdId ? "Save again" : "Add product"}
          </button>
        </div>

        {addShelf !== null && (
          <AddShelfDialog name={addShelf} homes={homes} onClose={() => setAddShelf(null)}
            onAdded={(n, home) => {
              setAddShelf(null);
              pendingShelf.current = { name: n, home };
              setTreeTick((t) => t + 1);
            }} />
        )}
        {/* "Sell at a loss?" - a new product in a fixed-price store whose
            buying price is above what customers pay (audit 203, A5). */}
        <ConfirmDialog
          open={!!lossAsk}
          busy={saving}
          title="Save at a loss?"
          message={lossAsk
            ? `This sells below its buying price (loss ${money(lossAsk.lossEach)} each). Save anyway?`
            : ""}
          confirmLabel="Yes, save anyway"
          cancelLabel="No, change it"
          onCancel={() => setLossAsk(null)}
          onConfirm={() => { setLossAsk(null); save(true); }}
        />
        {/* "Sell at a loss?" for prices typed here (MOCK 203 v2). */}
        <ConfirmDialog
          open={!!priceLoss}
          busy={saving}
          title="Save at a loss?"
          message={priceLoss ? `This sells below its buying price (loss ${money(priceLoss.lossEach)} each). Save anyway?` : ""}
          confirmLabel="Yes, save anyway"
          cancelLabel="No, change it"
          onCancel={() => setPriceLoss(null)}
          onConfirm={async () => {
            const pl = priceLoss;
            setPriceLoss(null);
            if (!pl) return;
            setSaving(true);
            const sent = await sendPrices(pl.changes, true);
            setSaving(false);
            if (sent === "ok") { toast("Saved - sold at a loss, as you chose", "success"); finished(); }
          }}
        />
        {bigOpen && shown.length > 0 && (
          <PictureViewer pictures={shown} start={Math.min(viewPic, shown.length - 1)}
            title={name || "Product"} onClose={() => setBigOpen(false)} />
        )}
      </div>
    </div>
  );
}
