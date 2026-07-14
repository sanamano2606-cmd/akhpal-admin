"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// Verticals a promo can link to (matches the customer app's kVerticals).
const VERTICALS = [
  ["restaurant", "Food / Restaurants"],
  ["grocery", "Grocery"],
  ["pharmacy", "Pharmacy"],
  ["clothing_store", "Fashion"],
  ["electronics_shop", "Electronics"],
  ["home_appliances", "Home"],
  ["beauty_cosmetics", "Beauty"],
  ["bakery", "Bakery"],
  ["books_stationery", "Books"],
  ["flowers_gifts", "Gifts"],
  ["pet_supplies", "Pets"],
  ["sports_fitness", "Sports"],
  ["jewelry_accessories", "Jewelry"],
  ["toys_games", "Toys"],
  ["laundry_cleaning", "Laundry"],
  ["garden_plants", "Garden"],
];

type Banner = any;

const blank = {
  title: "",
  subtitle: "",
  emoji: "",
  color1: "#7C3AED",
  color2: "#4F46E5",
  image_url: "",
  cta_text: "Order Now",
  action_type: "none",
  action_value: "",
  sort_order: 0,
  is_active: true,
};

export default function HomeBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = (await apiClient.getPromoBanners()) as any;
      setBanners(res?.banners || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load banners", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (b: Banner) => {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    try {
      await apiClient.deletePromoBanner(String(b.id));
      toast("Banner deleted", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Home Banners</h1>
          <p className="text-slate-600 mt-1">
            The promo cards shown at the top of the customer app home screen.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...blank, sort_order: (banners.length + 1) })}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
        >
          + Add banner
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : banners.length === 0 ? (
        <div className="text-slate-500 bg-white rounded-lg border border-slate-200 p-8 text-center">
          No banners yet. Click “Add banner” to create one.
        </div>
      ) : (
        <div className="grid gap-4">
          {banners.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-4"
            >
              {/* Live-ish preview */}
              <div
                className="w-40 h-20 rounded-lg overflow-hidden shrink-0 flex items-center px-3 text-white"
                style={
                  b.image_url
                    ? { backgroundImage: `url(${b.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: `linear-gradient(135deg, ${b.color1}, ${b.color2})` }
                }
              >
                <div className="drop-shadow">
                  <div className="text-sm font-bold leading-tight">{b.title}</div>
                  <div className="text-[10px] opacity-90 leading-tight">{b.subtitle}</div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{b.title}</div>
                <div className="text-xs text-slate-500">
                  Order {b.sort_order} ·{" "}
                  {b.is_active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-slate-400">Hidden</span>
                  )}
                  {b.action_type === "vertical" && b.action_value
                    ? ` · opens ${b.action_value}`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => setEditing(b)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={() => remove(b)}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BannerEditor
          banner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BannerEditor({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!banner.id;
  const [f, setF] = useState<Banner>({ ...blank, ...banner });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: string, v: any) => setF((p: Banner) => ({ ...p, [k]: v }));

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Image is over 5 MB", "error");
      return;
    }
    setUploading(true);
    try {
      const res = (await apiClient.uploadImage(file)) as any;
      if (res?.url) set("image_url", res.url);
      toast("Image uploaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!f.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    const payload = {
      title: f.title.trim(),
      subtitle: f.subtitle?.trim() || "",
      emoji: f.emoji?.trim() || "",
      color1: f.color1,
      color2: f.color2,
      image_url: f.image_url?.trim() || "",
      cta_text: f.cta_text?.trim() || "Order Now",
      action_type: f.action_type || "none",
      action_value: f.action_type === "vertical" ? f.action_value || "" : "",
      sort_order: parseInt(String(f.sort_order)) || 0,
      is_active: !!f.is_active,
    };
    try {
      setSaving(true);
      if (editing) await apiClient.updatePromoBanner(String(banner.id), payload);
      else await apiClient.createPromoBanner(payload);
      toast(editing ? "Banner updated" : "Banner added", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          {editing ? "Edit banner" : "Add banner"}
        </h2>

        {/* Preview */}
        <div
          className="h-24 rounded-xl mb-4 flex items-center px-4 text-white"
          style={
            f.image_url
              ? { backgroundImage: `url(${f.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${f.color1}, ${f.color2})` }
          }
        >
          <div className="drop-shadow">
            <div className="text-lg font-extrabold leading-tight">{f.title || "Title"}</div>
            <div className="text-xs opacity-90">{f.subtitle}</div>
          </div>
        </div>

        <div className="space-y-3">
          <input placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} className={input} />
          <input placeholder="Subtitle" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={input} />

          <div className="grid grid-cols-3 gap-3 items-center">
            <label className="text-sm text-slate-600">Colors</label>
            <div className="flex items-center gap-2">
              <input type="color" value={f.color1} onChange={(e) => set("color1", e.target.value)} className="w-10 h-9 rounded border" />
              <span className="text-xs text-slate-500">Start</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={f.color2} onChange={(e) => set("color2", e.target.value)} className="w-10 h-9 rounded border" />
              <span className="text-xs text-slate-500">End</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Emoji (optional, e.g. 🛍️)" value={f.emoji} onChange={(e) => set("emoji", e.target.value)} className={input} />
            <input placeholder="Button text" value={f.cta_text} onChange={(e) => set("cta_text", e.target.value)} className={input} />
          </div>

          {/* Image */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-slate-700">
                Background image <span className="font-normal text-slate-400">(optional — overrides colors)</span>
              </p>
              <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "bg-slate-200 text-slate-500" : "bg-primary-600 hover:bg-primary-700 text-white"}`}>
                {uploading ? "Uploading…" : "＋ Upload"}
                <input type="file" accept="image/*" disabled={uploading} className="hidden" onChange={(e) => { upload(e.target.files?.[0] || null); e.target.value = ""; }} />
              </label>
            </div>
            {f.image_url ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.image_url} alt="banner" className="w-24 h-12 object-cover rounded border" />
                <button type="button" onClick={() => set("image_url", "")} className="text-sm text-red-600">Remove image</button>
              </div>
            ) : (
              <input placeholder="…or paste an image URL" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} className={input} />
            )}
          </div>

          {/* Action */}
          <div className="grid grid-cols-2 gap-3">
            <select value={f.action_type} onChange={(e) => set("action_type", e.target.value)} className={input}>
              <option value="none">Tap: go to Categories</option>
              <option value="vertical">Tap: open a category</option>
            </select>
            {f.action_type === "vertical" && (
              <select value={f.action_value} onChange={(e) => set("action_value", e.target.value)} className={input}>
                <option value="">Choose a category…</option>
                {VERTICALS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Order</label>
              <input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Active (visible in app)
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-lg">
            {saving ? "Saving…" : editing ? "Save changes" : "Add banner"}
          </button>
        </div>
      </div>
    </div>
  );
}
