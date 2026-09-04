"use client";

/**
 * WHAT ONE DISCOUNT CODE HAS COST.
 *
 * A screen that did not exist. Nothing anywhere added up what a code had given
 * away — not the Discount Codes list, not Reports, not the Earnings tab. A
 * 50%-off code could run for a month and the only way to find out what it cost
 * was to add it up by hand from the orders, which nobody was ever going to do.
 *
 * NOTHING HERE IS NEW DATA. Every figure is already recorded against every
 * redemption: the customer, the order, the moment, and the exact discount.
 * This is the first thing that reads it back.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { money, fmtDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";
import { downloadCsv } from "@/lib/csv";

export function PromoCostPanel({
  promo,
  onClose,
}: {
  promo: any | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!promo?.id) return;
    let alive = true;
    setLoading(true);
    setError("");
    apiClient
      .getPromoCost(String(promo.id))
      .then((r: any) => alive && setData(r))
      .catch((e) => alive && setError(errorMessage(e, "what this code has cost")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [promo?.id]);

  if (!promo) return null;

  const uses: any[] = data?.uses || [];

  const exportCsv = () => {
    downloadCsv(
      `promo-${promo.code}-uses.csv`,
      uses.map((u) => ({
        customer: u.user_id || "",
        order: u.order_id || "",
        when: u.redeemed_at || "",
        cost: u.discount ?? "",
      })),
      [
        { key: "customer", label: "Customer" },
        { key: "order", label: "Order" },
        { key: "when", label: "When" },
        { key: "cost", label: "Discount given" },
      ],
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`What ${promo.code} has cost`}
      hint={(promo.gives || []).join(" + ") || "this code gives nothing"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {uses.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>
              Export
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-takal-ink-soft">Reading the uses…</p>
      ) : error ? (
        <p className="text-sm text-[#C8410F]">{error}</p>
      ) : data?.readable === false ? (
        /* NOT a confident zero. The read failed, and saying "never used" here
           would be the panel inventing an answer it does not have. */
        <p className="text-sm text-[#C8410F]">
          The record of this code&apos;s uses could not be read, so nothing is
          shown. This is not the same as &quot;never used&quot;.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-takal-line bg-takal-line sm:grid-cols-4">
            <Figure label="Times used" value={String(data.times_used)} />
            <Figure label="Customers" value={String(data.customers)} />
            <Figure label="Given away" value={money(data.given_away)} red />
            <Figure
              label="Still running"
              value={promo.window || ""}
              small
            />
          </div>

          {data.times_used === 0 ? (
            <p className="rounded-lg bg-takal-page px-4 py-3 text-sm text-takal-ink-soft">
              This code has never been used. Nothing has been given away with it.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-takal-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-takal-line bg-takal-page text-left">
                    <th className="px-4 py-2 font-semibold">Customer</th>
                    <th className="px-4 py-2 font-semibold">Order</th>
                    <th className="px-4 py-2 font-semibold">When</th>
                    <th className="px-4 py-2 text-right font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {uses.map((u) => (
                    <tr key={u.id} className="border-b border-takal-line last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">
                        {String(u.user_id || "").slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        #{String(u.order_id || "").slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 text-takal-ink-soft">
                        {u.redeemed_at ? fmtDateTime(u.redeemed_at) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {money(u.discount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.more > 0 && (
                <p className="px-4 py-2 text-xs text-takal-ink-soft">
                  …{data.more} more. Export to see them all.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Figure({
  label,
  value,
  red,
  small,
}: {
  label: string;
  value: string;
  red?: boolean;
  small?: boolean;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">
        {label}
      </div>
      <div
        className={`mt-0.5 font-bold ${small ? "text-sm" : "text-xl"} ${
          red ? "text-takal-red" : "text-takal-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
