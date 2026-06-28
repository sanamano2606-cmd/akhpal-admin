"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export default function PromosPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    min_order: "",
    max_uses: "",
    expires_at: "",
    description: "",
  });

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getPromos()) as any;
      setPromos(res?.promos || res?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast("Enter a code", "error");
      return;
    }
    const payload: any = { code: form.code.trim().toUpperCase() };
    if (form.discount_percent) payload.discount_percent = parseInt(form.discount_percent);
    if (form.min_order) payload.min_order = parseFloat(form.min_order);
    if (form.max_uses) payload.max_uses = parseInt(form.max_uses);
    if (form.expires_at) payload.expires_at = form.expires_at;
    if (form.description) payload.description = form.description;
    try {
      setCreating(true);
      await apiClient.createPromo(payload);
      toast("Promo created", "success");
      setForm({ code: "", discount_percent: "", min_order: "", max_uses: "", expires_at: "", description: "" });
      setShowForm(false);
      await fetchPromos();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create promo", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (p: any) => {
    try {
      await apiClient.updatePromo(String(p.id), { is_active: !(p.is_active !== false) });
      toast(p.is_active !== false ? "Promo disabled" : "Promo enabled", "success");
      await fetchPromos();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update promo", "error");
    }
  };

  const remove = async (p: any) => {
    if (!window.confirm(`Delete promo ${p.code}?`)) return;
    try {
      await apiClient.deletePromo(String(p.id));
      toast("Promo deleted", "success");
      await fetchPromos();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete promo", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Promo Codes</h1>
          <p className="text-slate-600 mt-1">Create and manage discount codes</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
          + New Promo
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>}

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-lg border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="EID20"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none uppercase" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label>
            <input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} placeholder="20"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Minimum order (Rs)</label>
            <input type="number" min={0} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="500"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max uses (optional)</label>
            <input type="number" min={0} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="100"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expires on (optional)</label>
            <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Eid promotion"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50">
              {creating ? "Creating..." : "Create Promo"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Code</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Min Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Uses</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Expires</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : promos.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-600">No promo codes yet</td></tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.code}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {p.percent_off ? `${p.percent_off}%` : p.amount_off ? `Rs ${p.amount_off}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.min_order ? `Rs ${p.min_order}` : "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.max_uses ?? "∞"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${p.is_active === false ? "bg-slate-100 text-slate-600" : "bg-green-50 text-green-700"}`}>
                        {p.is_active === false ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <button onClick={() => toggle(p)} className="text-primary-600 hover:text-primary-700 font-medium">
                          {p.is_active === false ? "Enable" : "Disable"}
                        </button>
                        <button onClick={() => remove(p)} className="text-red-600 hover:text-red-700" title="Delete">
                          <Trash2 className="w-4 h-4" />
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
