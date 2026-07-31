"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Building2, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
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
}

const EMPTY = { name: "", address: "", city: "", phone: "", latitude: "", longitude: "" };

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

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

  const create = async () => {
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
      await apiClient.createHub(body);
      toast("Office added", "success");
      setForm({ ...EMPTY });
      setShowForm(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add office", "error");
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

  const input = "w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Takal Offices</h1>
          <p className="text-slate-500 mt-1 text-sm max-w-2xl">
            Drop-off points for Standard (marketplace) parcels. Each order is
            routed to the office closest to the vendor&apos;s shop. Quick food
            orders never use an office — they go straight to a rider.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add office"}
        </button>
      </div>

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
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
          <p className="text-xs text-slate-500">
            Coordinates are only used to decide which office is nearest a vendor.
            Without them this office can still receive parcels, but it will not be
            auto-selected.
          </p>
          <button onClick={create} disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save office"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading offices…</p>
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
            <div key={h.id} className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{h.name}</p>
                  {h.city && <p className="text-xs text-slate-500">{h.city}</p>}
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
                  h.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {h.is_active ? "Open" : "Closed"}
                </span>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                {h.address && <p>{h.address}</p>}
                {h.phone && <p>Phone: {h.phone}</p>}
                <p className={h.latitude == null ? "text-amber-600" : ""}>
                  {h.latitude != null && h.longitude != null
                    ? `Location: ${h.latitude}, ${h.longitude}`
                    : "No location set — will not be auto-selected"}
                </p>
              </div>
              <button onClick={() => toggleActive(h)}
                className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium">
                {h.is_active ? "Close this office" : "Reopen this office"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
