"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Building2, X, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Takal offices (hubs).
//
// Every Standard/marketplace order is routed to the office NEAREST the vendor's
// shop, using the coordinates set here. The vendor sees that office's name,
// address and phone on the order, and brings the parcel there.
//
// Add an office when you open a new branch — no code change or app release.
// ─────────────────────────────────────────────────────────────────────────────

interface Hub {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
  /** What this office is carrying RIGHT NOW. Sent by the server since
   *  2 September 2026 - see routers/hubs.py::admin_list_hubs. */
  parcels_held?: number;
  /** THE VALUE of those parcels, not banknotes in a drawer. Every Standard
   *  parcel is paid in cash on delivery, so a parcel sitting in an office is
   *  money the office is responsible for. Sana approved showing it on
   *  2 September 2026. */
  cash_in_the_room?: number;
  oldest_parcel_at?: string | null;
}

/** How long the oldest parcel in an office has been sitting. */
function oldestFor(when?: string | null): { text: string; tooLong: boolean } | null {
  if (!when) return null;
  const ms = Date.now() - new Date(when).getTime();
  if (!isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  return {
    text: h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : h >= 1 ? `${h} h ${minutes % 60} m` : `${minutes} m`,
    tooLong: minutes > 24 * 60,
  };
}

const EMPTY = { name: "", address: "", city: "", phone: "", latitude: "", longitude: "" };

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  // null = the form is creating a new office; an id = editing that office.
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = (await apiClient.getHubs()) as { hubs: Hub[] };
      setHubs(res?.hubs ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load offices", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((p) => ({ ...p, [k]: v }));

  /** Open the form pre-filled with an existing office, ready to change. */
  const startEdit = (h: Hub) => {
    setEditingId(h.id);
    setForm({
      name: h.name ?? "",
      address: h.address ?? "",
      city: h.city ?? "",
      phone: h.phone ?? "",
      latitude: h.latitude != null ? String(h.latitude) : "",
      longitude: h.longitude != null ? String(h.longitude) : "",
    });
    setShowForm(true);
    // The form sits at the top of the page; scroll to it so a click on an
    // office lower down doesn't look like it did nothing.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY });
  };

  /** Saves a new office, or updates the one being edited. */
  const save = async () => {
    if (!form.name.trim()) {
      toast("Office name is required", "error");
      return;
    }
    // Coordinates are optional, but if one is given the other must be too —
    // a half-set location cannot be used to find the nearest office.
    const hasLat = form.latitude.trim() !== "";
    const hasLon = form.longitude.trim() !== "";
    if (hasLat !== hasLon) {
      toast("Enter both latitude and longitude, or neither", "error");
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
    };
    if (hasLat && hasLon) {
      const la = parseFloat(form.latitude);
      const lo = parseFloat(form.longitude);
      if (isNaN(la) || isNaN(lo)) {
        toast("Latitude and longitude must be numbers", "error");
        return;
      }
      body.latitude = la;
      body.longitude = lo;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.updateHub(editingId, body);
        toast("Office updated", "success");
      } else {
        await apiClient.createHub(body);
        toast("Office added", "success");
      }
      cancelForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save office", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (h: Hub) => {
    try {
      await apiClient.updateHub(h.id, { is_active: !h.is_active });
      toast(h.is_active ? "Office closed" : "Office reopened", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update office", "error");
    }
  };

  const input = "w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Takal Offices</h2>
          <p className="text-takal-ink-soft mt-1 text-sm max-w-2xl">
            Drop-off points for Standard (marketplace) parcels. Each order is
            routed to the office closest to the vendor&apos;s shop. Quick food
            orders never use an office — they go straight to a rider.
          </p>
        </div>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add office"}
        </button>
      </div>

      {showForm && (
        <div className="border border-takal-line rounded-xl p-4 bg-white space-y-3">
          <h2 className="font-semibold text-takal-ink">
            {editingId ? "Edit office" : "New office"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Office name (e.g. Takal Office, Mingora)"
              value={form.name} onChange={(e) => set("name", e.target.value)} />
            <input className={input} placeholder="City (e.g. Mingora)"
              value={form.city} onChange={(e) => set("city", e.target.value)} />
            <input className={input} placeholder="Full address the vendor drives to"
              value={form.address} onChange={(e) => set("address", e.target.value)} />
            <input className={input} placeholder="Phone the vendor calls on arrival"
              value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <input className={input} placeholder="Latitude (optional, e.g. 34.7795)"
              value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
            <input className={input} placeholder="Longitude (optional, e.g. 72.3614)"
              value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
          </div>
          <p className="text-xs text-takal-ink-soft">
            Coordinates are only used to decide which office is nearest a vendor.
            Without them this office can still receive parcels, but it will not be
            auto-selected.
          </p>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : editingId ? "Save changes" : "Save office"}
            </button>
            <button onClick={cancelForm} disabled={saving}
              className="px-4 py-2 rounded-lg border border-takal-line text-sm font-medium disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-takal-ink-soft">Loading offices…</p>
      ) : hubs.length === 0 ? (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">No offices set up.</p>
            <p>Standard orders will have no drop-off point until you add one.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hubs.map((h) => (
            <div key={h.id} className="border border-takal-line rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-takal-ink">{h.name}</p>
                  {h.city && <p className="text-xs text-takal-ink-soft">{h.city}</p>}
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                  h.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-takal-ink-soft"
                }`}>
                  {h.is_active ? "Open" : "Closed"}
                </span>
              </div>
              {/* WHAT THIS OFFICE IS CARRYING RIGHT NOW.
                  The office list used to be a settings page - a name, a city, a
                  phone number and an Edit link. Nothing on it said whether an
                  office was holding one parcel or forty, or how long the oldest
                  had been sitting there. */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-takal-page p-2.5 text-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-takal-ink-soft">
                    Holding
                  </div>
                  <div className="text-sm font-black text-takal-ink">
                    {h.parcels_held ? `${h.parcels_held} parcel${h.parcels_held === 1 ? "" : "s"}` : "nothing"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-takal-ink-soft">
                    Cash in the room
                  </div>
                  <div className="text-sm font-black text-takal-ink">
                    {h.parcels_held ? money(h.cash_in_the_room) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-takal-ink-soft">
                    Oldest
                  </div>
                  {(() => {
                    const o = oldestFor(h.oldest_parcel_at);
                    if (!o) return <div className="text-sm font-black text-takal-ink-soft">—</div>;
                    return (
                      <div className={`text-sm font-black ${o.tooLong ? "text-takal-red" : "text-takal-ink"}`}>
                        {o.text}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-snug text-takal-ink-soft">
                &ldquo;Cash in the room&rdquo; is what the parcels held here are
                worth, not notes in a drawer.
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-takal-ink-soft">
                {h.address && <p>{h.address}</p>}
                {h.phone && <p>Phone: {h.phone}</p>}
                <p className={h.latitude == null ? "text-amber-600" : ""}>
                  {h.latitude != null && h.longitude != null
                    ? `Location: ${h.latitude}, ${h.longitude}`
                    : "No location set — will not be auto-selected"}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => startEdit(h)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={() => toggleActive(h)}
                  className="flex-1 px-3 py-2 rounded-lg border border-takal-line text-sm font-medium">
                  {h.is_active ? "Close" : "Reopen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
