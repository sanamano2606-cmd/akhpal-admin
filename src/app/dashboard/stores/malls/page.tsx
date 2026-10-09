"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES → MALLS.  (Mock 172-6, approved by Sana 8 October 2026.)
//
// Sana: "Their Mall Should stay one ... if i add a Mall like this in Future, so
// all must be same as this one." Every mall: one name, one logo, one delivery,
// its stores inside. This page lists them and makes a new one from stores that
// already exist (how Wakeel Shopping Mall is made). Create store with several
// kinds ticked makes one too, the same way (parts-create-store.tsx).
//
// The rules are the SERVER's (backend/routers/malls.py). This page offers only
// what the server will take: an owner's stores that can join say so, and the
// ones that cannot say why.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Mall, MallStoreChoice, VendorMatch } from "@/lib/api-stores";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";
import { deliveryText, mallFromChoices, readyToMake, wholeRupees } from "@/lib/malls";
import { toast } from "@/lib/toast";
import { Button, ErrorState, LoadingState, Modal } from "@/components/ui";
import { MallLogo } from "./parts-mall";

export default function MallsPage() {
  const [malls, setMalls] = useState<Mall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [making, setMaking] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMalls((await apiClient.getMalls()).malls || []);
    } catch (e) {
      setError(readFailure(e, "the malls"));
      setMalls([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-takal-ink-soft">
          Every mall: one name, one logo, one delivery — its stores inside.
        </p>
        <Button onClick={() => setMaking(true)}><Plus className="h-4 w-4" /> Create mall</Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={load} denied={error.denied} />
      ) : loading && malls.length === 0 ? (
        <LoadingState label="Loading malls…" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-takal-line bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b-[1.5px] border-takal-line bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
                <th className="px-4 py-3">Mall</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Stores</th>
                <th className="px-3 py-3">Products</th>
                <th className="px-3 py-3">Delivery</th>
                <th className="px-3 py-3">Staff</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {malls.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-takal-ink-soft">
                  No mall yet. Press “Create mall” to put an owner’s stores under one name and logo.
                </td></tr>
              ) : malls.map((m) => (
                <tr key={m.id} className="border-b border-[#F0F0F0] hover:bg-[#FFFEE8]">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/stores/malls/${m.id}`} className="flex items-center gap-3 font-bold text-takal-ink hover:underline">
                      <MallLogo url={m.image_url} />
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{m.owner?.full_name || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span aria-hidden>{m.stores.map((s) => verticalEmoji(s.vendor_type)).join(" ")}</span>{" "}
                    <b>{m.store_count}</b>
                  </td>
                  <td className="px-3 py-3">{m.product_count.toLocaleString()}</td>
                  <td className="px-3 py-3">{deliveryText(m, null)}</td>
                  <td className="px-3 py-3">
                    {m.staff ? `${m.staff.filter((s) => s.is_active).length} login${m.staff.filter((s) => s.is_active).length === 1 ? "" : "s"}` : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {m.is_active ? (
                      <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-semibold text-takal-green">Open</span>
                    ) : (
                      <span className="rounded-full bg-[#EEEEEE] px-2.5 py-0.5 text-xs font-semibold text-takal-ink-soft">Switched off</span>
                    )}
                  </td>
                </tr>
              ))}
              {malls.length > 0 && (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-[13px] text-takal-ink-soft">
                  The next mall made with “Create store → several kinds” appears here, made the same way.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {making && <CreateMallDialog onClose={() => setMaking(false)} onMade={() => { setMaking(false); load(); }} />}
    </div>
  );
}

/** Make a mall from stores that already exist: find the owner, tick his stores
 *  that can join, name it, give it a logo. */
function CreateMallDialog({ onClose, onMade }: { onClose: () => void; onMade: () => void }) {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<VendorMatch[]>([]);
  const [owner, setOwner] = useState<VendorMatch | null>(null);
  const [choices, setChoices] = useState<MallStoreChoice[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [minimum, setMinimum] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState("");
  const [searchFailed, setSearchFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = search.trim();
    if (owner || t.length < 2) { setMatches([]); setSearchFailed(false); return; }
    let gone = false;
    const timer = setTimeout(async () => {
      try {
        const r = await apiClient.findVendors(t);
        if (!gone) { setMatches(r?.vendors || []); setSearchFailed(false); setProblem(""); }
      } catch (e) {
        if (!gone) {
          setMatches([]);
          setSearchFailed(true);
          setProblem(e instanceof Error ? e.message : "Could not search vendors");
        }
      }
    }, 350);
    return () => { gone = true; clearTimeout(timer); };
  }, [search, owner]);

  const pick = async (v: VendorMatch) => {
    setOwner(v);
    setProblem("");
    try {
      const r = await apiClient.getMallStoreChoices(v.id);
      setChoices(r.stores || []);
      const can = (r.stores || []).filter((s) => s.can_join).map((s) => s.id);
      setTicked(can);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "His stores could not be read");
    }
  };

  const plan = useMemo(() => mallFromChoices(choices, ticked), [choices, ticked]);
  const usedLogo = logo || plan.logoFromStore;
  const min = wholeRupees(minimum, 0);
  const missing = readyToMake(name, plan.ok, usedLogo) || min.error;

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setLogo((await apiClient.uploadImage(file)).url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The picture could not be uploaded", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const make = async () => {
    if (missing) { setProblem(missing); return; }
    setBusy(true);
    setProblem("");
    try {
      const r = await apiClient.createMall({
        name: name.trim(), store_ids: plan.ok,
        ...(logo ? { image_url: logo } : {}),
        minimum_order: min.value ?? 0,
      });
      toast(r.message || "Mall made", "success");
      onMade();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The mall could not be made");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} lockClose={busy || uploading} title="Create a mall" size="lg"
      hint="One name and one logo with several of one owner's stores inside. One delivery for the whole basket."
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={make} loading={busy} disabled={!owner}>
          Create mall{plan.ok.length ? ` with ${plan.ok.length} store${plan.ok.length === 1 ? "" : "s"}` : ""}
        </Button>
      </>}>
      <div className="space-y-4">
        {!owner ? (
          <div>
            <p className="mb-1 text-sm font-medium text-takal-ink">Whose stores?</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-takal-ink-soft" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                placeholder="The owner's name or phone"
                className="w-full rounded-lg border-[1.5px] border-takal-line py-2.5 pl-9 pr-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </div>
            <div className="mt-2 divide-y divide-takal-line rounded-lg border border-takal-line">
              {/* read-safe: a failed search says so here and in the problem line below - never "nobody found". */}
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-sm text-takal-ink-soft">
                  {search.trim().length < 2 ? "Type at least 2 letters."
                    : searchFailed ? "The search did not work - see the message below."
                    : "Nobody found yet."}
                </p>
              ) : matches.map((v) => (
                <button key={v.id} type="button" onClick={() => pick(v)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#FFFEE8]">
                  <span><b>{v.full_name}</b> <span className="text-takal-ink-soft">· {v.phone}</span></span>
                  <span className="text-xs text-takal-ink-soft">{v.shops.length} store{v.shops.length === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg bg-takal-yellow-soft px-3 py-2 text-sm">
              <span>Owner: <b>{owner.full_name}</b> · {owner.phone}</span>
              <button type="button" className="text-xs font-bold underline" onClick={() => { setOwner(null); setChoices([]); setTicked([]); }}>
                Change
              </button>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-takal-ink">His stores</p>
              <div className="divide-y divide-takal-line rounded-lg border border-takal-line">
                {choices.map((c) => (
                  <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${c.can_join ? "cursor-pointer" : "text-takal-disabled-text"}`}>
                    <input type="checkbox" disabled={!c.can_join} checked={ticked.includes(c.id)}
                      onChange={() => setTicked((t) => t.includes(c.id) ? t.filter((x) => x !== c.id) : [...t, c.id])} />
                    <span aria-hidden>{verticalEmoji(c.vendor_type)}</span>
                    <span className="flex-1"><b className={c.can_join ? "text-takal-ink" : ""}>{c.name}</b>
                      <span className="text-xs"> · {verticalLabel(c.vendor_type)} · {c.products} product{c.products === 1 ? "" : "s"}{c.has_own_logo ? "" : " · no logo"}</span>
                      {!c.can_join && <span className="block text-xs">{c.why_not}</span>}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-takal-ink">Mall name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Wakeel Shopping Mall"
                className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-takal-line bg-takal-page text-xs text-takal-ink-soft hover:border-takal-yellow">
                {usedLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={usedLogo} alt="Mall logo" className="h-full w-full object-cover" />
                  : uploading ? "Uploading…" : "📷 Add"}
              </button>
              <div className="text-sm">
                <p className="font-bold">Mall logo <span className="rounded-full bg-takal-red-soft px-2 py-0.5 text-[11px] font-bold text-takal-red">required</span></p>
                <p className="text-xs text-takal-ink-soft">
                  {logo ? "Uploaded. " : plan.logoFromStore ? "Taken from the first ticked store that has one. " : ""}
                  Every store without its own logo shows this one.
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-takal-ink">
                Minimum order for the whole mall <span className="font-normal text-takal-ink-soft">(Rs, optional)</span>
              </span>
              <input value={minimum} onChange={(e) => setMinimum(e.target.value)} inputMode="numeric" placeholder="0"
                className="w-40 rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
              {min.error && <span className="ml-2 text-sm text-takal-red">{min.error}</span>}
            </label>
          </>
        )}
        {problem && (
          <p role="alert" className="rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">{problem}</p>
        )}
      </div>
    </Modal>
  );
}
