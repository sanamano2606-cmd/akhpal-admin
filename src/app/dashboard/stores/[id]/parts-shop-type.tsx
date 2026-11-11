// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP TYPE BOX ON STORE SETTINGS.  (Mock 222, approved by Sana 1 Nov 2026.
// Pictures: mocks/Mock 222 Shop type on Store settings/.)
//
// Sana: "there is no shop type changing Option" - she looked here, on Store
// settings. The only way was the small pencil on the Stores list (it stays).
//
//   * The box: the type, Rider or Parcel, the commission in use, and
//     "Change shop type" - which only the Main Admin and "Shop money" see,
//     the same rule as the pencil (the server's rule: stores.money).
//   * The window: the thirteen types a new shop may choose, NOW on the current
//     one, the chosen one yellow, and WHAT CHANGES in orange at the bottom.
//   * "Are you sure?" lists every change before anything is saved.
//   * A live shop cannot become a pharmacy without a checked licence - the
//     tile is locked here and the server refuses it too.
//
// It saves through the SAME door as the pencil (PUT /admin/restaurants/{id}/
// vendor-type), so the server's own checks - the licence, a mall that names
// its stores after their kind - answer in their own words.
// Rules: src/lib/shop-type-change.ts. Tests: tests/mock-222-shop-type.test.ts.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Modal, useDialogKeys } from "@/components/ui";
import { verticalEmoji, verticalLabel, VERTICALS } from "@/lib/verticals";
import { expressShopTypes, EXPRESS_TYPES_FALLBACK } from "./parts-map";
import {
  typesToOffer, isRider, deliveryWords, whyNot, whatChanges, commissionAfter,
  type LicenceView, type TypeRates, type Change,
} from "@/lib/shop-type-change";

/** The soft colour behind each type's picture (Takal palette). */
const TINT: Record<string, string> = {
  restaurant: "#FFEFE8", grocery: "#E4F1F3", pharmacy: "#E8F3EE", beauty_cosmetics: "#FBE7E9",
  clothing_store: "#EFE9F6", electronics_shop: "#E6EEF4", home_appliances: "#FFFDE0",
  baby_kids: "#FFEFE8", sports_fitness: "#E8F3EE", books_stationery: "#E6EEF4",
  pet_supplies: "#FFFDE0", flowers_gifts: "#FBE7E9", auto_parts: "#F0F0F0",
};
const tint = (code: string) => TINT[code] || "#F0F0F0";

function SpeedChip({ code, express }: { code: string; express: string[] }) {
  const rider = isRider(code, express);
  return (
    <span data-speed={rider ? "rider" : "parcel"}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
        rider ? "bg-takal-green-soft text-takal-green" : "bg-takal-purple-soft text-takal-purple"}`}>
      {rider ? "🛵" : "📦"} {deliveryWords(code, express)}
    </span>
  );
}

export function ShopTypeBox({ store, state, mayChange, onChanged }: {
  /** The shop row (GET /admin/restaurants/{id}/detail -> restaurant). */
  store: any;
  /** The detail's `state`: commission_in_use_percent, has_location, licence. */
  state: any;
  /** Main Admin or "Shop money" (stores.money) - the server checks it again. */
  mayChange: boolean;
  onChanged: () => void;
}) {
  const now = String(store?.vendor_type || "").trim() || "restaurant";
  const [express, setExpress] = useState<string[]>(EXPRESS_TYPES_FALLBACK);
  const [rates, setRates] = useState<TypeRates>(null);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(now);
  const [sure, setSure] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    expressShopTypes().then((t) => { if (alive) setExpress(t); });
    return () => { alive = false; };
  }, []);
  // The type rates are read only when somebody may change the type, and a
  // refusal (no "Commission" permission) simply leaves them unknown - the
  // window then says the rate is set by the type, never a guessed figure.
  useEffect(() => {
    if (!mayChange) return;
    let alive = true;
    apiClient.getVerticalCommissions()
      .then((res: any) => {
        const m: Record<string, number | null> = {};
        for (const it of res?.items || []) m[String(it.vendor_type)] = it.commission_percent ?? null;
        if (alive) setRates(m);
      })
      .catch(() => { if (alive) setRates(null); });
    return () => { alive = false; };
  }, [mayChange]);

  const commission = {
    fixed: store?.price_mode === "fixed",
    own: store?.commission_percent ?? null,
    inUse: state?.commission_in_use_percent ?? null,
  };
  const commissionNow = commissionAfter(commission, now, now, rates).words;
  const lic: LicenceView = state?.licence ?? null;
  const hasPin = state?.has_location !== false;
  const blocked = whyNot(pick, store || {}, lic);
  const changes: Change[] = whatChanges({ from: now, to: pick, express, hasPin, commission, rates });

  const start = () => { setPick(now); setOpen(true); };
  const shut = () => { if (!saving) { setOpen(false); setSure(false); } };
  useDialogKeys(open && !sure, shut, saving);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.setRestaurantVendorType(String(store.id), pick);
      toast(`Shop type changed to ${verticalLabel(pick)}`, "success");
      setSure(false); setOpen(false);
      onChanged();
    } catch (err) {
      // The server's own words: the licence, a mall's names, a refused type.
      toast(err instanceof Error ? err.message : "The shop type could not be changed", "error");
      setSure(false);
    } finally {
      setSaving(false);
    }
  };

  const offered = typesToOffer(now);

  return (
    <div data-shop-type-box>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-xs font-bold tracking-wide text-takal-ink-soft">SHOP TYPE</span>
        <span className="text-xs text-takal-ink-soft">🔑 Only the Main Admin and &quot;Shop money&quot; can change it</span>
      </div>
      <div className="group flex flex-wrap items-center gap-3.5 rounded-xl border-[1.5px] border-takal-line bg-white px-4 py-3.5 transition hover:border-takal-ink hover:shadow-[0_0_0_3px_#FFFF00]">
        <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] text-[27px]" style={{ background: tint(now) }} aria-hidden>
          {verticalEmoji(now)}
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[17px] font-black leading-tight" data-shop-type-now={now}>{verticalLabel(now)}</b>
          <span className="text-[12.5px] text-takal-ink-soft">
            {VERTICALS.find((v) => v.value === now)?.examples || ""}
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SpeedChip code={now} express={express} />
            <span className="inline-flex whitespace-nowrap rounded-full bg-[#F3F3F3] px-2.5 py-0.5 text-xs font-bold">💰 Commission: {commissionNow}</span>
            <span className="inline-flex whitespace-nowrap rounded-full border border-takal-yellow-dark bg-takal-yellow-soft px-2.5 py-0.5 text-xs font-bold">🗂️ Shelves: {verticalLabel(now)} first</span>
          </div>
        </div>
        {mayChange && (
          <button type="button" onClick={start} data-change-shop-type
            className="w-full whitespace-nowrap rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-[13.5px] font-bold transition group-hover:bg-takal-yellow group-hover:shadow-[0_2px_0_#E6E600] sm:w-auto">
            ✏️ Change shop type
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-takal-ink-soft">
        Decides where customers find the shop, how its orders are delivered and its commission. Products stay on their shelves.
      </p>

      {/* ── THE WINDOW ── drawn on the page itself, like the shelf chooser */}
      {open && !sure && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) shut(); }}>
          <div role="dialog" aria-modal="true" aria-label="Change shop type"
            className="flex h-full w-full flex-col overflow-hidden bg-takal-card text-takal-ink shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:h-auto sm:max-h-[calc(100vh-32px)] sm:max-w-[1000px] sm:rounded-2xl">
            <div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
              <b className="flex-1 text-lg font-black">Change shop type</b>
              <button type="button" aria-label="Close" onClick={shut}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-takal-ink-soft hover:bg-takal-page">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="shrink-0 border-b border-takal-line px-4 pb-3 text-[13px] text-takal-ink-soft sm:px-5">
              {store?.name || "This shop"} is <b className="text-takal-ink">{verticalLabel(now)}</b> now. Choose its new type.
            </p>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-y-auto px-3 py-3.5 sm:grid-cols-2 sm:px-5 lg:grid-cols-3" role="radiogroup" aria-label="Shop types">
              {offered.map((v) => {
                const chosen = v.value === pick, isNow = v.value === now;
                const locked = !!whyNot(v.value, store || {}, lic);
                return (
                  <button key={v.value} type="button" role="radio" aria-checked={chosen}
                    data-type-tile={v.value} data-locked={locked || undefined}
                    onClick={() => setPick(v.value)}
                    className={`relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                      chosen ? "border-2 border-takal-ink bg-takal-yellow shadow-[0_3px_0_#000]"
                        : isNow ? "border-[1.5px] border-takal-ink bg-white hover:bg-takal-page"
                        : "border-[1.5px] border-takal-line bg-white hover:border-takal-ink"}`}>
                    {isNow && <span className="absolute -top-2 right-2.5 rounded-md bg-takal-ink px-2 py-px text-xs font-black tracking-wide text-takal-yellow">NOW</span>}
                    {chosen && <span aria-hidden className="absolute right-2.5 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-takal-ink text-[12px] font-black text-takal-yellow">✓</span>}
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] text-[21px]" style={{ background: chosen ? "#fff" : tint(v.value) }} aria-hidden>{v.emoji}</span>
                    <span className="min-w-0 pr-6">
                      <b className={`block text-[14.5px] font-bold leading-tight ${locked && !chosen ? "text-takal-disabled-text" : ""}`}>{v.label}</b>
                      <span className={`mb-1.5 mt-0.5 block text-xs ${chosen ? "text-takal-ink" : "text-takal-ink-soft"}`}>{v.examples}</span>
                      <SpeedChip code={v.value} express={express} />
                      {locked && <span className="mt-1.5 block text-xs font-bold text-takal-red">🔒 Needs a checked drug sale licence</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 border-t border-takal-line bg-takal-page px-4 pb-3.5 pt-3 sm:px-5">
              <p className="mb-2 text-xs font-black tracking-wider text-takal-ink-soft">WHAT CHANGES</p>
              {blocked ? (
                <div data-cannot-change className="mb-3 rounded-[10px] border-[1.5px] border-takal-red bg-takal-red-soft px-3 py-2 text-[12.5px]">
                  <b className="block text-xs text-takal-red">🔒 CANNOT CHANGE YET</b>{blocked}
                </div>
              ) : (
                <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {changes.filter((c) => c.key !== "pin").map((c) => (
                    <div key={c.key} data-change={c.key} data-changes={String(c.changes)}
                      className={`rounded-[10px] border px-2.5 py-2 text-[12.5px] ${
                        c.changes ? "border-[1.5px] border-takal-orange bg-takal-orange-soft" : "border-takal-line bg-white"}`}>
                      <b className={`block text-xs ${c.changes ? "text-[#B23A0E]" : "text-takal-ink-soft"}`}>
                        {c.title.toUpperCase()} · {c.changes == null ? "CHECK" : c.changes ? "CHANGES" : "SAME"}
                      </b>
                      {c.words}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <p className="min-w-0 flex-1 basis-full text-[12.5px] text-takal-ink-soft sm:basis-0">
                  {blocked ? "Nothing has been changed."
                    : pick === now ? "Choose a different type to change it."
                    : changes.find((c) => c.key === "pin")?.bad ? "⚠️ A rider will carry its orders - it has no map pin yet."
                    : changes.find((c) => c.key === "pin") ? "🛵 A rider will carry its orders. ✓ Its map pin is set."
                    : "Nothing is saved until you say yes."}
                </p>
                <button type="button" onClick={shut}
                  className="flex-1 rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-[13.5px] font-bold sm:flex-none">Cancel</button>
                <button type="button" data-go-change disabled={pick === now || !!blocked} onClick={() => setSure(true)}
                  className="flex-1 rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-4 py-2 text-[13.5px] font-bold shadow-[0_2px_0_#E6E600] disabled:border-[#d6d6d6] disabled:bg-[#e7e7e7] disabled:text-[#888] disabled:shadow-none sm:flex-none">
                  Change shop type
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── ARE YOU SURE? ── every change, before anything is saved */}
      <Modal open={sure} onClose={() => !saving && setSure(false)} lockClose={saving} size="sm"
        title={`Change ${store?.name || "this shop"} to ${verticalLabel(pick)}?`}
        footer={<>
          <button type="button" disabled={saving} onClick={() => setSure(false)}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-4 py-2 text-[13.5px] font-bold">No, keep {verticalLabel(now)}</button>
          <button type="button" data-yes-change disabled={saving} onClick={save}
            className="rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-4 py-2 text-[13.5px] font-bold shadow-[0_2px_0_#E6E600] disabled:opacity-60">
            {saving ? "Changing…" : "Yes, change it"}
          </button>
        </>}>
        <p className="mb-3 text-[13.5px] text-takal-ink-soft">Please read what will be different before you say yes.</p>
        <ul className="flex flex-col gap-2" data-sure-list>
          {sureLines(changes, now, pick, express).map((l) => (
            <li key={l.key} data-sure={l.key}
              className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2 text-[13.5px] leading-snug ${
                l.tone === "bad" ? "border-takal-red bg-takal-red-soft"
                  : l.tone === "good" ? "border-[#9CCBB3] bg-takal-green-soft"
                  : l.tone === "change" ? "border-takal-orange bg-takal-orange-soft"
                  : "border-takal-line"}`}>
              <span aria-hidden className="text-[17px] leading-none">{l.icon}</span><span>{l.words}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

/** The "Are you sure?" lines, in plain sentences. */
function sureLines(changes: Change[], from: string, to: string, express: string[]) {
  const get = (k: Change["key"]) => changes.find((c) => c.key === k);
  const lines: { key: string; icon: string; tone: "change" | "bad" | "good" | "same"; words: string }[] = [];
  lines.push({ key: "where", icon: "🗂️", tone: "change",
    words: `Customers will find it under ${verticalLabel(to)}, not ${verticalLabel(from)}.` });
  const d = get("delivery");
  lines.push(d?.changes
    ? { key: "delivery", icon: isRider(to, express) ? "🛵" : "📦", tone: "change",
        words: isRider(to, express)
          ? "A rider will deliver its orders in minutes. It is not a 1–3 day parcel any more."
          : "Its orders will go as parcels in 1–3 days. A rider will not carry them any more." }
    : { key: "delivery", icon: isRider(to, express) ? "🛵" : "📦", tone: "same",
        words: `Delivery stays the same: ${deliveryWords(to, express)}.` });
  const pin = get("pin");
  if (pin) lines.push(pin.bad
    ? { key: "pin", icon: "📍", tone: "bad", words: "No map pin. Customers cannot see a rider-delivered shop until it is placed on the map." }
    : { key: "pin", icon: "📍", tone: "good", words: "Map pin is set, so the rider knows where to collect." });
  const c = get("commission");
  lines.push({ key: "commission", icon: "💰", tone: c?.changes ? "change" : "same",
    words: c?.changes == null ? `Commission: ${c?.words}.`
      : c.changes ? `Commission changes to: ${c.words}.` : `Commission stays: ${c.words}.` });
  lines.push({ key: "products", icon: "📦", tone: "same",
    words: "Its products stay on their shelves. Orders already placed carry on as they are." });
  return lines;
}
