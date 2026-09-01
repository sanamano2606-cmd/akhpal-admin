// ─────────────────────────────────────────────────────────────────────────────
// The shop's own settings card: name, phone, address, trading hours, pickup,
// logo, open or closed.
//
// Only the fields actually changed are sent, so nothing else is overwritten.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Store settings — the same fields the vendor edits in their own app.
//
// Every one of these goes through PATCH /restaurants/{id}, which the vendor app
// already uses; the backend lets an admin through the ownership check, so no
// new server code was needed. Only changed fields are sent, so opening this
// card and saving cannot quietly overwrite something you did not touch.
// ─────────────────────────────────────────────────────────────────────────────
/** The store as form values. Kept outside the component so it is a plain
 *  function, not something rebuilt on every render. */
function storeToForm(store: any) {
  return {
    name: store?.name ?? "",
    phone: store?.phone ?? "",
    address: store?.address ?? "",
    description: store?.description ?? "",
    image_url: store?.image_url ?? "",
    opening_time: (store?.opening_time ?? "").toString().slice(0, 5),
    closing_time: (store?.closing_time ?? "").toString().slice(0, 5),
    minimum_order: String(store?.minimum_order ?? 0),
    allows_pickup: store?.allows_pickup === true,
    is_open: store?.is_open === true,
  };
}

export function StoreSettingsCard({ store, onSaved }: { store: any; onSaved: () => void }) {
  const [f, setF] = useState(() => storeToForm(store));
  const [saving, setSaving] = useState(false);
  // What the server currently holds — compared against on save so only real
  // edits are sent. Held in a ref so typing never triggers a re-render of it.
  const serverRef = useRef(storeToForm(store));

  // Reload the form ONLY when a different store is opened, or after a save has
  // brought back fresh values. Re-running this while the admin is typing was
  // what made edits appear to "snap back" to the old address.
  useEffect(() => {
    const fresh = storeToForm(store);
    serverRef.current = fresh;
    setF(fresh);
  }, [store?.id, store?.updated_at]);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { toast("The store needs a name", "error"); return; }
    const was = serverRef.current;
    const body: Record<string, any> = {};
    // Send only what actually changed, compared against what the server last
    // gave us — never against a value recomputed mid-edit.
    if (f.name !== was.name) body.name = f.name.trim();
    if (f.phone !== was.phone) body.phone = f.phone.trim();
    if (f.address !== was.address) body.address = f.address.trim();
    if (f.description !== was.description) body.description = f.description.trim();
    if (f.image_url !== was.image_url) body.image_url = f.image_url.trim();
    if (f.opening_time !== was.opening_time) body.opening_time = f.opening_time;
    if (f.closing_time !== was.closing_time) body.closing_time = f.closing_time;
    if (f.allows_pickup !== was.allows_pickup) body.allows_pickup = f.allows_pickup;
    if (f.is_open !== was.is_open) body.is_open = f.is_open;
    const min = Number(f.minimum_order);
    if (String(min) !== String(was.minimum_order)) {
      if (!isFinite(min) || min < 0) { toast("Minimum order must be 0 or more", "error"); return; }
      body.minimum_order = min;
    }
    if (Object.keys(body).length === 0) { toast("Nothing changed", "success"); return; }
    try {
      setSaving(true);
      await apiClient.updateRestaurant(String(store.id), body);
      // Take the saved values as the new baseline immediately, so a slow
      // reload cannot briefly show the old address again.
      serverRef.current = { ...serverRef.current, ...f };
      toast("Store updated", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  // NOTE: this is a plain render helper, NOT a component.
  //
  // It was written as `const Field = (props) => <div>...` and used as <Field/>.
  // React treats a function defined during render as a brand-new component
  // type on every render, so it threw the old <input> away and mounted a fresh
  // one after every keystroke. The field lost focus each character, and edits
  // looked like they were snapping back to the previous value — which is what
  // Sana hit trying to change an address. Calling it as a function keeps the
  // same input element alive.
  const field = ({ label, k, type = "text", placeholder = "", hint = "" }: any) => (
    <div key={k}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={(f as any)[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-amber-400"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Store settings</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The same details the owner can edit in the Vendors app.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              await apiClient.toggleRestaurantOpen(String(store.id));
              toast(store.is_open ? "Store closed" : "Store opened", "success");
              onSaved();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Could not change", "error");
            }
          }}
          className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
            store.is_open
              ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              : "bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100"
          }`}
          title="Closed means customers cannot order right now. It does not unapprove or hide the store."
        >
          <span className={`w-2.5 h-2.5 rounded-full ${store.is_open ? "bg-emerald-500" : "bg-slate-400"}`} />
          {store.is_open ? "Open for orders" : "Closed"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {field({ label: "Store name", k: "name" })}
        {field({ label: "Phone", k: "phone", placeholder: "03001234567" })}
      </div>
      {field({ label: "Address", k: "address" })}

      {/* What the rider actually taps.
          The rider app already has an "Open in Google Maps" button that uses
          the store's COORDINATES for turn-by-turn directions, falling back to
          this written address only when there is no pin. So the pin is what
          matters for navigation — showing the exact link here makes that
          visible, and lets you check it lands on the right shop. */}
      {(() => {
        const la = Number(store?.latitude), lo = Number(store?.longitude);
        const hasPin = isFinite(la) && isFinite(lo) && !(la === 0 && lo === 0);
        const link = hasPin
          ? `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=driving`
          : "";
        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600 mb-1">
              What the rider gets for directions
            </p>
            {hasPin ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs text-slate-700 break-all flex-1 min-w-[220px]">{link}</code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(link);
                    toast("Link copied", "success");
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50"
                >
                  Copy
                </button>
                <a href={link} target="_blank" rel="noreferrer"
                   className="px-2.5 py-1 rounded-md text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50">
                  Test it
                </a>
              </div>
            ) : (
              <p className="text-xs text-red-700">
                No map pin yet, so the rider only gets the typed address above and
                has to search for it. Set the pin on the map below.
              </p>
            )}
          </div>
        );
      })()}
      {field({ label: "Description", k: "description", placeholder: "Shown to customers under the store name" })}
      {field({ label: "Logo image URL", k: "image_url", placeholder: "https://..." })}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Opens at</label>
          <input type="time" value={f.opening_time}
            onChange={(e) => set("opening_time", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Closes at</label>
          <input type="time" value={f.closing_time}
            onChange={(e) => set("closing_time", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Minimum order (Rs)</label>
          <input type="number" min={0} value={f.minimum_order}
            onChange={(e) => set("minimum_order", e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm" />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Outside opening hours the app shows the store as Closed automatically, whatever the button above says.
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={f.allows_pickup}
          onChange={(e) => set("allows_pickup", e.target.checked)}
          className="w-4 h-4" />
        Customers may collect their own order from this store
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFFF00] text-black border border-yellow-400 hover:brightness-95 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}
