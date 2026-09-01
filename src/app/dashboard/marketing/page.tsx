"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { moneyExact, fmtDate } from "@/lib/format";
import { ErrorState } from "@/components/ui";

export default function PromosPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  // The promo being edited, or null when the form is creating a new one. The
  // SAME form does both: two forms would drift apart, and the one that is
  // used less would be the one that quietly lost a field.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    free_delivery: false,
    min_order: "",
    max_discount: "",
    max_uses: "",
    max_uses_per_user: "",
    expires_at: "",
    description: "",
  });

  const blank = {
    code: "",
    discount_percent: "",
    free_delivery: false,
    min_order: "",
    max_discount: "",
    max_uses: "",
    max_uses_per_user: "",
    expires_at: "",
    description: "",
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  };

  const startEdit = (p: any) => {
    setEditingId(String(p.id));
    setForm({
      code: p.code ?? "",
      discount_percent: p.percent_off != null ? String(p.percent_off) : "",
      free_delivery: p.free_delivery === true,
      min_order: p.min_order != null ? String(p.min_order) : "",
      max_discount: p.max_discount != null ? String(p.max_discount) : "",
      max_uses: p.max_uses != null ? String(p.max_uses) : "",
      max_uses_per_user:
        p.max_uses_per_user != null ? String(p.max_uses_per_user) : "",
      // The date input wants YYYY-MM-DD; the server sends a full timestamp.
      expires_at: p.expires_at ? String(p.expires_at).slice(0, 10) : "",
      description: p.description ?? "",
    });
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && !form.code.trim()) {
      toast("Enter a code", "error");
      return;
    }
    if (!form.discount_percent && !form.free_delivery) {
      toast("Enter a discount %, or tick Free delivery — otherwise the code does nothing", "error");
      return;
    }

    // EMPTY MEANS "NO LIMIT", AND IT HAS TO BE SENT AS null.
    // Leaving a cleared box out of the payload would keep the old number, so
    // a limit could be typed in but never taken out again.
    const numOrNull = (v: string) => (v.trim() === "" ? null : parseInt(v));
    // Rupees, not a count — a ceiling of Rs 249.50 has to survive.
    const moneyOrNull = (v: string) => (v.trim() === "" ? null : parseFloat(v));

    const payload: any = {
      discount_percent: form.discount_percent ? parseInt(form.discount_percent) : null,
      free_delivery: form.free_delivery,
      min_order: form.min_order ? parseFloat(form.min_order) : 0,
      max_discount: moneyOrNull(form.max_discount),
      max_uses: numOrNull(form.max_uses),
      max_uses_per_user: numOrNull(form.max_uses_per_user),
      expires_at: form.expires_at || null,
      description: form.description || null,
    };

    try {
      setCreating(true);
      if (editingId) {
        await apiClient.updatePromo(editingId, payload);
        toast("Promo updated", "success");
      } else {
        await apiClient.createPromo({ ...payload, code: form.code.trim().toUpperCase() });
        toast("Promo created", "success");
      }
      setForm(blank);
      setEditingId(null);
      setShowForm(false);
      await fetchPromos();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the promo", "error");
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
          <h2 className="text-xl font-bold text-takal-ink">Discount Codes</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">Codes customers type at checkout for money off or free delivery.</p>
        </div>
        <button onClick={startCreate} className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition">
          + New Promo
        </button>
      </div>

      {error && <ErrorState message={error} />}

      {showForm && (
        <form onSubmit={save} className="bg-white rounded-lg border border-takal-line p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Code *</label>
            {/* The code cannot be changed after the promo is created: customers may
                already have written it down, and the server does not accept a new
                code on an edit. To rename one, delete it and make a new one. */}
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editingId} placeholder="EID20"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none uppercase disabled:bg-slate-100 disabled:text-takal-ink-soft" />
            {editingId && (
              <p className="text-xs text-takal-ink-soft mt-1">The code itself cannot be changed. Delete it and create a new one to rename.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Discount %</label>
            <input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} placeholder="20"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
          </div>
          {/* Free delivery: waives the CUSTOMER's delivery charge only. The
              rider is still paid in full and the platform covers it, which shows
              up as "platform subsidy" on the Pay Out page. */}
          <div className="md:col-span-2">
            <label className="flex items-start gap-3 p-3 border border-takal-line rounded-lg cursor-pointer hover:bg-takal-page">
              <input
                type="checkbox"
                checked={form.free_delivery}
                onChange={(e) => setForm({ ...form, free_delivery: e.target.checked })}
                className="mt-0.5 w-4 h-4"
              />
              <span>
                <span className="block text-sm font-medium text-takal-ink">Free delivery</span>
                <span className="block text-xs text-takal-ink-soft mt-0.5">
                  The customer pays nothing for delivery. Your rider is still paid
                  in full — you cover it. Can be used on its own, or together with
                  a discount %.
                </span>
              </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Minimum order (Rs)</label>
            <input type="number" min={0} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="500"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              The bill must be at least this much before the code works.
            </p>
          </div>
          {/* THE CEILING ON WHAT A DISCOUNT CAN COST.
              A percentage grows with the bill: 50% of Rs 10,000 is Rs 5,000.
              This caps the giveaway without refusing the order, so a big
              customer still gets a discount and the loss stays predictable.
              The server already applies it (core._validate_promo) — only this
              box was missing, which is why it could never be set. */}
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Maximum discount (Rs)</label>
            <input type="number" min={1} step="any" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} placeholder="Leave empty = no ceiling"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              The most you will ever give away with this code, however big the
              order. 50% of a Rs 5,000 bill is Rs 2,500 — this box stops that.
              The customer is never refused, the discount just stops growing.
              Empty means no ceiling. Free delivery is separate and is not capped.
            </p>
          </div>
          {/* THE TWO LIMITS ARE DIFFERENT THINGS AND WERE EASY TO MIX UP.
              "Total uses" is one shared pot for the whole city. "Uses per customer"
              is how many times each person may use it. A first-order offer needs
              the SECOND box set to 1, not the first. */}
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Total uses — everyone together (optional)</label>
            <input type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Leave empty = no limit"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              One shared pot. Put 100 here and the code stops working after 100 orders
              in total across all customers. Empty means no limit.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Uses per customer (optional)</label>
            <input type="number" min={1} value={form.max_uses_per_user} onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })} placeholder="Leave empty = no limit"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              How many times EACH person may use it. For a &quot;first order only&quot;
              offer put <strong>1</strong> here and leave the box above empty.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Expires on (optional)</label>
            <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Eid promotion"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50">
              {creating ? "Saving..." : editingId ? "Save changes" : "Create Promo"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Code</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Min Order</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Max Discount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Uses (all)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Per customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Expires</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-takal-ink-soft">Loading...</td></tr>
              ) : promos.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-takal-ink-soft">No promo codes yet</td></tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-6 py-4 text-sm font-bold text-takal-ink">{p.code}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {p.percent_off ? `${p.percent_off}%` : p.amount_off ? moneyExact(p.amount_off) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{p.min_order ? moneyExact(p.min_order) : "—"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{p.max_discount ? moneyExact(p.max_discount) : "no ceiling"}</td>
                    {/* Shown as used / allowed so it is obvious at a glance when a
                        code has run out, instead of only showing the cap. */}
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {(p.times_used ?? 0)} / {p.max_uses ?? "\u221e"}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{p.max_uses_per_user ?? "\u221e"}</td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">{fmtDate(p.expires_at)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${p.is_active === false ? "bg-slate-100 text-takal-ink-soft" : "bg-green-50 text-green-700"}`}>
                        {p.is_active === false ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(p)} className="text-takal-ink hover:text-takal-ink font-medium">
                          Edit
                        </button>
                        <button onClick={() => toggle(p)} className="text-takal-ink hover:text-takal-ink font-medium">
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
