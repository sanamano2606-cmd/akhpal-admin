"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useDialogKeys } from "@/components/ui";

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
}: {
  restaurantId: string;
  vendorType: string;
  product: any | null; // null = new
  onClose: () => void;
  onSaved: () => void;
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
  // Same rule for the category list. "No categories for this store type"
  // used to be printed whenever the read failed, so the operator saved the
  // product uncategorised and it never appeared under its heading in the app.
  const [catsFailed, setCatsFailed] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [uploading, setUploading] = useState(false);

  // Upload one or more images picked from the device; append their URLs.
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast(`${file.name} is over 5 MB — skipped`, "error");
          continue;
        }
        const res = await apiClient.uploadImage(file);
        if (res?.url) urls.push(res.url);
      }
      if (urls.length) {
        setPhotos((p) => [...p.filter((u) => u.trim()), ...urls]);
        toast(`${urls.length} photo${urls.length > 1 ? "s" : ""} uploaded`, "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
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
            const label = prefix ? `${prefix} > ${n.name}` : n.name;
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
      try {
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
          <input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />

          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Price (Rs)" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            <input type="number" placeholder="Discount %" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Stock (blank = unlimited)" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
            {cats.length > 0 ? (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">No category</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            ) : catsFailed ? (
              <div className="text-xs text-[#C8410F] self-center">
                The category list could not be read. Close and reopen this box —
                do not save yet, or the product goes in with no category.
              </div>
            ) : (
              <div className="text-xs text-takal-disabled-text self-center">No categories for this store type</div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-takal-ink">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            Available for customers
          </label>

          <label className="flex items-center gap-2 text-sm text-takal-ink">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <span>⭐ Featured / Top-Rated <span className="font-normal text-takal-disabled-text">(shows the Top-Rated badge)</span></span>
          </label>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-takal-ink">Photos <span className="font-normal text-takal-disabled-text">(first is the cover)</span></p>
              <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "bg-slate-200 text-takal-ink-soft cursor-wait" : "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink"}`}>
                {uploading ? "Uploading…" : "＋ Upload from device"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
            </div>

            {/* Thumbnail previews */}
            {photos.filter((u) => u.trim()).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((url, i) =>
                  url.trim() ? (
                    <div key={`thumb-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-takal-line group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center leading-tight py-0.5">Cover</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Optional: paste an image URL instead */}
            <div className="space-y-2">
              {photos.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="…or paste an image URL" value={url} onChange={(e) => setPhotos((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="px-2 text-red-600 hover:text-red-700">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => setPhotos((p) => [...p, ""])} className="text-sm text-takal-ink hover:text-takal-ink">+ Add photo URL</button>
            </div>
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
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg">
            {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>
    </div>
  );
}
