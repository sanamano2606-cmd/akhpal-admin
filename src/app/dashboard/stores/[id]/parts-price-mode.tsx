// ─────────────────────────────────────────────────────────────────────────────
// HOW TAKAL EARNS FROM THIS STORE - standard or fixed-price.  (Plan Step 5b,
// Mock 171-3, APPROVED by Sana 8 October 2026; "Do all what you suggest".)
//
//   Standard     the shop sets its own prices; Takal takes commission and adds
//                markup (the Commission page).
//   Fixed-price  Takal sets a buying and a selling price for every product;
//                the vendor is paid the buying price; no commission, no
//                markup; Takal earns the difference.
//
// Pressing Save never switches at once: a window says first what will happen,
// with this store's own numbers - and offers "Fill buying prices first".
// The switch itself is the server's (routers/fixed_prices.py set_price_mode):
// refused while an order is unfinished; selling prices set to what customers
// pay today; commission and markup set to 0. Needs "Store prices".
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { canAccess } from "@/lib/perms";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Modal } from "@/components/ui";
import { sellingAfterSwitch, type StorePrices } from "@/lib/fixed-prices";

type Mode = "standard" | "fixed";

export function PriceModeCard({ store, onSaved, onFillBuyingFirst }: {
  store: any;
  onSaved: () => void;
  /** "Fill buying prices first": open the products with a Buying column. */
  onFillBuyingFirst: () => void;
}) {
  const known = store && Object.prototype.hasOwnProperty.call(store, "price_mode");
  const now: Mode = store?.price_mode === "fixed" ? "fixed" : "standard";
  const [choice, setChoice] = useState<Mode>(now);
  const [asking, setAsking] = useState(false);
  const [prices, setPrices] = useState<StorePrices | null>(null);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const allowed = canAccess("stores.prices");
  useEffect(() => { setChoice(now); }, [now]);

  const commission = store?.commission_percent;
  const markup = store?.menu_markup_percent;

  const openAsk = async () => {
    setRefused(null);
    setAsking(true);
    if (choice === "fixed") {
      setPrices(null);
      setReadFailed(null);
      try {
        setPrices(await apiClient.getStorePrices(String(store.id)));
      } catch (err) {
        setReadFailed(err instanceof Error ? err.message : "The products could not be read");
      }
    }
  };

  const doSwitch = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const res = await apiClient.setPriceMode(String(store.id), choice);
      toast(res.message || (choice === "fixed"
        ? `${store.name} is a fixed-price store now${res.selling_prices_set ? ` - ${res.selling_prices_set} selling prices set` : ""}`
        : `${store.name} is a standard store again`), "success");
      setAsking(false);
      onSaved();
    } catch (err) {
      setRefused(err instanceof Error ? err.message : "Nothing was changed - try again");
    } finally {
      setBusy(false);
    }
  };

  // The example line: a real product of THIS store.
  const sample = prices?.items.find((i) => i.selling_price > 0 && !i.options.some((o) => o.kind === "size" && o.has_own_price));
  const missing = prices?.counts.missing ?? null;

  const option = (m: Mode, title: string, words: React.ReactNode) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 ${choice === m ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line bg-white"} ${!allowed || !known ? "cursor-not-allowed opacity-70" : ""}`}>
      <input type="radio" name="price-mode" checked={choice === m} disabled={!allowed || !known || busy}
        onChange={() => setChoice(m)} className="mt-1 h-5 w-5 accent-black" />
      <span>
        <b className="text-takal-ink">{title}</b>
        <span className="block text-[13px] text-takal-ink-soft">{words}</span>
      </span>
    </label>
  );

  return (
    <div className="rounded-xl border border-takal-line p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-takal-ink">How Takal earns from this store</h3>
        <p className="text-[13px] text-takal-ink-soft">
          Only someone with the permission &ldquo;Store prices&rdquo; can change this (the Main Admin at first).
        </p>
      </div>
      {!known && (
        <p className="rounded-lg bg-takal-orange-soft px-3 py-2 text-[13px] text-[#C8410F]">
          Fixed-price stores are not switched on in the database yet (migration 125). Every store is standard until then.
        </p>
      )}
      {option("standard", "Standard - the shop sets its own prices",
        <>Takal takes commission{commission != null ? ` (${commission}%)` : ""} and adds markup{markup != null ? ` (${markup}%)` : ""}, from the Commission page.</>)}
      {option("fixed", "Fixed-price - Takal sets a buying and a selling price for every product",
        "The vendor is paid the buying price. The customer pays the selling price. No commission, no markup. Takal earns the difference.")}
      <div className="flex items-center justify-between gap-3">
        {!allowed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-takal-ink-soft"><Lock className="w-4 h-4" /> You can see this, not change it.</span>
        ) : <span />}
        <button onClick={openAsk} disabled={!allowed || !known || choice === now || busy}
          className="rounded-lg bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
          Save
        </button>
      </div>
      <p className="rounded-xl border-[1.5px] border-[#BBD3E8] bg-takal-blue-soft px-3 py-2 text-[13px] text-takal-blue">
        <b>Commission page:</b> a fixed-price store shows &ldquo;Fixed-price store - no commission, no markup&rdquo; and its boxes are locked.
        A <b>new</b> store can be made fixed-price on the &ldquo;Create store&rdquo; form, from its first day.
      </p>

      <Modal open={asking} onClose={() => { if (!busy) setAsking(false); }} size="lg" lockClose={busy}
        title={choice === "fixed" ? `Make “${store?.name}” a fixed-price store?` : `Make “${store?.name}” a standard store again?`}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button onClick={() => setAsking(false)} disabled={busy}
              className="rounded-lg border border-takal-line px-4 py-2 hover:bg-takal-page">Cancel</button>
            {choice === "fixed" && (
              <button onClick={() => { setAsking(false); onFillBuyingFirst(); }} disabled={busy}
                className="rounded-lg border-2 border-takal-yellow bg-white px-4 py-2 font-bold text-takal-ink hover:bg-takal-yellow-soft">
                Fill buying prices first
              </button>
            )}
            <button onClick={doSwitch} disabled={busy}
              className="rounded-lg bg-takal-yellow px-4 py-2 font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
              {busy ? "Switching…" : choice === "fixed" ? "Yes, make it fixed-price" : "Yes, make it standard"}
            </button>
          </div>
        }>
        {choice === "fixed" ? (
          <ul className="list-disc space-y-2.5 pl-5 text-sm text-takal-ink">
            <li>
              <b>Customers see no change today:</b> each product&apos;s selling price becomes what customers pay now
              (shop price{markup != null ? ` + ${markup}% markup` : " + the markup they pay now"}).
              {sample && markup != null && (
                <span className="block text-[13px] text-takal-ink-soft">
                  Example: {sample.name} - shop price {money(sample.selling_price)} → selling price{" "}
                  <b className="text-takal-ink">{money(sellingAfterSwitch(sample.selling_price, Number(markup)))}</b>.
                </span>
              )}
            </li>
            <li><b>Commission and markup become 0</b> for this store.</li>
            <li>
              <b>Every product, size and extra needs a buying price</b> before customers can order it.{" "}
              {missing === null && !readFailed ? <Loader2 className="inline w-4 h-4 animate-spin" />
                : missing !== null ? (
                  <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${missing > 0 ? "bg-takal-red-soft text-takal-red" : "bg-takal-green-soft text-takal-green"}`}>
                    {missing > 0 ? `${missing} still need one` : "every one has one"}
                  </span>
                ) : null}
              <span className="block text-[13px] text-takal-ink-soft">
                &ldquo;Fill buying prices first&rdquo; opens the product list with a Buying column you can fill now - the
                store keeps selling as it is until you switch.
              </span>
            </li>
            <li><b>The vendor can no longer</b> change prices or add products in the Partners app. They can still switch items on/off and set stock.</li>
            <li><b>Past orders do not change.</b> Each order keeps the prices it was placed with.</li>
            {readFailed && <li className="text-takal-red">The products could not be read just now ({readFailed}).</li>}
            {missing !== null && missing > 0 && (
              <li className="list-none -ml-5 rounded-xl border-[1.5px] border-[#F5B5BC] bg-takal-red-soft px-3 py-2 text-takal-red">
                ⛔ If you switch now, the {missing} product{missing === 1 ? "" : "s"} without a buying price <b>cannot be ordered</b> until you add one.
              </li>
            )}
          </ul>
        ) : (
          <ul className="list-disc space-y-2.5 pl-5 text-sm text-takal-ink">
            <li><b>Prices stay exactly as they are.</b> What the customer pays today becomes the shop&apos;s own price.</li>
            <li><b>Commission and markup stay 0</b> until somebody with &ldquo;Shop money &amp; promotion&rdquo; sets them on the Commission page - so no customer sees a price jump.</li>
            <li><b>The vendor is paid the shop&apos;s price</b> again, less commission. The buying prices are kept, unused, in case the store is switched back.</li>
            <li><b>Past orders do not change.</b></li>
          </ul>
        )}
        {refused && <p className="mt-3 rounded-lg bg-takal-red-soft px-3 py-2 text-sm font-bold text-takal-red">✕ {refused}</p>}
      </Modal>
    </div>
  );
}
