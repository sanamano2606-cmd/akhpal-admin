"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDialogKeys } from "@/components/ui";
import { CategoryPicker } from "@/components/CategoryPicker";
import { pathLabel } from "@/lib/category-search";
import { isPictureLink, makeCover, movePhoto } from "@/lib/photo-order";

interface VariantRow {
  variant_type: string;
  variant_value: string;
  stock: string;
  price: string;
}

export default function ProductEditorModal({
  restaurantId,
  vendorType,
  product,
  onClose,
  onSaved,
  canFeature = true,
}: {
  restaurantId: string;
  vendorType: string;
  product: any | null; // null = new
  onClose: () => void;
  onSaved: () => void;
  /** False for a Mall's own staff (Mock 133): "Featured" is Takal's to set,
   *  so the tick is not shown and never sent. The server refuses it anyway. */
  canFeature?: boolean;
}) {
  const editing = !!(product && product.id);
  const [saving, setSaving] = useState(false);

  // Escape closes it, and the page behind stops scrolling.
  useDialogKeys(true, onClose, saving);
  const [cats, setCats] = useState<{ id: string; label: string }[]>([]);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [discount, setDiscount] = useState(String(product?.discount_percent ?? 0));
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "");
  const [available, setAvailable] = useState(product?.is_available !== false);
  const [featured, setFeatured] = useState(product?.is_featured === true);
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  // TRUE when the product's photos and options could not be read. Save then
  // leaves both alone instead of replacing them with empty lists. See the
  // catch below and the guard in save().
  const [detailFailed, setDetailFailed] = useState(false);
  // TRUE once the product's photos and options have actually ARRIVED.
  //
  // AUDIT 15 SEPTEMBER 2026. The failed-read guard above covered a read that
  // FAILED, not one that was still on its way. The server sleeps on the free
  // plan and can take 30 seconds to answer; during that time both lists were
  // empty, Save was live, and pressing it replaced every photo and option on
  // the product with nothing - "Product updated". Save now waits for the read.
  const [detailLoaded, setDetailLoaded] = useState(!editing);
  // Same rule for the category list. "No categories for this store type"
  // used to be printed whenever the read failed, so the operator saved the
  // product uncategorised and it never appeared under its heading in the app.
  const [catsFailed, setCatsFailed] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [uploading, setUploading] = useState(false);
  // How many photos are on their way - one spinning square each (Mock 134).
  const [pending, setPending] = useState(0);
  // Photo being dragged, and the square it is over (Mock 134: drag to reorder).
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");

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

  // Flatten the category tree to selectable leaves ("Men > T-shirts").
  useEffect(() => {
    (async () => {
      try {
        const res = (await apiClient.getCategoryTree(vendorType)) as any;
        const tree = (res?.tree as any[]) || [];
        const leaves: { id: string; label: string }[] = [];
        const walk = (nodes: any[], prefix: string) => {
          for (const n of nodes) {
            const label = prefix ? pathLabel([prefix, n.name]) : n.name;
            if (Array.isArray(n.children) && n.children.length) walk(n.children, label);
            else leaves.push({ id: String(n.id), label });
          }
        };
        for (const top of tree) {
          if (Array.isArray(top.children) && top.children.length) walk(top.children, "");
          else leaves.push({ id: String(top.id), label: top.name });
        }
        setCats(leaves);
        setCatsFailed(false);
      } catch {
        // A FAILED READ MUST NOT BECOME A FACT ABOUT THE CATALOGUE.
        setCats([]);
        setCatsFailed(true);
      }
    })();
  }, [vendorType]);

  // Load full product (photos, variants, specs) when editing.
  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        setDetailFailed(false);
        setDetailLoaded(false);
        const full = (await apiClient.getProduct(String(product.id))) as any;
        const imgs = (full?.images as any[]) || [];
        setPhotos(imgs.map((i) => String(i.url)).filter(Boolean));
        const vs = (full?.variants as any[]) || [];
        setVariants(
          vs.map((v) => ({
            variant_type: v.variant_type ?? "",
            variant_value: v.variant_value ?? "",
            stock: v.stock_quantity != null ? String(v.stock_quantity) : "",
            price: v.price_override != null ? String(v.price_override) : "",
          }))
        );
        if (full?.category_id) setCategoryId(String(full.category_id));
        if (full?.description != null) setDescription(full.description);
        if (full?.is_featured != null) setFeatured(full.is_featured === true);
        setDetailLoaded(true);
      } catch {
        // THE READ FAILED, AND THAT CHANGES WHAT SAVE IS ALLOWED TO DO.
        //
        // Before 3 September 2026 this said "keep basics" and carried on. The
        // photo list and the variant list stayed EMPTY, nothing on the screen
        // said so, and Save then wrote those empty lists back — deleting every
        // photograph and every size/colour option on the product, while the
        // toast said "Product updated".
        //
        // On the free plan the server sleeps after 15 minutes, so a failed
        // first read is not a rare event. This flag makes Save skip both lists
        // rather than overwrite them with nothing.
        setDetailFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = async () => {
    // Still reading this product's photos and options - see detailLoaded.
    if (editing && !detailLoaded && !detailFailed) {
      toast("Still loading this product's photos and options — one moment", "error");
      return;
    }
    if (!name.trim() || price.trim() === "") {
      toast("Name and price are required", "error");
      return;
    }
    const payload: any = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      discount_percent: Math.max(0, Math.min(100, parseInt(discount) || 0)),
      is_available: available,
    };
    if (stock.trim() !== "") payload.stock = parseInt(stock) || 0;
    if (categoryId) payload.category_id = categoryId;

    try {
      setSaving(true);
      let productId = editing ? String(product.id) : "";
      if (editing) {
        await apiClient.updateMenuItem(productId, payload);
      } else {
        const res = (await apiClient.createProduct(restaurantId, payload)) as any;
        productId = String(res?.item?.id || "");
      }
      if (!productId) throw new Error("Could not save the product");

      // THE TWO WRITES THAT REPLACE A WHOLE LIST.
      //
      // setProductImages and setProductVariants do not add — they REPLACE. So
      // sending them a list this screen never managed to read is the same as
      // pressing delete on it. When the detail read failed, both are skipped
      // and the product keeps what it already had.
      if (!detailFailed) {
        const imgs = photos
          .map((u) => u.trim())
          .filter(Boolean)
          .map((url, i) => ({ url, position: i }));
        await apiClient.setProductImages(productId, imgs);

        const vs = variants
          .filter((v) => v.variant_type.trim() && v.variant_value.trim())
          .map((v) => {
            const o: any = { variant_type: v.variant_type.trim(), variant_value: v.variant_value.trim() };
            if (v.stock.trim() !== "") o.stock_quantity = parseInt(v.stock) || 0;
            if (v.price.trim() !== "") o.price_override = parseFloat(v.price);
            return o;
          });
        await apiClient.setProductVariants(productId, vs);
      }

      // Featured is admin-only (separate endpoint from the product update).
      let featuredFailed = false;
      if (canFeature) try {
        await apiClient.setProductFeatured(productId, featured);
      } catch {
        // Not fatal — the rest of the product did save. But it is not nothing
        // either: the tick did not apply, and saying "Product updated" without
        // mentioning it is how somebody comes back a week later wondering why
        // their featured item never appeared.
        featuredFailed = true;
      }

      toast(
        featuredFailed
          ? "Saved, but the Featured setting did not apply — try that one again"
          : detailFailed
            ? "Text and price saved. Photos and options were left as they were, because they could not be read."
            : editing
              ? "Product updated"
              : "Product added",
        featuredFailed || detailFailed ? "error" : "success",
      );
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";
  const labelCls = "mb-1 block text-xs font-semibold text-takal-ink-soft";
  const shown = photos.filter((u) => u.trim());

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-takal-ink mb-4">{editing ? "Edit product" : "Add product"}</h2>

        {/* SAID BEFORE THE SAVE, NOT AFTER IT.
            A toast that arrives once the button has been pressed is too late to
            change anybody's mind. */}
        {detailFailed && (
          <div className="mb-4 rounded-lg border-l-4 border-takal-orange bg-takal-orange-soft px-4 py-3 text-sm text-[#C8410F]">
            <strong>This product&apos;s photos and options could not be read.</strong>{" "}
            You can still change the name, price and stock — they will save
            normally. The photos and the size/colour options below are shown
            empty because they did not load, and they will be{" "}
            <strong>left exactly as they are</strong> rather than replaced.
            Close this and open it again to edit them.
          </div>
        )}

        <div className="space-y-3">
          {/* LABELS ABOVE EVERY BOX (Mock 134 extra). A placeholder vanishes
              the moment something is typed, and then "1450" and "10" look
              alike - which one is the price? */}
          <label className="block">
            <span className={labelCls}>Name</span>
            <input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Description</span>
            <textarea placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Price (Rs)</span>
              <input type="number" placeholder="Price (Rs)" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Discount %</span>
              <input type="number" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Stock</span>
              <input type="number" placeholder="Blank = not counted" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
            </label>
            <div>
            <span className={labelCls}>Category</span>
            {cats.length > 0 ? (
              <CategoryPicker options={cats} value={String(categoryId || "")} onChange={setCategoryId}
                emptyLabel="No category" ariaLabel="Category" />
            ) : catsFailed ? (
              <div className="text-xs text-[#C8410F] self-center">
                The category list could not be read. Close and reopen this box —
                do not save yet, or the product goes in with no category.
              </div>
            ) : (
              <div className="text-xs text-takal-disabled-text self-center">No categories for this store type</div>
            )}
            </div>
          </div>

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
            <span>
              <b>⭐ Featured</b>
              <br />
              <span className="font-normal text-takal-disabled-text">
                Goes to the top of search, its category and the shop&rsquo;s own menu, and
                carries a yellow &ldquo;Featured&rdquo; tag. Does not change an order the
                customer sorted themselves.
              </span>
            </span>
          </label>
          )}

          {/* PHOTOS, EACH SHOWN ONCE (Mock 134, approved 1 Oct 2026 - audit SM15).
              They used to be shown twice: as a picture AND as a box of
              computer text underneath. Now: squares only. The first is the
              cover. Drag to change the order - and because dragging does not
              work with a finger on a phone, every other square also has a
              "Make cover" star. A pasted link becomes a square too. */}
          <div>
            <span className={labelCls}>Photos — the first is the cover. Drag to change the order.</span>
            <div
              className="flex flex-wrap gap-2.5"
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
                  className={`group relative h-20 w-20 cursor-grab overflow-hidden rounded-xl border bg-white ${
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
                      className="absolute inset-x-0 bottom-0 bg-white/90 py-0.5 text-center text-[10.5px] font-bold text-takal-ink hover:bg-takal-yellow">
                      ★ Make cover
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
                <div key={`up-${k}`} aria-label="Uploading" className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-takal-line bg-[#F3F3F3]">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#E1E1E1] border-t-takal-green border-r-takal-green" />
                </div>
              ))}
              <label className={`flex h-20 w-20 flex-col items-center justify-center rounded-xl border-[2.5px] border-dashed border-[#C9C600] bg-takal-yellow-soft text-[#6B6900] ${
                uploading ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-takal-yellow"}`}>
                <span className="text-xl leading-none">＋</span>
                <span className="mt-1 text-[10.5px] font-bold">Add photos</span>
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

          {/* Variants */}
          <div>
            <p className="text-sm font-medium text-takal-ink mb-1">Options (size / colour — each with its own stock)</p>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_70px_80px_28px] gap-1 items-center">
                  <input placeholder="Type (Size)" value={v.variant_type} onChange={(e) => setVariants((a) => a.map((x, j) => (j === i ? { ...x, variant_type: e.target.value } : x)))} className="px-2 py-1.5 border border-takal-line rounded text-sm" />
                  <input placeholder="Value (M)" value={v.variant_value} onChange={(e) => setVariants((a) => a.map((x, j) => (j === i ? { ...x, variant_value: e.target.value } : x)))} className="px-2 py-1.5 border border-takal-line rounded text-sm" />
                  <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariants((a) => a.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} className="px-2 py-1.5 border border-takal-line rounded text-sm" />
                  <input type="number" placeholder="Price" value={v.price} onChange={(e) => setVariants((a) => a.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="px-2 py-1.5 border border-takal-line rounded text-sm" />
                  <button onClick={() => setVariants((a) => a.filter((_, j) => j !== i))} className="text-red-600 hover:text-red-700">✕</button>
                </div>
              ))}
              <button onClick={() => setVariants((a) => [...a, { variant_type: "", variant_value: "", stock: "", price: "" }])} className="text-sm text-takal-ink hover:text-takal-ink">+ Add option</button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
          <button
            onClick={save}
            disabled={saving || (editing && !detailLoaded && !detailFailed)}
            className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text text-takal-ink rounded-lg"
          >
            {saving
              ? "Saving…"
              : editing && !detailLoaded && !detailFailed
                ? "Loading…"
                : editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>
    </div>
  );
}
