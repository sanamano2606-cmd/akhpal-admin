"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 217-2 - PRODUCTS HIDDEN BY TAKAL (approved by Sana, 30 Oct 2026).
//
// One place to see every product the Takal Assistant hid, in every store, with
// the reason and - for a picture - a red box round the number it found.
// "Show again" is the Main Admin's alone (Sana: "For now Assistant AI and Main
// Admin"); a sub-admin sees the list but the button is locked. The server
// refuses anybody else too (routers/product_checks_admin.py).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";
import { money } from "@/lib/format";
import { boxPercent, filterHidden, foundText, isLocked, pictureOf, reasonTags, showAgainWords,
  type HiddenFilter, type TakalHiddenProduct } from "@/lib/takal-hidden";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export function TakalHiddenSection({ products, loading, failed, isMain, onRefresh, onShown }: {
  products: TakalHiddenProduct[] | null;
  loading: boolean;
  failed: boolean;
  isMain: boolean;
  onRefresh: () => void;
  /** A product was shown again: the list drops it. */
  onShown: (id: string) => void;
}) {
  const [ask, setAsk] = useState<TakalHiddenProduct | null>(null);
  const [busy, setBusy] = useState(false);
  // MOCK 224-3: All / ⚖️ Legal / 👤 By admin.
  const [only, setOnly] = useState<HiddenFilter>("all");
  const all = products || [];
  const nLegal = all.filter((p) => p.takal_hidden_kind === "legal").length;
  const nAdmin = all.filter((p) => p.takal_hidden_kind === "admin").length;
  const shown = filterHidden(all, only);
  const chip = (f: HiddenFilter, label: string) => (
    <button type="button" data-hidden-filter={f} aria-pressed={only === f} onClick={() => setOnly(f)}
      className={`whitespace-nowrap rounded-[10px] border-2 border-takal-ink px-3 py-1.5 text-[13px] font-bold ${only === f
        ? "bg-black text-takal-yellow" : "bg-white text-takal-ink"}`}>{label}</button>
  );

  const showAgain = async (p: TakalHiddenProduct) => {
    setBusy(true);
    try {
      await apiClient.showProductAgain(p.id);
      toast(`${p.name} is shown again.`, "success");
      onShown(p.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  return (
    <div data-testid="takal-hidden" className="mt-3 overflow-hidden rounded-2xl border border-takal-line bg-white">
      <div className="flex items-center gap-4 border-b border-[#F5B5BC] bg-takal-red-soft px-5 py-3">
        <div className="flex-1">
          <h2 className="text-[18px] font-extrabold text-[#8E1B1B]">⛔ Products hidden by Takal{products ? ` - ${all.length}` : ""}</h2>
          <p className="text-[13px] text-[#5a1515]">Each one broke a Takal rule. The vendor was told why in Roman Urdu.
            When he fixes it, the Assistant shows it again within the hour by itself - except{" "}
            <b>⚖️ Legal</b> and <b>👤 By admin</b>, which stay hidden until the Main Admin presses Show again.</p>
        </div>
        {(nLegal > 0 || nAdmin > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {chip("all", "All")}
            {chip("legal", `⚖️ Legal ${nLegal}`)}
            {chip("admin", `👤 By admin ${nAdmin}`)}
          </div>
        )}
        <button type="button" onClick={onRefresh} disabled={loading}
          className="rounded-[10px] border-2 border-takal-ink bg-white px-3.5 py-2 text-[13.5px] font-bold disabled:opacity-50">
          {loading ? "Checking…" : "Check again"}
        </button>
      </div>
      {failed && <p className="px-5 py-4 text-sm font-semibold text-takal-red">This list could not be read just now. Press Check again.</p>}
      {!failed && products && products.length === 0 && (
        <p className="px-5 py-6 text-sm text-takal-ink-soft">No product is hidden by Takal right now. 🎉</p>
      )}
      {!failed && products && products.length > 0 && shown.length === 0 && (
        <p className="px-5 py-6 text-sm text-takal-ink-soft">None of this kind right now.</p>
      )}
      {shown.map((p) => {
        const pic = pictureOf(p);
        const found = p.pictures_found?.find((f) => f.url === pic);
        const said = foundText(p);
        return (
          <div key={p.id} data-takal-hidden-row className="grid grid-cols-[60px_1.3fr_1.6fr_auto] items-center gap-4 border-t border-[#eee] px-5 py-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-[10px] bg-takal-page">
              {pic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pic} alt="" className="h-full w-full object-cover" />
              ) : <span className="grid h-full place-items-center text-xl" aria-hidden>📷</span>}
              {(found?.boxes || []).map((b, i) => {
                const at = boxPercent(b, found?.quality);
                return at ? <span key={i} data-red-box className="absolute rounded-[3px] border-2 border-[#ff2a2a]"
                  style={{ left: `${at.left}%`, top: `${at.top}%`, width: `${at.width}%`, height: `${at.height}%` }} /> : null;
              })}
            </div>
            <div className="min-w-0">
              <b className="block truncate">{p.name}</b>
              <div className="text-[12.5px] text-takal-ink-soft">
                {p.shop_name || "Store"} · {p.price != null ? money(p.price) : "—"} · hidden
                {p.takal_hidden_kind === "admin" && p.hidden_by_name ? ` by ${p.hidden_by_name}` : ""} {when(p.takal_hidden_at)}
              </div>
            </div>
            <div className="text-[13px]">
              {reasonTags(p.takal_hidden_reason, p.takal_hidden_kind).map((t) => (
                <span key={t} data-kind-tag={p.takal_hidden_kind || "rule"} className={`mr-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                  p.takal_hidden_kind === "legal" ? "bg-black text-takal-yellow"
                    : p.takal_hidden_kind === "admin" ? "bg-[#0B5394] text-white"
                      : "border border-[#F5B5BC] bg-takal-red-soft text-takal-red"}`}>{t}</span>
              ))}
              {p.takal_hidden_reason}
              {p.takal_hidden_kind === "legal" && p.takal_hidden_word && <> (word: <b>{p.takal_hidden_word}</b>)</>}
              {said && <span className="text-takal-ink-soft"> ({said})</span>}
              {isLocked(p) && <span className="ml-1 text-[11px] font-bold text-takal-ink-soft">🔒 locked</span>}
            </div>
            <div className="flex gap-2">
              <Link href={`/dashboard/stores/${p.restaurant_id}`}
                className="whitespace-nowrap rounded-[10px] border-2 border-takal-ink bg-white px-3.5 py-2 text-[13.5px] font-bold">Open store ›</Link>
              <button type="button" data-show-again disabled={!isMain || busy}
                title={isMain ? "Show it to customers again" : "Only the Main Admin can show it again"}
                onClick={() => setAsk(p)}
                className="whitespace-nowrap rounded-[10px] border-2 border-takal-ink bg-takal-yellow px-3.5 py-2 text-[13.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40">
                {isMain ? "Show again" : "🔒 Show again"}
              </button>
            </div>
          </div>
        );
      })}
      <ConfirmDialog
        open={!!ask}
        busy={busy}
        danger={false}
        onCancel={() => setAsk(null)}
        onConfirm={() => ask && showAgain(ask)}
        title={`Show "${ask?.name || "this product"}" again?`}
        confirmLabel="Yes, show it again"
        cancelLabel="Cancel"
        message={ask ? showAgainWords(ask) : ""}
      />
    </div>
  );
}
