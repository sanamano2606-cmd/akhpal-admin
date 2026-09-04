"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
// AMOUNTS USE money(); moneyExact IS FOR A RATE OR A SETTING.
// "Given away" and "Order over" are amounts of rupees, and they were the
// only place in the panel printing "Rs 1,234.5" while every other screen
// printed "Rs 1,235" for the same money. A minimum-order threshold is a
// setting, so it keeps moneyExact; the totals do not.
import { money, moneyExact } from "@/lib/format";
import { Badge, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { PROMO_STATUS } from "@/lib/marketing";
import { DeleteOrDisableDialog } from "./parts-promo-dialogs";
import { PromoCostPanel } from "./parts-promo-cost";

export default function PromosPage() {
  const [promos, setPromos] = useState<any[]>([]);
  // The three header figures, worked out by the SERVER from the redemption
  // rows. The panel does not add anything up itself: two places adding up the
  // same money is how they end up disagreeing.
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  // The code the delete/disable window is open on, and the one whose cost
  // screen is open. Never both.
  const [removing, setRemoving] = useState<any>(null);
  const [showingCost, setShowingCost] = useState<any>(null);
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
    starts_at: "",
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
    starts_at: "",
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
      starts_at: p.starts_at ? String(p.starts_at).slice(0, 10) : "",
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
      setError(null);
      const res = (await apiClient.getPromos()) as any;
      setPromos(res?.promos || res?.data || []);
      setSummary(res || {});
    } catch (err) {
      setError(readFailure(err, "the promo codes"));
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
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      description: form.description || null,
    };

    try {
      setCreating(true);
      if (editingId) {
        await apiClient.updatePromo(editingId, payload);
        toast("Discount code updated", "success");
      } else {
        await apiClient.createPromo({ ...payload, code: form.code.trim().toUpperCase() });
        toast("Discount code created", "success");
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
      toast(p.is_active !== false ? "Discount code switched off" : "Discount code switched on", "success");
      await fetchPromos();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update promo", "error");
    }
  };

  // NO window.confirm HERE ANY MORE.
  //
  // It used to be `confirm("Delete promo TAKAL1?")` — four words in a grey
  // browser box, in front of an action that deleted the only record of what
  // that code had cost. The window this opens reads the real numbers first and
  // offers "disable" instead when the code has been used at all.
  const remove = (p: any) => setRemoving(p);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Discount Codes</h2>
          {/* THE THREE NUMBERS THAT MATTER, said before the table.
              "Given away" is the sum of real redemptions. "No end date and no
              budget" is Sana's own open cheque, counted rather than left for
              her to spot. */}
          <p className="text-takal-ink-soft mt-1 text-sm">
            {promos.length} code{promos.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-takal-ink">
              {money(summary.given_away_total ?? 0)}
            </strong>{" "}
            given away so far
            {summary.open_cheque_count > 0 && (
              <>
                {" · "}
                <strong className="text-takal-red">
                  {summary.open_cheque_count} with no expiry and no limit
                </strong>
              </>
            )}
          </p>
        </div>
        <button onClick={startCreate} className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition">
          + New discount code
        </button>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchPromos} denied={error.denied} />
      )}

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
          {/* A CODE CAN NOW BE WRITTEN IN ADVANCE.
              There was only an end date, so an Eid code was live the second it
              was saved or it did not exist. The till refuses a code before its
              start date, and the home screen does not advertise it. */}
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Starts on (optional)</label>
            <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              Leave empty and the code works the moment you save it. Put a date
              here to write it now and have it start by itself on that morning.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Expires on (optional)</label>
            <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
            <p className="text-xs text-takal-ink-soft mt-1">
              Empty means it never stops. With no total-use limit either, that
              is a code with no ceiling on what it can cost.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-takal-ink mb-1">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Eid promotion"
              className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none" />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50">
              {creating ? "Saving…" : editingId ? "Save changes" : "Create discount code"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
          </div>
        </form>
      )}

      {/* THE TABLE THAT USED TO BE WRONG ABOUT BOTH LIVE CODES.
          There was a single "Discount" column, read from one database field.
          FIRST5 (free delivery) showed a dash, and TAKAL1 (50% up to Rs 1,000
          AND free delivery) showed "50%" — smaller than the offer being given
          away. A code can give more than one thing, so the column is a LIST,
          and the server is the one that fills it in. */}
      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Code</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">What it gives</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Conditions</th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Used</th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Cost so far</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Runs</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-takal-ink-soft">Loading…</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-takal-ink-soft">
                    The promo codes could not be read, so nothing can be listed here.
                    Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : promos.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-takal-ink-soft">No promo codes yet</td></tr>
              ) : (
                promos.map((p) => {
                  const status = PROMO_STATUS[p.status] || PROMO_STATUS.off;
                  return (
                  <tr key={p.id} className="border-b border-takal-line hover:bg-takal-page align-top">
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-takal-ink">{p.code}</div>
                      {p.description && (
                        <div className="text-xs text-takal-ink-soft mt-0.5">{p.description}</div>
                      )}
                    </td>

                    {/* EVERY part of the offer, not the first one that fits. */}
                    <td className="px-5 py-4">
                      {p.gives_nothing ? (
                        <span className="text-sm font-medium text-takal-red">
                          Gives nothing — takes nothing off the bill
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(p.gives || []).map((g: string) => (
                            <span key={g} className="inline-flex items-center rounded-full bg-takal-page px-2.5 py-1 text-xs font-medium text-takal-ink ring-1 ring-inset ring-takal-line">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-takal-ink-soft">
                      <div>{p.min_order ? `Order over ${moneyExact(p.min_order)}` : "Any order"}</div>
                      <div className="text-xs mt-0.5">
                        {p.max_uses_per_user ? `${p.max_uses_per_user} per customer` : "No limit per customer"}
                        {p.max_uses ? ` · ${p.max_uses} in total` : ""}
                      </div>
                    </td>

                    {/* Read from the redemption rows, which are the only place
                        a discount is written down. */}
                    <td className="px-5 py-4 text-right text-sm font-bold text-takal-ink">
                      {p.cost_readable === false ? "?" : (p.used ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-takal-ink">
                      {p.cost_readable === false ? "could not read" : moneyExact(p.given_away ?? 0)}
                    </td>

                    <td className="px-5 py-4 text-sm text-takal-ink-soft">
                      {(p.window || "").split(" - ").map((half: string, i: number) => (
                        <div key={i} className={half === "no end date" ? "font-bold text-takal-red" : ""}>
                          {half}
                        </div>
                      ))}
                    </td>

                    {/* The SERVER decides this. The old screen read is_active
                        alone, so a code that expired last month showed a green
                        "Active". */}
                    <td className="px-5 py-4">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => startEdit(p)} className="font-medium text-takal-ink hover:underline">
                          Edit
                        </button>
                        <button onClick={() => setShowingCost(p)} className="font-medium text-takal-ink hover:underline">
                          What it cost
                        </button>
                        <button onClick={() => toggle(p)} className="font-medium text-takal-ink hover:underline">
                          {p.is_active === false ? "Enable" : "Disable"}
                        </button>
                        <button onClick={() => remove(p)} className="text-takal-red hover:opacity-80" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {removing && (
        <DeleteOrDisableDialog
          promo={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            fetchPromos();
          }}
        />
      )}

      {showingCost && (
        <PromoCostPanel promo={showingCost} onClose={() => setShowingCost(null)} />
      )}

    </div>
  );
}
