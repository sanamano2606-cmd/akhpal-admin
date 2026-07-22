"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, PackageX, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { toast } from "@/lib/toast";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";

interface LowStockRow {
  store: string;
  store_type: string;
  product: string;
  product_id: string;
  variant_id: string | null;
  option: string | null;
  stock: number | null;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(5);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const rowKey = (r: LowStockRow) => r.variant_id ?? r.product_id;

  const saveStock = async (r: LowStockRow) => {
    const key = rowKey(r);
    const raw = (edits[key] ?? "").trim();
    const val = parseInt(raw, 10);
    if (raw === "" || isNaN(val) || val < 0) {
      toast("Enter a stock number (0 or more)", "error");
      return;
    }
    try {
      setSavingKey(key);
      if (r.variant_id) {
        await apiClient.updateVariantStock(r.variant_id, val);
      } else {
        await apiClient.updateProductStock(r.product_id, val);
      }
      toast("Stock updated", "success");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchLowStock();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update stock", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const fetchLowStock = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getLowStock(threshold)) as any;
      setRows(res?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  const outOfStock = rows.filter((r) => (r.stock ?? 0) <= 0).length;

  const stockBadge = (stock: number | null) => {
    const s = stock ?? 0;
    if (s <= 0)
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
          <PackageX className="w-3 h-3" /> Out of stock
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700">
        <AlertTriangle className="w-3 h-3" /> {s} left
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-600 mt-1">
            Products and options running low across all stores
          </p>
        </div>
        <button
          onClick={fetchLowStock}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-slate-900 rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Summary + threshold control */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Low / out of stock</p>
          <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Out of stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <label className="text-sm text-slate-500">Alert at or below</label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          >
            {[0, 3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n} units
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Store</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Product</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Option</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={5} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-600">
                    🎉 Nothing low on stock at this threshold.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.product_id}-${r.option ?? "base"}-${i}`} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{r.store}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        {verticalEmoji(r.store_type)} {verticalLabel(r.store_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800">{r.product}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.option || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {stockBadge(r.stock)}
                        <input
                          type="number"
                          min="0"
                          placeholder="Set"
                          value={edits[rowKey(r)] ?? ""}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [rowKey(r)]: e.target.value }))
                          }
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-primary-600 outline-none"
                        />
                        <button
                          onClick={() => saveStock(r)}
                          disabled={savingKey === rowKey(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-slate-900 rounded-lg text-xs font-medium"
                          title="Update stock"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {savingKey === rowKey(r) ? "…" : "Set"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
