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
//
//   Bill price   (Mock 231, Sana 8 Nov 2026) no commission, no markup; the shop
//                lists its own prices and types its bill total for every
//                order; the shop is paid the bill, Takal earns the discount.
//                A "Low discount" warning (default 2%) flags small discounts.
//                From standard only - a fixed-price store goes back first.
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
import { DEFAULT_LOW_PERCENT } from "@/lib/bill-price";

type Mode = "standard" | "fixed" | "bill";

export function PriceModeCard({ store, onSaved, onFillBuyingFirst }: {
  store: any;
  onSaved: () => void;
  /** "Fill buying prices first": open the products with a Buying column. */
  onFillBuyingFirst: () => void;
}) {
  const known = store && Object.prototype.hasOwnProperty.call(store, "price_mode");
  const now: Mode = store?.price_mode === "fixed" ? "fixed"
    : store?.price_mode === "bill" ? "bill" : "standard";
  const lowNow = Number(store?.bill_low_discount_percent ?? DEFAULT_LOW_PERCENT);
  const [low, setLow] = useState<string>(String(lowNow));
  useEffect(() => { setLow(String(lowNow)); }, [lowNow]);
  const lowNum = Number(low);
  const lowOk = low.trim() !== "" && Number.isFinite(lowNum) && lowNum >= 0 && lowNum <= 100;
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

  const [typed, setTyped] = useState<{ message: string; rows: { name: string; buying_price: number }[] } | null>(null);

  const doSwitch = async () => {
    setBusy(true);
    setRefused(null);
    setTyped(null);
    try {
      const res = await apiClient.setPriceMode(String(store.id), choice,
        choice === "bill" ? lowNum : undefined);
      // BUYING PRICES THE VENDOR TYPED HIMSELF (money audit M9 / AREA-4-05,
      // 21 Oct 2026): from today they are what Takal pays him, so the office
      // is shown each one to check. Kept on the card after the window closes.
      if (res.vendor_buying_prices_message || (res.vendor_buying_prices ?? []).length > 0) {
        setTyped({ message: res.vendor_buying_prices_message || "", rows: res.vendor_buying_prices ?? [] });
      }
      toast(res.message || (choice === "bill" ? `${store.name} is a bill-price store now`
        : choice === "fixed"
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
      {typed && (
        <div data-vendor-typed className="rounded-lg bg-takal-orange-soft px-3 py-2 text-[13px] text-[#C8410F]">
          <p className="font-bold">{typed.message || "These buying prices were typed by the vendor - check them."}</p>
          {typed.rows.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {typed.rows.map((r, i) => (
                <li key={i}>{r.name} - {money(r.buying_price)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!known && (
        <p className="rounded-lg bg-takal-orange-soft px-3 py-2 text-[13px] text-[#C8410F]">
          Fixed-price stores are not switched on yet. Every store is standard until then.
        </p>
      )}
      {option("standard", "Standard - the shop sets its own prices",
        <>Takal takes commission{commission != null ? ` (${commission}%)` : ""} and adds markup{markup != null ? ` (${markup}%)` : ""}, from the Commission page.</>)}
      {option("fixed", "Fixed-price - Takal sets a buying and a selling price for every product",
        "The vendor is paid the buying price. The customer pays the selling price. No commission, no markup. Takal earns the difference.")}
      {option("bill", "Bill price - the shop types its bill total for every order",
        <>No commission, no markup. Products are listed at the shop&apos;s own price. For every order the shop types its bill
          total; the shop is paid the bill, and the discount is Takal&apos;s earning. The shop only ever sees its own prices.
          <span className="mt-1 block rounded-lg bg-[#F2F2EF] px-2 py-1 text-[12.5px]">Listed Rs 2,000 · bill Rs 1,880 · Takal earns Rs 120</span></>)}
      {choice === "bill" && (
        <label data-low-discount className="flex flex-wrap items-center gap-2 text-sm text-takal-ink">
          Warn me when a bill&apos;s discount is under
          <input value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" disabled={!allowed || busy}
            className={`w-20 rounded-lg border px-2 py-1 font-bold ${lowOk ? "border-takal-line" : "border-takal-red"}`} />
          %
          <span className="text-[12.5px] text-takal-ink-soft">The order gets a yellow &ldquo;Low discount&rdquo; flag.</span>
        </label>
      )}
      <div className="flex items-center justify-between gap-3">
        {!allowed ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-takal-ink-soft"><Lock className="w-4 h-4" /> You can see this, not change it.</span>
        ) : <span />}
        <button onClick={openAsk}
          disabled={!allowed || !known || busy || !lowOk
            || (choice === now && !(choice === "bill" && lowNum !== lowNow))}
          className="rounded-lg bg-takal-yellow px-4 py-2 text-sm font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark disabled:opacity-50">
          Save
        </button>
      </div>
      <p className="rounded-xl border-[1.5px] border-[#BBD3E8] bg-takal-blue-soft px-3 py-2 text-[13px] text-takal-blue">
        <b>Commission page:</b> a fixed-price store shows &ldquo;Fixed-price store - no commission, no markup&rdquo; and its boxes are locked.
        A <b>new</b> store can be made fixed-price on the &ldquo;Create store&rdquo; form, from its first day.
      </p>

      <Modal open={asking} onClose={() => { if (!busy) setAsking(false); }} size="lg" lockClose={busy}
        title={choice === "fixed" ? `Make “${store?.name}” a fixed-price store?`
          : choice === "bill" ? (now === "bill" ? `Change the low-discount warning of “${store?.name}”?` : `Make “${store?.name}” a bill-price store?`)
          : `Make “${store?.name}” a standard store again?`}
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
              {busy ? "Switching…" : choice === "fixed" ? "Yes, make it fixed-price"
                : choice === "bill" ? (now === "bill" ? "Yes, save" : "Yes, make it bill-price") : "Yes, make it standard"}
            </button>
          </div>
        }>
        {choice === "bill" ? (
          <ul data-bill-switch className="list-disc space-y-2.5 pl-5 text-sm text-takal-ink">
            {now === "bill" ? (
              <li>From now on, a bill whose discount is under <b>{low}%</b> gets the &ldquo;Low discount&rdquo; flag. Bills already typed keep their flag.</li>
            ) : (
              <>
                {now === "fixed" && (
                  <li className="text-takal-red"><b>Make it standard first.</b> A fixed-price store&apos;s prices are Takal&apos;s selling prices, not the shop&apos;s own.</li>
                )}
                <li><b>Commission and markup become 0</b> for this store. Customers pay the shop&apos;s own listed prices.</li>
                <li><b>For every order the shop types its bill total</b> in the Partners app when it marks the order prepared. You can correct it from the paper bill on the order page.</li>
                <li><b>The shop is paid the bill.</b> Takal earns the difference. Until a bill is typed, the order is paid at the full listed price.</li>
                <li><b>A bill under {low}% discount</b> gets a yellow &ldquo;Low discount&rdquo; flag.</li>
                <li><b>Past orders do not change.</b></li>
              </>
            )}
          </ul>
        ) : choice === "fixed" ? (
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
