"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "SHOW TO CUSTOMERS" - THE SWITCH.  (Mock 207-6, approved by Sana 23 Oct 2026)
//
// "the Approved Stores Can Be Hide from Customer App Until i turn on to Show
// to customer in customer App."  Q1 = yes: every shop live today stays shown.
// Q2 = yes: only the MAIN ADMIN switches it - the server refuses everybody
// else (app_guard "__super__" + the door itself); here a sub-admin sees it
// locked, so nobody presses a button the server will refuse.
//
// Used on the Stores list (Live and Hidden lists) and on a store's own page.
// Turning it ON or OFF always asks once first (pictures 207-6 G and H).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";

export function CustomersSeeSwitch({ shop, isMain, onChanged, size = "sm" }: {
  shop: any; isMain: boolean; onChanged: () => void; size?: "sm" | "md";
}) {
  const shown = shop?.is_approved === true;
  const [ask, setAsk] = useState<null | "on" | "off">(null);
  const [busy, setBusy] = useState(false);
  const name = shop?.name || "This shop";
  const products = typeof shop?.product_count === "number" ? shop.product_count : null;

  const run = async () => {
    try {
      setBusy(true);
      const res: any = await apiClient.setShownToCustomers(String(shop.id), ask === "on");
      toast(res?.message || (ask === "on" ? `${name} is shown to customers now` : `${name} is hidden now`), "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  const w = size === "md" ? "h-[26px] w-[46px]" : "h-[22px] w-[40px]";
  const knob = size === "md" ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]";
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        data-customers-see
        disabled={!isMain || busy}
        onClick={() => setAsk(shown ? "off" : "on")}
        aria-label={`${shown ? "Hide" : "Show"} ${name} ${shown ? "from" : "to"} customers`}
        title={!isMain ? "Locked: only the main admin can change this."
          : shown ? "Shown to customers - click to hide it" : "Hidden from customers - click to show it"}
        className={`relative inline-block shrink-0 rounded-full border-[1.5px] transition disabled:cursor-not-allowed ${w} ${
          !isMain ? "border-[#BDBDBD] bg-[#EFEFEF]"
          : shown ? "border-takal-ink bg-takal-yellow" : "border-takal-ink bg-[#D9D9D9]"}`}
      >
        <span className={`absolute top-1/2 -translate-y-1/2 rounded-full border-[1.5px] transition-all ${knob} ${
          !isMain ? "left-[2px] border-[#BDBDBD] bg-white"
          : shown ? "right-[2px] border-takal-ink bg-takal-ink" : "left-[2px] border-takal-ink bg-white"}`} />
      </button>

      <ConfirmDialog
        open={ask === "on"}
        busy={busy}
        danger={false}
        onCancel={() => setAsk(null)}
        onConfirm={run}
        title={`Show ${name} to customers now?`}
        confirmLabel="Show to customers"
        cancelLabel="Not yet"
        message={
          <>
            Customers in range will see the shop
            {products !== null ? <> and its <b>{products} product{products === 1 ? "" : "s"}</b></> : null} straight
            away - on Home, in search and on its own page.
            {shop?.is_open === false && (
              <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
                Its own switch is <b>Closed</b>, so it takes no orders until the owner opens it. He is told.
              </span>
            )}
            <span className="mt-3 block text-takal-ink-soft">
              The vendor gets: <b className="text-takal-ink">&ldquo;Your shop is live - customers can see {name} now.&rdquo;</b>
            </span>
          </>
        }
      />
      <ConfirmDialog
        open={ask === "off"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={run}
        title={`Hide ${name} from customers?`}
        confirmLabel="Hide from customers"
        cancelLabel="Keep it shown"
        message={
          <>
            It disappears for customers at once. It stays <b>approved</b>, and the vendor can
            still sign in and change his products.
            <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
              A shop with an order still going cannot be hidden - finish those orders first.
            </span>
          </>
        }
      />
    </>
  );
}

/** The chip beside the switch: Shown / Hidden - not shown yet. */
export function CustomersSeeChip({ shop }: { shop: any }) {
  return shop?.is_approved === true ? (
    <span className="whitespace-nowrap rounded-full bg-takal-green-soft px-2 py-0.5 text-[11px] font-bold text-takal-green">
      Shown
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-takal-orange-soft px-2 py-0.5 text-[11px] font-bold text-[#B23E10]"
      title="Approved by Takal, not shown to customers yet">
      Hidden · not shown yet
    </span>
  );
}
