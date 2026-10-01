// ─────────────────────────────────────────────────────────────────────────────
// The shop's own settings card: name, phone, trading hours, logo, open or
// closed. The ADDRESS is not here any more: it lives with the map pin in the
// "Shop location" card (Mock 85), and the two are saved together.
//
// Only the fields actually changed are sent, so nothing else is overwritten.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { isPictureLink } from "@/lib/photo-order";
import { ConfirmDialog } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────────
// THE LOGO, AS A PICTURE YOU CAN CLICK.  (Mock 134, approved 1 Oct 2026 - SM12.)
//
// It was a "Logo image URL" text box: find the picture on the internet, copy
// its address, paste it - and never see the logo. Now: the logo itself, an
// Upload button (or drop a picture on it), Remove, and "or paste a link"
// folded away for the rare picture already on a website.
//
// IT SAVES BY ITSELF, ON ITS OWN. The Save settings button below is for the
// typed boxes; the logo goes straight to PATCH /restaurants/{id} with ONLY
// image_url, and the page is told the new address through onLogo - not by a
// reload, which would wipe anything half-typed in the boxes below.
// ─────────────────────────────────────────────────────────────────────────────
function LogoBox({ store, onLogo }: { store: any; onLogo: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [over, setOver] = useState(false);
  const [askRemove, setAskRemove] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const pickRef = useRef<HTMLInputElement>(null);
  const url = String(store?.image_url || "");

  const saveLogo = async (next: string, said: string) => {
    setBusy(true);
    try {
      await apiClient.updateRestaurant(String(store.id), { image_url: next });
      onLogo(next);
      setDone(true);
      window.setTimeout(() => setDone(false), 3000);
      toast(said, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The logo could not be saved", "error");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) { toast("That is not a picture.", "error"); return; }
    setBusy(true);
    try {
      const res = await apiClient.uploadImage(file);
      if (!res?.url) throw new Error("The picture could not be uploaded.");
      await saveLogo(res.url, "Logo saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The picture could not be uploaded", "error");
      setBusy(false);
    }
  };

  const applyLink = async () => {
    const t = link.trim();
    if (!isPictureLink(t)) { toast("Paste a full picture address that starts with https://", "error"); return; }
    await saveLogo(t, "Logo saved");
    setLink(""); setLinkOpen(false);
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-takal-ink-soft">Logo</label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={busy}
          onClick={() => pickRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
          aria-label={url ? "Choose a new logo" : "Add a logo"}
          className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-visible rounded-2xl ${
            busy ? "border-2 border-takal-line bg-[#F3F3F3] cursor-wait"
              : url ? `bg-takal-page ${over ? "ring-[3px] ring-takal-blue" : "hover:ring-[3px] hover:ring-takal-yellow"}`
              : `flex-col border-[2.5px] border-dashed ${over ? "border-takal-blue bg-takal-blue-soft" : "border-[#C9C600] bg-takal-yellow-soft hover:bg-takal-yellow"} text-[#6B6900]`}`}>
          {busy ? (
            <span aria-label="Uploading" className="h-12 w-12 animate-spin rounded-full border-[5px] border-[#E1E1E1] border-t-takal-green border-r-takal-green" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="The store's logo" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <>
              <span className="text-2xl leading-none">📷</span>
              <span className="mt-1 text-[11px] font-bold">Add logo</span>
            </>
          )}
          {done && !busy && (
            <span aria-hidden className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-takal-green text-xs text-white">✓</span>
          )}
        </button>
        <input ref={pickRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => pickRef.current?.click()}
              className="rounded-lg bg-takal-yellow px-3.5 py-2 text-sm font-bold text-takal-ink shadow-[0_2px_0_#E6E600] hover:bg-takal-yellow-dark disabled:opacity-50">
              📷 {url ? "Upload a new logo" : "Upload a logo"}
            </button>
            {url && (
              <button type="button" disabled={busy} onClick={() => setAskRemove(true)}
                className="rounded-lg border-[1.5px] border-takal-line bg-white px-3.5 py-2 text-sm font-bold text-takal-ink hover:bg-takal-page disabled:opacity-50">
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-takal-ink-soft">A square picture looks best. It saves by itself — no Save button needed.</p>
          {linkOpen ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <input autoFocus value={link} onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }}
                placeholder="https://…" aria-label="Link to a logo picture"
                className="min-w-[220px] flex-1 rounded-lg border border-takal-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-takal-yellow" />
              <button type="button" onClick={applyLink} disabled={busy}
                className="rounded-lg bg-takal-yellow px-3 py-2 text-sm font-bold text-takal-ink">Use this link</button>
              <button type="button" onClick={() => { setLinkOpen(false); setLink(""); }}
                className="rounded-lg border border-takal-line px-3 py-2 text-sm font-semibold text-takal-ink">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setLinkOpen(true)}
              className="mt-1 text-[12.5px] font-semibold text-takal-blue underline">or paste a link to a picture</button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={askRemove}
        busy={busy}
        onCancel={() => setAskRemove(false)}
        onConfirm={async () => { await saveLogo("", "Logo removed"); setAskRemove(false); }}
        title="Remove the logo?"
        confirmLabel="Yes, remove it"
        message={<p>The app will show a plain picture for <b>{store?.name || "this store"}</b> until a new logo is added.</p>}
      />
    </div>
  );
}

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
    description: store?.description ?? "",
    opening_time: (store?.opening_time ?? "").toString().slice(0, 5),
    closing_time: (store?.closing_time ?? "").toString().slice(0, 5),
    minimum_order: String(store?.minimum_order ?? 0),
    is_open: store?.is_open === true,
  };
}

export function StoreSettingsCard({ store, onSaved, onLogo }: {
  store: any;
  onSaved: () => void;
  /** Told the new logo address the moment it is saved, so the page header
   *  can show it without a reload (Mock 134). Without it, the page reloads. */
  onLogo?: (url: string) => void;
}) {
  const [f, setF] = useState(() => storeToForm(store));
  const [saving, setSaving] = useState(false);
  // The open/closed button FLIPS whatever the server has. Two quick clicks
  // were two flips - the shop ended where it started while the toast said it
  // had changed. One flip at a time. (Audit 15 September 2026.)
  const [toggling, setToggling] = useState(false);
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
    if (f.description !== was.description) body.description = f.description.trim();
    if (f.opening_time !== was.opening_time) body.opening_time = f.opening_time;
    if (f.closing_time !== was.closing_time) body.closing_time = f.closing_time;
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
      // reload cannot briefly show the old values again.
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
      <label className="block text-xs font-medium text-takal-ink-soft mb-1">{label}</label>
      <input
        type={type}
        value={(f as any)[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm focus:ring-2 focus:ring-amber-400"
      />
      {hint && <p className="text-xs text-takal-ink-soft mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-takal-line p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-takal-ink">Store settings</h3>
          <p className="text-xs text-takal-ink-soft mt-0.5">
            The same details the owner can edit in the Vendors app.
          </p>
        </div>
        <button
          disabled={toggling}
          onClick={async () => {
            if (toggling) return;
            setToggling(true);
            try {
              await apiClient.toggleRestaurantOpen(String(store.id));
              toast(store.is_open ? "Store closed" : "Store opened", "success");
              onSaved();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Could not change", "error");
            } finally {
              setToggling(false);
            }
          }}
          className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
            store.is_open
              ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              : "bg-takal-page border-takal-line text-takal-ink-soft hover:bg-slate-100"
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
      {/* The Address box and "What the rider gets for directions" moved into
          the Shop location card below (Mock 85): the address and the pin are
          one thing now, saved with one button. */}
      {field({ label: "Description", k: "description", placeholder: "Shown to customers under the store name" })}
      <LogoBox store={store} onLogo={onLogo ?? (() => onSaved())} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-takal-ink-soft mb-1">Opens at</label>
          <input type="time" value={f.opening_time}
            onChange={(e) => set("opening_time", e.target.value)}
            className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-takal-ink-soft mb-1">Closes at</label>
          <input type="time" value={f.closing_time}
            onChange={(e) => set("closing_time", e.target.value)}
            className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-takal-ink-soft mb-1">Minimum order (Rs)</label>
          <input type="number" min={0} value={f.minimum_order}
            onChange={(e) => set("minimum_order", e.target.value)}
            className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none text-sm" />
        </div>
      </div>
      <p className="text-xs text-takal-ink-soft -mt-2">
        Outside opening hours the app shows the store as Closed automatically, whatever the button above says.
      </p>

      {/* "Customers may collect their own order from this store" was here.
          Self-pickup was removed on Sana's instruction (audit finding B-10):
          no customer could ever collect - the pickup branch in the customer
          basket sat behind a flag that was permanently off - so the tick box
          set something nobody could use. The toggle is gone from the Partner
          app too, and the server refuses a pickup order outright. */}

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink transition disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
