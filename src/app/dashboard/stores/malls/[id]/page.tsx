"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ONE MALL.  (Mock 172-6, approved by Sana 8 October 2026.)
//
//   header     logo, name, owner, "Mall · Standard 1–3 days · One delivery",
//              "Name, logo, cover" and switching the mall off / on
//   stores     each store: products, commission, Open, Take out - and
//              "Add a store", which offers ONLY this owner's stores that can
//              join (the server says which, and why the others cannot)
//   delivery   one delivery, always; its fee (standard, or the mall's own) and
//              the minimum order for the whole mall - whole rupees
//   staff      the Main Admin only: who works here, the whole mall or one store
//   names      "Name every store after its kind" (Mock 177, migration 129):
//              each store's kind and name, the switch, and - when it is on -
//              the names "Add a store" and a new mall name will give
//
// Every rule is the server's (backend/routers/malls.py). Nothing here is
// deleted: taking a store out leaves its products, orders and payouts as they
// are, and the server refuses while one of its mall orders is unfinished.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Mall, MallStoreChoice } from "@/lib/api-stores";
import type { ShopStaffMember } from "@/lib/api-people";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { getMyPerms } from "@/lib/perms";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";
import { addPreview, deliveryText, emptyStores, minimumText, namesForNewMallName, rateText, shortName, storesWithoutLogo, wholeRupees } from "@/lib/malls";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Button, ConfirmDialog, ErrorState, LoadingState, Modal } from "@/components/ui";
import { MallStaffTab } from "../../[id]/parts-staff";
import { MallLogo } from "../parts-mall";
import { StoreNamesCard } from "./parts-store-names";

export default function MallPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [mall, setMall] = useState<Mall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [standardFee, setStandardFee] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMall(await apiClient.getMall(id));
    } catch (e) {
      setError(readFailure(e, "this mall"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!id) return;
    load();
    // The fee a basket really pays - the customer app's own quote. A missing
    // figure only leaves the words "standard parcel fee"; nothing else waits.
    apiClient.getMallDeliveryQuote(id)
      .then((q) => setStandardFee(Number(q?.delivery_fee)))
      .catch(() => setStandardFee(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Staff (Main Admin only) ──────────────────────────────────────────────
  const [isMain, setIsMain] = useState(false);
  const [staff, setStaff] = useState<ShopStaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const storeIds = useMemo(() => new Set((mall?.stores || []).map((s) => s.id)), [mall]);
  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffError("");
    try {
      const all = (await apiClient.getShopStaff()).staff || [];
      setStaff(all.filter((s) => s.mall_id === id || storeIds.has(s.restaurant_id)));
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "The staff list could not be read.");
    } finally {
      setStaffLoading(false);
    }
  };
  useEffect(() => {
    const main = getMyPerms().isSuper;
    setIsMain(main);
    if (main && mall) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mall]);

  // ── Changing it ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [takeOut, setTakeOut] = useState<{ id: string; name: string } | null>(null);
  const [takingOut, setTakingOut] = useState(false);
  const [switching, setSwitching] = useState(false);

  const doTakeOut = async () => {
    if (!takeOut) return;
    setTakingOut(true);
    try {
      const r = await apiClient.removeMallStore(id, takeOut.id);
      toast(r.message || `${takeOut.name} taken out`, "success");
      setTakeOut(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The store was not taken out", "error");
    } finally {
      setTakingOut(false);
    }
  };

  const doSwitch = async () => {
    if (!mall) return;
    setSwitching(true);
    try {
      await apiClient.updateMall(id, { is_active: !mall.is_active });
      toast(mall.is_active ? `${mall.name} is switched off` : `${mall.name} is open again`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That did not work", "error");
    } finally {
      setSwitching(false);
    }
  };

  if (error && !mall) return <ErrorState message={error.message} onRetry={load} denied={error.denied} />;
  if (!mall) return <LoadingState label={loading ? "Loading the mall…" : "Opening the mall…"} />;

  const noLogo = storesWithoutLogo(mall.stores);
  const empty = emptyStores(mall.stores);

  return (
    <div className="space-y-4">
      <Link href="/dashboard/stores/malls" className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
        <ChevronLeft className="h-4 w-4" /> Malls
      </Link>

      {/* ── Header ── */}
      <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-takal-line bg-white px-5 py-4">
        <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-takal-yellow" aria-hidden="true" />
        <MallLogo url={mall.image_url} size={88} />
        <div className="min-w-[min(320px,100%)] flex-1">
          <h2 className="truncate text-2xl font-extrabold text-takal-ink">{mall.name}</h2>
          <p className="mt-0.5 text-[13px] text-takal-ink-soft">
            {[mall.owner?.full_name ? `Owner ${mall.owner.full_name}` : "", mall.owner?.phone, mall.address]
              .filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#111111] px-2.5 py-0.5 text-xs font-bold text-takal-yellow">🛍️ Mall</span>
            <span className="rounded-full bg-takal-blue-soft px-2.5 py-0.5 text-xs font-semibold text-takal-blue">Standard 1–3 days</span>
            <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-semibold text-takal-green">One delivery</span>
            {!mall.is_active && (
              <span className="rounded-full bg-[#EEEEEE] px-2.5 py-0.5 text-xs font-semibold text-takal-ink-soft">Switched off — customers cannot order</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Name, logo, cover</Button>
          <Button variant={mall.is_active ? "ghost" : "primary"} onClick={doSwitch} loading={switching}>
            {mall.is_active ? "Switch off" : "Open again"}
          </Button>
        </div>
      </div>

      {(noLogo > 0 || empty > 0) && (
        <div className="rounded-xl border border-[#EDE88A] bg-takal-yellow-soft px-4 py-2.5 text-sm text-takal-ink">
          {noLogo > 0 && <p>🖼 {noLogo} store{noLogo === 1 ? " has" : "s have"} no logo of its own — customers see the mall’s logo.</p>}
          {empty > 0 && <p>📦 {empty} store{empty === 1 ? " has" : "s have"} no products yet — hidden from customers until they have some.</p>}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-4">
        {/* ── Store names (Mock 177) - shown once the database has the switch ── */}
        <StoreNamesCard mall={mall} onSaved={load} />
        {/* ── Stores ── */}
        <div className="min-w-0 rounded-2xl border border-takal-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-takal-ink">Stores in this mall ({mall.store_count})</h3>
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add a store</Button>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-takal-line text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                  <th className="py-2 pr-3">Store</th>
                  <th className="px-3 py-2">Products</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="py-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {/* read-safe: this page draws only after the mall was read (a failed read shows ErrorState above). */}
                {mall.stores.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-takal-ink-soft">No store in this mall yet. Press “Add a store”.</td></tr>
                ) : mall.stores.map((s) => (
                  <tr key={s.id} className="border-b border-[#F0F0F0]">
                    <td className="py-2.5 pr-3">
                      <span aria-hidden>{verticalEmoji(s.vendor_type)}</span>{" "}
                      <b className="text-takal-ink" title={s.name}>{shortName(s.name, mall.name)}</b>
                      {!s.has_own_logo && <span className="ml-1.5 text-[11px] text-takal-ink-soft">· mall’s logo</span>}
                      {!s.is_approved && <span className="ml-1.5 rounded-full bg-takal-orange-soft px-2 text-[11px] font-semibold text-[#C8410F]">waiting for approval</span>}
                    </td>
                    <td className="px-3 py-2.5">{s.products.toLocaleString()}</td>
                    <td className="px-3 py-2.5">{rateText(s, verticalLabel(s.vendor_type))}</td>
                    <td className="py-2.5 pl-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/stores/${s.id}`}
                          className="whitespace-nowrap rounded-lg border-[1.5px] border-takal-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-ink hover:border-[#DADA00] hover:bg-[#FFFEE0]">
                          Open
                        </Link>
                        <button onClick={() => setTakeOut({ id: s.id, name: s.name })}
                          className="whitespace-nowrap rounded-lg border-[1.5px] border-takal-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-ink hover:border-[#F3C2C7] hover:bg-takal-red-soft">
                          Take out
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12.5px] text-takal-ink-soft">
            “Add a store” offers only this owner’s shops with the SAME delivery speed (parcel stores, for now).
          </p>
        </div>
        </div>

        <div className="min-w-0 space-y-4">
          {/* ── Delivery ── */}
          <DeliveryCard mall={mall} standardFee={standardFee} onSaved={load} />
        </div>
      </div>

      {/* ── Staff (Main Admin only) - full width: its table is wide ── */}
      {isMain && (
        <div className="rounded-2xl border border-takal-line bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-takal-ink">
            Mall staff
            <span className="rounded-full bg-[#111111] px-2 text-[10.5px] font-extrabold leading-5 text-takal-yellow">🛡️ Main Admin only</span>
          </h3>
          {/* read-safe: part of the mall that was read. */}
          {mall.stores.length === 0 ? (
            <p className="text-sm text-takal-ink-soft">Add a store first — a staff login belongs to one of the mall’s stores.</p>
          ) : (
            <MallStaffTab restaurantId={mall.stores[0].id} shopName={mall.stores[0].name}
              staff={staff} loading={staffLoading} error={staffError} reload={loadStaff}
              mall={{ id: mall.id, name: mall.name, storeCount: mall.store_count }} />
          )}
        </div>
      )}

      {editing && <EditMallDialog mall={mall} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {adding && <AddStoresDialog mall={mall} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}
      <ConfirmDialog
        open={takeOut !== null}
        busy={takingOut}
        danger
        onCancel={() => setTakeOut(null)}
        onConfirm={doTakeOut}
        title={`Take ${takeOut?.name ?? "this store"} out of ${mall.name}?`}
        confirmLabel="Take it out"
        message={(
          <>
            <p>It becomes a shop of its own again:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Its products, orders and payouts stay exactly as they are</li>
              <li>A whole-mall staff login no longer reaches it</li>
              <li>Not possible while one of its mall orders is unfinished</li>
            </ul>
          </>
        )}
      />
    </div>
  );
}

function DeliveryCard({ mall, standardFee, onSaved }: { mall: Mall; standardFee: number | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(mall.admin_delivery_fee != null);
  const [fee, setFee] = useState(mall.admin_delivery_fee != null ? String(mall.admin_delivery_fee) : "");
  const [minimum, setMinimum] = useState(String(Math.round(Number(mall.minimum_order) || 0)));
  const [busy, setBusy] = useState(false);
  const feeRead = wholeRupees(fee, null);
  const minRead = wholeRupees(minimum, 0);
  const problem = (own && (feeRead.error || (feeRead.value == null ? "Type the mall's fee, or untick it" : null)))
    || minRead.error;

  const save = async () => {
    if (problem) return;
    setBusy(true);
    try {
      await apiClient.updateMall(mall.id, {
        admin_delivery_fee: own ? feeRead.value : null,
        minimum_order: minRead.value ?? 0,
      });
      toast("Delivery saved", "success");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Not saved", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-takal-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-takal-ink">Delivery</h3>
        <button onClick={() => setOpen(true)} className="text-sm font-bold underline">Change</button>
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <p className="flex justify-between gap-3"><span>One delivery for the whole mall</span><b className="text-takal-green">Always on</b></p>
        <p className="flex justify-between gap-3"><span>Fee</span><b>{deliveryText(mall, standardFee).replace(/^One · /, "")}</b></p>
        <p className="flex justify-between gap-3"><span>Minimum order</span><b>{minimumText(mall.minimum_order)}</b></p>
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} lockClose={busy} title={`Delivery for ${mall.name}`} size="md"
          hint="Charged ONCE for everything a customer buys from this mall in one basket."
          footer={<>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} loading={busy} disabled={!!problem}>Save</Button>
          </>}>
          <div className="space-y-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
              The mall has its own delivery fee
            </label>
            {own ? (
              <label className="block">
                <span className="mb-1 block font-medium">The mall’s fee (Rs)</span>
                <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" placeholder="150"
                  className="w-40 rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
              </label>
            ) : (
              <p className="text-takal-ink-soft">The standard parcel fee{standardFee != null ? ` (${money(standardFee)} today)` : ""} is charged.</p>
            )}
            <label className="block">
              <span className="mb-1 block font-medium">Minimum order for the whole mall (Rs)</span>
              <input value={minimum} onChange={(e) => setMinimum(e.target.value)} inputMode="numeric" placeholder="0"
                className="w-40 rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </label>
            {problem && <p role="alert" className="text-takal-red">{problem}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditMallDialog({ mall, onClose, onSaved }: { mall: Mall; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(mall.name);
  const [logo, setLogo] = useState(mall.image_url || "");
  const [cover, setCover] = useState(mall.cover_url || "");
  const [address, setAddress] = useState(mall.address || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"" | "logo" | "cover">("");
  const logoRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const problem = name.trim().length < 2 ? "A mall needs a name"
    : !logo ? "A mall needs a logo - it cannot be removed" : null;
  // Mock 177: with "Name every store after its kind" on, the stores follow
  // the mall's new name - listed here BEFORE Save.
  const follow = namesForNewMallName(mall.store_names, mall.name, name);

  const upload = async (which: "logo" | "cover", file?: File) => {
    if (!file) return;
    setUploading(which);
    try {
      const url = (await apiClient.uploadImage(file)).url;
      if (which === "logo") setLogo(url); else setCover(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The picture could not be uploaded", "error");
    } finally {
      setUploading("");
    }
  };

  const save = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const r = await apiClient.updateMall(mall.id, {
        name: name.trim(), image_url: logo, cover_url: cover || null, address: address.trim() || null,
      });
      toast(r?.message || "Saved", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Not saved", "error");
    } finally {
      setBusy(false);
    }
  };

  const Picture = ({ which, url, label }: { which: "logo" | "cover"; url: string; label: string }) => (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => (which === "logo" ? logoRef : coverRef).current?.click()}
        disabled={!!uploading}
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-takal-line bg-takal-page text-xs text-takal-ink-soft hover:border-takal-yellow ${which === "logo" ? "h-20 w-20" : "h-20 w-36"}`}>
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="" className="h-full w-full object-cover" />
          : uploading === which ? "Uploading…" : "📷 Add"}
      </button>
      <div className="text-sm">
        <p className="font-bold">{label}</p>
        {which === "cover" && url && (
          <button type="button" className="text-xs font-bold underline" onClick={() => setCover("")}>Remove</button>
        )}
        {which === "logo" && <p className="text-xs text-takal-ink-soft">Shown for every store without its own logo.</p>}
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} lockClose={busy || !!uploading} title="Name, logo, cover" size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={save} loading={busy} disabled={!!problem}>Save</Button>
      </>}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Mall name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
            className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
        </label>
        {follow.length > 0 && (
          <div className="rounded-xl border border-[#F3E58A] bg-takal-yellow-soft px-3.5 py-2.5 text-[13px] text-takal-ink">
            <p className="font-bold">{follow.length} store name{follow.length === 1 ? " changes" : "s change"} too (the switch is on):</p>
            <ul className="mt-1 space-y-0.5">
              {follow.map((c) => <li key={c.from}>{c.to}</li>)}
            </ul>
          </div>
        )}
        <Picture which="logo" url={logo} label="Logo (required)" />
        <Picture which="cover" url={cover} label="Cover picture (optional)" />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300}
            className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
        </label>
        {problem && <p role="alert" className="text-sm text-takal-red">{problem}</p>}
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("logo", e.target.files?.[0])} />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload("cover", e.target.files?.[0])} />
      </div>
    </Modal>
  );
}

function AddStoresDialog({ mall, onClose, onAdded }: { mall: Mall; onClose: () => void; onAdded: () => void }) {
  const [choices, setChoices] = useState<MallStoreChoice[] | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    apiClient.getMallStoreChoices(mall.owner_id)
      .then((r) => setChoices((r.stores || []).filter((s) => s.mall_id !== mall.id)))
      .catch((e) => setProblem(e instanceof Error ? e.message : "The owner's stores could not be read"));
  }, [mall]);

  const add = async () => {
    if (!ticked.length) return;
    setBusy(true);
    setProblem("");
    try {
      const r = await apiClient.addMallStores(mall.id, ticked);
      toast(r.message || "Added", "success");
      onAdded();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Not added");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} lockClose={busy} title={`Add a store to ${mall.name}`} size="md"
      hint="Only the owner's own stores, delivered the same way (parcel), and not in another mall."
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={add} loading={busy} disabled={!ticked.length}>
          Add {ticked.length ? `${ticked.length} store${ticked.length === 1 ? "" : "s"}` : ""}
        </Button>
      </>}>
      {choices === null ? (
        // A failed read shows only its problem line below - never "no other store".
        !problem && <LoadingState label="Reading the owner's stores…" />
      ) : (
        <div className="divide-y divide-takal-line rounded-lg border border-takal-line">
          {/* read-safe: this branch draws only after the owner's stores were read. */}
          {choices.length === 0 ? (
            <p className="px-3 py-4 text-sm text-takal-ink-soft">The owner has no other store. Make one with Create store first.</p>
          ) : choices.map((c) => {
            // Mock 177: the name it will get, and a kind this mall already has.
            const pv = addPreview(c, mall);
            const can = c.can_join && !pv.takenBy;
            const sameKind = ticked.some((t) => t !== c.id && choices.find((x) => x.id === t)?.vendor_type === c.vendor_type)
              && !!mall.store_names?.follow;
            return (
            <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${can && !sameKind ? "cursor-pointer" : "text-takal-disabled-text"}`}>
              <input type="checkbox" disabled={!can || (sameKind && !ticked.includes(c.id))} checked={ticked.includes(c.id)}
                onChange={() => setTicked((t) => t.includes(c.id) ? t.filter((x) => x !== c.id) : [...t, c.id])} />
              <span aria-hidden>{verticalEmoji(c.vendor_type)}</span>
              <span className="flex-1"><b className={can ? "text-takal-ink" : ""}>{c.name}</b>
                <span className="text-xs"> · {c.products} product{c.products === 1 ? "" : "s"}</span>
                {!c.can_join && <span className="block text-xs">{c.why_not}</span>}
                {c.can_join && pv.takenBy && (
                  <span className="mt-1 block rounded-md bg-takal-red-soft px-2 py-1 text-xs text-takal-red">
                    {pv.takenBy}. Two stores would both be called the same - move the products into one store, or turn the switch off.
                  </span>
                )}
                {can && pv.willBe && <span className="block text-xs text-takal-ink">Will be named <b>{pv.willBe}</b></span>}
                {can && sameKind && !ticked.includes(c.id) && (
                  <span className="block text-xs">Another store of this kind is ticked - only one per kind</span>
                )}</span>
            </label>
            );
          })}
        </div>
      )}
      {problem && <p role="alert" className="mt-3 text-sm text-takal-red">{problem}</p>}
    </Modal>
  );
}
